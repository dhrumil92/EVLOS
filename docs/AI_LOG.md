# AI_LOG

A running record of AI suggestions that were rejected or changed, and why. It feeds the "AI use" section of `DESIGN.md`. Add an entry the moment a suggestion is rejected or changed; do not reconstruct them at the end.

The raw ChatGPT export is not committed: it contains device addresses, serial numbers and personal identifiers. This log summarizes it instead; the original stays on the author's machine.

## Tools used
| Tool | Period | Used for |
|------|--------|----------|
| ChatGPT | 19 to 26 Oct 2026 | Understanding the hostel workflow, choosing the Device, first diagnostic server, Device settings. |
| Claude (claude.ai, on the web) | 26 Oct 2026 onward | Continuing the brainstorming, reading the course brief, requirements analysis, rules, the documents, tech stack discussion. |
| Claude Code | from Phase 1 (31 Oct 2026) | Building the whole project under `AGENTS.md`: code, tests, the page designs and keeping the documents up to date. No other coding tool was used. |
| Google Stitch | 5 Nov 2026 | Trying Live view layouts from short prompts. |

## Rejected or changed suggestions
| # | Date | Tool | Suggestion | Decision | Reason |
|---|------|------|------------|----------|--------|
| 1 | 19 Oct | ChatGPT | First check whether the existing system can be fixed with a configuration change, and talk to the sir and the current software vendor before building anything. | **Rejected** | The author does not want to interfere with the running system, and the course needs a real user. He builds independently on a spare Device. |
| 2 | 26 Oct | ChatGPT | Start with the PRD and SRS before anything else, as phase 1. | **Changed** | The author chose to confirm the Device works first, since the project would end if it could not. ChatGPT then adjusted to "verify the Device while writing requirements in parallel". |
| 3 | 27 Oct | Claude | Put one "Away for the whole day" flag per Student per day, set by the Rector. | **Changed** | The author's examples (leaving at 10:00 after punching, returning at 19:00) showed that Leave times matter. The model now uses Leaves with Out Time and Return Time. |
| 4 | 27 Oct | Claude | Offer a cutoff to close the loophole where a late short Leave gives "-". | **Rejected** | The Rector is flexible about it. Documented as a known limitation instead. |
| 5 | 27 Oct | Claude | Send the Daily Report right after the Rector Finalizes. | **Changed** | The author wants a fixed 23:30 IST email regardless of Finalize, plus a 23:00 Review Reminder, so the Rector is never left without the Report. |
| 6 | 27 Oct | Claude | A hint that tells the Rector when an Away Student punches ("he seems to be back, record the return?"). | **Rejected** | Recording Returns is the Rector's core duty. Documented as an assumption (A1 in the PRD). |
| 7 | 27 Oct | Claude | Model a Missing status and a 22:00 Room Check (not in the hostel and no Leave). | **Rejected** | No such case exists in this hostel. Removed from the glossary and the data model. |
| 8 | 27 Oct | Claude | Email both the Student and the Parent after an Absent. | **Changed** | Students only for now; Parent emails are a later phase. |
| 9 | 27 Oct | Claude | Use a job-queue library (`pg-boss`) for scheduled emails. | **Changed by Claude after review** | A simple outbox table plus a minute loop is enough at this scale and easier to explain in the viva. Not a user rejection, recorded for honesty. |
| 10 | 28 Oct | Claude | Add Students mainly by uploading an Excel or CSV Roster, with a preview. | **Changed** | The author expects mismatched columns and formats. Students are added by form; the upload comes last, with a downloadable sample file and strict header checks. Existing Students are loaded once by a script. |
| 11 | 28 Oct | Claude | Design for a Biometric ID being reused after a Student leaves. | **Rejected as unnecessary** | New Students always get new IDs; IDs are never reused. |
| 12 | 28 Oct | Claude | Deactivate takes an effective date (today or a future Day), with a "leaves hostel on" field. | **Rejected** | The author wants no date at registration. Deactivate and Activate are buttons in each Student's settings panel and take effect today. |
| 13 | 28 Oct | Claude | Decide the email provider and check the VM now. | **Rejected** | Build and run locally first; deploy after Phase 4; choose the email provider in Phase 5. |
| 14 | 28 Oct | Claude | Keep Student ID and Biometric ID as separate terms. | **Rejected** | Only one ID exists, the number on the Device. The two terms were merged into Student ID. |
| 15 | 28 Oct | Claude | Run PostgreSQL in Docker for local development. | **Rejected** | PostgreSQL is already installed on the author's PC. Docker is used only on the VM. |
| 16 | 30 Oct | Claude | Let the Rector Override a computed Pooja Status (for example Needs Review to Present when the fingerprint fails). | **Rejected** | No Pooja Status is changed by hand. A Student who explains a missed Pooja stays Absent and the Rector Excludes him from the email. |
| 17 | 30 Oct | Claude | Finalize both locks the Day and releases Notifications. | **Changed** | The author wants two clicks: Finalize, then Send Notifications from the Report's email list, so the Rector can Exclude Students first. |
| 18 | 30 Oct | Claude | Keep uploads from an unknown Device Serial for inspection. | **Changed** | Only one Device is registered; uploads from any other Device Serial are refused. A future Device for another place is registered with its own purpose and kept apart from Pooja. |
| 19 | 30 Oct | Claude | Keep the Pooja Window equal to the temple hours (05:30 to 17:30 IST). | **Changed** | The author added 30 minutes for late Punches: the window is 05:30 to 18:00 IST, both ends included. |
| 20 | 5 Nov | Claude | Add filter buttons to the Excel Report, switching to ExcelJS to get them. | **Rejected** | ExcelJS would bring 193 packages and 46 MB for one feature. The author kept write-excel-file (colours only) and asked instead for downloads that follow the Pooja Status filter on the Reports page, so a file holds only the Absent, Present or Not Applicable Students. |
| 21 | 5 Nov | Claude | Put Settings in the page menu with the other pages. | **Changed** | The author placed Settings beside Log out, as an account item rather than a page of daily work. |
| 22 | 5 Nov | Claude | Keep Temple Dusk (plum and gold, animated diya and dhoop) as the page theme. | **Rejected** | The author found it dark and the pages slow for the Rector, and asked for a light, flat look with no diya or dhoop. |
| 23 | 5 Nov | Google Stitch | Live view designs made from the author's prompts in a blush palette. | **Rejected** | The author liked none of them. |
| 24 | 5 to 6 Nov | Claude | Four light layouts in blush, then layout A in lemon yellow, then in sandalwood. | **Changed, then rejected** | The author picked layout A but rejected each colour version (borders too dark, then too glowing, then too thick), then asked for fresh directions. |
| 25 | 6 Nov | Claude | Four new directions: Dawn, Tulsi, Peacock and Lavender. | **Dawn accepted, the others rejected** | Every page was then designed in Dawn: indigo on a pale blue-white, Bricolage Grotesque headings and Atkinson Hyperlegible text. |
| 26 | 6 Nov | Claude (ui-ux-pro-max skill) | A dark glassmorphism style for an operations dashboard. | **Changed by Claude** | It goes against the author's "no dark or glossy" rule. Not a user rejection, recorded for honesty. |
| 27 | 6 Nov | Claude | A Students table with a Today column and the Student before the Room. | **Changed** | It is a management page: Room first, Today removed, Email added. |
| 28 | 6 Nov | Claude | Away in blue and Due Back in orange on the Live view and Students designs. | **Changed** | The glossary colours win: Away is red, Due Back is yellow, on every page. |
| 29 | 7 Nov | Claude | Leave the per-Student history out of the Student panel, because no server data was thought to exist. | **Changed** | The author asked for a month calendar under the Student's name, in green, red and grey. The Month Report already holds each Student's Pooja Status for every Day, so the page uses it and the server is unchanged. |
| 30 | 8 Nov | Claude | Show In hostel and Away (the glossary's words) in the new hostel Excel, and keep a CSV in the emails beside the Excel. | **Changed** | The author first preferred Present and Absent, then chose In hostel and Away after the glossary conflict was explained (Absent is only a Finalized Pooja Status). The author also removed the CSV from the Daily Report and Monthly Report emails, keeping it on the Reports page, and dropped the Student ID column. |
| 31 | 8 Nov | Claude | Group Students by floor, with a heading for each floor, in the new Excel. | **Changed** | The author wants one plain list in ascending room order (101, 102 ... 110, 201), with no groups and no headings. |
| 32 | 8 Nov | Claude | Put the Public Live View behind a link with a long secret code, and keep its Away and Due Back counts. | **Changed** | The author made it a plain public `/live`, since the numbers are meant for every Student, and kept only "N of M have done Pooja" and the bars. Claude's other suggestions were accepted: a separate server with no login, a 30-second cache, a rate limit, and M as the Active Students less those Not Applicable. |
| 33 | 8 Nov | Claude | Limit the Public Live View to 60 requests a minute per address, and keep the login check before the request limit. | **Changed by Claude** | Found while answering the author's question about flooding: all Students on the hostel Wi-Fi share one address, so 60 would block the page once about 30 watched, and behind Caddy every visitor would share Caddy's address. The limit is now 1200, every page route has a 600-a-minute limit counted before the login check, and `TRUST_PROXY` makes the limits count each visitor. Not a user rejection, recorded for honesty. |

## Accepted after discussion (for context)
| Date | Tool | Suggestion | Note |
|------|------|------------|------|
| 19 Oct | ChatGPT | A missing Punch is never Absent by itself. | Became rule 4. |
| 26 Oct | ChatGPT | Use a mobile hotspot for first Device tests. | Avoided touching the hostel network. |
| 27 Oct | Claude | Use PostgreSQL as the source of truth, and the author's GCP VM for hosting because the Device only speaks plain HTTP. | The author already runs PostgreSQL on the VM and chose to deploy everything there. |
| 7 Nov | Claude | Drop the Students-by-hour chart from the Reports page, and add a Last night card and four numbers for the month (Present on a usual Day, Absent in all Days together, Students Absent at least once, the worst Day). | Chart dropped: the author's approved design has no hour chart, and the Live view already shows the hour band. Card and four numbers **Changed**: the author found the numbers confusing, and a list of Absent Students would run long with about 360 Students (Review and Finalize already shows it). The page shows Present, Not Applicable and Absent only when a Day is chosen. |

## Template for new entries
| # | Date | Tool | Suggestion | Decision (Accepted / Rejected / Changed) | Reason |
