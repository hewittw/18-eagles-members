# Assignment 3 — Patterns & Flows: An Everyday Tool (full rubric)

Source: `../Design, Build, Ship - Assignment 3 - Patterns & Flows.pdf`. Due **Tue Oct 20, 2026, 5:30 PM**.

## Overview
Design and build a small tool you'd actually use every day or week, starting from scratch, around its flows:
the first visit, the core task, and reasons to return. Next.js on Vercel, saved to the browser (localStorage).
Make every change by directing the agent. Work out flows with the agent and study how similar tools welcome
someone new before building. Once deployed, have the agent try it as a brand-new user and fix what it finds.

## Steps
1. **Pick a tool** you'd use every week, started fresh. No sign-in, database, or APIs; localStorage only.
2. **Define flows with the agent** in plan mode: first visit, main task, coming back. Main task as one sentence
   with arrows. Ask the agent which steps, states, and errors it would add; choose what to keep. Draw the flows
   (Mermaid in `flows.md`), show the diagram in `README.md`. **A page (route) for each step, with shared navigation.**
3. **Research how 3 similar tools onboard people**, with subagents: the first screen, what it asks for, how soon
   you get something useful. Decide what to use in our first visit.
4. **Design the first visit.** Open with nothing saved. The first visit is the onboarding: immediate value,
   learn by doing (not a tour), never an empty screen.
5. **Build the main task and its form.** Shared components: buttons, inputs, fields with labels and errors, used
   consistently. Errors sit next to the field and say what to do next. Keep what the person typed.
6. **Give people a reason to come back** daily or weekly, and save what's needed in localStorage.
7. **Make it accessible.** Keyboard for everything, real labels, text contrast checked with the agent.
8. **First-run check.** Once deployed, the agent tries it as a brand-new user with a goal, goes through the first
   visit and main task, pretends to come back later, and gives usability feedback.

## Design Requirements
- **Flow:** the initial visit, the core task, and returning work from start to finish.
- **Onboarding:** someone new gets something useful on the first visit, with no dead-end empty screen.
- **Forms:** one column, a label on every field, errors next to the field that say what to do next, save what was typed.
- **Coming back:** the app remembers what you saved locally, and there's an experience designed around returning.
- **Components:** shared components used consistently throughout.
- **Navigation:** clear where you are and how to get back.
- **Accessibility:** keyboard, real labels, text contrast checked with the agent.
- **Visual style:** optional, welcome to explore a unique style.
- **Simplicity:** remove unnecessary steps, fields, and interactions.

## Tech Stack
Next.js + Tailwind CSS, data in localStorage: no database, accounts, or external APIs. Own GitHub repo, deployed on
Vercel Hobby. Push back on unneeded databases, backends, or packages. Context file is `AGENTS.md` (no CLAUDE.md;
check with `/context`).

## Submission
1. Vercel URL (live link to the tool). 2. GitHub URL with `README.md` and a commit history showing progress.

## Assessment checklist
- [ ] Live Vercel URL that works
- [ ] New tool built around its flows, a page for each step, shared navigation
- [ ] Flows as a diagram, shown in `README.md`
- [ ] First visit gives someone new something useful right away
- [ ] Form errors next to the field, say what to do next, typed values kept
- [ ] A reason to come back, and it remembers you between visits
- [ ] Keyboard access, real labels, text contrast checked with the agent
- [ ] First-run check (agent's usability feedback) in `README.md`
- [ ] Commits that show progress
- [ ] Ready to explain in class: design process (tool, user, what brings them back), onboarding, retention,
      the agent's feedback and the changes made, the agentic workflow (easy/hard)

A one-shot submission is marked incomplete.

## Lecture principles to apply (Week 3 slides)
- Flows: every step is more work; remove steps. Sentence with arrows → agent draws it → edit it.
- Patterns: list & detail; undo over "Are you sure?" (confirm only for delete-everything); search or browse.
- Navigation: core needs first, clear hierarchy, plain language, obvious actions. Product name, main sections,
  utility, page title.
- nth use: coming back is faster than the first visit. Start where they left off, with what they do most.
- Onboarding: immediate value; learn by doing on the real screen, one thing to do first; never a bare empty state;
  ramp up complexity. Goals, feedback, rewards, freedom to fail (Spider-Man).
- Retention: build habits that are good for people.
- Accessibility: ability + barrier = disability. Skip link, one h1 then h2s in order, consistent nav placement,
  labels so screen readers and browser agents can read it, real buttons, alt text, simpler screens.
