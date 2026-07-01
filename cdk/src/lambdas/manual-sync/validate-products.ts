import type { ProductsCleanProduct } from '../../shared/tiendanube.types';

export type ValidationIssueType =
  | 'missing_variants'
  | 'multiple_variants'
  | 'missing_inventory_levels'
  | 'multiple_inventory_levels';

export interface ValidationIssue {
  product_id: number | undefined;
  variant_id: number | null;
  issue: ValidationIssueType;
}

export interface ValidationReport {
  total: number;
  issueCount: number;
  issues: ValidationIssue[];
  summary: Record<string, number>;
}

/**
 * Finds products/variants that don't have exactly one variant and one
 * inventory level. Mirrors scripts/validate_products_clean.py.
 */
export function findIssues(products: ProductsCleanProduct[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const product of products) {
    const productId = product.id;
    const variants = product.variants;

    if (!Array.isArray(variants) || variants.length === 0) {
      issues.push({ product_id: productId, variant_id: null, issue: 'missing_variants' });
      continue;
    }

    if (variants.length > 1) {
      issues.push({ product_id: productId, variant_id: null, issue: 'multiple_variants' });
    }

    for (const variant of variants) {
      const inventoryLevels = variant.inventory_levels;

      if (!Array.isArray(inventoryLevels) || inventoryLevels.length === 0) {
        issues.push({
          product_id: productId,
          variant_id: variant.id,
          issue: 'missing_inventory_levels',
        });
        continue;
      }

      if (inventoryLevels.length > 1) {
        issues.push({
          product_id: productId,
          variant_id: variant.id,
          issue: 'multiple_inventory_levels',
        });
      }
    }
  }

  return issues;
}

/** Builds a validation report with issue counts by type. */
export function buildValidationReport(
  products: ProductsCleanProduct[],
): ValidationReport {
  const issues = findIssues(products);
  const summary: Record<string, number> = {};

  for (const issue of issues) {
    summary[issue.issue] = (summary[issue.issue] ?? 0) + 1;
  }

  return {
    total: products.length,
    issueCount: issues.length,
    issues,
    summary,
  };
}
