# PILOT TEMPLATE: who uses EVLOS, and what they said

The pilot (Phase 6, to 25 Nov 2026) needs evidence of real use: a list of the people who use EVLOS and a log of their feedback (`docs/PRD.md` section 9, `docs/PHASES.md`). This file is the blank layout.

**Nothing personal is kept in this repository.** Names, phone numbers, emails and what a person said are personal data, and AGENTS.md says never to commit real data. Keep the real list and log in a private file outside the repository (a private Google Sheet with one tab for each table below, or a local Excel file). Only the anonymised summary at the end goes into the repository, once the pilot is over.

## 1. List of people using EVLOS

One row for each person. Use initials or a code (P1, P2) if the file may be shown to someone else.

| # | Name or code | Role | How they use EVLOS | Since | Agreed (how and when) | Contact |
|---|--------------|------|--------------------|-------|-----------------------|---------|
| 1 | | Rector | Records Leaves and Returns, reviews, Finalizes, sends Notifications | | | |
| 2 | | Report Recipient | Receives the Review Reminder, Daily Report and Monthly Report | | | |
| 3 | | Tester | Used the emails and pages before the Rector did | | | |
| 4 | | Student | Opens the Public Live View at `/live` | | | |

Roles are the glossary's: **Rector**, **Student**, **Report Recipient**. Add **Tester** for someone helping before the real use starts.

## 2. Feedback log

One row for each thing someone said, with the date. Keep their own words in the "What they said" column.

| Date | Who | How it reached me | What they said | Kind | What I did | Commit or document | Status |
|------|-----|-------------------|----------------|------|------------|--------------------|--------|
| | | in person, WhatsApp, email, call | | bug, wish, confusion, praise | fixed, changed, not done, to do | commit hash or file | open, done, declined |

The best rows close a loop: someone asks for something, a commit changes it, and they confirm it works.

## 3. Written agreement for emails to Students

EVLOS sends real emails to Students only after the Rector agrees in writing (`docs/PHASES.md`). Keep the proof privately, and write only this here:

- Date the agreement was received: ________
- How it was given (email, WhatsApp, a signed note): ________
- What it covers (Notifications to Absent Students after Finalize, Report emails, the data kept): ________

## 4. Other evidence that already exists

| Evidence | Where to find it |
|----------|------------------|
| Visits to the short address | Vercel project `evlos`, Analytics |
| Uptime and outages | UptimeRobot, the `evlos` monitor |
| Daily Reports arriving every night at 23:30 IST | The Report Recipients' inbox |
| One backup each night | `tail ~/evlos-backups/backup.log` on the VM, and the Drive folder `evlos-backups` |
| Real Punches | The live view and the Reports page |
| Days Finalized | The Review and Finalize page |
| Changes made after feedback | `git log`, and `docs/AI_LOG.md` |
| Cost | Google Cloud, Billing, Reports (it should show 0) |

## 5. Summary for the viva (anonymised, filled in after the pilot)

- Pilot dates: ________ to ________
- People using EVLOS: ____ in total (Rector: __, Report Recipients: __, Testers: __, Students: __)
- Days finalized for real: ____
- Punches received from the Device: ____
- Feedback items: ____ in total, ____ led to a change, ____ still open
- The three things people liked: ________
- The three things people asked to change, and what was done: ________
- What I would do next: ________
