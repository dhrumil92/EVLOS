# AGENTS.md

Instructions for AI coding agents working on EVLOS (Claude Code, which built the project, or any other). Read this first.

## What this project is
A hostel Pooja attendance system: a fingerprint Device pushes Punches to a server; the Rector records Leaves and Returns, reviews exceptions, Finalizes the Day; Students are emailed only after Finalize; the Rector gets Reports. Requirements: `docs/PRD.md`. Structure and tech stack: `docs/ARCHITECTURE.md`. Schedule: `docs/PHASES.md`. Local setup: `docs/SETUP.md`. The server (Google Cloud VM): `docs/DEPLOY.md`.

## Non-negotiables
1. **Use the glossary.** Names in code, tests, commits and UI come from `UBIQUITOUS_LANGUAGE.md`. Never invent a synonym (no "attendance", "log", "user", "warden", "biometric ID", and no "absent" for a Leave). If a needed concept is missing, stop and ask; do not name it yourself.
2. **Core is pure.** `packages/core` has no database, network, filesystem, `Date.now()` or `new Date()`. Time comes from an injected `Clock`. Everything external is behind a port.
3. **The Device protocol stays in the adapter.** Nothing outside the Device adapter knows about the Device protocol, its serial numbers, or its timestamp format. Convert to IST at the boundary.
4. **Time is IST.** A Day is an IST calendar date. Schedules run in Asia/Kolkata. The server runs in UTC, so never rely on the server's local time.
5. **Test first.** For every rule: write a failing test, run it and confirm it fails for the right reason, then implement. Tests use Arrange / Act / Assert, one behaviour per test, and names that state the rule in glossary words. Do not write tests that only mirror the implementation.
6. **No secrets in code, prompts or commits.** Config comes from environment variables; keep `.env.example` current. Never touch production or cloud credentials. Never commit real Student data or the Rector's files.
7. **Databases.** Local development uses the PostgreSQL already installed on the author's machine: database `evlos` for development, `evlos_test` for tests, user `evlos`. Never run tests against `evlos`. Never touch any other database on the machine. On the VM, the real data lives in the `evlos-postgres-1` container: never run tests or experiments there, and restore a backup only into a scratch database.

## How to work
- Plan before editing. For any task that touches more than three files, show the plan and wait for approval.
- One rule or one behaviour per task and per pull request. Keep diffs small enough to read fully.
- Explain every non-trivial change in the PR description in plain words. The author must be able to explain each `file:line` in a viva.
- Prefer boring, explicit code. Keep functions short; the ESLint complexity rule is on, and a function over the limit must be split, not silenced.
- Do not add dependencies without saying why. Pin exact versions.
- Parameterised queries only. Never build SQL by string concatenation.
- Do not change `UBIQUITOUS_LANGUAGE.md`, `DESIGN.md` or `TESTING.md` without being asked. If the code and a document disagree, report it.
- If you are unsure about a domain rule, ask. Do not guess.

## Stack
TypeScript (strict), Node 22, Fastify, React with Vite and Tailwind, PostgreSQL with Drizzle, Vitest with React Testing Library for the pages (Playwright was planned for a few end-to-end flows and dropped on 2026-11-05; see `docs/ARCHITECTURE.md`), ESLint, Prettier. npm workspaces: `packages/core`, `apps/api`, `apps/web`. Docker Compose and Caddy are for deployment on the VM only, not for local development.

## Commands
Run from the repo root.

| Command | What it does |
|---------|--------------|
| `npm install` | Install all workspaces (`packages/core`, `apps/api`, `apps/web`). Versions are pinned exactly (`.npmrc`). |
| `npm run db:setup` | Build, then apply all migrations to `evlos` and `evlos_test` (reads `.env`). Safe to run again. |
| `npm run rector:create -- <email>` | Create the Rector's login in `evlos` (reads `.env`). Asks for the password at a hidden prompt; it needs at least 12 characters. |
| `npm run rector:password -- <email>` | Set a new password for a Rector who is locked out and cannot use the emailed reset link (reads `.env`). Asks twice at a hidden prompt; ends every login of that Rector and closes any open reset link. |
| `npm run students:load -- <file.csv> [--save]` | First load of the Rector's list into `evlos` (reads `.env`). Without `--save` it only checks; with it, all Students are saved or none. Columns as in `sample-roster.csv`. |
| `npm run email:test -- <email>` | Send one test email through the SMTP settings in `.env`, to check them. Touches no database. On failure it prints the error code and reason, never the password. |
| `npm run email:preview -- <email> [student\|daily\|monthly\|reminder\|reset]` | Send one sample email in the real design, with made-up Students and numbers, to the address given (reads `.env`). The kind is `student` when left out. Touches no database. |
| `npm test` | Run every test once. Database tests use `evlos_test` only and empty it first. |
| `npm run lint` | ESLint, including the complexity limit (10) and the pure-core rules. |
| `npm run typecheck` | Strict TypeScript for all workspaces. |
| `npm run format` / `npm run format:check` | Apply / check Prettier formatting. |
| `cd apps/api && npx drizzle-kit generate --name <what_changed>` | Write a new SQL migration after editing `apps/api/src/db/schema.ts`. Never edit or regenerate a migration that has already been applied; add a new one. |

`npm run dev` starts the server (Device endpoints on `DEVICE_PORT`, page API on `PAGE_PORT`, and the Public Live View on `PUBLIC_PORT`, the last two on `127.0.0.1` unless `PAGE_HOST` and `PUBLIC_HOST` say otherwise). `npm run dev:web` starts the page at http://localhost:5173. CI (`.github/workflows/ci.yml`) runs lint, typecheck, format check, `db:setup` and test on every push to `main` and every pull request.

On the VM the same scripts run inside the `api` container, for example `docker compose run --rm api node apps/api/dist/db/migrate-cli.js` (migrations for `DATABASE_URL` only, never a test database), and `deploy/backup.sh` backs up the database every night. Every server command is in `docs/DEPLOY.md`.

## Definition of done
- A failing test existed first and now passes; the whole suite, lint and typecheck pass.
- Names match the glossary.
- The change is in a small PR with a Conventional Commit title.
- Docs that cite code (`DESIGN.md`, `TESTING.md`) still point at the right lines.
- If an AI suggestion was rejected or changed by the author, it is recorded in `docs/AI_LOG.md`.

## Commit style
Conventional Commits, for example `feat(core): classify Needs Review after window closes`.
