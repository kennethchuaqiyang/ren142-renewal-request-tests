import { test, expect } from '@playwright/test';
import { SEED, resetStore, renewalPath } from './helpers';

// Source: row 33 ("404 Response Diff"). Rows 25 and 29 each individually assert a 404 —
// this test actually proves they're indistinguishable, rather than leaving that as two
// separately-plausible claims a reader has to take on faith.

test('nonexistent-id 404 and wrong-owner 404 are indistinguishable', async ({ request }) => {
  await resetStore(request);
  const nonexistent = await request.post(renewalPath(SEED.NONEXISTENT_RX), {
    headers: { 'x-patient-id': SEED.OWNER, 'x-request-channel': 'app' },
    data: {},
  });

  await resetStore(request);
  const wrongOwner = await request.post(renewalPath(SEED.OWNED_RX), {
    headers: { 'x-patient-id': SEED.OTHER_REAL_PATIENT, 'x-request-channel': 'app' },
    data: {},
  });

  expect(nonexistent.status()).toBe(404);
  expect(wrongOwner.status()).toBe(404);
  expect(nonexistent.status()).toBe(wrongOwner.status());

  const [bodyA, bodyB] = await Promise.all([nonexistent.json(), wrongOwner.json()]);
  expect(
    bodyA,
    'the two 404 bodies must be byte-identical in shape/content — any difference discloses existence to a non-owner'
  ).toEqual(bodyB);
});
