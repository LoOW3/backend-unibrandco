#!/usr/bin/env python3
"""
Fetch all Tiendanube products with pagination and save to scripts/output/products.json.

Environment variables:
  TIENDANUBE_ACCESS_TOKEN  Bearer token (required)
  TIENDANUBE_STORE_ID      Store ID (default: 6835321)
  TIENDANUBE_USER_AGENT    User-Agent header (required by API)

Usage:
  export TIENDANUBE_ACCESS_TOKEN="your-token"
  python scripts/fetch_tiendanube_products.py

API docs:
  https://tiendanube.github.io/api-documentation/intro#pagination
  https://tiendanube.github.io/api-documentation/resources/product
"""

from __future__ import annotations

import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

API_VERSION = "2025-03"
API_BASE_URL = "https://api.tiendanube.com"
DEFAULT_STORE_ID = "6835321"
DEFAULT_USER_AGENT = "Unibrandco Backend (ignaciodiaznanni@gmail.com)"
PAGE_SIZE = 200
RATE_LIMIT_DELAY_SECONDS = 10
RETRY_BACKOFF_SECONDS = 2.0

SCRIPT_DIR = Path(__file__).resolve().parent
OUTPUT_PATH = SCRIPT_DIR / "output" / "products.json"


class TiendanubeApiError(Exception):
    """Raised when the Tiendanube API returns an error response."""

    def __init__(self, status: int, body: str) -> None:
        self.status = status
        self.body = body
        super().__init__(f"Tiendanube API error {status}: {body[:500]}")


def get_config() -> dict[str, str]:
    """Load script configuration from environment variables."""
    access_token = os.environ.get("TIENDANUBE_ACCESS_TOKEN", "").strip()
    if not access_token:
        raise ValueError("TIENDANUBE_ACCESS_TOKEN environment variable is required")

    return {
        "access_token": access_token,
        "store_id": os.environ.get("TIENDANUBE_STORE_ID", DEFAULT_STORE_ID).strip(),
        "user_agent": os.environ.get("TIENDANUBE_USER_AGENT", DEFAULT_USER_AGENT).strip(),
    }


def build_products_url(store_id: str, page: int) -> str:
    """Build the paginated products endpoint URL."""
    query = urllib.parse.urlencode({"page": page, "per_page": PAGE_SIZE})
    return f"{API_BASE_URL}/{API_VERSION}/{store_id}/products?{query}"


def create_ssl_context() -> ssl.SSLContext:
    """Build SSL context; uses certifi when available (common macOS Python fix)."""
    try:
        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


def fetch_products_page(
    store_id: str,
    page: int,
    access_token: str,
    user_agent: str,
) -> tuple[list[dict[str, Any]], int | None]:
    """Fetch a single page of products from Tiendanube."""
    url = build_products_url(store_id, page)
    request = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {access_token}",
            "User-Agent": user_agent,
            "Accept": "application/json",
        },
        method="GET",
    )

    try:
        with urllib.request.urlopen(
            request,
            timeout=60,
            context=create_ssl_context(),
        ) as response:
            body = response.read().decode("utf-8")
            products = json.loads(body)
            total_count_header = response.headers.get("x-total-count")
            total_count = int(total_count_header) if total_count_header else None

            if not isinstance(products, list):
                raise TiendanubeApiError(response.status, body)

            return products, total_count
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")

        if error.code == 429:
            time.sleep(RETRY_BACKOFF_SECONDS)
            return fetch_products_page(store_id, page, access_token, user_agent)

        raise TiendanubeApiError(error.code, body) from error


def fetch_all_products(config: dict[str, str]) -> tuple[list[dict[str, Any]], int | None]:
    """Fetch and combine all product pages."""
    all_products: list[dict[str, Any]] = []
    expected_total: int | None = None
    page = 1

    while True:
        print(f"Fetching page {page}...")
        products, total_count = fetch_products_page(
            config["store_id"],
            page,
            config["access_token"],
            config["user_agent"],
        )

        if expected_total is None and total_count is not None:
            expected_total = total_count

        if not products:
            break

        all_products.extend(products)

        if len(products) < PAGE_SIZE:
            break

        page += 1
        time.sleep(RATE_LIMIT_DELAY_SECONDS)

    return all_products, expected_total


def save_products(
    products: list[dict[str, Any]],
    store_id: str,
    expected_total: int | None,
) -> Path:
    """Write combined products to the output JSON file."""
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    payload = {
        "store_id": store_id,
        "fetched_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "total_count": expected_total if expected_total is not None else len(products),
        "page_size": PAGE_SIZE,
        "products": products,
    }

    OUTPUT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    return OUTPUT_PATH


def main() -> int:
    """Run the Tiendanube products export."""
    try:
        config = get_config()
        products, expected_total = fetch_all_products(config)
        output_path = save_products(products, config["store_id"], expected_total)

        print(f"Saved {len(products)} products to {output_path}")

        if expected_total is not None and len(products) != expected_total:
            print(
                f"Warning: fetched {len(products)} products but x-total-count was {expected_total}",
                file=sys.stderr,
            )

        return 0
    except ValueError as error:
        print(f"Configuration error: {error}", file=sys.stderr)
        return 1
    except TiendanubeApiError as error:
        print(str(error), file=sys.stderr)
        return 1
    except urllib.error.URLError as error:
        print(f"Network error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
