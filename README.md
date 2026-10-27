# EVLOS

Hostel pooja attendance, built from biometric punches. Students punch a fingerprint device while the temple is open (05:30 to 17:30 IST). The system shows punches live, works out who was in the hostel from the Rector's leave records, and lets the Rector review and finalize the day. Students who were in the hostel but did not punch are emailed only after the Rector confirms. The Rector gets reminders and daily and monthly reports by email, and can download reports as CSV or Excel at any time.

IT643 Software Design and Testing term project, DAU.

## Status

In development. Requirements and domain language are settled; the code is not yet written.

## Live URL

TBD (will be added here before the `project-final` tag).

## Run locally

TBD. This section will be filled in with working commands (five or fewer) when the repo skeleton lands.

## How it works

Five rules the product enforces (full text in `DESIGN.md` once written):

1. A punch counts only between 05:30 and 17:30 IST.
2. The same punch uploaded twice is stored once.
3. A student away for any part of the window with no punch gets "-", never Absent.
4. A student in the hostel for the whole window with no punch is only Needs Review. He becomes Absent when the Rector finalizes.
5. An email goes to a student only after finalize, at most once per student per day.

## Planned stack

TypeScript, Node.js and Fastify, React and Vite, PostgreSQL, deployed on Google Cloud. The fingerprint device pushes to the server over plain HTTP; the Rector UI is served over HTTPS.

## Documents

- `UBIQUITOUS_LANGUAGE.md`: the domain vocabulary and flagged ambiguities.
- `DESIGN.md`: rules, design decisions, the boundary, and AI use (to come).
- `TESTING.md`: which rules are tested and how (to come).
