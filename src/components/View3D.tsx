import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { ExerciseNode, Scenario } from '../model/types';
import type { TaskView } from '../sim/bridge';
import { generateField } from '../map/terrain';
import { defaultRoads } from '../map/roads';

interface Props {
  scenario: Scenario;
  unit: ExerciseNode;
  tasks: TaskView[];
  nowS: number;
  running: boolean;
  speed: number;
  onClose: () => void;
}

const VERT_SCALE = 0.12; // terrain height relative to map width
const GRID = 140; // terrain resolution

/** Same position logic as the 2D map: along the route while moving. */
function unitPos(n: { x: number; y: number }, t: TaskView | undefined, now: number) {
  if (t && t.arrived && t.route && t.route.length > 0 && t.departed_s !== null) {
    const r = t.route;
    const e = now - t.departed_s;
    for (let i = 0; i < r.length - 1; i++) {
      if (e <= r[i + 1].t) {
        const span = r[i + 1].t - r[i].t;
        const p = span > 0 ? (e - r[i].t) / span : 1;
        return { x: r[i].x + (r[i + 1].x - r[i].x) * p, y: r[i].y + (r[i + 1].y - r[i].y) * p };
      }
    }
    return { x: r[r.length - 1].x, y: r[r.length - 1].y };
  }
  return { x: n.x, y: n.y };
}

export function View3D({ scenario, unit, tasks, nowS, running, speed, onClose }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const destLabelRef = useRef<HTMLDivElement>(null);
  // Snapshots arrive about once a second. Between them, the clock is extrapolated from the
  // wall clock so motion is smooth while running.
  const snapAt = useRef({ at: performance.now(), now: nowS });
  useEffect(() => {
    snapAt.current = { at: performance.now(), now: nowS };
  }, [nowS]);
  const W = scenario.map.width;
  const H = scenario.map.height;
  const hasElevation = !scenario.terrain?.image;

  // Heights sampled from the same procedural field as the 2D map.
  const heights = useMemo(() => {
    if (!hasElevation) return null;
    const f = generateField(GRID, Math.round(GRID * H / W), scenario.terrain?.seed ?? 1);
    return { f, rows: Math.round(GRID * H / W) };
  }, [W, H, hasElevation, scenario.terrain?.seed]);

  // Latest state for the animation loop.
  const live = useRef({ tasks, unit, scenario, running, speed });
  live.current = { tasks, unit, scenario, running, speed };

  useEffect(() => {
    const el = mountRef.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.setClearColor(0x0a1322);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0a1322, W * 0.9, W * 2.2);
    const camera = new THREE.PerspectiveCamera(55, el.clientWidth / el.clientHeight, 1, W * 5);
    // Start behind the unit at a low angle. The user can then orbit and zoom; the target stays on the unit.
    const start = unitPos(unit, tasks.find((x) => x.id === unit.id), snapAt.current.now);
    camera.position.set(start.x, W * 0.09, start.y + W * 0.12);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = W * 0.02;
    controls.maxDistance = W * 0.5;
    controls.maxPolarAngle = Math.PI * 0.48; // keep the camera above the ground
    controls.target.set(start.x, 0, start.y);

    scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x2a3a22, 1.1));
    const sun = new THREE.DirectionalLight(0xfff1d6, 1.4);
    sun.position.set(-W * 0.4, W * 0.8, W * 0.3);
    scene.add(sun);

    // Ground: a heightfield from the map's terrain, or a flat plane for uploaded maps.
    const geo = new THREE.PlaneGeometry(W, H, GRID - 1, (heights?.rows ?? 2) - 1);
    geo.rotateX(-Math.PI / 2);
    if (heights) {
      const pos = geo.attributes.position as THREE.BufferAttribute;
      const { f, rows } = heights;
      for (let i = 0; i < pos.count; i++) {
        const gx = i % GRID;
        const gz = Math.floor(i / GRID);
        const e = f.elev[Math.min(rows - 1, gz) * GRID + Math.min(GRID - 1, gx)];
        pos.setY(i, e * W * VERT_SCALE);
      }
      geo.computeVertexNormals();
    }
    const colour = new THREE.Color(hasElevation ? 0x4e6b3a : 0x3a4a33);
    const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: colour, flatShading: false }));
    ground.position.set(W / 2, 0, H / 2);
    scene.add(ground);

    // Roads as lines on the ground.
    const roadMat = new THREE.LineBasicMaterial({ color: 0xd9ccaa });
    for (const r of scenario.roads?.length ? scenario.roads : defaultRoads(W, H)) {
      const pts = r.points.map(([x, y]) => new THREE.Vector3(x, groundY(x, y) + 2, y));
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), roadMat));
    }

    function groundY(x: number, y: number): number {
      if (!heights) return 0;
      const { f, rows } = heights;
      const gx = Math.min(GRID - 1, Math.max(0, Math.round((x / W) * (GRID - 1))));
      const gz = Math.min(rows - 1, Math.max(0, Math.round((y / H) * (rows - 1))));
      return f.elev[gz * GRID + gx] * W * VERT_SCALE;
    }

    // Unit beacon: a bright core, a breathing halo, and a ring that pulses out along the ground.
    const beacon = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(W * 0.0055, 20, 14),
      new THREE.MeshStandardMaterial({ color: 0x2f7df6, emissive: 0x1d4fb8, emissiveIntensity: 1.4 }),
    );
    core.position.y = W * 0.02;
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(W * 0.009, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.25, depthWrite: false }),
    );
    halo.position.y = W * 0.03;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(W * 0.012, W * 0.016, 40),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    beacon.add(core, halo, ring);
    scene.add(beacon);
    const marker = beacon; // position and colour are driven below

    // Destination marker: an amber pillar and ring at the end of the route, labelled with the node name.
    const destGroup = new THREE.Group();
    const destPillar = new THREE.Mesh(
      new THREE.CylinderGeometry(W * 0.003, W * 0.003, W * 0.05, 12),
      new THREE.MeshStandardMaterial({ color: 0xf5b400, emissive: 0x7a5a00, emissiveIntensity: 0.8 }),
    );
    destPillar.position.y = W * 0.025;
    const destRing = new THREE.Mesh(
      new THREE.RingGeometry(W * 0.012, W * 0.015, 40),
      new THREE.MeshBasicMaterial({ color: 0xf5b400, side: THREE.DoubleSide, transparent: true, opacity: 0.8, depthWrite: false }),
    );
    destRing.rotation.x = -Math.PI / 2;
    destRing.position.y = 1;
    destGroup.add(destPillar, destRing);
    destGroup.visible = false;
    scene.add(destGroup);

    // Route line for a moving unit.
    const routeMat = new THREE.LineDashedMaterial({ color: 0x7dd3fc, dashSize: W * 0.01, gapSize: W * 0.006 });
    let routeLine: THREE.Line | null = null;

    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const { tasks: ts, unit: u, running: isRunning, speed: sp } = live.current;
      const elapsedS = (performance.now() - snapAt.current.at) / 1000;
      const now = isRunning ? snapAt.current.now + elapsedS * sp : snapAt.current.now;
      const t = ts.find((x) => x.id === u.id);
      const p = unitPos(u, t, now);
      const y = groundY(p.x, p.y);
      marker.position.set(p.x, y + W * 0.015, p.y);
      const colour = t?.state === 'complete' ? 0x22c55e : t?.state === 'active' ? 0x38bdf8 : 0x2f7df6;
      (core.material as THREE.MeshStandardMaterial).color.set(colour);
      (core.material as THREE.MeshStandardMaterial).emissive.set(colour).multiplyScalar(0.35);
      (halo.material as THREE.MeshBasicMaterial).color.set(colour);
      (ring.material as THREE.MeshBasicMaterial).color.set(colour);
      const holding = t?.state === 'arrived';

      // Breathing: a slow swell and fade, faster while the unit is moving or working.
      const period = t?.state === 'moving' || t?.state === 'active' ? 1.6 : holding ? 1.2 : 2.6;
      const phase = (Math.sin((performance.now() / 1000) * (2 * Math.PI / period)) + 1) / 2;
      halo.scale.setScalar(0.85 + 0.45 * phase);
      core.scale.setScalar(0.9 + 0.2 * phase);
      (halo.material as THREE.MeshBasicMaterial).opacity = 0.05 + 0.18 * phase;
      const ringPhase = (performance.now() / 1000 / period) % 1;
      ring.scale.setScalar(1 + ringPhase * 3);
      (ring.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - ringPhase);
      ring.position.y = -W * 0.015 + 0.5;

      if (routeLine) {
        scene.remove(routeLine);
        routeLine.geometry.dispose();
        routeLine = null;
      }
      if (t?.state === 'moving' && t.route && t.route.length > 1) {
        const pts = t.route.map((q) => new THREE.Vector3(q.x, groundY(q.x, q.y) + W * 0.004, q.y));
        routeLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), routeMat);
        routeLine.computeLineDistances();
        scene.add(routeLine);
      }

      // Destination marker and label while moving.
      const label = destLabelRef.current;
      const dst = t?.state === 'moving' && t.route && t.route.length > 1 ? t.route[t.route.length - 1] : null;
      if (dst) {
        const dy = groundY(dst.x, dst.y);
        destGroup.visible = true;
        destGroup.position.set(dst.x, dy, dst.y);
        destRing.scale.setScalar(1 + 0.25 * Math.sin(performance.now() / 300));
        const node = live.current.scenario.nodes.find((n) => n.id === u.assignment.destinationId);
        const v = new THREE.Vector3(dst.x, dy + W * 0.06, dst.y).project(camera);
        if (label) {
          const visible = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
          label.style.display = visible ? 'block' : 'none';
          label.style.left = `${((v.x + 1) / 2) * el.clientWidth}px`;
          label.style.top = `${((1 - v.y) / 2) * el.clientHeight}px`;
          label.textContent = `Destination: ${node?.name ?? 'unknown'}`;
        }
      } else {
        destGroup.visible = false;
        if (label) label.style.display = 'none';
      }

      // Orbit controls: the target follows the unit; the user chooses the angle and distance.
      controls.target.set(p.x, y + W * 0.01, p.y);
      controls.update();
      renderer.render(scene, camera);
    };
    tick();

    const onResize = () => {
      renderer.setSize(el.clientWidth, el.clientHeight);
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frame);
      controls.dispose();
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      geo.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [scenario, heights, W, H, hasElevation]);

  const t = tasks.find((x) => x.id === unit.id);
  return (
    <div className="view3d">
      <div ref={mountRef} className="view3dCanvas" />
      <div ref={destLabelRef} className="destLabel" style={{ display: 'none' }} />
      <div className="view3dBar">
        <span className="view3dTitle">3D view · {unit.name}</span>
        <span className="view3dState">{t ? t.state : 'not started'}</span>
        <span className="view3dNote">Simulated exercise view. Follows the unit in exercise time.</span>
        <button className="btn" onClick={onClose}>Close 3D view</button>
      </div>
    </div>
  );
}
