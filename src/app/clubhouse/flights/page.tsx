// Placeholder (Foundation). The Flights agent replaces this page with the live board for each followed airport.
import type { Metadata } from "next";
import { PageHeader } from "@/components/golf";
import { Page } from "../_components/Placeholder";

export const metadata: Metadata = { title: "Flights", description: "Live air traffic around the airports you follow, and the airport nearest each of your courses." };

export default function FlightsPage() {
  return (
    <Page>
      <PageHeader eyebrow="Getting there" title="Flights" />
      <p className="mt-4 max-w-measure font-serif text-lede text-ink-2">Live traffic around the airports you follow, and the one nearest each of your courses. The arrivals board goes up here shortly.</p>
    </Page>
  );
}
