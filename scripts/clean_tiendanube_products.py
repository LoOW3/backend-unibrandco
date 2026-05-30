#!/usr/bin/env python3
"""
Transform scripts/output/products.json into a minimal stock-focused JSON.

Usage:
  python scripts/clean_tiendanube_products.py
  python scripts/clean_tiendanube_products.py --input scripts/output/products.json --output scripts/output/products-clean.json
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_INPUT_PATH = SCRIPT_DIR / "output" / "products.json"
DEFAULT_OUTPUT_PATH = SCRIPT_DIR / "output" / "products-clean.json"


def clean_inventory_level(level: dict[str, Any]) -> dict[str, Any]:
    """Keep only stock-relevant inventory level fields."""
    return {
        "id": level["id"],
        "variant_id": level["variant_id"],
        "stock": level["stock"],
    }


def clean_variant(variant: dict[str, Any]) -> dict[str, Any]:
    """Keep only stock-relevant variant fields."""
    inventory_levels = variant.get("inventory_levels") or []
    return {
        "id": variant["id"],
        "product_id": variant["product_id"],
        "stock": variant["stock"],
        "sku": variant["sku"],
        "inventory_levels": [
            clean_inventory_level(level) for level in inventory_levels
        ],
    }


def clean_product(product: dict[str, Any]) -> dict[str, Any]:
    """Keep only product id and slim variants."""
    variants = product.get("variants") or []
    return {
        "id": product["id"],
        "variants": [clean_variant(variant) for variant in variants],
    }


def load_products_export(input_path: Path) -> dict[str, Any]:
    """Load and validate the products export JSON."""
    if not input_path.is_file():
        raise ValueError(f"Input file not found: {input_path}")

    payload = json.loads(input_path.read_text(encoding="utf-8"))

    if not isinstance(payload, dict):
        raise ValueError("Input JSON must be an object")

    products = payload.get("products")
    if not isinstance(products, list):
        raise ValueError("Input JSON must contain a 'products' array")

    return payload


def build_clean_export(
    payload: dict[str, Any],
    input_path: Path,
) -> dict[str, Any]:
    """Transform full products export into a slim stock-focused export."""
    products = payload["products"]
    clean_products = [clean_product(product) for product in products]

    return {
        "source": str(input_path.relative_to(SCRIPT_DIR.parent)),
        "source_fetched_at": payload.get("fetched_at"),
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "total_count": len(clean_products),
        "products": clean_products,
    }


def parse_args() -> argparse.Namespace:
    """Parse CLI arguments."""
    parser = argparse.ArgumentParser(
        description="Generate a minimal stock-focused JSON from products.json",
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=DEFAULT_INPUT_PATH,
        help=f"Input JSON path (default: {DEFAULT_INPUT_PATH})",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT_PATH,
        help=f"Output JSON path (default: {DEFAULT_OUTPUT_PATH})",
    )
    return parser.parse_args()


def main() -> int:
    """Run the products JSON cleanup."""
    args = parse_args()

    try:
        payload = load_products_export(args.input)
        products = payload["products"]

        print(f"Processing {len(products)} products from {args.input}...")

        clean_payload = build_clean_export(payload, args.input)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(
            json.dumps(clean_payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        print(f"Saved {clean_payload['total_count']} products to {args.output}")
        return 0
    except ValueError as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    except json.JSONDecodeError as error:
        print(f"Invalid JSON in input file: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
