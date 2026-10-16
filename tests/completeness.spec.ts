import { test, expect } from '@playwright/test';
import { SEED, renewalPath } from './helpers';

// Source: rows 34-35 ("HTTP Method", "Optional Header") — completeness cases beyond the
// contract text itself, but reasonable coverage for a reviewer to expect.

test('row 34: non-POST method (GET) on the renewal-request path -> 405', async ({ request }) => {
  const res = await request.get(renewalPath(SEED.OWNED_RX), {
    headers: { 'x-patient-id': SEED.OWNER },
  });

  expect(res.status()).toBe(405);
});

test('row 35: optional x-request-channel header omitted -> still succeeds', async ({ request }) => {
  const res = await request.post(renewalPath(SEED.OWNED_RX), {
    headers: { 'x-patient-id': SEED.OWNER },
    data: {},
  });

  expect(res.status(), 'x-request-channel is documented as optional; omitting it must not error').toBe(201);
  const body = await res.json();
  expect(body.channel).toBe('');
});
