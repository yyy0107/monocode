import type { ReactNode } from "react";

// One 24px grid, consistent padding and the same stroke for every setting.
const glyphs = {
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
