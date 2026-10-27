// Everything 18 Eagles saves for a golfer: synced to their own rows in Supabase (see store.ts, supabase/migrations).
import type { Course } from "./course-types";

export type ClubKind = "wood" | "hybrid" | "iron" | "wedge" | "putter";

export type Club = {
  id: string; // stable: "dr", "3w", "7i", "pt"…
  name: string; // "Driver", "7-iron"
  short: string; // "Dr", "7i" (fits a chip)
  kind: ClubKind;
  inBag: boolean; // shown as a club button on the hole screen
};

export type Fairway = "left" | "hit" | "right";

export type HoleEntry = {
  strokes: number | null; // the score; null = not played yet
  putts: number | null;
  fairway: Fairway | null; // par 4s and 5s only
  penalties: number;
  shots: string[]; // club ids in order, optional
  note: string;
};

export type Nine = "18" | "front" | "back";

/** The conditions a round was played in (Open-Meteo, via /api/weather), shown on the card. */
export type RoundWeather = {
  tempF: number; // air temperature, °F
  windMph: number;
  windDir: number; // degrees the wind comes FROM
  code: number; // WMO weather code
  summary: string; // "Sunny", "Light rain"…
  at: number; // epoch ms when captured
};

export type Round = {
  id: string;
  courseSlug: string;
  teeName: string;
  date: string; // yyyy-mm-dd, local
  holes: Nine;
  mode: "live" | "logged";
  status: "playing" | "complete";
  entries: Record<number, HoleEntry>; // keyed by hole number
  totalOnly: number | null; // a logged round entered as a total, with no hole detail
  lastHole: number; // where to resume
  note: string; // the round's note ("Work on lag putting")
  createdAt: number;
  finishedAt: number | null;
  weather?: RoundWeather | null; // optional: older cards and logged rounds may have none
};

export type Goal = "100" | "90" | "80" | "scratch";

export type Profile = {
  name: string | null; // what the golfer is called: asked first, shown in the hero and on the locker
  enteredIndex: number | null; // the index the golfer typed on the first visit
  goal: Goal | null;
  homeCourse: string | null; // course slug
  lastTee: Record<string, string>; // courseSlug → tee name, so tees are remembered
  welcomedAt: number | null; // first time the hero question was answered or skipped
  bagSetAt: number | null; // when the golfer confirmed their bag on the first visit
};

export type Store = {
  v: 1;
  profile: Profile;
  bag: Club[];
  rounds: Round[];
  customCourses: Course[];
  honorsSeen: string[]; // honor ids already celebrated
  lastVisit: number | null; // for "since your last visit"
};
