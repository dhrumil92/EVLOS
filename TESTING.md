# TESTING: EVLOS

> **SKELETON.** Nothing is tested yet. Fill each row only from real tests that exist in the repo. Check the format against the course project page before submission.

## Rules and their tests
| Rule | Test `file:line` | If untested — what stops you |
|------|------------------|-----------------------------|
| 1. A Punch counts only between 05:30 and 18:00 IST, both included | not written yet | |
| 2. The same Punch uploaded twice is stored once | not written yet | |
| 3. Away for any part of the Pooja Window with no Punch gives Not Applicable, never Absent | not written yet | |
| 4. In the hostel for the whole Pooja Window with no Punch is only Needs Review until Finalize | not written yet | |
| 5. A Notification goes only after Finalize, at most once per Student per Day (never to an Excluded Student) | not written yet | |

Rules tested: 0 of 5

## Weak test
None yet. When found: the test, why it would still pass if the rule were broken, and what fixes it.

## How to run the tests
After the one-time setup in `README.md` (PostgreSQL role, the two databases, `.env`):

```bash
npm run db:setup                                    # bring evlos_test up to the latest migration
npm test                                            # every test in every workspace
npx vitest run apps/api/src/db/migrate.test.ts      # one file
```

Database tests run only against `evlos_test`: `assertTestDatabase` (`apps/api/src/db/test-database.ts`) refuses any other database, and each test empties it first. CI runs the same tests on every push to `main` and every pull request, against a throwaway PostgreSQL 17.
