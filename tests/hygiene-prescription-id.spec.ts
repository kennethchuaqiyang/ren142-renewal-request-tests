import { test, expect } from '@playwright/test';
import { SEED, renewalPath } from './helpers';

// Source: rows 6-15, "Prescription ID" input-hygiene tree. These are exploratory
// robustness probes, not contract-mandated behavior (see README) — the contract
// says nothing about malformed ids, so these document what the implementation
// actually does, verified empirically against the running mock.
//
// Rows 7-9 (raw, literal space characters typed directly into the URL path) are
// intentionally NOT automated here: curl sends such bytes raw, but Playwright's
// underlying URL parsing auto-percent-encodes a literal space before the request
// is sent, so the two tools don't exercise the same wire bytes. Those three stay
// manual-only (curl) cases in Test_Cases_REN.xlsx rows 7-9.

test('row 6: blank segment (double slash) -> 404', async ({ request }) => {
  const res = await request.post(renewalPath(''), {
    headers: { 'x-patient-id': SEED.OWNER, 'x-request-channel': 'app' },
    data: {},
  });
  expect(res.status()).toBe(404);
});

test('row 10: leading %20 -> 404 (decoded to a literal leading space, no match)', async ({ request }) => {
  const res = await request.post(renewalPath('%20' + SEED.OWNED_RX), {
    headers: { 'x-patient-id': SEED.OWNER, 'x-request-channel': 'app' },
    data: {},
  });
  expect(res.status()).toBe(404);
});

test('row 11: %20 between segments -> 404', async ({ request }) => {
  const res = await request.post(renewalPath('rx%20_amelia_001'), {
    headers: { 'x-patient-id': SEED.OWNER, 'x-request-channel': 'app' },
    data: {},
  });
  expect(res.status()).toBe(404);
});

test('row 12: trailing %20 -> 404', async ({ request }) => {
  const res = await request.post(renewalPath(SEED.OWNED_RX + '%20'), {
    headers: { 'x-patient-id': SEED.OWNER, 'x-request-channel': 'app' },
    data: {},
  });
  expect(res.status()).toBe(404);
});

test('row 13: numeric-only id -> 404', async ({ request }) => {
  const res = await request.post(renewalPath('001'), {
    headers: { 'x-patient-id': SEED.OWNER, 'x-request-channel': 'app' },
    data: {},
  });
  expect(res.status()).toBe(404);
});

test('row 14: wrong casing -> 404 (lookup is case-sensitive)', async ({ request }) => {
  const res = await request.post(renewalPath('rx_Amelia_001'), {
    headers: { 'x-patient-id': SEED.OWNER, 'x-request-channel': 'app' },
    data: {},
  });
  expect(res.status()).toBe(404);
});

test('row 15: valid baseline -> 201', async ({ request }) => {
  const res = await request.post(renewalPath(SEED.OWNED_RX), {
    headers: { 'x-patient-id': SEED.OWNER, 'x-request-channel': 'app' },
    data: {},
  });
  expect(res.status()).toBe(201);
});
