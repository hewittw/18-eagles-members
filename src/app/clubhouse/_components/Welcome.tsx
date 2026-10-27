import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { buttonClasses } from "@/components/ui/Button";

/** What a signed-out visitor sees at /clubhouse: what this is, and the two doors in. Nobody's data is shown. */
export function Welcome() {
  return (
    <section aria-labelledby="welcome-title" className="mx-auto max-w-ledger px-4 py-16 sm:px-6 lg:px-8">
      <p className="caps text-label text-gold-ink">Members&apos; entrance</p>
      <h1 id="welcome-title" className="mt-3 max-w-2xl font-display text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.05] text-ink">
        Your golf journal, kept in your own locker.
      </h1>
      <p className="mt-4 max-w-xl text-[1.05rem] leading-relaxed text-ink-2">
        Play a round hole by hole, keep every card, and watch your handicap move. Sign in and it&apos;s on every device, private to you.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <SignUpButton mode="redirect"><button type="button" className={buttonClasses({ variant: "primary" })}>Create your locker</button></SignUpButton>
        <SignInButton mode="redirect"><button type="button" className={buttonClasses({ variant: "secondary" })}>Sign in</button></SignInButton>
      </div>
    </section>
  );
}
