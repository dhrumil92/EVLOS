# PRD: EVLOS (Hostel Pooja Attendance)

Technology choices are not listed here. This document says what the product must do; the stack is in `docs/ARCHITECTURE.md` (section Tech stack) and the rules for AI agents are in `AGENTS.md`.

Status: draft, 2026-10-28. Vocabulary follows `UBIQUITOUS_LANGUAGE.md`. Requirement IDs (FR-n, NFR-n) are stable so tests and `TESTING.md` can cite them. This document also serves as the project's requirements specification; no separate SRS is kept.

## 1. Problem
Students must attend Pooja while the temple is open (05:30 to 17:30 IST). Today the Rector walks every room at 22:00, writes the result on paper, then retypes it into a local Excel file. Leaves are recorded on paper (a Leave Note plus two reception books) and copied by hand. The existing biometric software is paid and run by a vendor, and its records do not always match the Device. The Rector's work is slow and error-prone, and Students are not told when they miss Pooja. The hostel has 360 Students.

## 2. Users
| User | Needs |
|------|-------|
| **Rector** (primary) | See Punches live, record Leaves and Returns quickly (including for many Students at once), review only the exceptions, Finalize the Day, get Reports by email. |
| **Student** (secondary) | Receive an email when an Absent is confirmed. Has no login. |
| **Developer** (operator) | Deploy, monitor, seed the Rector account, run the one-time first load. |

## 3. Goals and non-goals
**Goals**
- G1. The Rector's nightly work shrinks to: record Leaves and Returns as they happen, review the short Needs Review list, click Finalize.
- G2. Pooja Status is computed from evidence (Punches and Leaves), never guessed.
- G3. No Student is emailed unless the Rector has confirmed.
- G4. Reports are available on demand and arrive by email on a schedule.
- G5. Deployed, used by the real Rector and Students, with evidence of use.

**Non-goals (this release)**
- Replacing or touching the hostel's existing biometric software or its Devices.
- Parent emails, library footfall, mess meal counts, gym visits, pathshala tracking. The design leaves a seam for them; nothing is built.
- Storing fingerprints or templates. They stay on the Device.
- A Student-facing app, SMS, or WhatsApp.

## 4. Scope
| In the MVP | Later |
|------------|-------|
| Student form with settings panel (add, Leave, Return, Deactivate, Activate), Leave and Return for many Students, one-time first load, Punch ingestion, live view, Pooja Status, Needs Review, Override, Finalize, Notification, Review Reminder, Reports, Rector login | Roster upload with sample file (built last, optional), Parent emails, other Devices and activities, Student view, Leave requests by Students |

## 5. Functional requirements
Each has acceptance criteria in Given / When / Then form.

**FR-1 Manage Students (form and settings).** The Rector adds each new Student with a form: Student ID (the number registered on the Device), name, room, email, phone. There is no joining or leaving date on the form. A Student is Active from the Day he is added. In the Student list, every row has a settings (gear) icon that opens a small panel with two tabs:
- **Leave status:** shows whether the Student is In hostel, Away, or Due Back; records a Leave (Out date and time, Expected Return date and time); and records a Return (FR-4, FR-5).
- **Danger zone:** a button to Deactivate or Activate the Student.

Acceptance criteria:
- Given a filled form with a Student ID not used by any other Student, when saved, then the Student is Active from today.
- Given a Student ID already used (by an Active or Deactivated Student), when saved, then it is refused with a reason. Student IDs are never reused.
- Given an Active Student, when the Rector confirms Deactivate, then from today he is not listed and gets no Pooja Status. Finalized Days never change, and his Punches, Leaves and Reports stay.
- Given a Deactivated Student, when the Rector confirms Activate, then he is listed and evaluated again from today; the Days he was Deactivated are not evaluated.
- Deactivate and Activate need a confirmation and are recorded in the audit log.

**FR-1b Roster upload (built last, optional).** The Rector can upload an Excel or CSV file to add many Students at once. The page offers a downloadable sample file showing the exact columns; the upload must match it.
- Given a file whose header row does not match the sample exactly, when uploaded, then nothing is imported and the differences are shown.
- Given a matching file, when uploaded, then the Rector sees a preview (new Students, rows with errors and the reason) and confirms before anything is saved.
- Given a row with a duplicate Student ID or a missing email, then that row is rejected with a reason and the others still import.

**First load of existing Students.** The Rector's Excel has names and rooms but no Student IDs. The IDs come from the Device's user list (exported by USB) and are matched to the Excel by name, with every mismatch reviewed by hand. The developer then loads the 360 Students with a one-time script, validated the same way as the form and run on the developer's machine or server, not part of the Rector's screens. The files are deleted afterwards, since they hold personal data.

**FR-2 Receive Punches.** The system accepts uploads from a known Device and stores each Punch once.
- Given a Punch for a known Student ID from a known Device, when it arrives, then it is stored with its time converted to IST.
- Given the same Punch uploaded again, when it arrives, then no second copy is stored.
- Given an unknown Device serial, or a Student ID that is unknown or Deactivated, when it arrives, then it is kept for inspection and not counted toward any Pooja Status.

**FR-3 Live view.** The Rector's page shows a new Punch within 5 seconds, without reloading.

**FR-4 Record Leave.** The Rector records a Leave for one Student (gear icon, Leave status tab) or for many at once (FR-4b): Out date and time, Expected Return date and time. The Out Time may be in the past, because the Rector often enters Leaves after the Students have left.
- Given a Student with no open Leave, when a Leave is recorded, then the Student is Away.
- Given a Student who already has an open Leave, when another is recorded, then it is refused for that Student with a reason.
- A Leave entered by mistake can be cancelled or edited, and the change is audited.

**FR-4b Leave for many Students at once.** The Student list has a common gear icon that opens a Leave entry for several Students. The Rector finds Students by typing a name (also Student ID or room), adds each to the selection, enters one Out date and time and one Expected Return date and time, sees a summary ("35 Students will be Away"), and confirms. Students who already have an open Leave are listed and skipped. This is for vacations and holidays, when 30 to 40 Students leave on the same day.

**FR-5 Record Return.** The Rector records a Return Time for one Student (Leave status tab) or for many at once, using the same search-and-select panel as FR-4b.
- Given a Student with an open Leave, when the Return Time is recorded, then the Leave is closed and the Student is no longer Away.

**FR-6 Away and Due Back.** The Student list shows Away in red and Due Back in yellow, each with a text label. A Student stays Due Back after Expected Return passes until the Return Time is recorded.

**FR-7 Pooja Status.** For any Day the system computes a Pooja Status for each Active Student:
- Present: at least one Punch inside the Pooja Window (even if the Student then leaves).
- Not Applicable ("-"): no Punch, and the Student was Away for any part of the Pooja Window.
- Pending: no Punch yet and the Pooja Window has not closed.
- Needs Review: the Pooja Window closed, the Student was in the hostel the whole window, no Punch, Day not Finalized.
- Absent: only after Finalize (see FR-8).

**FR-8 Review, Override, Finalize.** The Rector sees the Needs Review list, may Override a Student (reason required), and Finalizes the Day.
- Given a Day with Needs Review Students, when the Rector Finalizes, then each becomes Absent unless Overridden, and the Day is locked.
- Given a Finalized Day, when someone tries to change it, then it is refused unless reopened with an audit entry.
- The list offers one bulk action ("Confirm all 7 as Absent") that shows a summary first.

**FR-9 Notification.** After Finalize, each Absent Student gets one email.
- Given a Finalized Day, when emails are sent, then each Absent Student receives exactly one, and a retry never sends a second.
- Given a Day not Finalized, then no Notification is sent.

**FR-10 Review Reminder.** At 23:00 IST, if the Day is not Finalized and Needs Review Students exist, the Rector gets one email listing them. If the Day is Finalized, nothing is sent.

**FR-11 Reports.** The Rector can download a Report for a Day, a month, or a date range as CSV or Excel at any time. The Daily Report is also emailed to the Rector at 23:30 IST whether or not the Day is Finalized. A Day that is not Finalized is marked Not Finalized and shows Needs Review, never Absent.

**FR-12 Monthly Report.** At 09:00 IST on the 1st, the Monthly Report for the previous month is emailed to the Rector. The last day of the month still gets its usual Daily Report.

**FR-13 Rector login.** Every page and API except the Device endpoints requires a login. Sessions expire.

**FR-14 Audit.** Leave, Return, Override, Finalize, Deactivate and Activate record who did it and when.

## 6. Non-functional requirements
- **NFR-1 Time correctness.** All rules use IST. The server's timezone must not change results. Schedules run in Asia/Kolkata.
- **NFR-2 Idempotency.** Re-uploaded Punches, retried emails and re-run schedules never create duplicates.
- **NFR-3 Resilience.** If the server is down, the Device keeps its Punches and re-uploads; nothing is lost.
- **NFR-4 Security.** The Rector site is HTTPS. The Device endpoint is plain HTTP (a Device limitation) and accepts only known serial numbers. Secrets live in environment variables.
- **NFR-5 Privacy.** Store only what is needed (Student ID, name, room, email, phone, Punches, Leaves). No fingerprints. Real emails go to Students only after the hostel agrees in writing.
- **NFR-6 Accessibility.** Colours always come with text.
- **NFR-7 Testability.** Rules are pure functions with an injected clock. Rules, not screens, carry most tests.
- **NFR-8 Extensibility.** A new Device purpose or activity is added without rewriting existing rules.
- **NFR-9 Operability.** A health endpoint, structured logs, nightly database backup (once deployed).

## 7. Assumptions
- A1. The Rector records every Leave and every Return. A missing Return is the Rector's responsibility.
- A2. No Student is out of the hostel without a Leave record, so there is no "missing" state.
- A3. All Students must punch. The Rector registers each Student's fingerprint on the Device by hand, and a new Student always gets a new Student ID; IDs are never reused. The system never stores or removes fingerprints.
- A4. A Leave that overlaps any part of the Pooja Window gives Not Applicable if there is no Punch. Known limitation: a short Leave late in the window also gives "-". The Rector accepts this.
- A5. The Student ID is the only identifier. The Rector's Excel has none (its "serial number" is a row number).
- A6. The Device will be mounted in a Wi-Fi zone with a power plug.

## 8. Risks
| Risk | Response |
|------|----------|
| Matching 360 names to Device IDs for the first load has errors | Export the Device user list; match by name; review every mismatch with the Rector. |
| The 1 GB free VM runs short of memory | Stop other containers or use a separate account; keep the app small. |
| Deployment starts late and leaves little pilot time | Build locally first, rehearse the VM with a hello-world around 9 Nov, deploy right after Phase 4. |
| Real emails reach Students too early | Local mail catcher until Phase 5; test addresses first; written approval from the Rector. |
| Time runs out before the 26 Nov end-sem | Fixed cut order in `docs/PHASES.md`. |
| Device protocol surprises | Parse from captured real payloads; keep it inside the Device adapter. |

## 9. Success criteria
- The Rector uses it for real Days during the pilot, and a user list and a feedback log exist.
- All five rules in `DESIGN.md` are enforced and tested.
- A live URL works; `README.md` runs locally in five commands or fewer.

## 10. Open questions
1. Does the Device's user list show Student names, so the first load can be matched to the Excel? (Check on the Device and export by USB.)
2. Which email provider and sender address will be used? Deferred to Phase 5; a Gmail app password is enough for testing.
3. Has the Rector agreed in writing to emails going to Students?
