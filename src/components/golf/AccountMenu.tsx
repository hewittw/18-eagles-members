"use client";
import { SignInButton, useClerk, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { buttonClasses } from "../ui/Button";
import { cx } from "../ui/cx";
import { useMember } from "./useMember";

/** The golfer's initials, as stamped on a locker tag: "AR" from Avery Ross, "A" from avery@…, never empty. */
export function initialsOf(first?: string | null, last?: string | null, email?: string | null) {
  const a = (first ?? "").trim()[0] ?? "";
  const b = (last ?? "").trim()[0] ?? "";
  return (a + b || (email ?? "").trim()[0] || "").toUpperCase();
}

/** A round brass-ringed tag with the initials, the same family as the roundel in the wordmark. Decorative. */
function Tag({ initials, size = "sm", open = false }: { initials: string; size?: "sm" | "lg"; open?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "grid shrink-0 place-items-center rounded-full border font-numeral font-semibold tracking-[0.06em] transition-colors duration-150",
        size === "lg" ? "size-12 border-2 border-green bg-green text-[1.15rem] text-on-green" : "size-9 border-gold text-[0.92rem]",
        size === "sm" && (open ? "bg-gold text-green-3" : "bg-green-2 text-on-green group-hover/acct:bg-white/15 group-active/acct:bg-gold group-active/acct:text-green-3"),
      )}
    >
      {initials || (
        <svg viewBox="0 0 24 24" className="size-5"><circle cx="12" cy="9" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M5 19.5 a7 7 0 0 1 14 0" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
      )}
    </span>
  );
}

const row =
  "flex min-h-tap w-full items-center gap-3 rounded-md px-3 py-2 text-left text-[0.98rem] font-semibold text-ink transition-colors duration-150 -outline-offset-2 " +
  "is-hover:bg-paper-3 is-pressed:bg-tint disabled:cursor-not-allowed disabled:text-ink-2";

function RowIcon({ d }: { d: ReactNode }) {
  return <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-green" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{d}</svg>;
}

/**
 * The account control at the right of the top bar. Signed in: the golfer's initials on a brass-ringed tag; it opens
 * a small card (a disclosure, not an ARIA menu: Tab moves through it, Esc or a click outside closes it) with who's
 * signed in, Your locker, Your account (Clerk's profile, themed) and Sign out (back to the public welcome).
 * Signed out: a quiet Sign in. Before Clerk knows: a blank space the same size, so nothing shifts.
 */
export function AccountMenu() {
  const member = useMember();
  const { user } = useUser();
  const { openUserProfile, signOut } = useClerk();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  if (member === "unknown") return <span aria-hidden="true" className="block size-11 shrink-0" />;
  if (member === "out") {
    return (
      <SignInButton mode="redirect">
        <button type="button" className={buttonClasses({ variant: "quiet", tone: "green", size: "sm" }, "shrink-0")}>Sign in</button>
      </SignInButton>
    );
  }

  const name = user?.fullName?.trim() || user?.firstName?.trim() || "";
  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const initials = initialsOf(user?.firstName, user?.lastName, email);

  return (
    <div
      ref={wrap}
      className="relative flex shrink-0 items-center md:border-l md:border-white/25 md:pl-3"
      onBlur={(e) => { if (open && !wrap.current?.contains(e.relatedTarget as Node | null)) setOpen(false); }}
    >
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="group/acct grid size-11 place-items-center rounded-full transition-transform duration-150 ease-press active:scale-95"
      >
        <Tag initials={initials} open={open} />
        <span className="sr-only">Your account{name ? `, ${name}` : ""}</span>
      </button>

      <div
        id={panelId}
        hidden={!open}
        className="absolute right-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] animate-hang overflow-hidden rounded-xl border border-rule bg-paper-2 text-ink shadow-lift"
      >
        <div className="flex items-center gap-3 border-b border-rule bg-paper-3 px-4 py-4">
          <Tag initials={initials} size="lg" />
          <div className="min-w-0">
            <p className="caps text-label text-gold-ink">Signed in</p>
            {name && <p className="mt-0.5 font-display text-[1.25rem] leading-tight text-ink [overflow-wrap:anywhere]">{name}</p>}
            {email && <p className="mt-0.5 text-[0.9rem] leading-snug text-ink-2 [overflow-wrap:anywhere]">{email}</p>}
          </div>
        </div>
        <ul className="grid gap-0.5 p-2">
          <li>
            <Link href="/clubhouse/locker" className={row} onClick={() => setOpen(false)}>
              <RowIcon d={<><rect x="5" y="2.5" width="14" height="19" rx="0.5" /><path d="M8 5.5 H16 M8 7.5 H16 M8 9.5 H16 M15.5 13.5 V16" /></>} />
              Your locker
            </Link>
          </li>
          <li>
            <button type="button" className={row} onClick={() => { setOpen(false); openUserProfile(); }}>
              <RowIcon d={<><circle cx="12" cy="9" r="3.6" /><path d="M5 19.5 a7 7 0 0 1 14 0" /></>} />
              <span>Your account<span className="block text-[0.85rem] font-normal text-ink-2">Name, email, password, sign-in methods</span></span>
            </button>
          </li>
          <li className="mt-1 border-t border-rule pt-1">
            <button type="button" className={row} disabled={leaving} onClick={() => { setLeaving(true); void signOut({ redirectUrl: "/clubhouse" }); }}>
              <RowIcon d={<><path d="M14 4.5 H18.5 V19.5 H14" /><path d="M10 8 L6 12 L10 16 M6 12 H15" /></>} />
              {leaving ? "Signing out…" : "Sign out"}
            </button>
          </li>
        </ul>
        <p className="border-t border-rule px-4 py-3 text-[0.85rem] leading-snug text-ink-2">Your cards are private to this account.</p>
      </div>
    </div>
  );
}
