# EVLOS

[![CI](https://github.com/dhrumil92/EVLOS/actions/workflows/ci.yml/badge.svg)](https://github.com/dhrumil92/EVLOS/actions/workflows/ci.yml)

**Hostel Pooja attendance from fingerprint Punches.** A fingerprint Device sends each Punch to EVLOS as it happens. EVLOS works out who was in the hostel from the Rector's Leave records, shows the Rector only the Students who need a decision, and emails a Student only after the Rector confirms the Day.

IT643 Software Design and Testing term project, DAU.

## The problem

Students of a 360-Student hostel must attend Pooja every day between 05:30 and 18:00 IST. Until now the Rector walked every room at 22:00, wrote the result on paper and retyped it into Excel, while Leaves lived in paper books. EVLOS replaces that nightly routine with a short review on one page.

## Features

**The Rector's day**
- **Live view.** Each Punch appears within seconds, with a count of Students Present so far and when the Device was last seen.
- **Students.** Add, edit, Deactivate and Activate Students; find and filter them, list them by floor, room or name, and see each Student's month of Pooja Statuses.
- **Vidyalaya Presence.** For a Day or a month, an Excel register of who was In hostel or Away, worked out from the Leaves, with the Days In hostel and the Days Away for each Student.
- **Leaves and Returns.** For one Student, or for 30 to 40 at once before a holiday, exactly as written in the hostel's books.
- **Review and Finalize.** After the Pooja Window closes, only the Students on Needs Review are shown. Finalize locks the Day and turns them Absent; it warns first if the Device has been quiet, as Punches may still be on it.
- **Exclude and Send Notifications.** The Rector leaves out any Student who explained, then sends one email to each remaining Absent Student. A Punch that arrived after Finalize is shown beside the Student, so no one is emailed by mistake.

**For the Students**
- **Public Live View** at `/live`, with no login: "42 of 100 have done Pooja" today and the 15-minute Punch bars, updated every 30 seconds. Numbers only, never a name.

**Emails**
- A **Notification** to each Absent Student, at most once per Day, only after Finalize.
- A **Review Reminder** at 23:00 IST when a Day still has Students on Needs Review.
- A **Daily Report** at 23:30 IST and a **Monthly Report** at 09:00 IST on the 1st, with the Pooja Report and Vidyalaya Presence attached as two Excel files.
- Every email goes through an outbox: it is never sent twice, and it is tried again when the email service is unreachable.

**Reports**
- Opens on this month with nothing to press. Choose a Day (with how many Students were Present, Not Applicable and Absent), a Month, or Pick dates.
- Three bars for each Day (Present, Not Applicable, Absent) on a scale that fits the tallest bar; press a Day to see who was Absent.
- Every Student's period as a row of small squares, one for each Day, the most Absent first, with a Floor choice.
- Download as CSV or as an Excel file with each Pooja Status in colour, either for every Student or only for the Present, Absent or Not Applicable ones.

**Settings and security**
- The **Report Recipients** who receive the Reminder and the Reports are kept on a Settings page, so no address is written in the code.
- Rector login with HttpOnly session cookies and Argon2 password hashes; change the password on the Settings page, or reset a forgotten one with a one-time link by email.
- Login and password tries are limited (five in 15 minutes), every other request is limited per address so a flood is refused, and every change by the Rector is recorded in an audit log.
- No fingerprints are ever stored: they stay on the Device.

## The five rules

1. A Punch counts only between 05:30 and 18:00 IST, both included (the Pooja Window).
2. The same Punch uploaded twice is stored once.
3. A Student who was Away for any part of the Pooja Window and has no Punch gets Not Applicable ("-"), never Absent.
4. A Student who was in the hostel for the whole Pooja Window and has no Punch is only Needs Review. He becomes Absent when the Rector Finalizes.
5. A Notification goes to a Student only after Finalize, and at most once per Student per Day.

Each rule is a pure function in `packages/core` with its own tests; `TESTING.md` points to them.

## Status

| Phase | What | State |
|-------|------|-------|
| 0 to 4 | Rules, Device, live view, Students, Leaves, Review and Finalize | Done |
| 5 | Emails, Reports, Settings, password change and reset | Done 5 Nov 2026 |
| 5b | Every page rebuilt in the Dawn design (phone menu included), Vidyalaya Presence | Done 8 Nov 2026 |
| 6 | Deploy on a Google Cloud VM over HTTPS, pilot with the Rector | Next, by 16 Nov 2026 |
| 7 | Documents and freeze | 20 to 25 Nov 2026 |

**Live URL:** not deployed yet (Phase 6).

## Tech stack

| Part | Choice |
|------|--------|
| Language | TypeScript (strict), Node.js 22 |
| Server | Fastify; Server-Sent Events for the live view |
| Page | React with Vite and Tailwind |
| Database | PostgreSQL 17 with Drizzle ORM and SQL migrations |
| Email | Nodemailer over SMTP (Gmail; Mailpit for local tests) |
| Reports | CSV, and Excel with write-excel-file |
| Quality | Vitest, ESLint (complexity limit 10), Prettier, GitHub Actions CI |

The design is hexagonal: the rules in `packages/core` know nothing about the database, the Device or email. Details and reasons are in `docs/ARCHITECTURE.md`.

## Run locally

The full guide, step by step (database, backend, frontend, the Rector's login, email and the Device), is in [`docs/SETUP.md`](docs/SETUP.md). The short version:

**You need** Node 22 (exact version in `.nvmrc`) and PostgreSQL 17. Once, as a PostgreSQL admin (for example in pgAdmin), create a login role `evlos` with a password and no superuser rights, and two databases owned by it: `evlos` for development and `evlos_test` for tests (every test run wipes it).

```bash
git clone https://github.com/dhrumil92/EVLOS.git && cd EVLOS
npm install
cp .env.example .env        # put the evlos password into both database URLs
npm run db:setup            # create the tables in evlos and evlos_test
npm test
```

Then start the app in two terminals and open http://localhost:5173:

```bash
npm run rector:create -- you@example.com   # once: the Rector's login (asks for a password)
npm run dev                                # terminal 1: the server for the Device and the page
npm run dev:web                            # terminal 2: the page
```

**Emails.** With the settings in `.env.example`, every email goes to Mailpit (https://github.com/axllent/mailpit) at http://localhost:8025 and none reaches a real inbox. To send real emails, put the Gmail settings from `.env.example` into `.env` and check them with `npm run email:test -- you@example.com`. Then add the Report Recipients on the Settings page.

**The Device.** Its Cloud server setting must point at this machine's address and `DEVICE_PORT`, and its Device Serial must be in the `devices` table.

## Commands

Run from the repository root.

| Command | What it does |
|---------|--------------|
| `npm run dev` | Build and start the server: Device endpoints on `DEVICE_PORT`, page API on `PAGE_PORT`, Public Live View on `PUBLIC_PORT`. |
| `npm run dev:web` | Start the page at http://localhost:5173 (the Public Live View at http://localhost:5173/live). |
| `npm run db:setup` | Apply every migration to `evlos` and `evlos_test`. Safe to run again. |
| `npm run rector:create -- <email>` | Create a Rector's login; the password (12 characters or more) is asked at a hidden prompt. Run it once per Rector. |
| `npm run rector:password -- <email>` | Set a new password for a Rector who is locked out and cannot use the emailed reset link; every login of that Rector ends. |
| `npm run students:load -- <file.csv> [--save]` | First load of the Rector's list of Students. Checks only, unless `--save`; then all are saved or none. Columns as in `sample-roster.csv`. |
| `npm run email:test -- <email>` | Send one test email through the SMTP settings in `.env`. |
| `npm test` | Run every test once. |
| `npm run lint` / `npm run typecheck` | ESLint and strict TypeScript for every workspace. |
| `npm run format` / `npm run format:check` | Apply or check Prettier formatting. |

## Configuration

Every setting is an environment variable, read from `.env`; `.env.example` explains each one. `.env` is never committed.

| Variable | What it is |
|----------|------------|
| `DATABASE_URL`, `TEST_DATABASE_URL` | The development and test databases. |
| `DEVICE_PORT`, `PAGE_PORT`, `PUBLIC_PORT` | The ports for the Device, for the page API, and for the Public Live View. |
| `COOKIE_SECURE` | `true` only when the site runs on HTTPS. |
| `PUBLIC_URL` | The address the Rector opens EVLOS at; password reset links point to it. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | The email service. With no `SMTP_HOST`, emails wait in the outbox. |

## Project layout

```
packages/core        the rules: pure functions with an injected clock, no I/O
apps/api             the server
  src/use-cases        what the Rector and the schedule do, built from the rules
  src/ports            what the use cases need from the outside world
  src/adapters         Device protocol, PostgreSQL, HTTP routes, login, email,
                       schedule loop, CSV and Excel Reports
  migrations           SQL migrations, applied in order
apps/web             the Rector's page (React)
docs                 requirements, architecture, schedule, AI log
```

## Testing

About 1,100 tests run with `npm test`: the rules as pure functions, the use cases with in-memory fakes, the HTTP routes with Fastify `inject`, and the PostgreSQL repositories against the real `evlos_test` database, which they refuse to run anywhere else. CI runs lint, typecheck, the format check and every test on each push to `main` and each pull request. See `TESTING.md`.

## Privacy

EVLOS stores only what the Rector needs: Student ID, name, room, email, phone, Punches and Leaves. Fingerprints never leave the Device. Real Student data and the Rector's files are never committed, and real emails go to Students only after the hostel agrees in writing.

## Documents

| File | What it is |
|------|------------|
| `docs/SETUP.md` | How to set up and run EVLOS locally, step by step. |
| `docs/PRD.md` | Requirements with acceptance criteria. |
| `docs/ARCHITECTURE.md` | Tech stack, layers, data model, flows, deployment. |
| `UBIQUITOUS_LANGUAGE.md` | The domain vocabulary and the ambiguities it settles. |
| `DESIGN.md` | The five rules, design decisions, the boundary, limitations, AI use. |
| `TESTING.md` | Which tests prove each rule, and how to run them. |
| `docs/PHASES.md` | Schedule, exit checks and cut order. |
| `docs/AI_LOG.md` | AI suggestions that were rejected or changed, and why. |
| `AGENTS.md` | Instructions for AI coding agents working in this repo. |
