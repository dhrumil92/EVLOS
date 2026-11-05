# PRD: EVLOS (Hostel Pooja Attendance)

Technology choices are not listed here. This document says what the product must do; the stack is in `docs/ARCHITECTURE.md` (section Tech stack) and the rules for AI agents are in `AGENTS.md`.

Status: written 2026-10-28, updated to match the code on 2026-11-05 (end of Phase 5). Vocabulary follows `UBIQUITOUS_LANGUAGE.md`. Requirement IDs (FR-n, NFR-n) are stable so tests and `TESTING.md` can cite them. This document also serves as the project's requirements specification; no separate SRS is kept.

## 1. Problem
Students must attend Pooja during the Pooja Window (05:30 to 18:00 IST). Today the Rector walks every room at 22:00, writes the result on paper, then retypes it into a local Excel file. Leaves are recorded on paper (a Leave Note plus two reception books) and copied by hand. The existing biometric software is paid and run by a vendor, and its records do not always match the Device. The Rector's work is slow and error-prone, and Students are not told when they miss Pooja. The hostel has 360 Students.

## 2. Users
| User | Needs |
|------|-------|
| **Rector** (primary) | See Punches live, record Leaves and Returns quickly (including for many Students at once), review only the exceptions, Finalize the Day, get Reports by email. |
| **Student** (secondary) | Receive an email when an Absent is confirmed. Has no login. |
| **Developer** (operator) | Deploy, monitor, seed the Rector account, run the one-time first load. |

## 3. Goals and non-goals
**Goals**
- G1. The Rector's nightly work shrinks to: record Leaves and Returns as they happen, review the short Needs Review list, click Finalize, Exclude any Student who explained, click Send Notifications.
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
| Student form with settings panel (add, Leave, Return, Deactivate, Activate), Leave and Return for many Students, one-time first load, Punch ingestion, live view, Pooja Status, Needs Review, Finalize, Exclude, Send Notifications, Notification, Review Reminder, Daily and Monthly Report, Reports as CSV and coloured Excel, Rector login with change and forgotten password, Settings with the Report Recipients | Roster upload with sample file (built last, optional), Parent emails, other Devices and activities, Student view, Leave requests by Students |

## 5. Functional requirements
Each has acceptance criteria in Given / When / Then form.

**FR-1 Manage Students (form and settings).** The Rector adds each new Student with a form: Student ID (the number registered on the Device), name, room, email, phone. A room is three digits, such as 605: the first digit is the floor and the other two number the room on that floor. The Student list can show one floor at a time and can be sorted by room or by name, A to Z. There is no joining or leaving date on the form. A Student is Active from the Day he is added. In the Student list, every row has a settings (gear) icon that opens a small panel with three tabs:
- **Details:** edits the Student's name, room, email and phone. The Student ID cannot be changed.
- **Leave status:** shows whether the Student is In hostel, Away, or Due Back; records a Leave (Out date and time, Expected Return date and time); and records a Return (FR-4, FR-5).
- **Danger zone:** a button to Deactivate or Activate the Student.

Acceptance criteria:
- Given a filled form with a Student ID not used by any other Student, when saved, then the Student is Active from today.
- Given a Student ID already used (by an Active or Deactivated Student), when saved, then it is refused with a reason. Student IDs are never reused.
- Given a Student, when the Rector edits his name, room, email or phone and saves, then the new details are used from then on, with the same checks as the add form. His Student ID stays the same.
- Given an Active Student, when the Rector confirms Deactivate, then from today he is not listed and gets no Pooja Status. Finalized Days never change, and his Punches, Leaves and Reports stay.
- Given a Deactivated Student, when the Rector confirms Activate, then he is listed and evaluated again from today; the Days he was Deactivated are not evaluated.
- Deactivate and Activate need a confirmation and are recorded in the audit log.

**FR-1b Roster upload (built last, optional).** The Rector can upload an Excel or CSV file to add many Students at once. The page offers a downloadable sample file showing the exact columns; the upload must match it.
- Given a file whose header row does not match the sample exactly, when uploaded, then nothing is imported and the differences are shown.
- Given a matching file, when uploaded, then the Rector sees a preview (new Students, rows with errors and the reason) and confirms before anything is saved.
- Given a row with a duplicate Student ID or a missing email, then that row is rejected with a reason and the others still import.

**First load of existing Students.** The Rector provides a list of Student IDs with names (open question 1), with room and email for each Student. The developer saves it from Excel as "CSV UTF-8" with the columns of `sample-roster.csv` and loads the 360 Students with a one-time command (`npm run students:load`), run on the developer's machine or server, not part of the Rector's screens. The command first checks every row the same way as the form and reports problems by line, without personal data; with `--save` it adds all Students in one transaction, or none if any row has a problem. A Student ID already used is refused. The file is deleted afterwards, since it holds personal data.

**FR-2 Receive Punches.** The system accepts uploads only from a registered Device and stores each Punch once. Today exactly one Device, the Pooja Device, is registered. A Device added later for another place (pathshala, mess, gym, library) is registered with its own purpose, and its Punches never count toward Pooja Status.
- Given a Punch for a known Student ID from a registered Device, when it arrives, then it is stored with its time converted to IST.
- Given the same Punch uploaded again, when it arrives, then no second copy is stored.
- Given an upload from a Device Serial that is not registered, when it arrives, then it is refused, nothing is stored, and the refusal is logged.
- Given a Punch from a registered Device for a Student ID that is unknown or Deactivated, when it arrives, then it is stored and not counted toward any Pooja Status.
- Given a Punch for a Day that is already Finalized, when it arrives, then it is stored, the Day stays locked, and the Rector sees a warning for that Student before Send Notifications. Built 2026-11-05: a Punch After Finalize inside the Pooja Window shows "Punched at 07:00, arrived after Finalize" beside the Absent Student, and the page asks the Rector to check before sending.

**FR-3 Live view.** The Rector's page shows a new Punch within 5 seconds, without reloading, and a count of Students Present so far for the Day. A Punch made outside the Pooja Window is listed with the note "Outside Pooja Window (05:30–18:00)" and is not counted. The page also shows the Device's Last Seen, refreshed every minute, and warns when the Device has been quiet for 10 minutes or more.

**FR-3b Day history.** The live view page has two lists for today: Latest Punches, shown when the page opens, and Every Student, with every Active Student's Pooja Status and the same sort and filter as the Reports page. A past Day is seen on the Reports page (FR-11), with the Day view and its date; the live view does not repeat it (decided 2026-11-05).
- Given today, when the page is open, then new Punches and statuses appear live.
- Given a past Day, when the Rector picks it on the Reports page, then the page shows that Day's Pooja Statuses and says whether it is Finalized. A Finalized Day shows its stored results; a Day not Finalized shows Needs Review, never Absent.
- A Day in the future cannot be picked.

**FR-4 Record Leave.** The Rector records a Leave for one Student (gear icon, Leave status tab) or for many at once (FR-4b): Out date and time, Expected Return date and time. The Out Time may be in the past, because the Rector often enters Leaves after the Students have left.
- Given a Student with no open Leave, when a Leave is recorded, then the Student is Away.
- Given a Student who already has an open Leave, when another is recorded, then it is refused for that Student with a reason.
- Given an Out Time later than now, when a Leave is recorded, then it is refused with a reason. A Student fills the Leave Note only at the moment of leaving, so an Out Time is never in the future; it may be days in the past, because the Rector sometimes enters the Leave Notes the next day.
- Given an Expected Return earlier than the Out Time, when a Leave is recorded or edited, then it is refused with a reason. In the many-Students panel only that row is blocked.
- The calendar disables future dates for the Out date. The Expected Return date may be in the future.
- A Leave entered by mistake can be cancelled or edited, and the change is audited. The Rector may edit the Expected Return, for example when a Student stays longer; a Finalized Day never changes because of such an edit.

**FR-4b Leave for many Students at once.** The Student list has a common gear icon that opens a Leave entry for several Students. The Rector finds Students by typing a name (also Student ID or room), adds each to the selection, and enters the Out Time and Expected Return of each Student as written on that Student's own Leave Note (the times differ: one Student leaves in the morning, another in the evening). The panel has one Out date and one Expected Return date at the top, both defaulting to today; each Student row asks only for the Out time and the Expected Return time. A Student whose date differs gets a small date field on his own row, so the Rector never picks a date for every Student. The Out date may be in the past, because the Rector sometimes enters the Leave Notes the next day. The Rector sees a summary ("35 Students will be Away") and confirms. Students who already have an open Leave are listed and skipped. This is for vacations and holidays, when 30 to 40 Students leave on the same day.

**FR-5 Record Return.** The Rector records a Return Time for one Student (Leave status tab) or for many at once, using the same search-and-select panel as FR-4b. In the panel the Rector sets one Return date at the top (default today) and enters only a Return time on each Student's row, as written in the Back-from-Home Book; a Student whose date differs gets a small date field on his own row. Students with no open Leave are listed and skipped.
- Given a Student with an open Leave, when the Return Time is recorded, then the Leave is closed and the Student is no longer Away.
- Expected Return and Return Time are stored separately, each with date and time. Recording the Return Time never overwrites the Expected Return, and it may differ from it (traffic, a longer vacation).
- Given a Return Time later than now, when it is recorded, then it is refused with a reason. The calendar disables future dates, and the server refuses them as well.
- Given a Return Time earlier than the Out Time, when it is recorded, then it is refused with a reason.
- Correcting a Return Time after it is recorded is not offered for now.

**FR-6 Away and Due Back.** The Student list shows Away in red and Due Back in yellow, each with a text label. A Student stays Due Back after Expected Return passes until the Return Time is recorded.

**FR-7 Pooja Status.** The Pooja Window is 05:30:00 to 18:00:00 IST, both ends included. For any Day the system computes a Pooja Status for each Active Student:
- Present: at least one Punch inside the Pooja Window (even if the Student then leaves).
- Not Applicable ("-"): no Punch, and the Student was Away for any part of the Pooja Window. Shown as soon as he is Away, even before the window closes. Any overlap counts: a Leave that starts or ends inside the window, a Leave that touches an edge (Out Time exactly 18:00:00, Return Time exactly 05:30:00), or a Student who returns during the window (for example at 08:00) without having punched. A Punch always wins: a Student who punched at 07:00 and left at 08:00 is Present, and so is a Student who returned at 16:00 and punched at 17:00.
- Pending: no Punch yet, the Pooja Window has not closed, and the Student has not been Away during it.
- Needs Review: the Pooja Window closed, the Student was in the hostel the whole window, no Punch, Day not Finalized.
- Absent: only after Finalize (see FR-8).

**FR-8 Review and Finalize.** Each night, usually around 23:00 IST, the Rector checks the Leave Notes and both books, records any missing Leaves and Returns, reviews the Needs Review list, and Finalizes the Day. No Pooja Status can be changed by hand.
- Given the Pooja Window has not closed, then Finalize is not available. The Rector can still see how many Students are Present so far.
- Given a Day with Needs Review Students, when the Rector Finalizes, then each becomes Absent and the Day is locked.
- Given a Finalized Day, when someone tries to change it, then it is refused.
- Finalize shows a summary first ("7 Students will be Absent").
- Before Finalize the page shows the Device's Last Seen. Given the Device has been quiet for 10 minutes or more, when the Rector clicks Finalize, then the question also says that Punches may still be on the Device. Finalize is still allowed.

**FR-9 Exclude and Send Notifications.** After Finalize, the Report shows an email list of the Absent Students, each with a cross. The Rector may Exclude any of them (for example a Student who explained why he missed Pooja) and then clicks Send Notifications.
- Given a Finalized Day, when the Rector clicks Send Notifications, then each Absent Student who is not Excluded receives exactly one email, and a retry or a second click never sends a second.
- Given an Excluded Student, then he receives no Notification and stays Absent in Reports.
- Given a Day not Finalized, or a Finalized Day where Send Notifications was not clicked, then no Notification is sent.

**FR-10 Review Reminder.** At 23:00 IST, if the Day is not Finalized and Needs Review Students exist, each Report Recipient gets one email listing them. If the Day is Finalized, nothing is sent.

**FR-11 Reports.** The Rector can download a Report for a Day, a month, or a date range as CSV or Excel at any time. The Daily Report is also emailed to the Report Recipients at 23:30 IST whether or not the Day is Finalized, with the Report attached as a coloured Excel file and as a CSV. A Day that is not Finalized is marked Not Finalized and shows Needs Review, never Absent. The Reports page has two cards. The first lists the Students with a scrollbar, sorts them by room (ascending) or by name, and filters them by Present, Absent (Needs Review on a Day not Finalized) and Not Applicable. A download holds the same Students as the filter shown: with a Pooja Status chosen, only the Students who had it on at least one Day, each with every Day of the Report, and the status in the file name. The second holds the graph:
- A Day Report shows a graph of how many Students made their first Punch in each hour of the Pooja Window.
- A month Report shows a graph with three bars for each Day: Present, Absent and Not Applicable.

**FR-12 Monthly Report.** At 09:00 IST on the 1st, the Monthly Report for the previous month is emailed to the Report Recipients, attached the same way. The last day of the month still gets its usual Daily Report.

**FR-13 Rector login.** Every page and API except the Device endpoints requires a login. Sessions expire. Five wrong tries from one address within 15 minutes are refused. The logged-in Rector can change the password on the Settings page (FR-15). A Rector who forgot the password clicks "Forgot password?" on the login page and types the login email; the page always answers the same, whether or not the email has an account. If it has one, a link is emailed to it that works once, within 30 minutes; it opens a page to type the new password twice (at least 12 characters). Using it ends every login and closes any older link. Both steps allow five tries per 15 minutes. The link needs `PUBLIC_URL` and the email settings. When the link cannot help (email not working, or the inbox lost), the developer sets a new password on the server with `npm run rector:password`, which also ends every login of that Rector.

**FR-14 Audit.** Leave (record, edit, cancel), Return, Finalize, Exclude, Send Notifications, Deactivate, Activate, Add and Remove Report Recipient, Change Password and Reset Password record who did it and when (never the password). A Reset Password done on the server's command line has no Rector as done-by; its detail says "command line".

**FR-15 Settings.** A Settings page, opened beside Log out, holds the Report Recipients: the Rector adds an email address or removes one (after a confirmation). An address is checked like a Student's email and kept in lower case; the same address cannot be added twice. When the list is empty, the page warns that no one receives the Review Reminder, Daily Report or Monthly Report. A change applies to the next email without a restart. The page also lets the Rector change the password: the current password, then the new one twice (at least 12 characters, and not the same as the current one). The two new ones are compared on the page. A wrong current password is refused, with five tries per 15 minutes. After a change, every other login of the Rector ends and this one stays.

## 6. Non-functional requirements
- **NFR-1 Time correctness.** All rules use IST. The server's timezone must not change results. Schedules run in Asia/Kolkata.
- **NFR-2 Idempotency.** Re-uploaded Punches, retried emails and re-run schedules never create duplicates.
- **NFR-3 Resilience.** If the server is down, the Device keeps its Punches and re-uploads; nothing is lost.
- **NFR-4 Security.** The Rector site is HTTPS. The Device endpoint is plain HTTP (a Device limitation) and accepts only registered Device Serials. Secrets live in environment variables.
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
| The Rector's list for the first load has errors (wrong Student ID, room or email) | `npm run students:load` checks every row like the form and saves nothing while any row has a problem; each reported line is checked with the Rector. |
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
1. Answered 2026-11-03: the Device holds only Student IDs and fingerprints, no names. The first load therefore cannot match the Device's list to the Excel by name, as the First load paragraph in FR-1 first assumed (it now describes the CSV load). Instead, the Rector holds a list of Student IDs with names and will provide it. Until then, development uses test Students enrolled by the author and friends, who have agreed to this.
2. Answered 2026-11-04: Gmail, through an app password (SMTP `smtp.gmail.com`, port 587), sent from the author's Gmail address. Gmail allows about 500 emails a day, which covers 360 Students. Tested on 4 Nov with real emails to the author and friends who agreed (Review Reminder, Notifications, Daily Report). Another SMTP provider can replace it by changing `.env` only.
3. Has the Rector agreed in writing to emails going to Students?
4. Should the Rector be able to unlock (reopen) a Finalized Day to correct a mistake? Set aside on 2026-10-30; until decided, a Finalized Day cannot be changed.
5. Decided 2026-11-02 from captured payloads: when the Device uploads late, it sends the original punch time (Punches made while the server was down arrived later with their own times, in one batch). The upload-time case does not occur, so no purple Punch is needed.
6. Should the Rector be reminded when a Day is Finalized but Send Notifications was not clicked? Not for now (decided 2026-10-30); revisit after the pilot if needed.
7. Decided 2026-11-02: the many-Students Leave panel (FR-4b) uses one default Out date and Expected Return date with a per-row date override, and a future Out Time is refused (FR-4).
