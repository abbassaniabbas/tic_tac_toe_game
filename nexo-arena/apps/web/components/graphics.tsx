import type { CSSProperties } from 'react';

export function Mark({ value, className = '', style }: { value: 'X' | 'O'; className?: string; style?: CSSProperties }) {
  return <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" className={`game-mark mark-${value.toLowerCase()} ${className}`} style={style}>
    {value === 'X' ? <><path d="M15 15L49 49"/><path d="M49 15L15 49"/></> : <circle cx="32" cy="32" r="23"/>}
  </svg>;
}
const paths = {
  arrow: 'M5 12h14M13 6l6 6-6 6',
  chevron: 'M9 5l7 7-7 7',
  back: 'M19 12H5m6 6-6-6 6-6',
  undo: 'M8 8H3V3m0 5 4-4a8 8 0 1 1-1 12',
  restart: 'M20 7V3h-4m4 4a8 8 0 1 0 1 8',
  settings: 'M4 7h16M4 17h16M8 4v6M16 14v6',
  sun: 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2',
  moon: 'M20 14a8 8 0 0 1-10-10 8.5 8.5 0 1 0 10 10Z',
  sound: 'M11 4 6 8H3v8h3l5 4V4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
  mute: 'M11 4 6 8H3v8h3l5 4V4Zm5 5 6 6m0-6-6 6',
  close: 'M6 6l12 12M18 6 6 18',
  check: 'M5 12l4 4L19 6',
  bolt: 'M13 2 4 14h7l-1 8 10-13h-7l0-7Z',
  people: 'M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3m15-7a4 4 0 0 1 5 4v3M15 3a4 4 0 0 1 0 8',
  bot: 'M5 8h14v12H5V8Zm7-5v5M2 12v4m20-4v4M8 16h8',
  download: 'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4',
} as const;
export function Icon({ name, size = 20, className = '' }: { name: keyof typeof paths; size?: number; className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
    <path d={paths[name]}/>{name === 'sun' && <circle cx="12" cy="12" r="4"/>}{name === 'people' && <circle cx="9" cy="7" r="4"/>}{name === 'bot' && <><path d="M8 12h1m6 0h1"/></>}
  </svg>;
}
export function Brand({ compact = false }: { compact?: boolean }) {
  return <span className="brand"><span className="brand-symbol" aria-hidden="true"><span/><span/><span/></span><span>NEXO{!compact && <span className="brand-arena">ARENA</span>}</span></span>;
}
