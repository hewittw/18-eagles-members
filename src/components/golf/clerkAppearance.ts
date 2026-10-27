import { tokens } from "../tokens";

/**
 * Clerk, dressed for the clubhouse: every Clerk screen (sign in, sign up, the account modal) takes our tokens, not
 * Clerk's purple. Set once on <ClerkProvider>. Clerk's CSS is put in Tailwind's `base` layer: above the preflight,
 * under components and utilities, so the Tailwind classes in `elements` win. (A separate `clerk` layer ordered with
 * `@layer theme, base, clerk, …` is the documented way, but the build drops that statement, which left Clerk on top.)
 */
export const clerkAppearance = {
  cssLayerName: "base",
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
    // Our primary button: flat Masters green, condensed caps, no Clerk gradient or bevel.
    formButtonPrimary: "min-h-12 rounded-lg border border-green bg-green bg-none text-[0.98rem] font-semibold uppercase tracking-[0.08em] text-on-green shadow-none hover:bg-green-2 hover:border-green-2 active:bg-green-3 after:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
    // Inputs and the social button keep Clerk's focus ring (a box-shadow from colorRing); Clerk draws their resting edge
    // at a faint alpha, so a real Rope Gray border gives them the 3:1 boundary.
    socialButtonsBlockButton: "min-h-12 rounded-lg border border-rule-strong font-sans hover:bg-paper-3",
    socialButtonsBlockButtonText: "font-sans text-[0.95rem] font-semibold text-ink",
    formFieldInput: "min-h-12 rounded-lg border border-rule-strong",
    card: "shadow-none",
    cardBox: "rounded-xl border border-rule shadow-card",
    formFieldLabel: "text-ink font-semibold",
    footerActionLink: "text-link underline underline-offset-3 font-semibold",
    profileSectionTitleText: "font-display text-[1.15rem] font-normal",
    navbarButton: "font-semibold",
    // Clerk's stock avatar is a violet gradient: toned to Masters green (grey, then a green wash).
    avatarBox: "bg-green",
    avatarImage: "[filter:grayscale(1)_sepia(1)_hue-rotate(105deg)_saturate(2.6)_brightness(0.62)]",
  },
} as const;
