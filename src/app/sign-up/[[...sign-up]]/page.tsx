import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Suspense } from "react";
import { MembersEntrance } from "@/components/golf/MembersEntrance";

export const metadata: Metadata = { title: "Create your locker" };

export default function SignUpPage() {
  return (
    <MembersEntrance
      eyebrow="New members"
      title="Take a locker at 18 Eagles."
      lede="One account keeps your cards, your bag and your handicap, wherever you play and whatever you play on."
    >
      {/* Suspense: Clerk reads the request (cacheComponents is on). */}
      <Suspense fallback={<div className="h-[32rem] w-full max-w-[25rem]" aria-hidden="true" />}>
        <SignUp fallbackRedirectUrl="/clubhouse" />
      </Suspense>
    </MembersEntrance>
  );
}
