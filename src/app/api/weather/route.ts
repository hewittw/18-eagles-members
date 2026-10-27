import type { NextRequest } from "next/server";
import { forecast, forecastLive, grid } from "@/lib/api/weather";
import { badRequest, pause, reply, signedIn, signedOut, simulation, unavailable } from "@/lib/api/upstream";

// GET /api/weather?lat=33.02&lng=-117.21 → { forecast: Forecast }
// Conditions on the Clubhouse, the 7-day tee sheet on a course page, and the wind on the hole screen.
export async function GET(req: NextRequest) {
  if (!(await signedIn())) return signedOut();

  const url = req.nextUrl;
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (!url.searchParams.get("lat") || !url.searchParams.get("lng") || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return badRequest("Send the course's latitude and longitude, like lat=33.02&lng=-117.21.");
  }

  const sim = simulation(url);
  if (sim === "slow") await pause(2500);
  try {
    const f = sim === "down" ? await forecastLive(grid(lat), grid(lng), 1) : await forecast(grid(lat), grid(lng));
    return reply({ forecast: f }, 200, 300);
  } catch (e) {
    // Timeouts, 5xx, a network failure, or a reply we can't read: all one calm answer for the browser.
    console.warn("[api/weather]", e instanceof Error ? e.message : e);
    return unavailable("The weather service");
  }
}
