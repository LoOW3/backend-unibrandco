# backend-unibrandco

Backend infrastructure for Unibrandco — Patagonia WMS stock sync to S3.

## Architecture

- **EventBridge** triggers a Lambda every 30 minutes between **06:30** and **19:30** Argentina time (UTC-3), **Monday to Friday**, to fetch stock from Patagonia WMS and save JSON snapshots to S3.
- **HTTP API** (`POST /stock/sync`) allows manual sync on demand, protected by Cognito JWT (ADMIN group only).
- Snapshots are stored at `yyyy/mm/dd/HHmmss.json` (UTC) in a private S3 bucket.
- **EventBridge** runs a daily cleanup Lambda at **03:00 UTC** that deletes Patagonia stock snapshots older than **8 UTC calendar days**. Other bucket objects (e.g. `tienda-nube-products/products-clean.json`) are not affected.
- **S3 ObjectCreated** triggers a diff Lambda that compares each new snapshot with the previous one and stores `UnidadesDisponibles` changes in DynamoDB.
- **DynamoDB Stream** triggers a Tiendanube sync Lambda that maps changed SKUs to Tiendanube products and PATCHes stock via the Tiendanube API.
- **HTTP API** (`POST /webhooks/tiendanube/order-paid`) receives Tiendanube `order/paid` webhooks, fetches the full order, and creates Patagonia pedidos in DigipWMS.
- **DynamoDB** table `patagonia-pedidos` stores each successfully created pedido; **Admin API** exposes paginated list and get-by-`codigo` (Cognito ADMIN).

## Stock diff flow

After every sync (scheduled or manual):

1. A new snapshot is written to S3.
2. The diff Lambda loads the current and previous snapshots.
3. Items with changed `UnidadesDisponibles` are saved to DynamoDB table `stock-availability-changes`.

Change rules:

| Case | Stored object |
|------|---------------|
| Changed availability | Current item + `previousUnidadesDisponibles` |
| New article | Current item + `"new": true` |
| Removed article | Previous item + `"deleted": true` |

Example DynamoDB item:

```json
{
  "pk": "SYNC#2025/05/30/153000.json",
  "syncedAt": "2025-05-30T15:30:00.000Z",
  "currentSyncKey": "2025/05/30/153000.json",
  "previousSyncKey": "2025/05/30/150000.json",
  "changedCount": 2,
  "changedItems": [
    {
      "CodigoArticulo": "AN03027",
      "UnidadesDisponibles": 10,
      "previousUnidadesDisponibles": 4
    },
    {
      "CodigoArticulo": "XX99999",
      "UnidadesDisponibles": 5,
      "new": true
    }
  ]
}
```

Query a diff record:

```bash
aws dynamodb get-item \
  --table-name stock-availability-changes \
  --key '{"pk":{"S":"SYNC#2025/05/30/153000.json"}}' \
  --region us-east-1
```

## Tiendanube stock sync flow

After a diff record is written to DynamoDB:

1. The DynamoDB stream fires on `INSERT` events.
2. The Tiendanube sync Lambda loads `tienda-nube-products/products-clean.json` from the same S3 bucket.
3. For each item in `changedItems`, it matches `CodigoArticulo` to variant `sku`.
4. It PATCHes stock to `https://api.tiendanube.com/2025-03/{store_id}/products/stock-price`.

Skip rules:

| Case | Action |
|------|--------|
| `deleted: true` | Skip |
| SKU not in products-clean.json | Log warning, skip |
| Matched SKU | PATCH `inventory_levels[].stock` with `UnidadesDisponibles` |

### Upload products catalog to S3

Generate and upload the catalog after fetching Tiendanube products:

```bash
python scripts/fetch_tiendanube_products.py
python scripts/clean_tiendanube_products.py

aws s3 cp scripts/output/products-clean.json \
  s3://YOUR_STOCK_BUCKET/tienda-nube-products/products-clean.json \
  --region us-east-1
```

## Tiendanube order/paid webhook

When an order is marked as paid, Tiendanube POSTs to your webhook URL. The flow:

1. **Webhook Lambda** validates payload, fetches the order from Tiendanube, builds a `summary` (products + `userData`).
2. Returns **HTTP 200** with that summary in the response body (same as the second CloudWatch log).
3. **Async-invokes** `PatagoniaCreatePedidoFunction` with `{ action, summary }`.
4. **Patagonia Lambda** maps `summary` to DigipWMS `CreatePedido` and `POST`s to `https://api.v2.digipwms.com/api/v2/Pedidos` ([Swagger](https://api.v2.digipwms.com/swagger/index.html)).
5. On success, the pedido is written to DynamoDB table `patagonia-pedidos` (`pk`: `PEDIDO#{orderId}TN`). Failed POSTs are not stored.

Admin API (JWT + `ADMIN` group):

- `GET /admin/patagonia-pedidos?limit=&cursor=` — paginated list (newest first)
- `GET /admin/patagonia-pedidos/{codigo}` — full record (`summary` + `createPedido`)

See [docs/admin-api-integration.md](docs/admin-api-integration.md) sections 7–8.

Patagonia pedido mapping:

| Field | Source |
|-------|--------|
| `codigo` | `{orderId}TN` (idempotent per Tiendanube order) |
| `clienteUbicacionCodigo` | `8436326823` (fixed) |
| `fecha` | ISO 8601 `date-time` at processing time |
| `estado` | `Pendiente` |
| `observacion` | `userData` as text (max 280 chars) |
| `items[].articuloCodigo` | product `sku` |
| `items[].unidades` | product `quantity` |

Uses the same `patagonia-wms/api-key` secret (`X-API-Key`) as stock sync; pedidos use API **v2**, stock uses **v1**.

Events other than `order/paid` return `200 { received: true, skipped: true }` and do not call Patagonia.

**Security (MVP):** the webhook route is public (no Cognito, no HMAC). Anyone who knows the URL could trigger order fetches. Do not share the URL; consider adding a path token or Partners app `client_secret` + HMAC later.

### Register the webhook in Tiendanube

After deploy, use the stack output `TiendanubeOrderPaidWebhookUrl`:

```bash
curl -X POST "https://api.tiendanube.com/2025-03/YOUR_STORE_ID/webhooks" \
  -H "Authorization: Bearer YOUR_TIENDANUBE_ACCESS_TOKEN" \
  -H "User-Agent: Unibrandco Backend (you@example.com)" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "order/paid",
    "url": "https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/webhooks/tiendanube/order-paid"
  }'
```

Requires `read_orders` (or `write_orders`) scope on your access token.

### Set Tiendanube API credentials

After deploy, replace the placeholder secret value:

```bash
aws secretsmanager put-secret-value \
  --secret-id tiendanube/api-credentials \
  --secret-string '{
    "store_id": "6835321",
    "access_token": "YOUR_TIENDANUBE_ACCESS_TOKEN",
    "user_agent": "Unibrandco Backend (you@example.com)"
  }' \
  --region us-east-1
```

## Prerequisites

- Node.js 20+
- AWS CLI configured
- AWS CDK bootstrapped in `us-east-1`

## Deploy

```bash
cd cdk
npm install
npm run build
npx cdk bootstrap aws://YOUR_ACCOUNT_ID/us-east-1   # first time only
npx cdk deploy
```

## Post-deploy setup

### 1. Set Patagonia WMS API key

After deploy, replace the placeholder secret value:

```bash
aws secretsmanager put-secret-value \
  --secret-id patagonia-wms/api-key \
  --secret-string 'YOUR_PATAGONIA_API_KEY' \
  --region us-east-1
```

### 2. Create an admin user

```bash
# Create user
aws cognito-idp admin-create-user \
  --user-pool-id YOUR_USER_POOL_ID \
  --username admin@example.com \
  --user-attributes Name=email,Value=admin@example.com Name=email_verified,Value=true \
  --temporary-password 'TempPass123!' \
  --region us-east-1

# Set permanent password
aws cognito-idp admin-set-user-password \
  --user-pool-id YOUR_USER_POOL_ID \
  --username admin@example.com \
  --password 'YourSecurePass123!' \
  --permanent \
  --region us-east-1

# Add to ADMIN group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id YOUR_USER_POOL_ID \
  --username admin@example.com \
  --group-name ADMIN \
  --region us-east-1
```

### 3. Get JWT token (for manual sync)

```bash
aws cognito-idp initiate-auth \
  --client-id YOUR_USER_POOL_CLIENT_ID \
  --auth-flow USER_PASSWORD_AUTH \
  --auth-parameters USERNAME=admin@example.com,PASSWORD='YourSecurePass123!' \
  --region us-east-1
```

Use the `IdToken` from the response.

### 4. Trigger manual sync

```bash
curl -X POST https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/stock/sync \
  -H "Authorization: Bearer YOUR_ID_TOKEN"
```

Response example:

```json
{
  "s3Key": "2025/05/30/151200.json",
  "itemCount": 150,
  "syncedAt": "2025-05-30T15:12:00.000Z"
}
```

## Tests

```bash
cd cdk
npm test
```

## Stack outputs

| Output | Description |
|--------|-------------|
| `UserPoolId` | Cognito User Pool ID |
| `UserPoolClientId` | Cognito App Client ID |
| `StockBucketName` | S3 bucket for snapshots |
| `StockSyncApiUrl` | Manual sync endpoint |
| `PatagoniaApiKeySecretArn` | Secrets Manager ARN for API key |
| `TiendanubeSecretArn` | Secrets Manager ARN for Tiendanube credentials |
| `TiendanubeOrderPaidWebhookUrl` | Public URL to register for `order/paid` webhooks |
| `StockChangesTableName` | DynamoDB table for availability diffs |
| `PatagoniaPedidosTableName` | DynamoDB table for Tiendanube orders sent to Patagonia |

## Project structure

```
cdk/src/shared/                 # Shared types and Tiendanube API helpers
cdk/src/lambdas/stock-sync/    # Sync Lambda
cdk/src/lambdas/stock-diff/    # Diff Lambda (S3 trigger → DynamoDB)
cdk/src/lambdas/tiendanube-stock-sync/  # Tiendanube stock sync (DynamoDB stream)
cdk/src/lambdas/tiendanube-order-paid-webhook/  # order/paid webhook → summary + invoke Patagonia
cdk/src/lambdas/patagonia-create-pedido/       # POST DigipWMS /api/v2/Pedidos → DynamoDB
cdk/src/lambdas/admin-api/                    # Admin dashboard, stock changes, patagonia pedidos
cdk/lib/constructs/            # CDK constructs (Auth, StockSync)
cdk/lib/cdk-stack.ts           # Main stack
```
