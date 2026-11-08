# ARCHITECTURE

How the system is put together. The graded design rules, decisions and boundary live in `DESIGN.md`. Names follow `UBIQUITOUS_LANGUAGE.md`. Checked against the code on 2026-11-05 (end of Phase 5); anything not built yet is marked with the phase that brings it.

## Tech stack
Status: a choice is confirmed once it is used in the repo; versions are pinned exactly when each is added. In use now: TypeScript, Node 22, Fastify, React with Vite and Tailwind, PostgreSQL 17 with Drizzle, Server-Sent Events, session cookies with Argon2, Nodemailer over SMTP (Gmail with an app password; Mailpit for local tests), write-excel-file for Excel Reports, Vitest, ESLint, Prettier, GitHub Actions CI. Dropped on 2026-11-05: Playwright (see the Tests row). Not yet: Docker Compose, Caddy, hosting, `/health`, backups and the uptime check (Phase 6).

| Layer | Choice | Why |
|-------|--------|-----|
| Language | TypeScript (strict) everywhere | One language, types as design, matches the author's full-stack goal. |
| Runtime | Node.js 22 LTS | Already used for the Device test server. |
| API | Fastify | Small, fast, easy to test with `inject`; serves the Device endpoints too. |
| Web | React with Vite and Tailwind (plain components; shadcn/ui was not needed) | Quick to build a clear table-and-panel UI. |
| Database | PostgreSQL 17 with Drizzle ORM and SQL migrations | Constraints for uniqueness and idempotency; light on a 1 GB VM. |
| Live updates | Server-Sent Events | One-way push of new Punches; simpler than WebSockets. |
| Scheduler | In-process loop in Asia/Kolkata plus the `outbox_emails` table | Enough at this scale and easy to explain. |
| Email | Nodemailer through an SMTP provider on port 587: Gmail with an app password (chosen 4 Nov; about 500 emails a day), Mailpit on this machine for tests. Every email is sent as HTML and as plain text together. `npm run email:test` checks the settings; `npm run email:preview` sends a sample of any email to an address. | GCP blocks outbound port 25, and mail sent straight from a VM IP usually lands in spam. Any SMTP provider can replace Gmail through `.env` alone. |
| Reports | CSV by hand; Excel with `write-excel-file` (one dependency; `read-excel-file` only in tests, to read the file back) | Needed for FR-11. ExcelJS was set aside: no release since 2023 and many dependencies. |
| Auth | Session cookies, Argon2 password hashing | No hand-rolled crypto. |
| Tests | Vitest, Fastify `inject`, a real PostgreSQL test database for repository tests, React Testing Library for the pages | Rules are pure and fast to test; see `TESTING.md`. Playwright browser tests were planned for one or two flows and dropped on 2026-11-05 to keep time for deployment: the whole flow was instead run by hand on a real Day (4 Nov). One may be added in Phase 7 if time allows. |
| Quality | ESLint with the `complexity` rule on, Prettier, strict TypeScript | The course measures complexity. |
| Delivery | GitHub Actions (lint, typecheck, format check, test with a Postgres service container); Docker Compose and Caddy (HTTPS) on the VM only, updated by hand with `git pull` and `docker compose up -d --build` | Repeatable deploys to one small VM. An automatic deploy on merge was cut from Phase 6. |
| Operations | Pino logs, an uptime check on `/api/public/live`, nightly database backup (not built yet) | NFR-9. The Public Live View route reads the database, so it doubles as the health check and needed no new route. |
| Hosting | Google Cloud free-tier VM (e2-micro, 1 GB RAM), after Phase 4 | The Device speaks plain HTTP on its own port; the scheduler needs a long-running process. |

## Environments
- **Local (the author's PC, Phases 1 to 5):** the PostgreSQL already installed on the machine, with a user `evlos` and databases `evlos` (development) and `evlos_test` (tests, may be wiped). Emails go to a local mail catcher (Mailpit) for tests, or to real inboxes through Gmail when `.env` has the Gmail settings. The Device pushes to the PC over the same Wi-Fi. The page's API listens on `127.0.0.1` only and needs a Rector login; on the VM it is reached only through Caddy over HTTPS.
- **CI (GitHub Actions):** a Postgres service container; no Docker on the author's PC is involved.
- **Production (GCP VM, from Phase 6):** Docker Compose with `postgres`, `api` and `web` (`deploy/docker-compose.yml`), and a separate edge Caddy (`deploy/edge`) that alone holds ports 80 and 443; PostgreSQL 16 in its own container with its own volume. Caddy must answer any page address that is not a file, such as `/reset-password`, with `index.html`, as Vite does locally, and `PUBLIC_URL` must be the HTTPS address, so the link in a reset email opens.

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
                   canFinalize, studentsToNotify, Session and reset link expiry,
                   when the Device has gone quiet,
                   Report hour slots, email retries, the times of scheduled
                   emails. No I/O, no system clock.
apps/api
  use cases        recordPunches, addStudent, editStudent, deactivateStudent,
                   activateStudent, recordLeave, editLeave, cancelLeave,
                   returnLeave, recordLeaves and returnLeaves (many Students),
                   listStudents, getLiveView, getDeviceStatus, getReview, finalizeDay,
                   sendNotifications (which also saves each Exclude), getReport,
                   sendDueEmails, queueReviewReminder, queueDailyReport,
                   queueMonthlyReport, listReportRecipients, addReportRecipient,
                   removeReportRecipient, loadRoster, createRector, setRectorPassword, logIn,
                   logOut, changePassword, requestPasswordReset, resetPassword
  ports            Clock (in core), DeviceRegistry, PunchRepository,
                   StudentRepository, LeaveRepository, FinalizeRepository,
                   RectorRepository, ReportRecipientRepository, LiveFeed,
                   Passwords, SessionTokens, Notifier, OutboxRepository
  adapters         device (Device protocol parser and routes), postgres (Drizzle),
                   http routes (and PUBLIC_URL for reset links), login (Argon2
                   and session tokens), roster (CSV reader for the first load),
                   email (Nodemailer over SMTP, which also attaches the logo and
                   the evlos wordmark inside each HTML email), scheduler (the
                   schedule loop), report (one shared table, written as CSV or
                   coloured Excel; the Vidyalaya Presence Excel; the files for
                   the emails)
  email-templates  the HTML of every email in the Tiles design: one layout (indigo
                   header, white card, no colour around it) and a function for each
                   email (Student Notification, Daily and Monthly Report, Review
                   Reminder, password reset, test email). Layout only, no rules.
                   Text from a person is escaped. The plain-text body is still
                   written in the use case, so both versions say the same words.
apps/web           React UI for the Rector in the Dawn design: login (with
                   forgot password), live view, Students (each Student's month,
                   Vidyalaya Presence download), Leaves (the two books),
                   Review and Finalize, Reports (Day, Month, Pick dates),
                   Settings (Report Recipients, password, Device and times),
                   the reset password page; a sticky menu bar, and a side menu
                   on phones
```
Dependencies point inward: adapters know about the core, the core knows nothing about adapters. Reports are put together in the `getReport` use case from core rules; the core holds no Report builder of its own.

## 3. Data model
Facts are stored; statuses are computed. Only the Rector's decisions are stored as results. The tables are defined in `apps/api/src/db/schema.ts`; migrations are in `apps/api/migrations/`.

| Table | Key columns | Notes |
|-------|-------------|-------|
| `students` | `student_id` PK, name, room, email, phone | The Student ID is the number registered on the Device and is never reused. The exact type is decided from real Device data. Students are never deleted. No fingerprint data. |
| `student_active_periods` | `student_id`, `active_from`, `active_until` null | One open period while a Student is Active. Deactivate closes it with today's date; Activate opens a new one. A Student is Active on a Day if some period covers it, so deactivating and reactivating never rewrites history. |
| `devices` | `device_serial` PK, label, `last_seen_at` null | `last_seen_at` is the Device's Last Seen, updated on every call it makes (every 30 seconds while online). Registered Devices only; today one row, the Pooja Device. A purpose column is added when a second Device arrives (section 7). |
| `punches` | device serial, `student_id`, `punched_at` (timestamptz), `received_at`; unique on serial, `student_id`, `punched_at` | Never edited. The unique key makes re-uploads harmless. No foreign key on `student_id` on purpose: Punches from unknown or Deactivated Student IDs are kept but not counted. Uploads from an unregistered Device Serial are refused and not stored. |
| `leaves` | `id` PK, `student_id`, `out_at`, `expected_return_at`, `returned_at` null, `cancelled_at` null | Open while `returned_at` and `cancelled_at` are null. Away and Due Back are derived. |
| `day_finalizations` | `day` PK, finalized by, finalized at | Locks a Day. |
| `pooja_results` | `day`, `student_id` PK; status, first punch time, `excluded_at` null | Written at Finalize only. Before Finalize the status is computed on read. `excluded_at` is set when the Rector Excludes an Absent Student. |
| `outbox_emails` | kind, recipient, subject, body, `html` (nullable), `dedupe_key` unique, status, attempts, `send_after`, `sent_at` | Kinds: Notification, Review Reminder, Daily Report, Monthly Report. `body` is the plain text and `html` the same email with layout; an email queued before migration 0012 has no `html` and goes out as plain text. The password-reset email is not queued, so its link is never stored. `status` goes queued -> sending -> sent; a refused email goes back to queued for a retry, or to failed after the third refusal. |
| `outbox_attachments` | `outbox_email_id`, `position` PK; file name, `content` (bytes) | The files sent with an outbox email, in order: a Daily Report and a Monthly Report carry the Pooja Excel file, then the Vidyalaya Presence Excel file. Kept as bytes, since an Excel file is not text. Saved in the same transaction as the email, and only for a new `dedupe_key`. Migration 0008 moved the CSVs from the old `attachment` column here. |
| `rectors`, `rector_sessions` | email, Argon2 password hash; SHA-256 hash of the session token, expiry | Each Rector's account is made with `npm run rector:create`, once per Rector; a locked-out Rector gets a new password with `npm run rector:password`, which ends all the Rector's sessions, closes open reset links and writes a Reset Password audit row with the detail "command line". Named after the glossary, not "users". A password change (`POST /api/password`) saves the new hash, deletes the Rector's other sessions and writes the audit row in one transaction; the session that asked stays. |
| `password_resets` | `token_hash` PK (SHA-256 of the link's token), `rector_id`, `expires_at` (30 minutes after asking), `used_at` null | Forgot password links. Using one is a single update that checks it is unused and not expired, then, in the same transaction, saves the new hash, closes the Rector's other links, deletes all the Rector's sessions and writes a Reset Password audit row. |
| `audit_log` | `action`, `student_id` (empty for a Day action), `done_at`, `done_by`, `detail` (null unless the action is about something other than a Student) | Rows are only added. Actions: Leave, Edit Leave, Cancel Leave, Return, Finalize, Exclude, Send Notifications, Deactivate, Activate, Add Report Recipient, Remove Report Recipient (the address in `detail`), Change Password, Reset Password. |
| `report_recipients` | `email` PK (lower case), `added_at` | The Report Recipients, kept on the Settings page. Who added or removed each one is in `audit_log`. |

Dates are stored as timestamptz in UTC and converted with an explicit Asia/Kolkata zone for all rules. A Day is an IST calendar date.

## 4. Key flows
**Punch.** Device pushes to its endpoints -> the Device adapter parses the upload, refuses an unregistered Device Serial, converts the timestamp to IST -> `recordPunches` stores it once -> the live view is notified over Server-Sent Events. A Punch for a Finalized Day is stored and the Day stays locked. On the Review page, an Absent Student with a Punch After Finalize (inside the Pooja Window, `received_at` later than the Day's `finalized_at`) is labelled with its time before Send Notifications (PRD FR-2).

**Last Seen.** Every call from a registered Device, including the one every 30 seconds, sets `devices.last_seen_at`. `GET /api/device-status` gives the Last Seen and whether the Device has gone quiet (core `isDeviceQuiet`, 10 minutes); the live view and the Review page ask for it every minute, and a quiet Device is named in the Finalize question.

**Day view.** The Rector's page asks for a Day -> the use case loads Active Students, Punches and Leaves -> the core computes each Pooja Status with the injected Clock -> the UI shows Present, Not Applicable, Pending and Needs Review, with Away in red and Due Back in yellow (always with text).

**Student panel.** Clicking a row on the Students page opens a side panel with the Student's month of Pooja Statuses, the Leave box (record Leave or Return), Details (edit name, room, email and phone; the Student ID never changes) and a Deactivate or Activate link. Leaves and Returns for many Students are recorded on the Leaves page, one tab per paper book: the Going-to-Home Book (one line per Student, room first; the line rules are in `apps/web/src/going-book.ts`) and the Back-from-Home Book (tick the Away Students; `apps/web/src/back-book.ts`). The use case answers per line, so a refused line keeps its reason and the others are saved.

**Finalize.** Available only after the Pooja Window closes (18:00 IST). The Rector reviews Needs Review and clicks Finalize -> in one transaction: write `pooja_results` (each Needs Review becomes Absent), write `day_finalizations`, write the audit row. No email is queued. A Finalized Day cannot be reopened (PRD open question 4).

**Exclude and Send Notifications.** The Review page shows the Absent Students with a cross each. The Rector Excludes some and clicks Send Notifications -> in one transaction: set `excluded_at` for the Excluded Students, insert one Notification per remaining Absent Student into `outbox_emails` with a `dedupe_key` of kind, Day and Student, and write the audit rows. A second click finds the keys already present and queues nothing. The Review page then shows each Notification as queued, sent or not sent.

**Scheduler.** One in-process loop, run every minute (`apps/api/src/adapters/scheduler/schedule-loop.ts`). Each run first queues the scheduled emails that fell due since the last run, then sends the due emails. The times are worked out in IST by the core (`packages/core/src/schedule.ts`), so the server's UTC clock never matters. An email missed while the server was off is caught up later the same IST Day, never on a later Day. If queuing one fails, the next run tries it again; a run never starts while the last is still going.
- every run (built): take the due rows from `outbox_emails` and mark each as being sent before handing it to the email provider, so none is sent twice; mark it sent, or queue it again 5 minutes later, or mark it failed after the third refusal;
- 23:00 (built): Review Reminder, one email for each Report Recipient listing the Students on Needs Review by room, only if the Day is not Finalized and such Students exist. The list comes from the same Review the Review page shows;
- 23:30 (built): Daily Report, one email for each Report Recipient, with the counts in the body and the Day's Report and Vidyalaya Presence attached as Excel files; marked Not Finalized where the Day is not Finalized. Its `dedupe_key` is kind, Day and address;
- 09:00 on the 1st (built): Monthly Report for the previous month, one email for each Report Recipient, with every Pooja Status of the month counted, the Days not Finalized named, and the month's Report and Vidyalaya Presence attached as Excel files. Its `dedupe_key` is kind, month and address.
Each job writes a row with a `dedupe_key`, so running twice does not send twice.

**Report.** Built by the `getReport` use case from stored data for a Day, month or date range: a Finalized Day is read from `pooja_results`, any other Day is worked out from Punches and Leaves. Shown on the Reports page and downloaded as CSV from `GET /api/reports/csv` or as Excel from `GET /api/reports/xlsx`: one row per Student, one column per Day, Not Applicable as "-", and a Day not Finalized marked in its heading. Both files are built from one shared table (`report-table.ts`), so they always hold the same cells; the Excel file stores every cell as text, so a Student ID keeps its leading zeros and no cell can run as a formula, and colours each Pooja Status with Excel's own styles (Present green, Absent red, Needs Review yellow, Not Applicable and Pending grey). A CSV is plain text, so it has no colours. A download may add `status` (for example `&status=Absent`, the filter chosen on the page): `withStatus` then keeps only the Students who had that Pooja Status on at least one Day, before either file is built, and the file name ends with the status. Report emails attach the Pooja Excel file and Vidyalaya Presence as a second Excel file; there is no CSV in the email. The monthly grid (Students by Days) is an export format, not the storage format.

**Vidyalaya Presence.** Built by the `getVidyalayaPresence` use case from Students, their Active periods and Leaves, never from Punches, so it needs no Finalize and is worked out again each time. The rule is `isAwayOnDay` in the core: Away from the Day of the Out Time up to, but not including, the Day of the Return Time, and Away on every Day from the Out Time while there is no Return Time. Rooms are sorted with numeric text comparison, so 110 comes before 201. `presenceXlsx` writes the Excel file (the Room and Name columns, one column for each Day, then Days In hostel and Days Away). It is downloaded from `GET /api/vidyalaya-presence/xlsx` (a Day or a month, no range) and attached by `reportAttachments` to the Daily Report and Monthly Report emails. The Students page has no state of its own for it: the button builds the link.

**Public Live View.** A second small Fastify server on `PUBLIC_PORT` (3001, this machine only), apart from the Rector's: it registers no login, sets no cookie and has one read-only route, `GET /api/public/live`, which takes no input. Every other address on it is "not found". `getPublicLiveView` works out today's numbers from `getReport`, so they follow the same Pooja rules: Present, and the Students expected (Active, less Not Applicable), plus how many first Punches fell in each 15-minute bar (`poojaSlotOf` in the core). The route keeps its answer for 30 seconds and shares it between viewers who ask at once, allows one address 1200 requests a minute (all the Students on the hostel Wi-Fi share one internet address, and each page asks twice a minute), and sends `X-Robots-Tag: noindex` and `Cache-Control: no-store`. The page at `/live` is shown by `main.tsx` without the login gate, asks again every 30 seconds with `credentials: 'omit'`, and draws the bars with the same `PunchBand` as the Rector's Live view. On the VM, Caddy sends `/api/public/` to `PUBLIC_PORT` and every other `/api/` to `PAGE_PORT`.

**First load.** `npm run students:load -- <file.csv>` reads the Rector's list (Student IDs, names, rooms, emails), saved from Excel as "CSV UTF-8" with the columns of `sample-roster.csv`. It checks every row like the form and reports problems by line; with `--save` it adds every Student in one transaction, or none. Real data stays out of the repo.

## 5. Deployment (Phase 6)
The full steps are in `docs/DEPLOY.md`; running more projects on the VM is in `docs/VM_MULTI_PROJECT.md`.
- Docker Compose on the VM: `postgres`, `api` and `web`. The Dockerfile has two targets, `api` (the server and the migrations) and `web` (the built page as plain files). Images are built on the VM.
- An edge Caddy, in its own Compose project, is the only thing on ports 80 and 443. It gets the HTTPS certificate for `evlos.34-55-12-141.sslip.io` and sends `/api/public` to port 3001, `/api` to port 3000 and everything else to `web`. It is separate from EVLOS so that later projects on the same VM join the shared `edge` network and add one block to its Caddyfile. A Vercel front page was considered and not used: Vercel cannot host the Device endpoint, the schedule loop or PostgreSQL, and a rewrite to the VM would leave that hop unencrypted.
- A separate plain-HTTP port (8081) exposes only the Device endpoints. The page server and the Public Live View listen on `PAGE_HOST` and `PUBLIC_HOST` (127.0.0.1 locally, 0.0.0.0 inside the container); Compose publishes neither port.
- GitHub Actions runs lint, typecheck and tests on every push and pull request. The VM is updated by hand; an automatic deploy on merge was cut.
- Config in environment variables (`deploy/.env` on the VM, never committed). The uptime check reads `/api/public/live`. A nightly database backup is still to be built: snapshots are off because they are not free.
- Free tier: one e2-micro with 1 GB RAM and 2 GB of swap, a 30 GB standard disk, no snapshots, no Ops Agent, a static IP kept attached, in us-central1. EVLOS uses about 480 MB, leaving about 470 MB available. Run `free -m` before adding a project.

## 6. Security and privacy
- The Rector site requires login, uses HTTPS and session cookies, and hashes passwords with Argon2.
- The Device endpoint cannot carry a password. It accepts only registered Device Serials and refuses all others, and stores Punches for unknown Student IDs without counting them. Not rate limited, so a Device's uploads are never refused; the firewall on the VM opens only its port.
- Request limits, counted per address: login, forgotten password and password change 5 tries in 15 minutes; every other page route 600 requests a minute, counted before the login check so a flood of requests that are not logged in is refused too; the Public Live View 1200 a minute (the hostel Wi-Fi gives every Student one shared address). On the VM `TRUST_PROXY=true`, so the limits count the visitor's address that Caddy passes on, not Caddy's own.
- The Public Live View runs on its own server with one read-only route that takes no input, and answers with numbers only.
- Dependencies are pinned exactly. `npm audit --omit=dev` checks the code the server runs (0 findings on 2026-11-08); `npm audit` also checks the development tools (14 moderate findings on 2026-11-08, all in tools that never run on the server: esbuild through the dev tooling and minimatch through ESLint).
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
