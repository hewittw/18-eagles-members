import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { SkipLink } from "../ui/SkipLink";
import { cx } from "../ui/cx";
import { AppNav, type NavKey } from "./AppNav";
import { CurrentNav, PhoneTabBar } from "./CurrentNav";
import { Wordmark } from "./Wordmark";

export type AppShellProps = {
  children: ReactNode;
  /** Which tab is current. Omit it and the shell reads the URL. */
  current?: NavKey;
  /** Design-system only: draw the frame in place (no fixed bar, no landmarks, no skip link). */
  preview?: boolean;
  /** Preview only: which layout to draw. */
  previewLayout?: "phone" | "desktop";
};

/**
 * The tool's frame: skip link, the Locker Green bar with the wordmark and the five places, <main id="main">,
 * and a quiet footer. Phones get a bottom tab bar in thumb reach; from md up the places sit in the top bar.
 */
export function AppShell({ children, current, preview, previewLayout = "phone" }: AppShellProps) {
  const nav = (variant: "bar" | "tabs") =>
    current || preview ? (
      <AppNav current={current} variant={variant} label={preview ? `Preview: ${previewLayout} navigation` : undefined} />
    ) : (
      <Suspense fallback={<AppNav variant={variant} />}>
        <CurrentNav variant={variant} />
      </Suspense>
    );

  const tabBar = (tabs: ReactNode) => (
    <div data-obscures className="fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-paper/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 md:hidden">
      {tabs}
    </div>
  );

  if (preview) {
    const phone = previewLayout === "phone";
    return (
      <div className="flex h-full min-h-0 flex-col bg-paper">
        <div className="tex-locker on-green border-b border-gold/40">
          <div className={cx("flex items-center justify-between gap-4", phone ? "px-4 py-2.5" : "px-6")}>
            <span className={phone ? "" : "py-2"}><Wordmark tone="green" /></span>
            {!phone && nav("bar")}
          </div>
        </div>
        <div className="tex-paper min-h-0 flex-1 overflow-hidden">{children}</div>
        {phone && <div className="border-t border-rule bg-paper">{nav("tabs")}</div>}
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <header data-obscures className="tex-locker on-green sticky top-0 z-40 border-b border-gold/40">
        <div className="mx-auto flex max-w-ledger flex-wrap items-center justify-between gap-x-4 px-4 sm:px-6 lg:px-8">
          <Link href="/clubhouse" className="-mx-1 flex min-h-tile items-center px-1 md:min-h-16" aria-label="18 Eagles, the clubhouse">
            <Wordmark tone="green" />
          </Link>
          <div className="hidden md:block">{nav("bar")}</div>
        </div>
      </header>
      <main id="main" className="flex-1 outline-none">
        {children}
      </main>
      {/* On phones too, so everyone is told where the cards live; the padding clears the fixed tab bar. */}
      <footer className="border-t border-rule pb-[calc(var(--tabbar)+env(safe-area-inset-bottom))] md:pb-0">
        <div className="mx-auto flex max-w-ledger flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-6 text-[0.92rem] text-ink-2 sm:px-6 lg:px-8">
          <p className="caps text-[0.72rem] text-gold-ink">18 Eagles · A golf journal</p>
          <p>Your rounds are saved to your own account, private to you, on every device you sign in on.</p>
        </div>
      </footer>
      {/* Phones only; left out on the hole screen, where the hole's action bar takes the bottom edge. */}
      {current ? tabBar(nav("tabs")) : (
        <Suspense fallback={tabBar(nav("tabs"))}>
          <PhoneTabBar>{tabBar(nav("tabs"))}</PhoneTabBar>
        </Suspense>
      )}
    </div>
  );
}
