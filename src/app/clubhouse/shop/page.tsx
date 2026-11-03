import type { Metadata } from "next";
import { ShopBoard } from "./_shop/ShopBoard";

export const metadata: Metadata = { title: "Pro Shop", description: "What golf brands have on sale right now, with the categories you watch first." };

// The shop is live (Supabase snapshot + Realtime in the browser, as the signed-in golfer), so the page is a client
// component under this server page, like Tour.
export default function ShopPage() {
  return <ShopBoard />;
}
