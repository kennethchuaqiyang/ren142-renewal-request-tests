# REN-142 renewal-request — Playwright API automation

Generated from `Test_Cases_REN.xlsx` (Cases tab), targeting the `ren142-mock-api` Go
server at `C:\mockRun`. This is the "gold" automation companion to that xlsx — one
suite covering the actual access-control contract, plus the exploratory hygiene
breadth, built to actually run and verified against the live mock.

## Running it

```
# 1. start the mock server (separate terminal)
cd C:\mockRun
go run main.go

# 2. install and run the tests
cd C:\testrun
npm install
npx playwright test
```

HTML report after a run: `npx playwright show-report`.

## Layout

| File | Covers (xlsx rows) |
|---|---|
| `tests/access-contract.spec.ts` | 25-32 — the core contract: actor derivation, 401 on missing actor, 404-indistinguishability, no-persist-on-reject |
| `tests/response-diff.spec.ts` | 33 — diffs the two 404 bodies byte-for-byte instead of asserting each in isolation |
| `tests/completeness.spec.ts` | 34-35 — non-POST method, optional header omitted |
| `tests/persistence-on-reject.spec.ts` | 36 — aggregate persistence check across all three rejection types |
| `tests/hygiene-prescription-id.spec.ts` | 6, 10-15 — malformed/edge-case prescription ids |
| `tests/hygiene-patient-id.spec.ts` | 16, 18, 20-24 — malformed/edge-case header values |
| `tests/concurrency.spec.ts` | 39 — lightweight in-process version of the Artillery load test described in the xlsx |

Rows 7-9 and 17/19 raw-space URL-path cases, and rows 37-38 (DB down / Timeout), are
intentionally **not** automated here — see the comment at the top of
`hygiene-prescription-id.spec.ts` and the xlsx itself for why (client-library
URL-encoding behavior differs from curl for raw path spaces; rows 37-38 have no
dependency to fail against in this mock).

## Current result against the mock: 23 passed, 6 failed — on purpose

This isn't a suite someone forgot to fix. The failures are real findings: this mock
has deliberately planted access-control violations, and this is what a correctly
written suite looks like catching them, rather than silently passing because an
assertion got weakened to match broken behavior.

**Failing (all genuine):**
- `access-contract.spec.ts` — row 25, row 29: a rejected request (nonexistent id /
  wrong owner) still gets persisted before the rejection check runs
- `access-contract.spec.ts` — row 27, row 30: the query-string `patientId` overrides
  the header-derived actor, both when the header is missing (row 27) and when it
  conflicts with a header that IS present (row 30) — the body equivalent (rows 28, 31)
  correctly passes, since the body is never read for actor identity at all
- `persistence-on-reject.spec.ts` — the aggregate version of the same persist-before-
  validate issue above
- `response-diff.spec.ts` — the two 404 responses are NOT byte-identical: a
  nonexistent prescription returns `{"error":"prescription not found"}`, a
  wrong-owner prescription returns `{"error":"not authorized for this prescription"}`
  — this alone discloses existence to a non-owner, independent of status code

**Passing:** everything else, including the hygiene breadth, the method/optional-header
completeness cases, and the concurrency check (the mutex around the in-memory store
is correctly serializing writes — no duplicate/missing `requestId`s under load).

## Two corrections this suite found in the xlsx itself

Running the Patient-ID hygiene rows empirically (not assuming) turned up two places
where `Test_Cases_REN.xlsx`'s expected result doesn't match reality — both are left
as comments at the top of `hygiene-patient-id.spec.ts`, but worth calling out:

- **Rows 17 and 19** (leading/trailing raw space in the header value) — the xlsx
  expects 401. Actual: **201**. Most HTTP stacks trim leading/trailing whitespace
  (OWS) off header values per RFC 7230, so `" pat_amelia"` is sent as `"pat_amelia"`
  and matches the real owner.
- **Rows 20-23** (literal `%20`, or wrong casing, inside the header value) — the
  xlsx expects 401 uniformly. Actual: **404**. A header value is never URL-decoded,
  so these are not "missing" — they're a real, present, wrong value, which takes the
  owner-mismatch path (404), not the missing-actor path (401). Only a genuinely
  *empty* header value (row 16) is actually 401.

These aren't flaky tests — they're the suite doing its job on the xlsx's own
assumptions, the same way it does on the server's behavior.
