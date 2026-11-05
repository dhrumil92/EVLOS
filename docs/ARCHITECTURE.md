# ARCHITECTURE

How the system is put together. The graded design rules, decisions and boundary live in `DESIGN.md`. Names follow `UBIQUITOUS_LANGUAGE.md`. Checked against the code on 2026-11-04 (end of Phase 4); anything not built yet is marked with the phase that brings it.

## Tech stack
Status: a choice is confirmed once it is used in the repo; versions are pinned exactly when each is added. In use now: TypeScript, Node 22, Fastify, React with Vite and Tailwind, PostgreSQL 17 with Drizzle, Server-Sent Events, session cookies with Argon2, Nodemailer over SMTP (Gmail with an app password; Mailpit for local tests), write-excel-file for Excel Reports, Vitest, ESLint, Prettier, GitHub Actions CI. Not yet: Playwright; Docker Compose, Caddy, hosting, `/health`, backups and the uptime check (Phase 6).

| Layer | Choice | Why |
|-------|--------|-----|
| Language | TypeScript (strict) everywhere | One language, types as design, matches the author's full-stack goal. |
| Runtime | Node.js 22 LTS | Already used for the Device test server. |
| API | Fastify | Small, fast, easy to test with `inject`; serves the Device endpoints too. |
| Web | React with Vite and Tailwind (plain components; shadcn/ui was not needed) | Quick to build a clear table-and-panel UI. |
| Database | PostgreSQL 17 with Drizzle ORM and SQL migrations | Constraints for uniqueness and idempotency; light on a 1 GB VM. |
| Live updates | Server-Sent Events | One-way push of new Punches; simpler than WebSockets. |
| Scheduler | In-process loop in Asia/Kolkata plus the `outbox_emails` table | Enough at this scale and easy to explain. |
| Email | Nodemailer through an SMTP provider on port 587: Gmail with an app password (chosen 4 Nov; about 500 emails a day), Mailpit on this machine for tests. `npm run email:test` checks the settings. | GCP blocks outbound port 25, and mail sent straight from a VM IP usually lands in spam. Any SMTP provider can replace Gmail through `.env` alone. |
| Reports | CSV by hand; Excel with `write-excel-file` (one dependency; `read-excel-file` only in tests, to read the file back) | Needed for FR-11. ExcelJS was set aside: no release since 2023 and many dependencies. |
| Auth | Session cookies, Argon2 password hashing | No hand-rolled crypto. |
| Tests | Vitest, Fastify `inject`, a real PostgreSQL test database for repository tests, Playwright for one or two flows | Rules are pure and fast to test; see `TESTING.md`. |
| Quality | ESLint with the `complexity` rule on, Prettier, strict TypeScript | The course measures complexity. |
| Delivery | GitHub Actions (lint, typecheck, test with a Postgres service container, deploy); Docker Compose and Caddy (HTTPS) on the VM only | Repeatable deploys to one small VM. |
| Operations | Pino logs, `/health`, an uptime check, nightly database backup | NFR-9. |
| Hosting | Google Cloud free-tier VM (e2-micro, 1 GB RAM), after Phase 4 | The Device speaks plain HTTP on its own port; the scheduler needs a long-running process. |

## Environments
- **Local (the author's PC, Phases 1 to 5):** the PostgreSQL already installed on the machine, with a user `evlos` and databases `evlos` (development) and `evlos_test` (tests, may be wiped). Emails go to a local mail catcher (Mailpit) for tests, or to real inboxes through Gmail when `.env` has the Gmail settings. The Device pushes to the PC over the same Wi-Fi. The page's API listens on `127.0.0.1` only and needs a Rector login; on the VM it is reached only through Caddy over HTTPS.
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
packages/core      pure rules and types: Day, Pooja Window, Pooja Status, Away,
                   Due Back, Leave and Return checks, Active, Student checks,
                   canFinalize, studentsToNotify, Session expiry, Report hour
                   slots, email retries, the times of scheduled emails. No I/O,
                   no system clock.
apps/api
  use cases        recordPunches, addStudent, editStudent, deactivateStudent,
                   activateStudent, recordLeave, editLeave, cancelLeave,
                   returnLeave, recordLeaves and returnLeaves (many Students),
                   listStudents, getLiveView, getReview, finalizeDay,
                   sendNotifications (which also saves each Exclude), getReport,
                   sendDueEmails, queueReviewReminder, queueDailyReport,
                   queueMonthlyReport, loadRoster, createRector, logIn, logOut
  ports            Clock (in core), DeviceRegistry, PunchRepository,
                   StudentRepository, LeaveRepository, FinalizeRepository,
                   RectorRepository, LiveFeed, Passwords, SessionTokens,
                   Notifier, OutboxRepository
  adapters         device (Device protocol parser and routes), postgres (Drizzle),
                   http routes, login (Argon2 and session tokens), roster (CSV
                   reader for the first load), email (Nodemailer over SMTP),
                   scheduler (the schedule loop), report (CSV file)
apps/web           React UI for the Rector
```
Dependencies point inward: adapters know about the core, the core knows nothing about adapters. Reports are put together in the `getReport` use case from core rules; the core holds no Report builder of its own.

## 3. Data model
Facts are stored; statuses are computed. Only the Rector's decisions are stored as results. The tables are defined in `apps/api/src/db/schema.ts`; migrations are in `apps/api/migrations/`.

| Table | Key columns | Notes |
|-------|-------------|-------|
| `students` | `student_id` PK, name, room, email, phone | The Student ID is the number registered on the Device and is never reused. The exact type is decided from real Device data. Students are never deleted. No fingerprint data. |
| `student_active_periods` | `student_id`, `active_from`, `active_until` null | One open period while a Student is Active. Deactivate closes it with today's date; Activate opens a new one. A Student is Active on a Day if some period covers it, so deactivating and reactivating never rewrites history. |
| `devices` | `device_serial` PK, label | Registered Devices only; today one row, the Pooja Device. A purpose column is added when a second Device arrives (section 7). |
| `punches` | device serial, `student_id`, `punched_at` (timestamptz), `received_at`; unique on serial, `student_id`, `punched_at` | Never edited. The unique key makes re-uploads harmless. No foreign key on `student_id` on purpose: Punches from unknown or Deactivated Student IDs are kept but not counted. Uploads from an unregistered Device Serial are refused and not stored. |
| `leaves` | `id` PK, `student_id`, `out_at`, `expected_return_at`, `returned_at` null, `cancelled_at` null | Open while `returned_at` and `cancelled_at` are null. Away and Due Back are derived. |
| `day_finalizations` | `day` PK, finalized by, finalized at | Locks a Day. |
| `pooja_results` | `day`, `student_id` PK; status, first punch time, `excluded_at` null | Written at Finalize only. Before Finalize the status is computed on read. `excluded_at` is set when the Rector Excludes an Absent Student. |
| `outbox_emails` | kind, recipient, subject, body, `dedupe_key` unique, status, attempts, `send_after`, `sent_at`, `attachment_name` and `attachment` null | Kinds: Notification, Review Reminder, Daily Report, Monthly Report. A Daily Report and a Monthly Report carry their CSV in `attachment`. `status` goes queued -> sending -> sent; a refused email goes back to queued for a retry, or to failed after the third refusal. |
| `rectors`, `rector_sessions` | email, Argon2 password hash; SHA-256 hash of the session token, expiry | One Rector account at first, made with `npm run rector:create`. Named after the glossary, not "users". |
| `audit_log` | `action`, `student_id` (empty for a Day action), `done_at`, `done_by` | Rows are only added. Actions: Leave, Edit Leave, Cancel Leave, Return, Finalize, Exclude, Send Notifications, Deactivate, Activate. |

Dates are stored as timestamptz in UTC and converted with an explicit Asia/Kolkata zone for all rules. A Day is an IST calendar date.

## 4. Key flows
**Punch.** Device pushes to its endpoints -> the Device adapter parses the upload, refuses an unregistered Device Serial, converts the timestamp to IST -> `recordPunches` stores it once -> the live view is notified over Server-Sent Events. A Punch for a Finalized Day is stored and the Day stays locked. *Not built yet:* the warning the Rector should see for that Student (PRD FR-2).

**Day view.** The Rector's page asks for a Day -> the use case loads Active Students, Punches and Leaves -> the core computes each Pooja Status with the injected Clock -> the UI shows Present, Not Applicable, Pending and Needs Review, with Away in red and Due Back in yellow (always with text).

**Settings panel.** The gear icon on a row opens three tabs: Details (edit name, room, email and phone; the Student ID never changes), Leave status (record Leave or Return) and Danger zone (Deactivate or Activate). The common gear icon opens search-and-select for Leave or Return for many Students; the use case reports which Students were skipped because a Leave was already open.

**Finalize.** Available only after the Pooja Window closes (18:00 IST). The Rector reviews Needs Review and clicks Finalize -> in one transaction: write `pooja_results` (each Needs Review becomes Absent), write `day_finalizations`, write the audit row. No email is queued. A Finalized Day cannot be reopened (PRD open question 4).

**Exclude and Send Notifications.** The Review page shows the Absent Students with a cross each. The Rector Excludes some and clicks Send Notifications -> in one transaction: set `excluded_at` for the Excluded Students, insert one Notification per remaining Absent Student into `outbox_emails` with a `dedupe_key` of kind, Day and Student, and write the audit rows. A second click finds the keys already present and queues nothing. The Review page then shows each Notification as queued, sent or not sent.

**Scheduler.** One in-process loop, run every minute (`apps/api/src/adapters/scheduler/schedule-loop.ts`). Each run first queues the scheduled emails that fell due since the last run, then sends the due emails. The times are worked out in IST by the core (`packages/core/src/schedule.ts`), so the server's UTC clock never matters. An email missed while the server was off is caught up later the same IST Day, never on a later Day. If queuing one fails, the next run tries it again; a run never starts while the last is still going.
- every run (built): take the due rows from `outbox_emails` and mark each as being sent before handing it to the email provider, so none is sent twice; mark it sent, or queue it again 5 minutes later, or mark it failed after the third refusal;
- 23:00 (built): Review Reminder, one email for each address in `REPORT_EMAIL` listing the Students on Needs Review by room, only if the Day is not Finalized and such Students exist. The list comes from the same Review the Review page shows;
- 23:30 (built): Daily Report, one email for each address in `REPORT_EMAIL`, with the counts in the body and the Day's CSV attached; marked Not Finalized where the Day is not Finalized. Its `dedupe_key` is kind, Day and address;
- 09:00 on the 1st (built): Monthly Report for the previous month, one email for each address in `REPORT_EMAIL`, with every Pooja Status of the month counted, the Days not Finalized named, and the month's CSV attached. Its `dedupe_key` is kind, month and address.
Each job writes a row with a `dedupe_key`, so running twice does not send twice.

**Report.** Built by the `getReport` use case from stored data for a Day, month or date range: a Finalized Day is read from `pooja_results`, any other Day is worked out from Punches and Leaves. Shown on the Reports page and downloaded as CSV from `GET /api/reports/csv` or as Excel from `GET /api/reports/xlsx`: one row per Student, one column per Day, Not Applicable as "-", and a Day not Finalized marked in its heading. Both files are built from one shared table (`report-table.ts`), so they always hold the same cells; the Excel file stores every cell as text, so a Student ID keeps its leading zeros and no cell can run as a formula, and colours each Pooja Status with Excel's own styles (Present green, Absent red, Needs Review yellow, Not Applicable and Pending grey). A CSV is plain text, so it has no colours. A download may add `status` (for example `&status=Absent`, the filter chosen on the page): `withStatus` then keeps only the Students who had that Pooja Status on at least one Day, before either file is built, and the file name ends with the status. Report emails attach the CSV of the full Report. The monthly grid (Students by Days) is an export format, not the storage format.

**First load.** `npm run students:load -- <file.csv>` reads the Rector's list (Student IDs, names, rooms, emails), saved from Excel as "CSV UTF-8" with the columns of `sample-roster.csv`. It checks every row like the form and reports problems by line; with `--save` it adds every Student in one transaction, or none. Real data stays out of the repo.

## 5. Deployment (Phase 6)
- Docker Compose on the VM: `api` and `caddy` (and PostgreSQL if kept local to the VM).
- Caddy serves the UI over HTTPS. A separate plain-HTTP port (8081) exposes only the Device endpoints.
- GitHub Actions runs lint, typecheck and tests on every pull request and deploys on merge to `main`.
- Config in environment variables. Nightly database backup. Health endpoint and an uptime check.
- Free tier note: one e2-micro with 1 GB RAM, so keep the app lean; stop unrelated containers or use a separate account. Run `free -m` and confirm the region (us-west1, us-central1 or us-east1) before relying on it.

## 6. Security and privacy
- The Rector site requires login, uses HTTPS and session cookies, and hashes passwords with Argon2.
- The Device endpoint cannot carry a password. It accepts only registered Device Serials and refuses all others, and stores Punches for unknown Student IDs without counting them. *Not built yet:* rate limiting on the Device endpoint; today only the login is rate limited (5 tries per 15 minutes).
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
