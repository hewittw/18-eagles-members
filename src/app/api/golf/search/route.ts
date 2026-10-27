import type { NextRequest } from "next/server";
import { searchCourses, searchCoursesLive } from "@/lib/api/opengolf";
import { badRequest, pause, reply, signedIn, signedOut, simulation, unavailable } from "@/lib/api/upstream";

// GET /api/golf/search?q=torrey&state=CA → { results: CourseHit[] }
// Used by "Find your course" on the add-a-course form. Signed-in golfers only; OpenGolfAPI is called from here.
export async function GET(req: NextRequest) {
  if (!(await signedIn())) return signedOut();

  const url = req.nextUrl;
  const q = (url.searchParams.get("q") ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (q.length < 2) return badRequest("Type at least two letters of the course name.");
  const rawState = (url.searchParams.get("state") ?? "").trim().toUpperCase();
  if (rawState && !/^[A-Z]{2}$/.test(rawState)) return badRequest("Use the two-letter state code, like CA.");
  const limit = Math.min(10, Math.max(1, Number(url.searchParams.get("limit")) || 8));

  const sim = simulation(url);
  if (sim === "slow") await pause(2500);
  try {
    const results = sim === "down" ? await searchCoursesLive(q, rawState || null, limit, 1) : await searchCourses(q, rawState || null, limit);
    return reply({ results }, 200, 3600);
  } catch (e) {
    // Timeouts, 5xx, a network failure, or a reply we can't read: all one calm answer for the browser.
    console.warn("[api/search]", e instanceof Error ? e.message : e);
    return unavailable("Course search");
  }
}
