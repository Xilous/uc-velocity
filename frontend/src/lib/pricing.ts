import type { QuoteLineItem } from '@/types'

/**
 * Get the unit price for a quote line item, resolving from the linked
 * inventory item (with markup) if no explicit override is set.
 *
 * Priority:
 * 1. Explicit unit_price override (set by markup control calculation)
 * 2. Line-item markup_percent with base cost (per-item markup)
 * 3. Inventory item's markup (legacy / no line-item markup set)
 */
export function getLineItemUnitPrice(item: QuoteLineItem): number {
  // If explicit unit_price override exists (from markup calculation), use it
  if (item.unit_price) return item.unit_price

  // If line-item markup_percent is set, use it with base cost
  if (item.markup_percent != null) {
    if (item.part) return item.part.cost * (1 + item.markup_percent / 100)
    if (item.labor) return item.labor.hours * item.labor.rate * (1 + item.markup_percent / 100)
    if (item.miscellaneous) return item.miscellaneous.unit_price * (1 + item.markup_percent / 100)
  }

  // Fall back to inventory item's markup (legacy / no line-item markup set)
  if (item.labor) {
    return item.labor.hours * item.labor.rate * (1 + item.labor.markup_percent / 100)
  }
  if (item.part) {
    return item.part.cost * (1 + (item.part.markup_percent ?? 0) / 100)
  }
  if (item.miscellaneous) {
    return item.miscellaneous.unit_price * (1 + item.miscellaneous.markup_percent / 100)
  }
  return 0
}

/** Unit price * quantity (before discount). */
export function getLineItemSubtotal(item: QuoteLineItem): number {
  return getLineItemUnitPrice(item) * item.quantity
}

/** Subtotal after applying the line-item discount code (if any). */
export function getLineItemTotal(item: QuoteLineItem): number {
  const subtotal = getLineItemSubtotal(item)
  if (item.discount_code) {
    return subtotal * (1 - item.discount_code.discount_percent / 100)
  }
  return subtotal
}

/** Sum of totals for all non-PMS line items (the base for PMS % calculations). */
export function calculateNonPmsTotal(lineItems: QuoteLineItem[]): number {
  return lineItems
    .filter(item => !item.is_pms)
    .reduce((sum, item) => sum + getLineItemTotal(item), 0)
}

/**
 * Effective unit price that accounts for PMS % items.
 * PMS % items derive their unit price from a percentage of the non-PMS total.
 */
export function getEffectiveUnitPrice(item: QuoteLineItem, nonPmsTotal: number): number {
  if (item.is_pms && item.pms_percent != null) {
    return nonPmsTotal * item.pms_percent / 100
  }
  return getLineItemUnitPrice(item)
}

/** Effective total using the PMS-aware unit price, with discount applied. */
export function getEffectiveLineItemTotal(item: QuoteLineItem, nonPmsTotal: number): number {
  const unitPrice = getEffectiveUnitPrice(item, nonPmsTotal)
  const subtotal = unitPrice * item.quantity
  if (item.discount_code) {
    return subtotal * (1 - item.discount_code.discount_percent / 100)
  }
  return subtotal
}

/** Value of already-fulfilled quantity for a line item. */
export function getFulfilledLineItemValue(item: QuoteLineItem, nonPmsTotal: number): number {
  if (item.qty_fulfilled === 0) return 0
  const unitPrice = getEffectiveUnitPrice(item, nonPmsTotal)
  let total = unitPrice * item.qty_fulfilled
  if (item.discount_code) {
    total = total * (1 - item.discount_code.discount_percent / 100)
  }
  return total
}

/** Aggregate statistics for a section of line items. */
export function calculateSectionTotals(
  items: QuoteLineItem[],
  nonPmsTotal: number,
  useEffectiveTotal = false
) {
  return {
    qtyOrdered: items.reduce((sum, item) => sum + item.quantity, 0),
    qtyPending: items.reduce((sum, item) => sum + item.qty_pending, 0),
    qtyFulfilled: items.reduce((sum, item) => sum + item.qty_fulfilled, 0),
    total: items.reduce(
      (sum, item) => sum + (useEffectiveTotal ? getEffectiveLineItemTotal(item, nonPmsTotal) : getLineItemTotal(item)),
      0
    ),
    fulfilledValue: items.reduce((sum, item) => sum + getFulfilledLineItemValue(item, nonPmsTotal), 0),
  }
}

/** Grand total across all line items (handles PMS % items correctly). */
export function calculateQuoteTotal(lineItems: QuoteLineItem[]): number {
  const nonPmsTotal = calculateNonPmsTotal(lineItems)
  const pmsTotal = lineItems
    .filter(item => item.is_pms)
    .reduce((sum, item) => {
      if (item.pms_percent != null) {
        const unitPrice = nonPmsTotal * item.pms_percent / 100
        let subtotal = unitPrice * item.quantity
        if (item.discount_code) {
          subtotal = subtotal * (1 - item.discount_code.discount_percent / 100)
        }
        return sum + subtotal
      }
      return sum + getLineItemTotal(item)
    }, 0)
  return nonPmsTotal + pmsTotal
}

/** Sum of all discount amounts across line items. */
export function calculateTotalDiscount(lineItems: QuoteLineItem[], nonPmsTotal: number): number {
  return lineItems.reduce((sum, item) => {
    if (!item.discount_code) return sum
    const unitPrice = item.is_pms && item.pms_percent != null
      ? nonPmsTotal * item.pms_percent / 100
      : getLineItemUnitPrice(item)
    const subtotal = unitPrice * item.quantity
    const discountAmount = subtotal * (item.discount_code.discount_percent / 100)
    return sum + discountAmount
  }, 0)
}

/** Format a number as currency with 2 decimal places. */
export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}
