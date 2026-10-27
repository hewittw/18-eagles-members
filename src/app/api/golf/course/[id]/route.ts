import type { NextRequest } from "next/server";
import { courseDetail, courseDetailLive } from "@/lib/api/opengolf";
import { badRequest, pause, reply, signedIn, signedOut, simulation, unavailable } from "@/lib/api/upstream";

// GET /api/golf/course/<OpenGolfAPI id> → { course: CourseDetail }
// Fills the add-a-course form from a search result, and shows "Course facts" on a course page.
export async function GET(req: NextRequest, ctx: RouteContext<"/api/golf/course/[id]">) {
  if (!(await signedIn())) return signedOut();

  const { id } = await ctx.params;
  // OpenGolfAPI ids are UUIDs; anything else never leaves our server.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return badRequest("That isn't an OpenGolfAPI course id.");

  const sim = simulation(req.nextUrl);
  if (sim === "slow") await pause(2500);
  try {
    const course = sim === "down" ? await courseDetailLive(id, 1) : await courseDetail(id.toLowerCase());
    if (!course) return reply({ error: "not_found", message: "OpenGolfAPI has no course with that id." }, 404);
    return reply({ course }, 200, 3600);
  } catch (e) {
    console.warn("[api/golf/course]", e instanceof Error ? e.message : e);
    return unavailable("OpenGolfAPI");
  }
}
