# Ubiquitous Language: EVLOS (Hostel Pooja Attendance)

> **DRAFT.** The "Named in code at" column points at real code as checked on 2026-11-04 (end of Phase 4). A cell marked *planned* names an identifier that does not exist yet; replace it with a real `file:line` once the code exists. Docs that do not match the code are graded as absent. Times are written `HH:MM IST` (24-hour).

## Terms

| Term | Definition | Aliases to avoid | Named in code at |
|------|------------|------------------|------------------|
| **Student** | A resident of the hostel who is expected to punch for Pooja. Identified by one Student ID. | user, boarder, member, inmate | `packages/core/src/student.ts:3` |
| **Room** | The three-digit number of the room a Student lives in, such as 605. The first digit is the Floor; the other two number the room on that Floor. | block, flat, cell | `packages/core/src/student.ts:34` |
| **Floor** | The storey a room is on: the first digit of its Room, so Room 605 is on Floor 6. The Rector can list the Students on one Floor. | level, storey, wing | `packages/core/src/student.ts:53` |
| **Rector** | The hostel officer who records Leaves and Returns, reviews the Day, and Finalizes it. The only role that can Finalize. | admin, warden, sir, manager | `apps/api/src/ports/rector-repository.ts:3` |
| **Roster** | The list of Students the Rector supplies as an Excel file (Student IDs, names, rooms and emails), saved as CSV for the first load. Used once for the first load of existing Students. Later Students are added by form; an upload with a sample file comes last. | master list, student table, student sheet | `apps/api/src/adapters/roster/read-roster.ts:86`, `apps/api/src/use-cases/load-roster.ts:51` |
| **Active** | A Student who currently lives in the hostel. Only Active Students are listed and given a Pooja Status. A Student is Active from the Day he is added until he is Deactivated, and again after he is Activated. | current, enrolled | `packages/core/src/student.ts:25` |
| **Deactivate** | The Rector's act of recording that a Student has left the hostel, using the Danger zone button in his settings. Takes effect today: he is no longer listed or evaluated. Finalized Days never change; his Punches, Leaves and Reports stay. | delete, remove, archive | `apps/api/src/use-cases/deactivate-and-activate.ts:19` |
| **Activate** | The Rector's act of reversing a Deactivate, from today. The Days in between are not evaluated. | restore, undelete | `apps/api/src/use-cases/deactivate-and-activate.ts:33` |
| **Device** | The fingerprint terminal that reads fingerprints and uploads Punches. The Rector registers each Student's fingerprint on it by hand. | machine, terminal, biometric | `apps/api/src/db/schema.ts:4` |
| **Device Serial** | The serial number a Device sends with every upload. Only a registered Device Serial is accepted; an upload from any other is refused. Not a Student identifier. | device ID, machine number | `apps/api/src/db/schema.ts:5` |
| **Student ID** | The number the Rector registers on the Device together with a Student's fingerprint. The only identifier of a Student, used in the form, Punches, Leaves and Reports. Never reused. | roll number, biometric ID, user ID, PIN, enroll number, serial number | `packages/core/src/punch.ts:4` |
| **Punch** | One fingerprint scan uploaded by a Device: a Student ID plus a timestamp. A fact that never changes. | log, scan, swipe, entry, attendance record | `packages/core/src/punch.ts:3` |
| **Pooja** | The daily worship Students are expected to attend. Evidenced only by a Punch inside the Pooja Window. | prayer, session, event | n/a (domain word) |
| **Pooja Window** | 05:30 to 18:00 IST on a Day, both ends included. A Punch counts only inside it. | shift, slot, temple timing | `packages/core/src/pooja-window.ts:6` |
| **Outside Pooja Window** | The note shown on a Punch made outside the Pooja Window, written on the page as "Outside Pooja Window (05:30–18:00)". The Punch is stored but does not count toward any Pooja Status. | late punch, invalid punch, ignored punch | `apps/web/src/App.tsx:19` (the note), `packages/core/src/pooja-window.ts:10` (the rule) |
| **Day** | One calendar date in IST. All rules are evaluated per Student per Day. | date, session day | `packages/core/src/day.ts:4` |
| **Pooja Status** | The outcome for one Student on one Day: **Present**, **Absent**, **Not Applicable**, **Pending**, or **Needs Review**. | attendance, mark, result | `packages/core/src/pooja-status.ts:8` |
| **Present** | Pooja Status: the Student has at least one Punch inside the Pooja Window. A Punch always wins, even if the Student then leaves on a Leave. | attended, done, marked | `packages/core/src/pooja-status.ts:9` |
| **Not Applicable** | Pooja Status, shown as "-": no Punch, and the Student was Away for any part of the Pooja Window. Shown as soon as he is Away, even before the window closes. Any overlap counts, including a Leave that only touches an edge of the window and a Student who returns inside it; a Punch always wins. No Notification is sent. *Known limitation: a short Leave late in the window also gives "-" (see DESIGN.md).* | excused, skipped, leave | `packages/core/src/pooja-status.ts:10` |
| **Pending** | Pooja Status: no Punch yet, the Pooja Window has not closed, and the Student has not been Away during it. Not an absence. | unknown, blank, N/A | `packages/core/src/pooja-status.ts:11` |
| **Needs Review** | Pooja Status before Finalize: the Pooja Window closed, the Student was in the hostel the whole window, and has no Punch. The Rector reviews it; Finalize makes it Absent. | exception, flagged, suspect | `packages/core/src/pooja-status.ts:12` |
| **Absent** | Pooja Status after Finalize: the Rector confirmed a Student who was in the hostel and did not punch. The only status that can get a Notification, and only if the Student is not Excluded. | missing, no-show | `packages/core/src/pooja-status.ts:13` |
| **Exclude** | The Rector's act, after Finalize and before Send Notifications, of removing an Absent Student from the email list (the cross next to his name), for example because he explained why he missed Pooja. He stays Absent in Reports. No reason is needed; it is audited. | override, excuse, skip | `apps/api/src/use-cases/review.ts:161` (part of Send Notifications) |
| **Leave** | A system record of a Student being away from the hostel: Out Time, Expected Return, and (once recorded) Return Time. | holiday, going home | `packages/core/src/leave.ts:6` |
| **Leave Note** | The paper A4 form a Student fills before leaving. A paper source for a Leave, not the Leave itself. | leave form, slip | n/a (paper) |
| **Going-to-Home Book** | The reception book where a Student writes room, name, date, time and signature when leaving. Source of Out Time. | exit register, out book | n/a (paper) |
| **Back-from-Home Book** | The reception book where a Student writes room, name, in time and signature when returning. Source of Return Time. | entry register, in book | n/a (paper) |
| **Out Time** | When the Student left, taken from the Going-to-Home Book. Opens a Leave. May be in the past when the Rector enters it. | departure | `packages/core/src/leave.ts:7` |
| **Expected Return** | The return date and time the Student wrote on the Leave Note. Only drives the Due Back colour. Returning later is allowed. | planned return, due date | `packages/core/src/leave.ts:8` |
| **Return Time** | When the Student came back, recorded by the Rector from the Back-from-Home Book. Closes a Leave. | in time, arrival | `packages/core/src/leave.ts:9` |
| **Away** | The Student has an open Leave (no Return Time yet). Shown in red with a text label. | absent, outside | `packages/core/src/leave.ts:17` |
| **Due Back** | The Student is Away and Expected Return is tomorrow or earlier. Shown in yellow with a text label, and stays yellow after the date passes until the Return Time is recorded. The Student is still Away. | overdue, late, pending return | `packages/core/src/leave.ts:54` |
| **Returned** | The Rector recorded the Return Time. The Leave is closed. | marked present, arrived | `apps/api/src/use-cases/leaves.ts:98` |
| **Finalize** | The Rector's act of confirming a Day's Pooja Statuses, available only after the Pooja Window closes: every Needs Review becomes Absent and the Day is locked. It sends no email (see Send Notifications). | send, submit, approve, close | `apps/api/src/use-cases/review.ts:110` |
| **Send Notifications** | The Rector's click, after Finalize, that emails every Absent Student who is not Excluded. Done from the Report's email list, usually around 23:00 IST. | finalize, mail all, submit | `apps/api/src/use-cases/review.ts:147` |
| **Notification** | The email to a Student about an Absent. Sent only after Finalize and Send Notifications, never to an Excluded Student, at most once per Student per Day. | alert, message | `apps/api/src/ports/finalize-repository.ts:19` |
| **Review Reminder** | The 23:00 IST email to the Rector listing Students on Needs Review, sent only if the Day is not Finalized and such Students exist. | alert, nag | `ReviewReminder` (*planned*, Phase 5) |
| **Report** | A table of Pooja Statuses for a Day, a month, or a date range, downloadable as CSV or Excel. A Day that is not Finalized is marked Not Finalized and shows Needs Review, never Absent. | export, sheet, register | `apps/api/src/use-cases/get-report.ts:29` |
| **Daily Report** | The Report for one Day, emailed to the Rector at 23:30 IST whether or not the Day is Finalized. | night mail | `apps/api/src/use-cases/daily-report.ts:47` |
| **Monthly Report** | The Report for the previous month, emailed to the Rector at 09:00 IST on the 1st. | month-end mail | `MonthlyReport` (*planned*, Phase 5) |

## Flagged ambiguities

1. **"Absent" meant three things:** not punching, being on leave, and being out of the hostel. **Winner:** *Absent* means only a Finalized Pooja Status. A Student on leave is **Away**. A Student with no Punch and no verdict yet is **Pending** or **Needs Review**.
2. **"Present" meant a Punch result and a Return from leave** ("the Rector marks him present"). **Winner:** *Present* is only a Pooja Status. Coming back from leave is **Returned**.
3. **"Attendance" meant a Punch, a Pooja Status and the Rector's register.** **Winner:** "attendance" is not a domain term. Use Punch, Pooja Status or Report. *One exception:* the word may describe the product in one-line summaries and titles (for example "a hostel Pooja attendance system"). It never names a concept in rules, requirements, code, tests or the UI.
4. **"ID" meant a Device number, a Device user ID or PIN, a roll number, and the "serial number" in the Rector's Excel.** **Winner:** **Student ID** is the only identifier, and it is the number registered on the Device. The Excel's "serial number" is a row number, not an identifier.
5. **"-" meant Not Applicable and an empty cell.** **Winner:** "-" is only how Not Applicable is displayed. A Day with no result yet is **Pending**.
6. **"Leave" meant the paper note, the book entry and the period.** **Winner:** **Leave** is the system record. **Leave Note**, **Going-to-Home Book** and **Back-from-Home Book** are the paper sources.
7. **"Send" meant clicking the button that confirms the Day** ("the Rector clicks send"). **Winner:** **Finalize** is the Rector's click that locks the Day. **Send Notifications** is his separate, later click that emails the Absent Students who are not Excluded.
8. **"Reminder", "alert" and "notification" meant any email.** **Winner:** **Notification** goes to a Student, **Review Reminder** goes to the Rector, and Reports are **Daily Report** and **Monthly Report**.
9. **"Window" meant the temple hours and the punch time.** **Winner:** **Pooja Window** (05:30 to 18:00 IST, both ends included) for both.
10. **"Log", "scan" and "swipe" meant one Device upload.** **Winner:** **Punch**.
11. **"Machine", "device", "terminal" and "biometric" meant the same thing.** **Winner:** **Device**.
12. **A time on the Device has no timezone, but servers run in UTC.** **Winner:** a **Day** is an IST calendar date, and every timestamp is converted at the Device boundary.
13. **"Delete" and "remove" a Student meant erasing him and also meant he has left.** **Winner:** **Deactivate**. It hides him from today and keeps his history, so past Reports stay correct. Permanent erasure is not a feature of the product.
14. **"Override" meant changing a Pooja Status by hand and also excusing a Student who explained a missed Pooja.** **Winner:** no Pooja Status is changed by hand. A Student who explains stays Absent and the Rector **Excludes** him from the email.
15. **"Serial number" meant a row in the Rector's Excel and the number a Device sends.** **Winner:** the Device's number is the **Device Serial**. The Excel's serial number is a row number (see 4).
