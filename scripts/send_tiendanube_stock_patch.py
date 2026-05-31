#!/usr/bin/env python3
"""
Send Tiendanube stock-price PATCH requests in chunks from a stock-patch JSON file.

Environment variables:
  TIENDANUBE_ACCESS_TOKEN  Bearer token (required unless --dry-run)
  TIENDANUBE_STORE_ID      Store ID (default: 6835321)
  TIENDANUBE_USER_AGENT    User-Agent header (required by API)

Usage:
  export TIENDANUBE_ACCESS_TOKEN="your-token"
  python scripts/send_tiendanube_stock_patch.py
  python scripts/send_tiendanube_stock_patch.py --dry-run
  python scripts/send_tiendanube_stock_patch.py \
    --input scripts/output/193753-stock-patch.json \
    --chunk-size 50 \
    --delay 10
"""

from __future__ import annotations

import argparse
import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

API_BASE_URL = "https://api.tiendanube.com"
DEFAULT_API_VERSION = "2025-03"
DEFAULT_STORE_ID = "6835321"
DEFAULT_USER_AGENT = "Unibrandco Backend (ignaciodiaznanni@gmail.com)"
DEFAULT_CHUNK_SIZE = 50
DEFAULT_DELAY_SECONDS = 10
MAX_RETRIES = 3
RETRY_BACKOFF_SECONDS = 2.0

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_INPUT_PATH = SCRIPT_DIR / "output" / "193753-stock-patch.json"


class TiendanubeApiError(Exception):
    """Raised when the Tiendanube API returns an error response."""

    def __init__(self, status: int, body: str) -> None:
        self.status = status
        self.body = body
        super().__init__(f"Tiendanube API error {status}: {body[:500]}")


def get_config(require_token: bool = True) -> dict[str, str]:
    """Load script configuration from environment variables."""
    access_token = os.environ.get("TIENDANUBE_ACCESS_TOKEN", "").strip()
    if require_token and not access_token:
        raise ValueError("TIENDANUBE_ACCESS_TOKEN environment variable is required")

    return {
        "access_token": access_token,
        "store_id": os.environ.get("TIENDANUBE_STORE_ID", DEFAULT_STORE_ID).strip(),
        "user_agent": os.environ.get("TIENDANUBE_USER_AGENT", DEFAULT_USER_AGENT).strip(),
    }


def create_ssl_context() -> ssl.SSLContext:
    """Build SSL context; uses certifi when available (common macOS Python fix)."""
    try:
        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


def load_patch_items(input_path: Path) -> list[dict[str, Any]]:
    """Load and validate the stock-patch JSON array."""
    if not input_path.is_file():
        raise ValueError(f"Input file not found: {input_path}")

    payload = json.loads(input_path.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise ValueError("Stock patch file must be a JSON array")

    return payload


def count_variants(products: list[dict[str, Any]]) -> int:
    """Count total variants across patch products."""
    return sum(len(product.get("variants") or []) for product in products)


def chunk_patch_items(
    patch_items: list[dict[str, Any]],
    max_variants: int,
) -> list[list[dict[str, Any]]]:
    """Split patch items so each chunk has at most max_variants variants."""
    if max_variants <= 0:
        raise ValueError("chunk-size must be greater than 0")

    chunks: list[list[dict[str, Any]]] = []
    current_chunk: list[dict[str, Any]] = []
    current_variant_count = 0

    for product in patch_items:
        variants = product.get("variants") or []
        product_variant_count = len(variants)

        if product_variant_count > max_variants:
            if current_chunk:
                chunks.append(current_chunk)
                current_chunk = []
                current_variant_count = 0

            for index in range(0, product_variant_count, max_variants):
                chunks.append(
                    [
                        {
                            "id": product["id"],
                            "variants": variants[index : index + max_variants],
                        }
                    ]
                )
            continue

        if current_variant_count + product_variant_count > max_variants:
            chunks.append(current_chunk)
            current_chunk = [product]
            current_variant_count = product_variant_count
            continue

        current_chunk.append(product)
        current_variant_count += product_variant_count

    if current_chunk:
        chunks.append(current_chunk)

    return chunks


def build_stock_price_url(store_id: str, api_version: str) -> str:
    """Build the Tiendanube stock-price PATCH endpoint URL."""
    return f"{API_BASE_URL}/{api_version}/{store_id}/products/stock-price"


def patch_stock_chunk(
    config: dict[str, str],
    api_version: str,
    chunk: list[dict[str, Any]],
    attempt: int = 0,
) -> None:
    """PATCH a single chunk of stock updates to Tiendanube."""
    url = build_stock_price_url(config["store_id"], api_version)
    body = json.dumps(chunk).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        headers={
            "Authorization": f"Bearer {config['access_token']}",
            "User-Agent": config["user_agent"],
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
        method="PATCH",
    )

    try:
        with urllib.request.urlopen(
            request,
            timeout=60,
            context=create_ssl_context(),
        ) as response:
            response.read()
            if response.status >= 400:
                raise TiendanubeApiError(response.status, response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        error_body = error.read().decode("utf-8", errors="replace")

        if error.code == 429 and attempt < MAX_RETRIES:
            backoff = RETRY_BACKOFF_SECONDS * (attempt + 1)
            print(f"Rate limited (429), retrying in {backoff:.0f}s...", file=sys.stderr)
            time.sleep(backoff)
            patch_stock_chunk(config, api_version, chunk, attempt + 1)
            return

        raise TiendanubeApiError(error.code, error_body) from error


def send_stock_patches(
    config: dict[str, str],
    api_version: str,
    chunks: list[list[dict[str, Any]]],
    delay_seconds: float,
    dry_run: bool,
    start_chunk: int = 1,
) -> int:
    """Send all stock patch chunks to Tiendanube."""
    total_chunks = len(chunks)
    patched_products = 0

    if start_chunk < 1 or start_chunk > total_chunks:
        raise ValueError(f"start-chunk must be between 1 and {total_chunks}")

    for index, chunk in enumerate(chunks, start=1):
        if index < start_chunk:
            continue

        variant_count = count_variants(chunk)
        if dry_run:
            print(
                f"Chunk {index}/{total_chunks} — "
                f"{len(chunk)} products, {variant_count} variants — dry-run"
            )
            patched_products += len(chunk)
            continue

        print(
            f"Chunk {index}/{total_chunks} — "
            f"{len(chunk)} products, {variant_count} variants — sending..."
        )
        patch_stock_chunk(config, api_version, chunk)
        patched_products += len(chunk)
        print(
            f"Chunk {index}/{total_chunks} — "
            f"{len(chunk)} products, {variant_count} variants — OK"
        )

        if index < total_chunks and delay_seconds > 0:
            time.sleep(delay_seconds)

    return patched_products


def parse_args() -> argparse.Namespace:
    """Parse CLI arguments."""
    parser = argparse.ArgumentParser(
        description="Send Tiendanube stock-price PATCH requests in chunks",
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=DEFAULT_INPUT_PATH,
        help=f"Stock patch JSON path (default: {DEFAULT_INPUT_PATH})",
    )
    parser.add_argument(
        "--chunk-size",
        type=int,
        default=DEFAULT_CHUNK_SIZE,
        help=f"Max variants per PATCH request (default: {DEFAULT_CHUNK_SIZE})",
    )
    parser.add_argument(
        "--start-chunk",
        type=int,
        default=1,
        help="Start sending from this chunk number (default: 1)",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=DEFAULT_DELAY_SECONDS,
        help=f"Seconds to wait between chunks (default: {DEFAULT_DELAY_SECONDS})",
    )
    parser.add_argument(
        "--api-version",
        default=DEFAULT_API_VERSION,
        help=f"Tiendanube API version (default: {DEFAULT_API_VERSION})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print chunk plan without calling the API",
    )
    return parser.parse_args()


def main() -> int:
    """Run the Tiendanube stock patch sender."""
    args = parse_args()

    try:
        patch_items = load_patch_items(args.input)
        chunks = chunk_patch_items(patch_items, args.chunk_size)
        config = get_config(require_token=not args.dry_run)

        print(
            f"Loaded {len(patch_items)} products from {args.input} "
            f"into {len(chunks)} chunks of up to {args.chunk_size} variants."
        )

        if args.start_chunk > 1:
            print(f"Resuming from chunk {args.start_chunk}/{len(chunks)}.")

        if args.dry_run:
            print("Dry-run mode: no API requests will be sent.")

        patched_products = send_stock_patches(
            config,
            args.api_version,
            chunks,
            args.delay,
            args.dry_run,
            args.start_chunk,
        )

        action = "planned" if args.dry_run else "patched"
        print(f"Done: {action} {patched_products} products in {len(chunks)} chunks.")
        return 0
    except ValueError as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    except TiendanubeApiError as error:
        print(str(error), file=sys.stderr)
        return 1
    except json.JSONDecodeError as error:
        print(f"Invalid JSON in input file: {error}", file=sys.stderr)
        return 1
    except urllib.error.URLError as error:
        print(f"Network error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
