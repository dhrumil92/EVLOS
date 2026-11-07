# PHASES

Plan from 2026-10-28 to the 26 Nov end-sem. The viva follows the exam, so the repo is frozen and tagged `project-final` by 25 Nov. Dates are targets; a phase is done only when its exit check passes. Development runs on the author's PC first; deployment comes after Phase 4.

| # | Phase | Target | Exit check | Status (2026-11-08) |
|---|-------|--------|-----------|--------------------|
| 0 | Documents and repo | by 30 Oct | All documents in this repo, consistent with each other; hygiene files in place; first backlog drafted. | Done 30 Oct |
| 1 | Skeleton and CI | 31 Oct to 2 Nov | Monorepo, lint, typecheck, test, CI on every pull request, `.env.example`, `db:setup`, five-command local run. | Done 2 Nov |
| 2 | Core rules, test first | 2 to 6 Nov | The five rules plus Away and Due Back as pure functions with an injected clock, all tested, including IST edge cases. | Done 2 Nov |
| 3 | Local walking skeleton and wireframes | 5 to 9 Nov | Device adapter and PostgreSQL running on the PC; a real Punch from the Device (on the same Wi-Fi) appears in the live view. Wireframes of five screens done: live view with Day history, Student list with gear panel, Leave and Return for many Students, review and Finalize, Reports. One-evening VM rehearsal with a hello-world container. | Done 2 Nov. Two items were dropped as not needed: the wireframes, because eight visual designs were tried on the real page and one was chosen instead; and the VM rehearsal, because the author already runs four Docker containers for two other projects on the same VM. |
| 4 | Rector workflow (local) | 9 to 15 Nov | Login, Student form, per-row gear panel (Leave status and Danger zone), common gear panel for many Students, one-time first load of the 360 Students, Needs Review list, Finalize, Exclude and Send Notifications. The Rector can run a real Day. | Done 3 Nov. The load command is ready; the 360 real Students wait for the Rector's list (PRD open question 1). Send Notifications queues emails; sending is Phase 5. |
| 5 | Emails and Reports | 15 to 19 Nov | Outbox and schedule loop; Notification, 23:00 Review Reminder, 23:30 Daily Report, 09:00 Monthly Report, manual CSV and Excel Reports. Local mail catcher first; real email provider chosen and tested at the end. | Done 5 Nov. Step 1, queued Notifications are sent through SMTP and the Review page shows queued, sent or not sent; step 2, the schedule loop in IST; step 3, CSV download; step 4, the 23:30 Daily Report email with the Report attached (Excel and CSV from 5 Nov; since 8 Nov the Pooja Excel and Vidyalaya Presence as two Excel files, and no CSV, which stays a download on the Reports page), to the Report Recipients; step 5, the 23:00 Review Reminder; step 6, the 09:00 Monthly Report on the 1st; step 7 (5 Nov), Excel download next to the CSV, with the same table and each Pooja Status in its colour, and both downloads follow the Pooja Status filter chosen on the page; step 8, Gmail as the real email provider, checked with `npm run email:test` and run end to end on the night of 4 Nov (Review Reminder, Finalize, Notifications, Daily Report) to the author and friends who agreed; step 4b (5 Nov), the Report Recipients on a new Settings page beside Log out, replacing `REPORT_EMAIL`; change password on the Settings page, and forgot password with a one-time link by email, plus `npm run rector:password` for a Rector locked out when email cannot help (5 Nov); two guards against a wrong Absent email, a Punch After Finalize shown before Send Notifications and the Device's Last Seen with a warning before Finalize (5 Nov). |
| 6 | Deploy and pilot | deploy by 16 Nov, pilot to 25 Nov | Running on the GCP VM over HTTPS with the Device on its plain-HTTP port; Device mounted at the Pooja location; the Rector uses it for real Days; user list and feedback log kept. | Not started |
| 7 | Documents and freeze | 20 to 25 Nov | `DESIGN.md` and `TESTING.md` complete; every `file:line` re-checked; live URL in README; tag `project-final`. | Not started |

**Added after Phase 5 (6 to 8 Nov), before deployment.** Every page was rebuilt in the Dawn design the author chose (Live view, Students with each Student's month, Leaves with the two books, Review and Finalize, Reports with Day, Month and Pick dates, Settings, the login screens), with a sticky menu bar and a side menu on phones. Vidyalaya Presence (PRD FR-16) was added: the Rector's Excel register of who was In hostel or Away, downloaded from the Students page and attached to the Daily and Monthly Report emails. Next, before deployment: the Public Live View, a page with no login that shows only how many Students have done Pooja today.

## Rules for the schedule
- Real Punches should flow as soon as the system is deployed. A user list and a feedback log are the evidence of use for the highest grade band; more days of real use is better.
- Real emails to Students start only after the Rector agrees in writing. Before that, send to test addresses.
- Study time for the end-sem is protected: no new features after 19 Nov.

## Cut order if time runs short
Cut from the top first.
1. Roster upload with sample file (built last; the form and the first-load script already cover the need).
2. Monthly Report email (keep the manual download).
3. Excel export (keep CSV).
4. Review Reminder email.
5. Live view by streaming (fall back to a refresh button).
6. Daily Report email.

Never cut: the five rules, Finalize, Notification after Finalize only, login, deployment, tests for the five rules.

## Weekly habits
- Each Sunday: update this table, check the backlog, and confirm `DESIGN.md` and `TESTING.md` still match the code.
- Every pull request: explain each changed file aloud before merging; log any rejected AI suggestion in `docs/AI_LOG.md`.
