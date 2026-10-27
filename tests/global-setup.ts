import { clerkSetup } from "@clerk/testing/playwright";

// Gets a Clerk Testing Token so automated sign-ins aren't blocked by bot protection.
export default async function globalSetup() {
  await clerkSetup({ publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, dotenv: false });
}
