#!/usr/bin/env python3
"""
Build a Tiendanube stock-price PATCH payload from a Patagonia snapshot and products-clean.json.

Usage:
  python scripts/build_tiendanube_stock_patch.py
  python scripts/build_tiendanube_stock_patch.py \
    --stock scripts/output/193753.json \
    --catalog scripts/output/products-clean.json \
    --output scripts/output/193753-stock-patch.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, TypedDict

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_STOCK_PATH = SCRIPT_DIR / "output" / "193753.json"
DEFAULT_CATALOG_PATH = SCRIPT_DIR / "output" / "products-clean.json"
PATCH_CHUNK_WARNING_SIZE = 50


class SkuMapping(TypedDict):
    product_id: int
    variant_id: int


class SkippedStockItem(TypedDict):
    CodigoArticulo: str
    UnidadesDisponibles: int


class BuildStockPatchResult(TypedDict):
    patch_items: list[dict[str, Any]]
    matched_count: int
    skipped_items: list[SkippedStockItem]


def derive_output_paths(stock_path: Path) -> tuple[Path, Path]:
    """Derive default patch and skipped report paths from the stock filename."""
    stem = stock_path.stem
    output_dir = stock_path.parent
    return (
        output_dir / f"{stem}-stock-patch.json",
        output_dir / f"{stem}-skipped-skus.json",
    )


def load_stock_snapshot(stock_path: Path) -> list[dict[str, Any]]:
    """Load and validate a Patagonia stock snapshot JSON array."""
    if not stock_path.is_file():
        raise ValueError(f"Stock file not found: {stock_path}")

    payload = json.loads(stock_path.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise ValueError("Stock snapshot must be a JSON array")

    return payload


def load_products_catalog(catalog_path: Path) -> list[dict[str, Any]]:
    """Load and validate products-clean.json."""
    if not catalog_path.is_file():
        raise ValueError(f"Catalog file not found: {catalog_path}")

    payload = json.loads(catalog_path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("Catalog JSON must be an object")

    products = payload.get("products")
    if not isinstance(products, list):
        raise ValueError("Catalog JSON must contain a 'products' array")

    return products


def build_sku_index(products: list[dict[str, Any]]) -> dict[str, SkuMapping]:
    """Build a lookup from variant sku to Tiendanube product and variant ids."""
    sku_index: dict[str, SkuMapping] = {}

    for product in products:
        product_id = product.get("id")
        if not isinstance(product_id, int):
            continue

        for variant in product.get("variants") or []:
            sku = variant.get("sku")
            variant_id = variant.get("id")

            if not sku or not isinstance(variant_id, int):
                continue

            sku_index[str(sku)] = {
                "product_id": product_id,
                "variant_id": variant_id,
            }

    return sku_index


def build_stock_patch(
    stock_items: list[dict[str, Any]],
    sku_index: dict[str, SkuMapping],
) -> BuildStockPatchResult:
    """Map Patagonia stock items to Tiendanube PATCH payload items."""
    skipped_items: list[SkippedStockItem] = []
    product_map: dict[int, dict[str, Any]] = {}
    matched_count = 0

    for item in stock_items:
        codigo_articulo = item.get("CodigoArticulo")
        unidades_disponibles = item.get("UnidadesDisponibles")

        if not codigo_articulo or unidades_disponibles is None:
            continue

        mapping = sku_index.get(str(codigo_articulo))
        if not mapping:
            skipped_items.append(
                {
                    "CodigoArticulo": str(codigo_articulo),
                    "UnidadesDisponibles": int(unidades_disponibles),
                }
            )
            continue

        matched_count += 1
        variant_patch = {
            "id": mapping["variant_id"],
            "inventory_levels": [{"stock": int(unidades_disponibles)}],
        }

        existing_product = product_map.get(mapping["product_id"])
        if existing_product:
            existing_product["variants"].append(variant_patch)
            continue

        product_map[mapping["product_id"]] = {
            "id": mapping["product_id"],
            "variants": [variant_patch],
        }

    patch_items = sorted(product_map.values(), key=lambda product: product["id"])
    return {
        "patch_items": patch_items,
        "matched_count": matched_count,
        "skipped_items": skipped_items,
    }


def write_patch_output(output_path: Path, patch_items: list[dict[str, Any]]) -> None:
    """Write the PATCH-only JSON array."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(patch_items, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def repo_relative_path(path: Path) -> str:
    """Return a repo-relative path string, falling back to absolute if needed."""
    resolved = path.resolve()
    repo_root = SCRIPT_DIR.parent.resolve()
    try:
        return str(resolved.relative_to(repo_root))
    except ValueError:
        return str(resolved)


def write_skipped_report(
    skipped_report_path: Path,
    stock_path: Path,
    catalog_path: Path,
    total_snapshot_items: int,
    matched_count: int,
    skipped_items: list[SkippedStockItem],
) -> None:
    """Write a report of Patagonia items not found in the catalog."""
    if not skipped_items:
        return

    skipped_report_path.parent.mkdir(parents=True, exist_ok=True)
    report = {
        "source_stock": repo_relative_path(stock_path),
        "source_catalog": repo_relative_path(catalog_path),
        "total_snapshot_items": total_snapshot_items,
        "matched_count": matched_count,
        "skipped_count": len(skipped_items),
        "skipped_items": skipped_items,
    }
    skipped_report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def parse_args() -> argparse.Namespace:
    """Parse CLI arguments."""
    default_patch_path, default_skipped_path = derive_output_paths(DEFAULT_STOCK_PATH)

    parser = argparse.ArgumentParser(
        description="Build Tiendanube stock-price PATCH payload from Patagonia snapshot",
    )
    parser.add_argument(
        "--stock",
        type=Path,
        default=DEFAULT_STOCK_PATH,
        help=f"Patagonia stock snapshot path (default: {DEFAULT_STOCK_PATH})",
    )
    parser.add_argument(
        "--catalog",
        type=Path,
        default=DEFAULT_CATALOG_PATH,
        help=f"products-clean.json path (default: {DEFAULT_CATALOG_PATH})",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="PATCH output path (default: derived from stock filename)",
    )
    parser.add_argument(
        "--skipped-report",
        type=Path,
        default=None,
        help="Skipped SKUs report path (default: derived from stock filename)",
    )
    args = parser.parse_args()

    if args.output is None or args.skipped_report is None:
        derived_patch_path, derived_skipped_path = derive_output_paths(args.stock)
        if args.output is None:
            args.output = derived_patch_path
        if args.skipped_report is None:
            args.skipped_report = derived_skipped_path

    return args


def main() -> int:
    """Run the stock patch builder."""
    args = parse_args()

    try:
        stock_items = load_stock_snapshot(args.stock)
        products = load_products_catalog(args.catalog)
        sku_index = build_sku_index(products)

        print(
            f"Processing {len(stock_items)} snapshot items against "
            f"{len(sku_index)} catalog SKUs..."
        )

        result = build_stock_patch(stock_items, sku_index)
        write_patch_output(args.output, result["patch_items"])
        write_skipped_report(
            args.skipped_report,
            args.stock,
            args.catalog,
            len(stock_items),
            result["matched_count"],
            result["skipped_items"],
        )

        print(f"Saved {len(result['patch_items'])} products to {args.output}")
        print(
            "Summary: "
            f"total={len(stock_items)}, "
            f"matched={result['matched_count']}, "
            f"skipped={len(result['skipped_items'])}"
        )

        if len(result["patch_items"]) > PATCH_CHUNK_WARNING_SIZE:
            chunk_count = (
                len(result["patch_items"]) + PATCH_CHUNK_WARNING_SIZE - 1
            ) // PATCH_CHUNK_WARNING_SIZE
            print(
                f"Warning: PATCH payload has {len(result['patch_items'])} products; "
                f"Tiendanube API may require ~{chunk_count} requests "
                f"(chunk size {PATCH_CHUNK_WARNING_SIZE}).",
                file=sys.stderr,
            )

        if result["skipped_items"]:
            print(f"Saved skipped SKU report to {args.skipped_report}")

        return 0
    except ValueError as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    except json.JSONDecodeError as error:
        print(f"Invalid JSON: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
