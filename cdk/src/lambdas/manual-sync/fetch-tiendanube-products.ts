import type { TiendanubeConfig } from '../../shared/tiendanube.types';

const API_BASE_URL = 'https://api.tiendanube.com';
const PAGE_SIZE = 200;
const RATE_LIMIT_DELAY_MS = 10_000;
const RETRY_BACKOFF_MS = 2_000;

export interface FetchProductsResult {
  products: unknown[];
  expectedTotal: number | null;
}

/** Products fetched per page — used to derive total pages for progress. */
export const PRODUCTS_PAGE_SIZE = PAGE_SIZE;

/** Called after each page so callers can report progress. */
export type FetchProgressCallback = (progress: {
  pagesFetched: number;
  expectedTotal: number | null;
  productsSoFar: number;
}) => Promise<void> | void;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildProductsUrl(apiVersion: string, storeId: string, page: number): string {
  const query = new URLSearchParams({
    page: String(page),
    per_page: String(PAGE_SIZE),
  });
  return `${API_BASE_URL}/${apiVersion}/${storeId}/products?${query.toString()}`;
}

async function fetchProductsPage(
  config: TiendanubeConfig,
  apiVersion: string,
  page: number,
): Promise<{ products: unknown[]; totalCount: number | null }> {
  const url = buildProductsUrl(apiVersion, config.store_id, page);
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${config.access_token}`,
      'User-Agent': config.user_agent,
      Accept: 'application/json',
    },
  });

  if (response.status === 429) {
    await sleep(RETRY_BACKOFF_MS);
    return fetchProductsPage(config, apiVersion, page);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Tiendanube products fetch failed: ${response.status} ${response.statusText} - ${body.slice(0, 500)}`,
    );
  }

  const products = (await response.json()) as unknown;
  if (!Array.isArray(products)) {
    throw new Error('Tiendanube products response is not a JSON array');
  }

  const totalHeader = response.headers.get('x-total-count');
  const totalCount = totalHeader ? Number(totalHeader) : null;

  return { products, totalCount };
}

/**
 * Fetches all Tiendanube products with pagination.
 * Mirrors scripts/fetch_tiendanube_products.py.
 */
export async function fetchAllProducts(
  config: TiendanubeConfig,
  apiVersion: string,
  onProgress?: FetchProgressCallback,
): Promise<FetchProductsResult> {
  const allProducts: unknown[] = [];
  let expectedTotal: number | null = null;
  let page = 1;

  for (;;) {
    console.log(JSON.stringify({ action: 'fetching tiendanube products page', page }));
    const { products, totalCount } = await fetchProductsPage(config, apiVersion, page);

    if (expectedTotal === null && totalCount !== null) {
      expectedTotal = totalCount;
    }

    if (products.length === 0) {
      break;
    }

    allProducts.push(...products);

    if (onProgress) {
      await onProgress({
        pagesFetched: page,
        expectedTotal,
        productsSoFar: allProducts.length,
      });
    }

    if (products.length < PAGE_SIZE) {
      break;
    }

    page += 1;
    await sleep(RATE_LIMIT_DELAY_MS);
  }

  return { products: allProducts, expectedTotal };
}
