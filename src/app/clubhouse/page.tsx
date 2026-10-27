import type { Metadata } from "next";
import { ClubhouseGate } from "./_components/ClubhouseGate";

export const metadata: Metadata = { title: "Clubhouse" };

export default function ClubhousePage() {
  return <ClubhouseGate />;
}
