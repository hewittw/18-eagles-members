"use client";
import { useAuth } from "@clerk/nextjs";
import { useSyncExternalStore } from "react";

export type Member = "in" | "out" | "unknown";

const noop = () => () => {};
// Clerk's own "has this browser got a session" cookie (`__client_uat`, suffixed on dev instances; "0" when signed out).
// It only steers what the bar shows for the moment before Clerk loads; Clerk's answer replaces it, and the proxy
// and Row Level Security decide what anyone may actually see.
const cookieGuess = () => /(?:^|;\s*)__client_uat(?:_[^=]*)?=(?!0(?:;|$))[^;]+/.test(document.cookie);

/** Signed in, signed out, or not known yet (the server render). Used for what the bar offers, never for access. */
export function useMember(): Member {
  const { isLoaded, isSignedIn } = useAuth();
  const guess = useSyncExternalStore(noop, cookieGuess, () => null);
  if (isLoaded) return isSignedIn ? "in" : "out";
  return guess === null ? "unknown" : guess ? "in" : "out";
}
