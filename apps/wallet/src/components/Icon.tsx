const PATHS = {
  shield: ["M12 3l7 3v5.5c0 4.4-2.9 8.1-7 9.5-4.1-1.4-7-5.1-7-9.5V6l7-3z", "M8.8 12.2l2.3 2.3 4.2-4.6"],
  check: ["M5 12.5l4.5 4.5L19 7.5"],
  cross: ["M6 6l12 12M18 6L6 18"],
  back: ["M15 6l-6 6 6 6"],
  forward: ["M9 6l6 6-6 6"],
  plus: ["M12 5v14M5 12h14"],
  clock: ["M12 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17z", "M12 7.5V12l3 2"],
  camera: ["M4 8h3l1.5-2h7L17 8h3v11H4z", "M12 9.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z"],
  upload: ["M12 16V5M7.5 9.5L12 5l4.5 4.5M5 19h14"],
  lock: ["M7 11h10a2 2 0 012 2v5a2 2 0 01-2 2H7a2 2 0 01-2-2v-5a2 2 0 012-2z", "M8.5 11V8a3.5 3.5 0 017 0v3"],
  document: ["M7 3h7l4 4v14H7z", "M14 3v4h4M10 12h5M10 16h5"],
  qr: ["M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z", "M14 14h2.5v2.5M20 14v6h-6v-2"],
  wallet: ["M6 6h12a3 3 0 013 3v7a3 3 0 01-3 3H6a3 3 0 01-3-3V9a3 3 0 013-3z", "M3 10h18M16 14.5h2"],
  person: ["M12 5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z", "M5 19.5c1.2-3.6 12.8-3.6 14 0"],
} as const;

export type IconName = keyof typeof PATHS;

export default function Icon({ name, size = 24, stroke = 2 }: { name: IconName; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
