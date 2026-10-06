import type { ReactNode } from "react";

// One 24px grid, consistent padding and the same stroke for every setting.
const glyphs = {
  agent: (
    <>
      <rect x="4" y="6" width="16" height="14" rx="3" />
      <path d="M12 3v3M8 15h8M8 10v1M16 10v1" />
    </>
  ),
  account: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
    </>
  ),
  appearance: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v18M12 7h6M12 11h8M12 15h7M12 19h4" />
    </>
  ),
  language: (
    <>
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="4" ry="9" />
      <path d="M3 12h18" />
    </>
  ),
  notifications: (
    <>
      <path d="M6 10a6 6 0 0 1 12 0v5l2 3H4l2-3v-5ZM10 21h4M12 2v2" />
    </>
  ),
  followUp: (
    <>
      <path d="M14 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <path d="m11 13 1-4 6-6 3 3-6 6-4 1ZM16 5l3 3" />
    </>
  ),
  glass: (
    <>
      <path d="m10 3 2.5 6.5L19 12l-6.5 2.5L10 21l-2.5-6.5L1 12l6.5-2.5L10 3ZM20 3v4M18 5h4" />
    </>
  ),
  intensity: (
    <>
      <path d="M5.6 18.4a9 9 0 1 1 12.8 0ZM12 5v2M5 10l2 1M19 10l-2 1M12 14l4-5" />
      <circle cx="12" cy="14" r="1.5" />
    </>
  ),
  transparency: (
    <>
      <path d="M3 12s3-6 9-6 9 6 9 6-3 6-9 6-9-6-9-6Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  accent: (
    <>
      <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.9 1.2-1.8-.5-1-.1-2.2 1.1-2.2H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10Z" />
      <circle cx="7.5" cy="11" r="1" />
      <circle cx="10" cy="7" r="1" />
      <circle cx="15" cy="7.5" r="1" />
    </>
  ),
  sounds: (
    <>
      <path d="M4 9v6h4l5 4V5L8 9H4ZM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
    </>
  ),
  layout: (
    <>
      <path d="M20 5h-9a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h9M4 13h9a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H4" />
    </>
  ),
  archive: (
    <>
      <rect x="3" y="4" width="18" height="5" rx="1.5" />
      <path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4" />
    </>
  ),
  updates: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10m-4-4 4 4 4-4" />
    </>
  ),
  link: (
    <>
      <path d="m9 7 2-2a5 5 0 0 1 7 7l-2 2M15 17l-2 2a5 5 0 0 1-7-7l2-2M8 16l8-8" />
    </>
  ),
  code: (
    <>
      <path d="m8 6-5 6 5 6m8-12 5 6-5 6M14 3l-4 18" />
    </>
  ),
  terminal: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="m7 8 4 4-4 4m6 0h4" />
    </>
  ),
  laptop: (
    <>
      <path d="M5 16V5a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v11M5 16h14l2 4H3l2-4Z" />
    </>
  ),
  desktop: (
    <>
      <rect x="3" y="3" width="18" height="14" rx="2" />
      <path d="M12 17v4m-4 0h8" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type MobileSettingsIconName = keyof typeof glyphs;

export function MobileSettingsGlyph({
  name,
}: {
  name: MobileSettingsIconName;
}) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {glyphs[name]}
    </svg>
  );
}

export function MobileSettingsIcon({ name }: { name: MobileSettingsIconName }) {
  return (
    <span className="mobile-settings-icon" aria-hidden="true">
      <MobileSettingsGlyph name={name} />
    </span>
  );
}
