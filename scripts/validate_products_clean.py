#!/usr/bin/env python3
"""
Validate that every product in products-clean.json has exactly one variant
and each variant has exactly one inventory level.

Usage:
  python scripts/validate_products_clean.py
  python scripts/validate_products_clean.py --input scripts/output/products-clean.json
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any, TypedDict

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_INPUT_PATH = SCRIPT_DIR / "output" / "products-clean.json"


class ValidationIssue(TypedDict, total=False):
    product_id: int
    variant_id: int | None
    issue: str


def load_clean_export(input_path: Path) -> dict[str, Any]:
    """Load and validate the products-clean JSON wrapper."""
    if not input_path.is_file():
        raise ValueError(f"Input file not found: {input_path}")

    payload = json.loads(input_path.read_text(encoding="utf-8"))

    if not isinstance(payload, dict):
        raise ValueError("Input JSON must be an object")

    products = payload.get("products")
    if not isinstance(products, list):
        raise ValueError("Input JSON must contain a 'products' array")

    return payload


def find_issues(products: list[dict[str, Any]]) -> list[ValidationIssue]:
    """Find products or variants with invalid variant or inventory level counts."""
    issues: list[ValidationIssue] = []

    for product in products:
        product_id = product.get("id")
        variants = product.get("variants")

        if not isinstance(variants, list):
            issues.append(
                {
                    "product_id": product_id,
                    "variant_id": None,
                    "issue": "missing_variants",
                }
            )
            continue

        variant_count = len(variants)
        if variant_count == 0:
            issues.append(
                {
                    "product_id": product_id,
                    "variant_id": None,
                    "issue": "missing_variants",
                }
            )
            continue

        if variant_count > 1:
            issues.append(
                {
                    "product_id": product_id,
                    "variant_id": None,
                    "issue": "multiple_variants",
                }
            )

        for variant in variants:
            variant_id = variant.get("id")
            inventory_levels = variant.get("inventory_levels")

            if not isinstance(inventory_levels, list):
                issues.append(
                    {
                        "product_id": product_id,
                        "variant_id": variant_id,
                        "issue": "missing_inventory_levels",
                    }
                )
                continue

            inventory_count = len(inventory_levels)
            if inventory_count == 0:
                issues.append(
                    {
                        "product_id": product_id,
                        "variant_id": variant_id,
                        "issue": "missing_inventory_levels",
                    }
                )
                continue

            if inventory_count > 1:
                issues.append(
                    {
                        "product_id": product_id,
                        "variant_id": variant_id,
                        "issue": "multiple_inventory_levels",
                    }
                )

    return issues


def print_report(total: int, issues: list[ValidationIssue]) -> None:
    """Print a human-readable validation report."""
    print(f"\nIssues found: {len(issues)}\n")

    for entry in issues:
        product_id = entry["product_id"]
        variant_id = entry.get("variant_id")
        issue = entry["issue"]

        if issue == "missing_variants":
            print(f"Product {product_id}: no variants")
            continue

        if issue == "multiple_variants":
            print(f"Product {product_id}: multiple variants")
            continue

        if issue == "missing_inventory_levels":
            print(f"Product {product_id}, variant {variant_id}: no inventory_levels")
            continue

        if issue == "multiple_inventory_levels":
            print(
                f"Product {product_id}, variant {variant_id}: multiple inventory_levels"
            )
            continue

        print(f"Product {product_id}, variant {variant_id}: {issue}")

    summary = Counter(entry["issue"] for entry in issues)
    print("\nSummary:")
    for issue_type, count in sorted(summary.items()):
        print(f"  {issue_type}: {count}")


def parse_args() -> argparse.Namespace:
    """Parse CLI arguments."""
    parser = argparse.ArgumentParser(
        description="Validate exactly one variant and one inventory level per product",
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=DEFAULT_INPUT_PATH,
        help=f"Input JSON path (default: {DEFAULT_INPUT_PATH})",
    )
    return parser.parse_args()


def main() -> int:
    """Run products-clean validation."""
    args = parse_args()

    try:
        payload = load_clean_export(args.input)
        products = payload["products"]

        print(f"Validating {len(products)} products from {args.input}...")

        issues = find_issues(products)

        if not issues:
            print(
                "All products have exactly one variant and one inventory level."
            )
            return 0

        print_report(len(products), issues)
        return 1
    except ValueError as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    except json.JSONDecodeError as error:
        print(f"Invalid JSON in input file: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
