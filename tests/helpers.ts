import { APIRequestContext, expect } from '@playwright/test';

// Seed data from README.md — mirrors the mock server's hardcoded prescriptions map.
export const SEED = {
  OWNED_RX: 'rx_amelia_001',
  OWNER: 'pat_amelia',
  OTHER_REAL_PATIENT: 'pat_noah', // owns rx_noah_001, not rx_amelia_001
  NONEXISTENT_RX: 'rx_fake_999',
};

export interface RenewalRequestBody {
  requestId: string;
  prescriptionId: string;
  requestedBy: string;
  channel: string;
  status: string;
  createdAt: string;
}

export async function resetStore(request: APIRequestContext): Promise<void> {
  const res = await request.post('/debug/reset');
  expect(res.ok(), 'POST /debug/reset must succeed before a test can trust a clean store').toBeTruthy();
}

export async function listPersisted(request: APIRequestContext): Promise<unknown[]> {
  const res = await request.get('/debug/renewal-requests');
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  // Go's json.Marshal encodes a nil slice as `null`, not `[]` — an empty store
  // round-trips as `null` here. Normalize so callers can always use array matchers.
  return body ?? [];
}

export function renewalPath(prescriptionId: string, query = ''): string {
  return `/api/prescriptions/${prescriptionId}/renewal-requests${query}`;
}
