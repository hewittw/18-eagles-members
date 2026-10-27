import { BUILT_IN } from "@/data/courses";
import { COURSE_GEO } from "@/data/course-geo";
import type { Course, Hole, Tee } from "./course-types";
import type { Nine, Round } from "./types";

export { BUILT_IN };

export const builtInBySlug = new Map(BUILT_IN.map((c) => [c.slug, c]));

export function findCourse(slug: string, custom: Course[] = []): Course | undefined {
  return builtInBySlug.get(slug) ?? custom.find((c) => c.slug === slug);
}

export const allCourses = (custom: Course[] = []) => [...custom, ...BUILT_IN];

/** Where a course is (for the weather), or null for a course added by hand without a location. */
export function courseGeo(c: Course): { lat: number; lng: number } | null {
  const g = c.geo ?? COURSE_GEO[c.slug];
  return g && Number.isFinite(g.lat) && Number.isFinite(g.lng) ? { lat: g.lat, lng: g.lng } : null;
}

/** The course's OpenGolfAPI id, when we know it. */
export const openGolfIdOf = (c: Course): string | null => c.openGolfId ?? COURSE_GEO[c.slug]?.openGolfId ?? null;

export function teeOf(course: Course, name: string): Tee {
  return course.tees.find((t) => t.name === name) ?? course.tees[0];
}

/** The holes a round covers, in order. */
export function holesFor(course: Course, nine: Nine): Hole[] {
  if (course.holes.length === 9 || nine === "18") return course.holes;
  return nine === "front" ? course.holes.slice(0, 9) : course.holes.slice(9, 18);
}

export const roundHoles = (r: Round, course: Course) => holesFor(course, r.holes);

/** A hole's yards from a tee. Holes list the first tee's yards; other tees scale by their total. */
export function yardsAt(course: Course, tee: Tee, hole: Hole): number {
  return course.tees[0].name === tee.name ? hole.yards : Math.round((hole.yards * tee.yards) / course.tees[0].yards);
}

/** The default home course: the golfer's choice, else the first course tagged "home". */
export function defaultHome(homeSlug: string | null, custom: Course[] = []): Course {
  return (homeSlug && findCourse(homeSlug, custom)) || BUILT_IN.find((c) => c.slug === "rancho-santa-fe") || BUILT_IN.find((c) => c.tags.includes("home")) || BUILT_IN[0];
}

export function courseGroups(courses: Course[]) {
  return {
    home: courses.filter((c) => c.tags.includes("home")),
    majors: courses.filter((c) => c.tags.includes("major-host")),
    usa: courses.filter((c) => c.country === "USA"),
    scotland: courses.filter((c) => c.country === "Scotland"),
  };
}
