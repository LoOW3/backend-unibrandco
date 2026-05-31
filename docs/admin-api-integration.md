# Admin API — Frontend Integration

This document describes how the frontend should authenticate and consume the Unibrandco admin stock sync API.

## Base URL

After deployment, read the CDK output `AdminApiBaseUrl`. All routes below are relative to that base URL.

Example:

```text
https://abc123.execute-api.us-east-1.amazonaws.com
```

## Authentication

All admin routes require:

1. A valid Cognito **IdToken** from the `unibrandco-users` User Pool.
2. Membership in the **`ADMIN`** Cognito group.

Send the token on every request:

```http
Authorization: Bearer <IdToken>
Content-Type: application/json
```

### Login flow

Use Cognito `USER_PASSWORD_AUTH` or your frontend auth library (Amplify, AWS SDK, etc.) to obtain an `IdToken`.

Example with AWS CLI:

```bash
aws cognito-idp initiate-auth \
  --client-id YOUR_USER_POOL_CLIENT_ID \
  --auth-flow USER_PASSWORD_AUTH \
  --auth-parameters USERNAME=admin@example.com,PASSWORD='YourSecurePass123!' \
  --region us-east-1
```

Use the `AuthenticationResult.IdToken` value as the bearer token.

### Error responses

| Status | Meaning |
|--------|---------|
| `401` | Missing or invalid JWT (returned by API Gateway) |
| `403` | Valid JWT but user is not in the `ADMIN` group |
| `404` | Route or resource not found |
| `500` | Server error |

Error body:

```json
{
  "message": "Forbidden: ADMIN group required"
}
```

## CORS

The API allows:

- Origins: `*`
- Methods: `GET`, `POST`, `OPTIONS`
- Headers: `Authorization`, `Content-Type`

## Endpoints

### 1. Manual Patagonia sync

Triggers a manual fetch from Patagonia WMS and stores a snapshot in S3.

```http
POST /stock/sync
Authorization: Bearer <IdToken>
```

**Response `200`:**

```json
{
  "s3Key": "2025/05/30/151200.json",
  "itemCount": 150,
  "syncedAt": "2025-05-30T15:12:00.000Z"
}
```

This endpoint starts the pipeline. Tiendanube updates happen asynchronously after the diff is computed.

---

### 2. Admin dashboard

Returns the latest Tiendanube stock sync summary.

```http
GET /dashboard/admin
Authorization: Bearer <IdToken>
```

**Response `200`:**

```json
{
  "lastTiendanubeSync": {
    "syncKey": "2025/05/30/153000.json",
    "syncedAt": "2025-05-30T15:30:00.000Z",
    "patchedAt": "2025-05-30T15:30:05.000Z",
    "patchedCount": 15,
    "patchedItems": [
      {
        "sku": "ART-001",
        "newStock": 10,
        "previousStock": 8
      }
    ]
  }
}
```

If no Tiendanube sync has run yet:

```json
{
  "lastTiendanubeSync": null
}
```

---

### 3. List stock changes (paginated)

Returns stock diff records without the heavy `changedItems` array.

```http
GET /admin/stock-changes?limit=20&cursor=<optional>
Authorization: Bearer <IdToken>
```

**Query parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | number | `20` | Page size, max `100` |
| `cursor` | string | — | Opaque cursor from previous response `nextCursor` |

**Response `200`:**

```json
{
  "items": [
    {
      "pk": "SYNC#2025/05/30/153000.json",
      "syncedAt": "2025-05-30T15:30:00.000Z",
      "currentSyncKey": "2025/05/30/153000.json",
      "previousSyncKey": "2025/05/30/150000.json",
      "changedCount": 18,
      "createdAt": "2025-05-30T15:30:02.000Z",
      "tiendanubeSync": {
        "patchedAt": "2025-05-30T15:30:05.000Z",
        "patchedCount": 15,
        "matchedCount": 15,
        "skippedDeleted": 1,
        "skippedNoSku": 2
      }
    }
  ],
  "nextCursor": "eyJwIjoiLi4uIn0"
}
```

When there are no more pages, `nextCursor` is `null`.

---

### 4. Stock change detail

Returns the full diff record including `changedItems` and `tiendanubeSync`.

```http
GET /admin/stock-changes/{syncKey}
Authorization: Bearer <IdToken>
```

**Path parameter:**

- `syncKey`: snapshot key, e.g. `2025/05/30/153000.json`

Example:

```http
GET /admin/stock-changes/2025/05/30/153000.json
```

**Response `200`:** full `StockDiffRecord` object.

**Response `404`:**

```json
{
  "message": "Stock change record not found"
}
```

---

### 5. Patagonia stock files by day

Lists S3 snapshot files for a given UTC day.

```http
GET /admin/stock-files?date=YYYY-MM-DD
Authorization: Bearer <IdToken>
```

**Query parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `date` | string | yes | Date in `YYYY-MM-DD` format |

**Response `200`:**

```json
{
  "date": "2025-05-30",
  "files": [
    {
      "s3Key": "2025/05/30/153000.json",
      "syncedAt": "2025-05-30T15:30:00.000Z",
      "sizeBytes": 123456
    }
  ]
}
```

Files are sorted by `syncedAt` descending.

**Response `400`:**

```json
{
  "message": "Invalid or missing date query parameter. Expected YYYY-MM-DD."
}
```

---

### 6. Download Patagonia snapshot

Returns a presigned S3 URL to download a stock snapshot JSON file.

```http
GET /admin/stock-files/download?syncKey=2025/05/30/153000.json
Authorization: Bearer <IdToken>
```

**Query parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `syncKey` | string | yes | Snapshot S3 key, e.g. `2025/05/30/153000.json` |

**Response `200`:**

```json
{
  "syncKey": "2025/05/30/153000.json",
  "downloadUrl": "https://...",
  "expiresAt": "2026-03-10T12:05:00.000Z",
  "contentType": "application/json"
}
```

Use `downloadUrl` immediately — it expires in **5 minutes**. Auth is required only for this API call, not for the presigned S3 URL.

**Response `400`:**

```json
{
  "message": "Invalid syncKey. Expected yyyy/mm/dd/HHmmss.json"
}
```

**Response `404`:**

```json
{
  "message": "Stock snapshot file not found"
}
```

---

## Suggested TypeScript types

```typescript
export interface TiendanubePatchedItem {
  sku: string;
  newStock: number;
  previousStock?: number;
}

export interface AdminDashboardResponse {
  lastTiendanubeSync: {
    syncKey: string;
    syncedAt: string;
    patchedAt: string;
    patchedCount: number;
    patchedItems: TiendanubePatchedItem[];
  } | null;
}

export interface StockChangeSummary {
  pk: string;
  syncedAt: string;
  currentSyncKey: string;
  previousSyncKey: string;
  changedCount: number;
  createdAt: string;
  tiendanubeSync?: {
    patchedAt: string;
    patchedCount: number;
    matchedCount: number;
    skippedDeleted: number;
    skippedNoSku: number;
  };
}

export interface PaginatedStockChangesResponse {
  items: StockChangeSummary[];
  nextCursor: string | null;
}

export interface StockFilesResponse {
  date: string;
  files: Array<{
    s3Key: string;
    syncedAt: string;
    sizeBytes: number;
  }>;
}

export interface StockFileDownloadResponse {
  syncKey: string;
  downloadUrl: string;
  expiresAt: string;
  contentType: string;
}
```

## Example frontend client

```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_ADMIN_API_BASE_URL!;

async function adminFetch<T>(
  path: string,
  idToken: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const error = (await response.json()) as { message?: string };
    throw new Error(error.message ?? `Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function getAdminDashboard(idToken: string) {
  return adminFetch<AdminDashboardResponse>('/dashboard/admin', idToken);
}

export async function listStockChanges(
  idToken: string,
  params?: { limit?: number; cursor?: string | null },
) {
  const searchParams = new URLSearchParams();

  if (params?.limit) {
    searchParams.set('limit', String(params.limit));
  }

  if (params?.cursor) {
    searchParams.set('cursor', params.cursor);
  }

  const query = searchParams.toString();
  const path = query ? `/admin/stock-changes?${query}` : '/admin/stock-changes';

  return adminFetch<PaginatedStockChangesResponse>(path, idToken);
}

export async function triggerManualSync(idToken: string) {
  return adminFetch<{ s3Key: string; itemCount: number; syncedAt: string }>(
    '/stock/sync',
    idToken,
    { method: 'POST' },
  );
}

export async function downloadStockFile(idToken: string, syncKey: string) {
  const searchParams = new URLSearchParams({ syncKey });
  const { downloadUrl } = await adminFetch<StockFileDownloadResponse>(
    `/admin/stock-files/download?${searchParams.toString()}`,
    idToken,
  );

  window.open(downloadUrl, '_blank', 'noopener,noreferrer');
}
```

## Recommended dashboard flow

1. Authenticate admin user and store `IdToken`.
2. Call `GET /dashboard/admin` for the latest Tiendanube sync summary.
3. Call `GET /admin/stock-changes?limit=20` for historical diffs.
4. Paginate with `nextCursor`.
5. Open detail view with `GET /admin/stock-changes/{syncKey}`.
6. Browse Patagonia snapshots by day with `GET /admin/stock-files?date=YYYY-MM-DD`.
7. Download a snapshot with `GET /admin/stock-files/download?syncKey=...`, then open `downloadUrl`.
8. Trigger manual sync with `POST /stock/sync`, then refresh dashboard after pipeline completion.

## Notes

- Snapshot keys and dates use **UTC**.
- `/admin/stock-files` only returns days that still have snapshots in S3 (retention: 8 UTC calendar days).
- Only records created after the GSI deployment include pagination support in `/admin/stock-changes`.
- Tiendanube sync results appear in the dashboard after the async pipeline completes.
