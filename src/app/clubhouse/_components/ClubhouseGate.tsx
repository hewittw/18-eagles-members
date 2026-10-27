"use client";
import { useAuth } from "@clerk/nextjs";
import { Clubhouse } from "./Clubhouse";
import { Placeholder } from "./Placeholder";
import { Welcome } from "./Welcome";

/** /clubhouse is public: signed out it's the welcome (nobody's data), signed in it's that golfer's clubhouse. */
export function ClubhouseGate() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <Placeholder />;
  return isSignedIn ? <Clubhouse /> : <Welcome />;
}
