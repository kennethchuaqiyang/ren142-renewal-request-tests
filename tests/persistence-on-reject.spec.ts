import { test, expect } from '@playwright/test';
import { SEED, resetStore, listPersisted, renewalPath } from './helpers';

// Source: row 36 ("Persistence on Reject"). Every rejection row in access-contract.spec.ts
// already checks listPersisted() is empty after ITS OWN rejected call. This spec is the
// row-36 equivalent: it fires all three rejection types back to back against a single
// reset store and checks the aggregate — the thing a single-call check can miss is a
// write that only shows up once a few rejections have piled up (e.g. an off-by-one in
// an index/counter that only overwrites instead of appending on the 2nd+ call).

test('all three rejection types combined leave the store empty', async ({ request }) => {
  await resetStore(request);

  const missingHeader = await request.post(renewalPath(SEED.OWNED_RX), {
    headers: { 'x-request-channel': 'app' },
    data: {},
  });
  expect(missingHeader.status()).toBe(401);

  const wrongOwner = await request.post(renewalPath(SEED.OWNED_RX), {
    headers: { 'x-patient-id': SEED.OTHER_REAL_PATIENT, 'x-request-channel': 'app' },
    data: {},
  });
  expect(wrongOwner.status()).toBe(404);

  const nonexistent = await request.post(renewalPath(SEED.NONEXISTENT_RX), {
    headers: { 'x-patient-id': SEED.OWNER, 'x-request-channel': 'app' },
    data: {},
  });
  expect(nonexistent.status()).toBe(404);

  const persisted = await listPersisted(request);
  expect(persisted, 'zero records after three rejected calls, not just "no new ones since last check"').toHaveLength(0);
});
