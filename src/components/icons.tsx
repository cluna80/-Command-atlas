// Minimal line icons, sized and coloured via CSS (currentColor).
const base = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export const BellIcon = () => (
  <svg {...base}><path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8" /><path d="M13.7 20a2 2 0 01-3.4 0" /></svg>
);
export const GearIcon = () => (
  <svg {...base}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></svg>
);
export const HelpIcon = () => (
  <svg {...base}><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 015 .5c0 1.7-2.5 2-2.5 3.5" /><path d="M12 17h.01" /></svg>
);
export const SearchIcon = () => (
  <svg {...base} width={14} height={14}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
);
export const ClockIcon = () => (
  <svg {...base}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
export const DocIcon = () => (
  <svg {...base}><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z" /><path d="M14 3v6h6M8 13h8M8 17h8" /></svg>
);
export const ClipboardIcon = () => (
  <svg {...base}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1M9 12l2 2 4-4" /></svg>
);
export const LayersIcon = () => (
  <svg {...base}><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></svg>
);
export const LocateIcon = () => (
  <svg {...base}><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>
);
export const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg {...base} width={12} height={12} style={{ transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform .15s' }}><path d="M6 9l6 6 6-6" /></svg>
);

// Section icons for the asset library.
const sec = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export const PersonnelIcon = () => (
  <svg {...sec}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" /></svg>
);
export const TeamIcon = () => (
  <svg {...sec}><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-5.2 6-5.2s6 1.9 6 5.2" /><circle cx="17" cy="9" r="2.5" /><path d="M16.5 14.2c2.6 0 4.5 1.6 4.5 4.3" /></svg>
);
export const TransportIcon = () => (
  <svg {...sec}><path d="M2 7h12v9H2z" /><path d="M14 10h4l3 3.5V16h-7" /><circle cx="6" cy="17.5" r="1.8" /><circle cx="17.5" cy="17.5" r="1.8" /></svg>
);
export const SupplyIcon = () => (
  <svg {...sec}><path d="M3 7.5L12 3l9 4.5v9L12 21l-9-4.5z" /><path d="M3 7.5l9 4.5 9-4.5M12 12v9" /></svg>
);
export const MedicalIcon = () => (
  <svg {...sec}><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" /></svg>
);
export const CommsIcon = () => (
  <svg {...sec}><circle cx="12" cy="12" r="2" /><path d="M8.5 8.5a5 5 0 000 7M15.5 8.5a5 5 0 010 7M5.6 5.6a9.5 9.5 0 000 12.8M18.4 5.6a9.5 9.5 0 010 12.8" /></svg>
);
export const EventIcon = () => (
  <svg {...sec}><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></svg>
);
