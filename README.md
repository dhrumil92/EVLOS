# EVLOS

A hostel Pooja attendance system built on fingerprint Punches. Students punch a Device during the Pooja Window (05:30 to 18:00 IST). The system shows Punches live, works out who was in the hostel from the Rector's Leave records, and lets the Rector review and Finalize each Day. A Student who was in the hostel but did not punch is emailed only after the Rector confirms. The Rector receives reminders and daily and monthly Reports by email and can download Reports as CSV or Excel at any time.

IT643 Software Design and Testing term project, DAU.

## Status

In development. Requirements and domain language are settled. The project skeleton, CI and database setup are in place; the rules are not yet written.

## Live URL

TBD (added here before the `project-final` tag).

## Run locally

Prerequisites:
- Node 22 (exact version in `.nvmrc`) and PostgreSQL 17 running on your machine.
- Once, as a PostgreSQL admin (for example in pgAdmin): a login role `evlos` with a password and no superuser rights, and two databases owned by it: `evlos` (development) and `evlos_test` (tests; wiped by every test run).

```bash
git clone https://github.com/dhrumil92/EVLOS.git && cd EVLOS
npm install
cp .env.example .env        # then put the evlos password into both URLs
npm run db:setup            # creates the tables in evlos and evlos_test
npm test
```

There is no app to start yet. From Phase 3, `npm run dev` replaces `npm test` as the last command.

## The five rules the product enforces

1. A Punch counts only between 05:30 and 18:00 IST, both included (the Pooja Window).
2. The same Punch uploaded twice is stored once.
3. A Student who was Away for any part of the Pooja Window and has no Punch gets Not Applicable ("-"), never Absent.
4. A Student who was in the hostel for the whole Pooja Window and has no Punch is only Needs Review. He becomes Absent when the Rector Finalizes.
5. A Notification goes to a Student only after Finalize, and at most once per Student per Day.

## Stack

TypeScript, Node.js with Fastify, React with Vite, PostgreSQL. Details in `docs/ARCHITECTURE.md`.

## Documents

| File | What it is |
|------|------------|
| `UBIQUITOUS_LANGUAGE.md` | The domain vocabulary and flagged ambiguities. |
| `DESIGN.md` | The five rules, design decisions, the boundary, limitations, AI use. |
| `TESTING.md` | Which rules are tested and how. |
| `AGENTS.md` | Instructions for AI coding agents working in this repo. |
| `docs/PRD.md` | Requirements with acceptance criteria. |
| `docs/ARCHITECTURE.md` | Tech stack, structure, data model, flows, deployment. |
| `docs/PHASES.md` | Schedule to the end-sem, exit checks, cut order. |
| `docs/AI_LOG.md` | AI suggestions that were rejected or changed, and why. |
