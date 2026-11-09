# TESTING: EVLOS

> **DRAFT.** The five rules are tested as pure functions in `packages/core`. Fill each row only from real tests that exist in the repo. Check the format against the course project page before submission.

## Rules and their tests
| Rule | Test `file:line` | If untested — what stops you |
|------|------------------|-----------------------------|
| 1. A Punch counts only between 05:30 and 18:00 IST, both included | `packages/core/src/pooja-window.test.ts:11`, `:15`, `:23`, `:27` | |
| 2. The same Punch uploaded twice is stored once | `packages/core/src/punch.test.ts:11`; the unique key on `punches`: `apps/api/src/adapters/postgres/punch-repository.test.ts:59` | |
| 3. Away for any part of the Pooja Window with no Punch gives Not Applicable, never Absent | `packages/core/src/pooja-status.test.ts:114`, `:118`, `:128` | |
| 4. In the hostel for the whole Pooja Window with no Punch is only Needs Review until Finalize | `packages/core/src/pooja-status.test.ts:172`, `:182`; Finalize makes Needs Review Absent: `apps/api/src/use-cases/review.test.ts:96` | |
| 5. A Notification goes only after Finalize, at most once per Student per Day (never to an Excluded Student) | `packages/core/src/notification.test.ts:26`, `:43`, `:51`; refused before Finalize: `apps/api/src/use-cases/review.test.ts:285`; the outbox `dedupe_key`: `apps/api/src/adapters/postgres/finalize-repository.test.ts:129`; the sender takes each email once, even with two runs at once: `apps/api/src/adapters/postgres/outbox-repository.test.ts:99`, `:108`; a Punch After Finalize is shown before Send Notifications: `apps/api/src/use-cases/review.test.ts:170`; a quiet Device is named before Finalize: `packages/core/src/device.test.ts:12` | |

Rules tested: 5 of 5 as pure functions, and the database keys behind rules 2 and 5 against PostgreSQL, including that the outbox sender never takes an email twice.

## Weak test
None yet. When found: the test, why it would still pass if the rule were broken, and what fixes it.

## Checks on the deployed server
Not part of `npm test`: done by hand on the Google Cloud VM on 9 Nov 2026, with the commands in `docs/DEPLOY.md`.
- **The Device endpoint over the internet** (section 6): the registered Device Serial gets the Device options, an unknown one gets `403 Forbidden`, and an uploaded Punch at 06:00 IST is stored once as `00:30 UTC`. The test Punch was then deleted.
- **The nightly backup** (section 12): with a wrong container the script stops with `backup FAILED` and leaves no file; five runs keeping 3 leave exactly 3 files; a backup restored into a scratch database has the same number of Students, Punches and Leaves as the live one. The same failure, empty-dump and pruning cases were first run against a fake `docker` on the author's PC.
- **A VM restart** (section 9): every container came back by itself.

## How to run the tests
1,157 tests in 110 files (8 Nov 2026). After the one-time setup in `docs/SETUP.md` (PostgreSQL role, the two databases, `.env`):

```bash
npm run db:setup                                    # bring evlos_test up to the latest migration
npm test                                            # every test in every workspace
npx vitest run apps/api/src/db/migrate.test.ts      # one file
```

Database tests run only against `evlos_test`: `assertTestDatabase` (`apps/api/src/db/test-database.ts`) refuses any other database, and each test empties it first. CI runs the same tests on every push to `main` and every pull request, against a throwaway PostgreSQL 17.
