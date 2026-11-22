import type { Product, ProductVariantOption } from './types.ts';

export function parseProductVariants(raw: unknown): ProductVariantOption[] {
  let items: unknown[] = [];

  if (Array.isArray(raw)) {
    items = raw;
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) items = parsed;
      } catch {
        items = trimmed.split(/[،,]/);
      }
    } else {
      items = trimmed.split(/[،,]/);
    }
  }

  const out: ProductVariantOption[] = [];
  for (const entry of items) {
    if (typeof entry === 'string') {
      const clean = entry.trim();
      if (!clean) continue;
      // Support optional "label | price" inline notation if edited manually in Sheets
      const pipeIdx = clean.lastIndexOf('|');
      if (pipeIdx > 0) {
        const label = clean.slice(0, pipeIdx).trim();
        const maybePrice = Number(clean.slice(pipeIdx + 1).trim());
        if (label) {
          out.push({
            label,
            price: Number.isFinite(maybePrice) && maybePrice >= 0 ? maybePrice : null,
          });
          continue;
        }
      }
      out.push({ label: clean, price: null });
    } else if (entry && typeof entry === 'object') {
      const obj = entry as { label?: unknown; name?: unknown; price?: unknown };
      const label = String(obj.label ?? obj.name ?? '').trim();
      if (!label) continue;
      const hasPrice = obj.price !== null && obj.price !== undefined && String(obj.price).trim() !== '';
      const parsedPrice = hasPrice ? Number(obj.price) : NaN;
      out.push({
        label,
        price: Number.isFinite(parsedPrice) && parsedPrice >= 0 ? parsedPrice : null,
      });
    }
  }

  return out;
}

export function resolveVariantUnitPrice(product: Product, variantLabel: string): number {
  if (!variantLabel || !Array.isArray(product.variants) || product.variants.length === 0) {
    return product.price;
  }
  const found = product.variants.find((v) => v.label.trim() === variantLabel.trim());
  if (found && found.price !== null && Number.isFinite(found.price) && found.price >= 0) {
    return found.price;
  }
  return product.price;
}

export function getProductPriceSummary(product: Product): {
  defaultPrice: number;
  minPrice: number;
  maxPrice: number;
  hasRange: boolean;
} {
  const prices = (product.variants || [])
    .map((v) => (v.price !== null && Number.isFinite(v.price) && v.price >= 0 ? v.price : product.price))
    .filter((p) => Number.isFinite(p));

  const firstVariantPrice = product.variants?.[0]?.price;
  const defaultPrice =
    firstVariantPrice !== null && firstVariantPrice !== undefined && Number.isFinite(firstVariantPrice)
      ? firstVariantPrice
      : product.price;

  if (prices.length === 0) {
    return {
      defaultPrice: product.price,
      minPrice: product.price,
      maxPrice: product.price,
      hasRange: false,
    };
  }

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  return {
    defaultPrice,
    minPrice,
    maxPrice,
    hasRange: minPrice !== maxPrice,
  };
}
