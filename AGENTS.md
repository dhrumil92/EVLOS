# AGENTS.md

Instructions for AI coding agents (Google Antigravity or any other) working on EVLOS. Read this first. If Antigravity does not pick this file up automatically, paste it into the workspace Rules.

## What this project is
A hostel Pooja attendance system: a fingerprint Device pushes Punches to a server; the Rector records Leaves and Returns, reviews exceptions, Finalizes the Day; Students are emailed only after Finalize; the Rector gets Reports. Requirements: `docs/PRD.md`. Structure and tech stack: `docs/ARCHITECTURE.md`. Schedule: `docs/PHASES.md`.

## Non-negotiables
1. **Use the glossary.** Names in code, tests, commits and UI come from `UBIQUITOUS_LANGUAGE.md`. Never invent a synonym (no "attendance", "log", "user", "warden", "biometric ID", and no "absent" for a Leave). If a needed concept is missing, stop and ask; do not name it yourself.
2. **Core is pure.** `packages/core` has no database, network, filesystem, `Date.now()` or `new Date()`. Time comes from an injected `Clock`. Everything external is behind a port.
3. **The Device protocol stays in the adapter.** Nothing outside the Device adapter knows about the Device protocol, its serial numbers, or its timestamp format. Convert to IST at the boundary.
4. **Time is IST.** A Day is an IST calendar date. Schedules run in Asia/Kolkata. The server runs in UTC, so never rely on the server's local time.
5. **Test first.** For every rule: write a failing test, run it and confirm it fails for the right reason, then implement. Tests use Arrange / Act / Assert, one behaviour per test, and names that state the rule in glossary words. Do not write tests that only mirror the implementation.
6. **No secrets in code, prompts or commits.** Config comes from environment variables; keep `.env.example` current. Never touch production or cloud credentials. Never commit real Student data or the Rector's files.
7. **Databases.** Local development uses the PostgreSQL already installed on the author's machine: database `evlos` for development, `evlos_test` for tests, user `evlos`. Never run tests against `evlos`. Never touch any other database on the machine.

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
TypeScript (strict), Node 22, Fastify, React with Vite and Tailwind, PostgreSQL with Drizzle, Vitest, Playwright for a few end-to-end flows, ESLint, Prettier. npm workspaces: `packages/core`, `apps/api`, `apps/web`. Docker Compose and Caddy are for deployment on the VM only, not for local development.

## Commands
TBD. Filled in when the repo skeleton lands (install, test, lint, typecheck, dev, build, db:setup, migrate).

## Definition of done
- A failing test existed first and now passes; the whole suite, lint and typecheck pass.
- Names match the glossary.
- The change is in a small PR with a Conventional Commit title.
- Docs that cite code (`DESIGN.md`, `TESTING.md`) still point at the right lines.
- If an AI suggestion was rejected or changed by the author, it is recorded in `docs/AI_LOG.md`.

## Commit style
Conventional Commits, for example `feat(core): classify Needs Review after window closes`.
