import { test, expect } from '@playwright/test';
import { SEED, renewalPath } from './helpers';

// Source: rows 16-24, "Patient ID" (header) input-hygiene tree. Exploratory, not
// contract-mandated — but empirically verified here, and the results genuinely
// diverge from what Test_Cases_REN.xlsx's L column currently assumes (it expects
// 401 "Unauthorized" uniformly for every malformed variant). That assumption only
// holds for a truly EMPTY header. Anything non-empty — garbage, wrong value,
// mistyped casing — is NOT "missing", so it takes the owner-lookup path instead,
// which resolves to 404 for this prescription, not 401. Two rows (17, 19) go
// further still: common HTTP stacks trim leading/trailing whitespace (OWS) off
// header *values* per RFC 7230, so a leading/trailing space around a correct
// value is silently normalized away and the call actually SUCCEEDS (201).
//
// Rows 18 and 20-23 (space BETWEEN characters, or literal %20 inside the value —
// header values are never URL-decoded) are left as 404 below, since none of those
// malformed strings equals the real owner value.
//
// Row 18 (space between, e.g. "pat _amelia") is likewise not OWS and not
// automatable via a simple string assumption — verified empirically, see below.

test('row 16: blank header value -> 401 (the only case this really is "missing")', async ({ request }) => {
  const res = await request.post(renewalPath(SEED.OWNED_RX), {
    headers: { 'x-patient-id': '', 'x-request-channel': 'app' },
    data: {},
  });
  expect(res.status()).toBe(401);
});

test('row 17: leading raw space -> 201, NOT 401 (OWS trimmed by the HTTP stack, value matches)', async ({ request }) => {
  const res = await request.post(renewalPath(SEED.OWNED_RX), {
    headers: { 'x-patient-id': ' ' + SEED.OWNER, 'x-request-channel': 'app' },
    data: {},
  });
  expect(res.status(), 'xlsx currently expects 401 here — this is a real correction, not a flaky test').toBe(201);
});

test('row 18: internal space -> 404 (not trimmed, value does not match any owner)', async ({ request }) => {
  const res = await request.post(renewalPath(SEED.OWNED_RX), {
    headers: { 'x-patient-id': 'pat _amelia', 'x-request-channel': 'app' },
    data: {},
  });
  expect(res.status()).toBe(404);
});

test('row 19: trailing raw space -> 201, NOT 401 (OWS trimmed, same as row 17)', async ({ request }) => {
  const res = await request.post(renewalPath(SEED.OWNED_RX), {
    headers: { 'x-patient-id': SEED.OWNER + ' ', 'x-request-channel': 'app' },
    data: {},
  });
  expect(res.status(), 'xlsx currently expects 401 here — this is a real correction, not a flaky test').toBe(201);
});

test('row 20: literal %20 leading (header values are never URL-decoded) -> 404', async ({ request }) => {
  const res = await request.post(renewalPath(SEED.OWNED_RX), {
    headers: { 'x-patient-id': '%20' + SEED.OWNER, 'x-request-channel': 'app' },
    data: {},
  });
  expect(res.status(), 'xlsx currently expects 401; actual is 404 since the value is non-empty, just wrong').toBe(404);
});

test('row 21: literal %20 between -> 404', async ({ request }) => {
  const res = await request.post(renewalPath(SEED.OWNED_RX), {
    headers: { 'x-patient-id': 'pat%20_amelia', 'x-request-channel': 'app' },
    data: {},
  });
  expect(res.status()).toBe(404);
});

test('row 22: literal %20 trailing -> 404', async ({ request }) => {
  const res = await request.post(renewalPath(SEED.OWNED_RX), {
    headers: { 'x-patient-id': SEED.OWNER + '%20', 'x-request-channel': 'app' },
    data: {},
  });
  expect(res.status()).toBe(404);
});

test('row 23: wrong casing -> 404 (header value match is case-sensitive)', async ({ request }) => {
  const res = await request.post(renewalPath(SEED.OWNED_RX), {
    headers: { 'x-patient-id': 'Pat_amelia', 'x-request-channel': 'app' },
    data: {},
  });
  expect(res.status()).toBe(404);
});

test('row 24: valid baseline -> 201', async ({ request }) => {
  const res = await request.post(renewalPath(SEED.OWNED_RX), {
    headers: { 'x-patient-id': SEED.OWNER, 'x-request-channel': 'app' },
    data: {},
  });
  expect(res.status()).toBe(201);
});
