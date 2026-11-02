// Placeholder (Foundation). The Tour agent replaces this page with the live leaderboard and world ranking.
import type { Metadata } from "next";
import { PageHeader } from "@/components/golf";
import { Page } from "../_components/Placeholder";

export const metadata: Metadata = { title: "Tour", description: "The live PGA TOUR leaderboard and the world ranking, with the players you follow first." };

export default function TourPage() {
  return (
    <Page>
      <PageHeader eyebrow="On tour this week" title="Tour" />
      <p className="mt-4 max-w-measure font-serif text-lede text-ink-2">The live leaderboard and the world ranking, with your players first. The board goes up here shortly.</p>
    </Page>
  );
}
