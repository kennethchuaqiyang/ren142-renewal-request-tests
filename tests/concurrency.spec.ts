import { test, expect } from '@playwright/test';
import { SEED, resetStore, listPersisted, renewalPath, RenewalRequestBody } from './helpers';

// Source: row 39 ("Load Test", Non Functional). A lightweight in-process version of
// what the xlsx describes running via Artillery — fires a concurrent burst mixing
// valid and invalid calls and checks the shared in-memory state (guarded by a single
// sync.Mutex in main.go) stays correct under concurrency. For a heavier/longer run,
// use the Artillery command documented in the xlsx instead; this is the quick,
// CI-friendly version.

const CONCURRENT_VALID = 15;
const CONCURRENT_INVALID = 10; // missing header -> 401, must not pollute the store

test('concurrent valid + invalid calls: unique ids, correct persisted count, no cross-talk', async ({ request }) => {
  await resetStore(request);

  const validCalls = Array.from({ length: CONCURRENT_VALID }, () =>
    request.post(renewalPath(SEED.OWNED_RX), {
      headers: { 'x-patient-id': SEED.OWNER, 'x-request-channel': 'app' },
      data: {},
    })
  );
  const invalidCalls = Array.from({ length: CONCURRENT_INVALID }, () =>
    request.post(renewalPath(SEED.OWNED_RX), {
      headers: { 'x-request-channel': 'app' },
      data: {},
    })
  );

  const [validResponses, invalidResponses] = await Promise.all([
    Promise.all(validCalls),
    Promise.all(invalidCalls),
  ]);

  for (const res of invalidResponses) {
    expect(res.status()).toBe(401);
  }

  const validBodies = await Promise.all(
    validResponses.map(async (res) => {
      expect(res.status()).toBe(201);
      return (await res.json()) as RenewalRequestBody;
    })
  );

  const requestIds = validBodies.map((b) => b.requestId);
  expect(new Set(requestIds).size, 'every successful call must get a unique requestId — no dupes from a racy counter').toBe(CONCURRENT_VALID);
  for (const b of validBodies) {
    expect(b.requestedBy, 'no cross-talk between concurrent requests actor values').toBe(SEED.OWNER);
  }

  const persisted = await listPersisted(request);
  expect(
    persisted.length,
    'persisted count must equal exactly the number of successful calls — no extra entries from the 401s'
  ).toBe(CONCURRENT_VALID);
});
