# DESIGN: EVLOS

> **DRAFT.** The rules are settled. The decisions and the boundary are the plan; each `file:line` and each "before / after" is filled in only from real code and real refactors. Do not invent them. Terms come from `UBIQUITOUS_LANGUAGE.md`.

## Five rules the product enforces
1. A Punch counts only between 05:30 and 17:30 IST (the Pooja Window).
2. The same Punch uploaded twice is stored once.
3. A Student who was Away for any part of the Pooja Window and has no Punch gets Not Applicable ("-"), never Absent.
4. A Student who was in the hostel for the whole Pooja Window and has no Punch is only Needs Review. He becomes Absent when the Rector Finalizes.
5. A Notification goes to a Student only after Finalize, and at most once per Student per Day.

## Three design decisions (planned; confirm against code)
| # | Decision | Principle | `file:line` | Before | Why changed |
|---|----------|-----------|-------------|--------|-------------|
| D1 | Rules are pure functions that receive a `Clock` instead of reading the system time | Dependency inversion | TBD | TBD | Tests must be able to say "it is 23:30 IST" without waiting; the server runs in UTC. |
| D2 | Sending email is a `Notifier` port; delivery goes through an outbox with a unique key | Dependency inversion, single responsibility | TBD | TBD | Retries must never send a second Notification; tests use a fake notifier. |
| D3 | Pooja Status is computed from stored facts (Punches, Leaves) and written only at Finalize | Single source of truth | TBD | TBD | A stored status can go stale when a Leave or Punch arrives late. |

Replace a row if the real refactors turn out different. A decision counts only when its before and after really happened in this repo's history.

## One boundary
The Device adapter. It is where the fingerprint terminal's push protocol, serial numbers and timezone-less timestamps stop. Inside the boundary, the core sees only a Punch with a Student ID and an IST time. This protects the core from the Device vendor: changing the Device, its firmware or its protocol touches the adapter only. A second, smaller boundary is the email provider behind `Notifier`.

## Known limitations
- A Student with a short Leave late in the Pooja Window (for example leaving at 17:00) gets Not Applicable even if he was in the hostel most of the window. The Rector accepts this and can Override.
- A forgotten Return keeps a Student Away. The Rector is responsible for recording Returns.
- The Device sends plain HTTP, so Punch uploads are not encrypted in transit. Access is limited to known Device serial numbers.

## AI use
- **Tools:** ChatGPT for early exploration (hostel workflow, Device setup, first diagnostic server); Claude for requirements analysis and drafting documents; Google Antigravity for implementation under `AGENTS.md`.
- **Rejected suggestions:** every one is logged in `docs/AI_LOG.md`. One example: Claude suggested a hint that tells the Rector when an Away Student punches ("he seems to be back"). The author rejected it because recording Returns is the Rector's core duty, and the assumption is documented instead.
- **Rule for every change:** the author reads the diff and can explain each file before merging.
