import { test, expect } from '@playwright/test';
import { SEED, resetStore, listPersisted, renewalPath, RenewalRequestBody } from './helpers';

// Source: Test_Cases_REN.xlsx -> Cases tab, "Functional" category, rows 25-32.
// This is the core access-control contract itself (not the exploratory hygiene rows):
//   - actor derived from x-patient-id header only; query/body patient ids are inert
//   - no actor header -> 401
//   - nonexistent prescription vs. owned-by-someone-else -> both 404
//   - nothing persists on any rejected path

test.describe('Prescription ID / Invalid Prescription ID (row 25)', () => {
  test('nonexistent prescription id -> 404', async ({ request }) => {
    await resetStore(request);

    const res = await request.post(renewalPath(SEED.NONEXISTENT_RX), {
      headers: { 'x-patient-id': SEED.OWNER, 'x-request-channel': 'app' },
      data: {},
    });

    expect(res.status()).toBe(404);

    const persisted = await listPersisted(request);
    expect(persisted, 'nothing should persist on a rejected request').toHaveLength(0);
  });
});

test.describe('Prescription ID / Valid Prescription ID / No Patient ID in header (rows 26-28)', () => {
  test('row 26: no patient id anywhere -> 401', async ({ request }) => {
    await resetStore(request);

    const res = await request.post(renewalPath(SEED.OWNED_RX), {
      headers: { 'x-request-channel': 'app' },
      data: {},
    });

    expect(res.status()).toBe(401);
    expect(await listPersisted(request)).toHaveLength(0);
  });

  test('row 27: patient id in query string only -> still 401, query must be inert', async ({ request }) => {
    await resetStore(request);

    const res = await request.post(renewalPath(SEED.OWNED_RX, `?patientId=${SEED.OWNER}`), {
      headers: { 'x-request-channel': 'app' },
      data: {},
    });

    expect(res.status(), 'a query-string patient id must never substitute for the header').toBe(401);
    expect(await listPersisted(request)).toHaveLength(0);
  });

  test('row 28: patient id in body only -> still 401, body must be inert', async ({ request }) => {
    await resetStore(request);

    const res = await request.post(renewalPath(SEED.OWNED_RX), {
      headers: { 'x-request-channel': 'app' },
      data: { patientId: SEED.OWNER },
    });

    expect(res.status(), 'a body patient id must never substitute for the header').toBe(401);
    expect(await listPersisted(request)).toHaveLength(0);
  });
});

test.describe('Prescription ID / Mismatching Patient ID in header (row 29)', () => {
  test('a different real patient does not own this prescription -> 404, not 403', async ({ request }) => {
    await resetStore(request);

    const res = await request.post(renewalPath(SEED.OWNED_RX), {
      headers: { 'x-patient-id': SEED.OTHER_REAL_PATIENT, 'x-request-channel': 'app' },
      data: {},
    });

    expect(res.status(), 'existence must not be disclosed to a non-owner via a different status code').toBe(404);
    expect(await listPersisted(request)).toHaveLength(0);
  });
});

test.describe('Prescription ID / Matching Patient ID (rows 30-32) — spoofing resistance + baseline', () => {
  test('row 30: correct header + conflicting query patient id -> succeeds as the header patient', async ({ request }) => {
    await resetStore(request);

    const res = await request.post(renewalPath(SEED.OWNED_RX, `?patientId=${SEED.OTHER_REAL_PATIENT}`), {
      headers: { 'x-patient-id': SEED.OWNER, 'x-request-channel': 'app' },
      data: {},
    });

    expect(res.status()).toBe(201);
    const body = (await res.json()) as RenewalRequestBody;
    expect(body.requestedBy, 'query string must not leak into the actor, even when it conflicts with the header').toBe(SEED.OWNER);
  });

  test('row 31: correct header + conflicting body patient id -> succeeds as the header patient', async ({ request }) => {
    await resetStore(request);

    const res = await request.post(renewalPath(SEED.OWNED_RX), {
      headers: { 'x-patient-id': SEED.OWNER, 'x-request-channel': 'app' },
      data: { patientId: SEED.OTHER_REAL_PATIENT },
    });

    expect(res.status()).toBe(201);
    const body = (await res.json()) as RenewalRequestBody;
    expect(body.requestedBy, 'body must not leak into the actor, even when it conflicts with the header').toBe(SEED.OWNER);
  });

  test('row 32: clean baseline — correct header only -> 201 with expected fields', async ({ request }) => {
    await resetStore(request);

    const res = await request.post(renewalPath(SEED.OWNED_RX), {
      headers: { 'x-patient-id': SEED.OWNER, 'x-request-channel': 'app' },
      data: {},
    });

    expect(res.status()).toBe(201);
    const body = (await res.json()) as RenewalRequestBody;
    expect(body.requestedBy).toBe(SEED.OWNER);
    expect(body.prescriptionId).toBe(SEED.OWNED_RX);
    expect(body.status).toBe('pending');
    expect(body.requestId).toBeTruthy();
    expect(body.createdAt).toBeTruthy();
  });
});
