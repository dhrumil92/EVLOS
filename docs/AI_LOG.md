# AI_LOG

A running record of AI suggestions that were rejected or changed, and why. It feeds the "AI use" section of `DESIGN.md`. Add an entry the moment a suggestion is rejected or changed; do not reconstruct them at the end.

The raw ChatGPT export is not committed: it contains device addresses, serial numbers and personal identifiers. This log summarizes it instead; the original stays on the author's machine.

## Tools used
| Tool | Period | Used for |
|------|--------|----------|
| ChatGPT | 19 to 26 Oct 2026 | Understanding the hostel workflow, choosing the Device, first diagnostic server, Device settings. |
| Claude | 26 Oct 2026 onward | Reading the course brief, requirements analysis, rules, documents, tech stack discussion. |
| Google Antigravity | from 28 Oct 2026 | Implementation, under `AGENTS.md`. |

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

## Accepted after discussion (for context)
| Date | Tool | Suggestion | Note |
|------|------|------------|------|
| 19 Oct | ChatGPT | A missing Punch is never Absent by itself. | Became rule 4. |
| 26 Oct | ChatGPT | Use a mobile hotspot for first Device tests. | Avoided touching the hostel network. |
| 27 Oct | Claude | Use PostgreSQL as the source of truth, and the author's GCP VM for hosting because the Device only speaks plain HTTP. | The author already runs PostgreSQL on the VM and chose to deploy everything there. |

## Template for new entries
| # | Date | Tool | Suggestion | Decision (Accepted / Rejected / Changed) | Reason |
