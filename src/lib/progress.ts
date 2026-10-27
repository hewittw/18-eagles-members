// What the hub shows. Update the status as each part lands.
export type Status = "done" | "in progress" | "next";

export type Part = {
  n: string;
  title: string;
  href: string;
  status: Status;
  note: string;
};

export const TOOL_HREF = "/clubhouse";

export const parts: Part[] = [
  { n: "01", title: "Research", href: "/research", status: "done", note: "How GHIN, 18Birdies, and Arccos welcome a new golfer, and what we take from each." },
  { n: "02", title: "Mood board", href: "/mood-board", status: "done", note: "The Members' Ledger: ceremonial, tailored, sunlit. 29 artifacts remixing the Rancho Santa Fe feel and old-school Masters ceremony." },
  { n: "03", title: "Design system", href: "/design-system", status: "done", note: "The app's real component library: every component in every state, 33 color pairs measured, keyboard-checked." },
  { n: "04", title: "Flows", href: "/flows", status: "done", note: "The first visit, playing a round, and coming back, as a diagram (also in the README)." },
  { n: "05", title: "18 Eagles", href: TOOL_HREF, status: "done", note: "The tool itself: a name and three setup questions, the hole-by-hole card, handicap, stats, the next-round challenge and the Trophy Room. The submitted link." },
];

// Week 4 (Full stack): what changed this week. Each links into the tool where you can see it.
export const week4: Part[] = [
  { n: "W4.1", title: "Accounts, and a journal per account", href: "/clubhouse", status: "done", note: "Sign in with Clerk; every card, bag and setting is saved to your own rows in Supabase instead of this browser, so it's on every device you sign in on." },
  { n: "W4.2", title: "Row Level Security", href: "/clubhouse", status: "done", note: "Postgres refuses any read or write of another golfer's rows: the policies check the Clerk user on every request, not just the app." },
  { n: "W4.3", title: "Live course data and weather", href: "/clubhouse/courses", status: "in progress", note: "Search real courses (OpenStreetMap via OpenGolfAPI) on the add-a-course form, and the conditions at the course from Open-Meteo, kept on the card." },
  { n: "W4.4", title: "Feedback addressed", href: "/clubhouse/stats", status: "done", note: "\u201cThe header is a little noisy\u201d: the top bar now recedes as you scroll. \u201cNormalize the images\u201d: every course photo graded to one sunlit set." },
  { n: "W4.5", title: "Security review", href: "/clubhouse", status: "in progress", note: "Secrets kept server-side, every Server Action checks the session, inputs size-checked, no service-role key anywhere." },
  { n: "W4.6", title: "The RLS test", href: "/clubhouse", status: "in progress", note: "Two test golfers: each signs in and can't read, change or delete the other's cards." },
];

// The assignment's checklist (docs/assignment.md), tracked here so progress is visible at a glance.
export const checklist: { item: string; status: Status }[] = [
  { item: "A tool built around its flows, a page for each step, shared navigation", status: "done" },
  { item: "Flows as a diagram, shown in the README", status: "done" },
  { item: "Onboarding research: three similar apps", status: "done" },
  { item: "A first visit that gives someone new something useful right away", status: "done" },
  { item: "A form with errors next to the field that keeps what was typed", status: "done" },
  { item: "A reason to come back, and it remembers you", status: "done" },
  { item: "Keyboard access, real labels, contrast checked", status: "done" },
  { item: "First-run check by the agent, in the README", status: "done" },
  { item: "Live on Vercel, with a commit history that shows progress", status: "done" },
];
