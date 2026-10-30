# PHASES

Plan from 2026-10-28 to the 26 Nov end-sem. The viva follows the exam, so the repo is frozen and tagged `project-final` by 25 Nov. Dates are targets; a phase is done only when its exit check passes. Development runs on the author's PC first; deployment comes after Phase 4.

| # | Phase | Target | Exit check |
|---|-------|--------|-----------|
| 0 | Documents and repo | by 30 Oct | All documents in this repo, consistent with each other; hygiene files in place; first backlog drafted. |
| 1 | Skeleton and CI | 31 Oct to 2 Nov | Monorepo, lint, typecheck, test, CI on every pull request, `.env.example`, `db:setup`, five-command local run. |
| 2 | Core rules, test first | 2 to 6 Nov | The five rules plus Away and Due Back as pure functions with an injected clock, all tested, including IST edge cases. |
| 3 | Local walking skeleton and wireframes | 5 to 9 Nov | Device adapter and PostgreSQL running on the PC; a real Punch from the Device (on the same Wi-Fi) appears in the live view. Wireframes of five screens done: day view, Student list with gear panel, Leave and Return for many Students, review and Finalize, Reports. One-evening VM rehearsal with a hello-world container. |
| 4 | Rector workflow (local) | 9 to 15 Nov | Login, Student form, per-row gear panel (Leave status and Danger zone), common gear panel for many Students, one-time first load of the 360 Students, Needs Review list, Finalize, Exclude and Send Notifications. The Rector can run a real Day. |
| 5 | Emails and Reports | 15 to 19 Nov | Outbox and schedule loop; Notification, 23:00 Review Reminder, 23:30 Daily Report, 09:00 Monthly Report, manual CSV and Excel Reports. Local mail catcher first; real email provider chosen and tested at the end. |
| 6 | Deploy and pilot | deploy by 16 Nov, pilot to 25 Nov | Running on the GCP VM over HTTPS with the Device on its plain-HTTP port; Device mounted at the Pooja location; the Rector uses it for real Days; user list and feedback log kept. |
| 7 | Documents and freeze | 20 to 25 Nov | `DESIGN.md` and `TESTING.md` complete; every `file:line` re-checked; live URL in README; tag `project-final`. |

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
