import type { Metadata } from "next";
import { FlightsBoard } from "./_flights/FlightsBoard";

export const metadata: Metadata = { title: "Flights", description: "The airport near you, the one for where you're playing, and the flights between them, live." };

export default function FlightsPage() {
  return <FlightsBoard />;
}
