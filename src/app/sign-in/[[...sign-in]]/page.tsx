import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Suspense } from "react";
import { MembersEntrance } from "@/components/golf/MembersEntrance";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <MembersEntrance
      eyebrow="The members' entrance"
      title="Welcome back to the clubhouse."
      lede="Sign in and your locker is as you left it: every card, your bag, your index."
    >
      {/* Suspense: Clerk reads the request (cacheComponents is on). */}
      <Suspense fallback={<div className="h-[28rem] w-full max-w-[25rem]" aria-hidden="true" />}>
        <SignIn fallbackRedirectUrl="/clubhouse" />
      </Suspense>
    </MembersEntrance>
  );
}
