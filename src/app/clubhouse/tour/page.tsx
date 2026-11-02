import type { Metadata } from "next";
import { TourBoard } from "./_tour/TourBoard";

export const metadata: Metadata = { title: "Tour", description: "The live PGA TOUR leaderboard and the world ranking, with the players you follow first." };

// The board is live (Supabase snapshot + Realtime in the browser, as the signed-in golfer), so the page is a
// client component under this server page.
export default function TourPage() {
  return <TourBoard />;
}
