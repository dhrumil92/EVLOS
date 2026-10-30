# ARCHITECTURE

How the system is put together. The graded design rules, decisions and boundary live in `DESIGN.md`. Names follow `UBIQUITOUS_LANGUAGE.md`. Everything here is planned until the code exists; update it as the code lands.

## Tech stack
Status: proposed choices for the 30-day build. A choice is confirmed once it is used in the repo; versions are pinned exactly when each is added.

| Layer | Choice | Why |
|-------|--------|-----|
| Language | TypeScript (strict) everywhere | One language, types as design, matches the author's full-stack goal. |
| Runtime | Node.js 22 LTS | Already used for the Device test server. |
| API | Fastify | Small, fast, easy to test with `inject`; serves the Device endpoints too. |
| Web | React with Vite and Tailwind, shadcn/ui components | Quick to build a clear table-and-panel UI without designing from scratch. |
| Database | PostgreSQL 16 with Drizzle ORM and SQL migrations | Constraints for uniqueness and idempotency; light on a 1 GB VM. |
| Live updates | Server-Sent Events | One-way push of new Punches; simpler than WebSockets. |
| Scheduler | In-process loop in Asia/Kolkata plus the `outbox_emails` table | Enough at this scale and easy to explain. |
| Email | Nodemailer through an SMTP provider on port 587 (local mail catcher in development; Gmail app password for early testing; a provider such as Brevo chosen in Phase 5) | GCP blocks outbound port 25, and mail sent straight from a VM IP usually lands in spam. |
| Reports | CSV by hand; Excel with a library such as ExcelJS | Needed for FR-11. |
| Auth | Session cookies, Argon2 password hashing | No hand-rolled crypto. |
| Tests | Vitest, Fastify `inject`, a real PostgreSQL test database for repository tests, Playwright for one or two flows | Rules are pure and fast to test; see `TESTING.md`. |
| Quality | ESLint with the `complexity` rule on, Prettier, strict TypeScript | The course measures complexity. |
| Delivery | GitHub Actions (lint, typecheck, test with a Postgres service container, deploy); Docker Compose and Caddy (HTTPS) on the VM only | Repeatable deploys to one small VM. |
| Operations | Pino logs, `/health`, an uptime check, nightly database backup | NFR-9. |
| Hosting | Google Cloud free-tier VM (e2-micro, 1 GB RAM), after Phase 4 | The Device speaks plain HTTP on its own port; the scheduler needs a long-running process. |

## Environments
- **Local (the author's PC, Phases 1 to 5):** the PostgreSQL already installed on the machine, with a user `evlos` and databases `evlos` (development) and `evlos_test` (tests, may be wiped). Emails go to a local mail catcher (Mailpit). The Device pushes to the PC over the same Wi-Fi.
- **CI (GitHub Actions):** a Postgres service container; no Docker on the author's PC is involved.
- **Production (GCP VM, from Phase 6):** Docker Compose with `api` and `caddy`; PostgreSQL on the VM or a free managed tier, with its own database and user for EVLOS.

## 1. Context
```
Fingerprint Device --(plain HTTP, Device push)--> API (Fastify) --> PostgreSQL
                                                    |  ^
Rector's browser --(HTTPS, login)--> Caddy -------->|  |-- live updates to the browser
                                                    |
                                                    +--> email (SMTP, port 587)
```
In production, one small VM runs Caddy and the API. The Device keeps its own Punches and re-uploads if the server is down.

## 2. Layers (hexagonal)
```
packages/core      pure rules and types: Pooja Status, Pooja Window, Away, Due Back,
                   Active, Report building. No I/O, no system clock.
apps/api
  use cases        RecordPunch, AddStudent, DeactivateStudent, ActivateStudent,
                   RecordLeave, RecordLeaveForMany, RecordReturn, GetDay,
                   OverrideStatus, FinalizeDay, BuildReport
  ports            Clock, PunchRepository, StudentRepository, LeaveRepository,
                   DayRepository, Notifier
  adapters         device (Device protocol parser), postgres (Drizzle), email
                   (Nodemailer), roster (first-load script, later upload),
                   http routes, scheduler
apps/web           React UI for the Rector
```
Dependencies point inward: adapters know about the core, the core knows nothing about adapters.

## 3. Data model
Facts are stored; statuses are computed. Only the Rector's decisions are stored as results.

| Table | Key columns | Notes |
|-------|-------------|-------|
| `students` | `student_id` PK, name, room, email, phone | The Student ID is the number registered on the Device and is never reused. The exact type is decided from real Device data. Students are never deleted. No fingerprint data. |
| `student_active_periods` | `student_id`, `active_from`, `active_until` null | One open period while a Student is Active. Deactivate closes it with today's date; Activate opens a new one. A Student is Active on a Day if some period covers it, so deactivating and reactivating never rewrites history. |
| `devices` | `serial_number` PK, label | Known Devices only. |
| `punches` | device serial, `student_id`, `punched_at` (timestamptz), `received_at`; unique on serial, `student_id`, `punched_at` | Never edited. The unique key makes re-uploads harmless. No foreign key on purpose: Punches from unknown or Deactivated IDs are kept but not counted. |
| `leaves` | `student_id`, `out_at`, `expected_return_at`, `returned_at` null, `cancelled_at` null | Open while `returned_at` and `cancelled_at` are null. Away and Due Back are derived. |
| `day_finalizations` | `day` PK, finalized by, finalized at | Locks a Day. |
| `pooja_results` | `day`, `student_id` PK; status, first punch time, override reason | Written at Finalize only. Before Finalize the status is computed on read. |
| `outbox_emails` | kind, recipient, subject, body, `dedupe_key` unique, status, attempts, `send_after`, `sent_at` | Kinds: Notification, Review Reminder, Daily Report, Monthly Report. |
| `users`, `sessions` | email, password hash, role | One Rector account at first. |
| `audit_log` | who, what, when, subject | Leave, Return, Override, Finalize, Deactivate, Activate. |

Dates are stored as timestamptz in UTC and converted with an explicit Asia/Kolkata zone for all rules. A Day is an IST calendar date.

## 4. Key flows
**Punch.** Device pushes to its endpoints -> the Device adapter parses the upload, checks the serial, converts the timestamp to IST -> `RecordPunch` stores it once -> the live view is notified.

**Day view.** The Rector's page asks for a Day -> the use case loads Active Students, Punches and Leaves -> the core computes each Pooja Status with the injected Clock -> the UI shows Present, Not Applicable, Pending and Needs Review, with Away in red and Due Back in yellow (always with text).

**Settings panel.** The gear icon on a row opens two tabs: Leave status (record Leave or Return) and Danger zone (Deactivate or Activate). The common gear icon opens search-and-select for Leave or Return for many Students; the use case reports which Students were skipped because a Leave was already open.

**Finalize.** The Rector reviews Needs Review, applies Overrides, clicks Finalize -> in one transaction: write `pooja_results`, write `day_finalizations`, insert one Notification per Absent Student into `outbox_emails` with a `dedupe_key` of kind, Day and Student.

**Scheduler.** An in-process loop in Asia/Kolkata:
- every minute: send due rows from `outbox_emails`, mark sent or failed, retry failures a few times;
- 23:00: Review Reminder if the Day is not Finalized and Needs Review Students exist;
- 23:30: Daily Report to the Rector, marked Not Finalized where the Day is not Finalized;
- 09:00 on the 1st: Monthly Report for the previous month.
Each job writes a row with a `dedupe_key`, so running twice does not send twice.

**Report.** Built by the core from stored data for a Day, month or date range, rendered to CSV or Excel. The monthly grid (Students by Days) is an export format, not the storage format.

**First load.** A one-time script reads the matched Excel (names, rooms, Student IDs from the Device user list), validates it like the form, and creates the Students. Real data stays out of the repo.

## 5. Deployment (Phase 6)
- Docker Compose on the VM: `api` and `caddy` (and PostgreSQL if kept local to the VM).
- Caddy serves the UI over HTTPS. A separate plain-HTTP port (8081) exposes only the Device endpoints.
- GitHub Actions runs lint, typecheck and tests on every pull request and deploys on merge to `main`.
- Config in environment variables. Nightly database backup. Health endpoint and an uptime check.
- Free tier note: one e2-micro with 1 GB RAM, so keep the app lean; stop unrelated containers or use a separate account. Run `free -m` and confirm the region (us-west1, us-central1 or us-east1) before relying on it.

## 6. Security and privacy
- The Rector site requires login, uses HTTPS and session cookies, and hashes passwords with Argon2.
- The Device endpoint cannot carry a password. It accepts only known serial numbers, ignores unknown Student IDs, and is rate limited.
- Minimal personal data. No fingerprint templates. Real Student emails only after the Rector agrees in writing.

## 7. Extension seam
New Devices and activities (library footfall, mess meals, gym visits, pathshala) reuse the Punch store. A Device will later carry a purpose, and each activity gets its own rule module that reads Punches and is registered without editing the Pooja rules. This is not built now; the only work today is keeping Pooja rules out of the Device adapter and out of the Punch store.

## 8. Decisions in brief
- PostgreSQL is the source of truth; Google Sheets is not used for storage. Reports export to CSV and Excel.
- One VM and one app instead of serverless, because the Device speaks plain HTTP on its own port and the scheduler needs a long-running process.
- Outbox table plus a minute loop instead of a job-queue library, to keep the system small and explainable.
- Statuses are computed from facts and stored only at Finalize.
- Student ID is the Device's number; there is no second identifier.
- Build and run locally first; deploy after Phase 4.
