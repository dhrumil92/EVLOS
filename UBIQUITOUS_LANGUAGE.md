# Ubiquitous Language: EVLOS (Hostel Pooja Attendance)

> **DRAFT.** The "Named in code at" column holds *planned* identifiers. Replace each with a real `file:line` once the code exists. Docs that do not match the code are graded as absent. Times are written `HH:MM IST` (24-hour).

## Terms

| Term | Definition | Aliases to avoid | Named in code at |
|------|------------|------------------|------------------|
| **Student** | A resident of the hostel who is expected to punch for Pooja. Identified by one Student ID. | user, boarder, member, inmate | `Student` (TBD) |
| **Rector** | The hostel officer who records Leaves and Returns, reviews the Day, and Finalizes it. The only role that can Finalize. | admin, warden, sir, manager | `Role.RECTOR` (TBD) |
| **Roster** | The list of Students the Rector supplies as an Excel file (names and rooms). Used once for the first load of existing Students. Later Students are added by form; an upload with a sample file comes last. | master list, student table, student sheet | `importRoster` (TBD) |
| **Active** | A Student who currently lives in the hostel. Only Active Students are listed and given a Pooja Status. A Student is Active from the Day he is added until he is Deactivated, and again after he is Activated. | current, enrolled | `isActiveOn` (TBD) |
| **Deactivate** | The Rector's act of recording that a Student has left the hostel, using the Danger zone button in his settings. Takes effect today: he is no longer listed or evaluated. Finalized Days never change; his Punches, Leaves and Reports stay. | delete, remove, archive | `deactivateStudent` (TBD) |
| **Activate** | The Rector's act of reversing a Deactivate, from today. The Days in between are not evaluated. | restore, undelete | `activateStudent` (TBD) |
| **Device** | The fingerprint terminal that reads fingerprints and uploads Punches. The Rector registers each Student's fingerprint on it by hand. | machine, terminal, biometric | `Device` (TBD) |
| **Student ID** | The number the Rector registers on the Device together with a Student's fingerprint. The only identifier of a Student, used in the form, Punches, Leaves and Reports. Never reused. | roll number, biometric ID, user ID, PIN, enroll number, serial number | `studentId` (TBD) |
| **Punch** | One fingerprint scan uploaded by a Device: a Student ID plus a timestamp. A fact that never changes. | log, scan, swipe, entry, attendance record | `Punch` (TBD) |
| **Pooja** | The daily worship Students are expected to attend. Evidenced only by a Punch inside the Pooja Window. | prayer, session, event | n/a (domain word) |
| **Pooja Window** | 05:30 to 17:30 IST on a Day: the hours the temple is open. A Punch counts only inside it. | shift, slot, temple timing | `POOJA_WINDOW` (TBD) |
| **Day** | One calendar date in IST. All rules are evaluated per Student per Day. | date, session day | `Day` (TBD) |
| **Pooja Status** | The outcome for one Student on one Day: **Present**, **Absent**, **Not Applicable**, **Pending**, or **Needs Review**. | attendance, mark, result | `PoojaStatus` (TBD) |
| **Present** | Pooja Status: the Student has at least one Punch inside the Pooja Window. A Punch always wins, even if the Student then leaves on a Leave. | attended, done, marked | `PoojaStatus.PRESENT` (TBD) |
| **Not Applicable** | Pooja Status, shown as "-": no Punch, and the Student was Away for any part of the Pooja Window. No Notification is sent. *Known limitation: a short Leave late in the window also gives "-" (see DESIGN.md).* | excused, skipped, leave | `PoojaStatus.NOT_APPLICABLE` (TBD) |
| **Pending** | Pooja Status: no Punch yet and the Pooja Window has not closed. Not an absence. | unknown, blank, N/A | `PoojaStatus.PENDING` (TBD) |
| **Needs Review** | Pooja Status before Finalize: the Pooja Window closed, the Student was in the hostel the whole window, and has no Punch. The Rector must decide. | exception, flagged, suspect | `PoojaStatus.NEEDS_REVIEW` (TBD) |
| **Absent** | Pooja Status after Finalize: the Rector confirmed a Student who was in the hostel and did not punch. The only status that triggers a Notification. | missing, no-show | `PoojaStatus.ABSENT` (TBD) |
| **Override** | The Rector changing a computed Pooja Status at Finalize (for example Needs Review to Present because the fingerprint failed). Needs a reason. | edit, fix, correction | `Override` (TBD) |
| **Leave** | A system record of a Student being away from the hostel: Out Time, Expected Return, and (once recorded) Return Time. | holiday, going home | `Leave` (TBD) |
| **Leave Note** | The paper A4 form a Student fills before leaving. A paper source for a Leave, not the Leave itself. | leave form, slip | n/a (paper) |
| **Going-to-Home Book** | The reception book where a Student writes room, name, date, time and signature when leaving. Source of Out Time. | exit register, out book | n/a (paper) |
| **Back-from-Home Book** | The reception book where a Student writes room, name, in time and signature when returning. Source of Return Time. | entry register, in book | n/a (paper) |
| **Out Time** | When the Student left, taken from the Going-to-Home Book. Opens a Leave. May be in the past when the Rector enters it. | departure | `Leave.outAt` (TBD) |
| **Expected Return** | The return date and time the Student wrote on the Leave Note. Only drives the Due Back colour. Returning later is allowed. | planned return, due date | `Leave.expectedReturnAt` (TBD) |
| **Return Time** | When the Student came back, recorded by the Rector from the Back-from-Home Book. Closes a Leave. | in time, arrival | `Leave.returnedAt` (TBD) |
| **Away** | The Student has an open Leave (no Return Time yet). Shown in red with a text label. | absent, outside | `isAway` (TBD) |
| **Due Back** | The Student is Away and Expected Return is tomorrow or earlier. Shown in yellow with a text label, and stays yellow after the date passes until the Return Time is recorded. The Student is still Away. | overdue, late, pending return | `isDueBack` (TBD) |
| **Returned** | The Rector recorded the Return Time. The Leave is closed. | marked present, arrived | `returnLeave` (TBD) |
| **Finalize** | The Rector's act of confirming a Day's Pooja Statuses. Locks the Day and releases Notifications. | send, submit, approve, close | `finalizeDay` (TBD) |
| **Notification** | The email to a Student about an Absent. Sent only after Finalize, at most once per Student per Day. | alert, message | `Notification` (TBD) |
| **Review Reminder** | The 23:00 IST email to the Rector listing Students on Needs Review, sent only if the Day is not Finalized. | alert, nag | `ReviewReminder` (TBD) |
| **Report** | A table of Pooja Statuses for a Day, a month, or a date range, downloadable as CSV or Excel. A Day that is not Finalized is marked Not Finalized and shows Needs Review, never Absent. | export, sheet, register | `Report` (TBD) |
| **Daily Report** | The Report for one Day, emailed to the Rector at 23:30 IST whether or not the Day is Finalized. | night mail | `DailyReport` (TBD) |
| **Monthly Report** | The Report for the previous month, emailed to the Rector at 09:00 IST on the 1st. | month-end mail | `MonthlyReport` (TBD) |

## Flagged ambiguities

1. **"Absent" meant three things:** not punching, being on leave, and being out of the hostel. **Winner:** *Absent* means only a Finalized Pooja Status. A Student on leave is **Away**. A Student with no Punch and no verdict yet is **Pending** or **Needs Review**.
2. **"Present" meant a Punch result and a Return from leave** ("the Rector marks him present"). **Winner:** *Present* is only a Pooja Status. Coming back from leave is **Returned**.
3. **"Attendance" meant a Punch, a Pooja Status and the Rector's register.** **Winner:** "attendance" is not a domain term. Use Punch, Pooja Status or Report. *One exception:* the word may describe the product in one-line summaries and titles (for example "a hostel Pooja attendance system"). It never names a concept in rules, requirements, code, tests or the UI.
4. **"ID" meant a Device number, a Device user ID or PIN, a roll number, and the "serial number" in the Rector's Excel.** **Winner:** **Student ID** is the only identifier, and it is the number registered on the Device. The Excel's "serial number" is a row number, not an identifier.
5. **"-" meant Not Applicable and an empty cell.** **Winner:** "-" is only how Not Applicable is displayed. A Day with no result yet is **Pending**.
6. **"Leave" meant the paper note, the book entry and the period.** **Winner:** **Leave** is the system record. **Leave Note**, **Going-to-Home Book** and **Back-from-Home Book** are the paper sources.
7. **"Send" meant clicking the button that confirms the Day** ("the Rector clicks send"). **Winner:** **Finalize** is the Rector's click. Sending emails is what the system does afterwards.
8. **"Reminder", "alert" and "notification" meant any email.** **Winner:** **Notification** goes to a Student, **Review Reminder** goes to the Rector, and Reports are **Daily Report** and **Monthly Report**.
9. **"Window" meant the temple hours and the punch time.** **Winner:** **Pooja Window** (05:30 to 17:30 IST) for both, since they are the same.
10. **"Log", "scan" and "swipe" meant one Device upload.** **Winner:** **Punch**.
11. **"Machine", "device", "terminal" and "biometric" meant the same thing.** **Winner:** **Device**.
12. **A time on the Device has no timezone, but servers run in UTC.** **Winner:** a **Day** is an IST calendar date, and every timestamp is converted at the Device boundary.
13. **"Delete" and "remove" a Student meant erasing him and also meant he has left.** **Winner:** **Deactivate**. It hides him from today and keeps his history, so past Reports stay correct. Permanent erasure is not a feature of the product.
