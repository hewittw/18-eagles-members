import { tokens } from "../tokens";

/**
 * Clerk, dressed for the clubhouse: every Clerk screen (sign in, sign up, the account modal) takes our tokens, not
 * Clerk's purple. Set once on <ClerkProvider>. Clerk's CSS sits in the `clerk` layer (globals.css orders it under
 * components and utilities), so the Tailwind classes in `elements` win where they're used.
 */
export const clerkAppearance = {
  cssLayerName: "clerk",
  variables: {
    colorPrimary: tokens.green.hex,
    colorPrimaryForeground: tokens["on-green"].hex,
    colorDanger: tokens.error.hex,
    colorSuccess: tokens.success.hex,
    colorWarning: tokens.error.hex,
    colorNeutral: tokens.ink.hex,
    colorForeground: tokens.ink.hex,
    colorMutedForeground: tokens["ink-2"].hex,
    colorMuted: tokens["paper-3"].hex,
    colorBackground: tokens["paper-2"].hex,
    colorInput: tokens["paper-2"].hex,
    colorInputForeground: tokens.ink.hex,
    colorBorder: tokens["rule-strong"].hex,
    colorRing: tokens.focus.hex,
    colorShadow: "rgb(28 27 23 / 0.5)",
    colorModalBackdrop: "rgb(0 64 43 / 0.62)",
    fontFamily: "var(--font-franklin), 'Libre Franklin', Arial, sans-serif",
    fontFamilyButtons: "var(--font-oswald), Oswald, 'Arial Narrow', sans-serif",
    fontSize: "0.95rem",
    borderRadius: "0.625rem",
  },
  elements: {
    headerTitle: "font-display text-[1.7rem] font-normal leading-tight tracking-normal text-ink",
    headerSubtitle: "text-ink-2",
    formButtonPrimary: "uppercase tracking-[0.08em] font-semibold text-[0.98rem] min-h-12",
    formFieldLabel: "text-ink font-semibold",
    footerActionLink: "text-link underline underline-offset-3 font-semibold",
    profileSectionTitleText: "font-display text-[1.15rem] font-normal",
    navbarButton: "font-semibold",
    // Clerk's stock avatar is a violet gradient: toned to Masters green (grey, then a green wash).
    avatarBox: "bg-green",
    avatarImage: "[filter:grayscale(1)_sepia(1)_hue-rotate(105deg)_saturate(2.6)_brightness(0.62)]",
  },
} as const;
