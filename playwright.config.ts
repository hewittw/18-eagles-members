import { defineConfig, devices } from "@playwright/test";

// The RLS isolation test (tests/rls-isolation.spec.ts). Keys load from .env.local into the test process
// (Clerk test sign-in needs CLERK_SECRET_KEY); nothing is printed. Point BASE at any deployment:
//   npx playwright test                       → http://localhost:3300 (npx next dev -p 3300)
//   BASE=https://18-eagles-members.vercel.app npx playwright test
try { process.loadEnvFile(".env.local"); } catch {}

export default defineConfig({
  testDir: "tests",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  globalSetup: "./tests/global-setup.ts",
  use: { baseURL: process.env.BASE ?? "http://localhost:3300", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
