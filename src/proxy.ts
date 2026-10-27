import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Where the app decides who may enter: every page inside the Clubhouse needs a signed-in Clerk session
// (a signed-out visitor is sent to sign in). /clubhouse itself stays public: signed out it's the welcome page.
// The hub, research, mood board and design system are public process pages. What each person may *see*
// is decided again, per row, by Row Level Security in Supabase.
const isPrivate = createRouteMatcher(["/clubhouse/(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isPrivate(req)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
