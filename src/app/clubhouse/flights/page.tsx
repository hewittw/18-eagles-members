import type { Metadata } from "next";
import { FlightsBoard } from "./_flights/FlightsBoard";

export const metadata: Metadata = { title: "Flights", description: "The airport nearest each of your courses, and live air traffic around the airports you follow." };

export default function FlightsPage() {
  return <FlightsBoard />;
}
