import * as XLSX from 'xlsx'
import type { BacklogQuoteItem } from '@/types'

/**
 * Generate and download a Backlog Quotes Excel report.
 *
 * Layout:
 *   - Quote header rows (bold) with summary columns
 *   - Item detail rows grouped under each quote (outline level 1)
 *   - Grand total row at the bottom
 */
export function generateBacklogExcel(data: BacklogQuoteItem[]): void {
  const wb = XLSX.utils.book_new()

  // Build row data — each row is an array of cell values
  const rows: (string | number)[][] = []

  // Header row
  const headerRow = [
    'Quote #', 'UCA Project #', 'Customer', 'Project', 'Client PO',
    'Status', 'Item Type', 'Description', 'Qty Ordered', 'Qty Fulfilled',
    'Qty Pending', 'Unit Price', 'Backlog Value',
  ]
  rows.push(headerRow)

  // Track which data rows are detail rows (for grouping)
  // Row index 0 = header, data rows start at index 1
  const detailRowIndices: number[] = []

  let grandTotal = 0

  for (const quote of data) {
    // Quote summary row
    rows.push([
      quote.quote_number,
      quote.uca_project_number,
      quote.customer_name,
      quote.project_name,
      quote.client_po_number || '',
      quote.status,
      '', // item_type (blank for summary)
      '', // description
      '', // qty ordered
      '', // qty fulfilled
      '', // qty pending
      '', // unit price
      quote.backlog_total,
    ])

    // Item detail rows
    for (const li of quote.line_items) {
      const rowIdx = rows.length // 0-based index of the row we're about to push
      detailRowIndices.push(rowIdx)

      rows.push([
        '', // quote #
        '', // uca project
        '', // customer
        '', // project
        '', // client PO
        '', // status
        li.item_type,
        li.description,
        li.quantity,
        li.qty_fulfilled,
        li.qty_pending,
        li.unit_price,
        li.backlog_value,
      ])
    }

    grandTotal += quote.backlog_total
  }

  // Grand total row
  rows.push([
    '', '', '', '', '', '', '', '', '', '', '', 'Grand Total',
    grandTotal,
  ])

  // Create worksheet from array of arrays
  const ws = XLSX.utils.aoa_to_sheet(rows)

  // Set column widths
  ws['!cols'] = [
    { wch: 18 }, // Quote #
    { wch: 14 }, // UCA Project #
    { wch: 22 }, // Customer
    { wch: 22 }, // Project
    { wch: 14 }, // Client PO
    { wch: 12 }, // Status
    { wch: 10 }, // Item Type
    { wch: 30 }, // Description
    { wch: 11 }, // Qty Ordered
    { wch: 12 }, // Qty Fulfilled
    { wch: 11 }, // Qty Pending
    { wch: 12 }, // Unit Price
    { wch: 14 }, // Backlog Value
  ]

  // Apply row outline/grouping for detail rows
  if (!ws['!rows']) ws['!rows'] = []
  for (const idx of detailRowIndices) {
    // Ensure array is long enough
    while (ws['!rows'].length <= idx) {
      ws['!rows'].push({})
    }
    ws['!rows'][idx] = { level: 1 }
  }

  // Format currency columns (Unit Price and Backlog Value) as number with 2 decimals
  const numFmt = '#,##0.00'
  const currencyCols = [11, 12] // 0-indexed: Unit Price (L), Backlog Value (M)
  for (let r = 1; r < rows.length; r++) {
    for (const c of currencyCols) {
      const cellRef = XLSX.utils.encode_cell({ r, c })
      if (ws[cellRef] && typeof ws[cellRef].v === 'number') {
        ws[cellRef].z = numFmt
      }
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, 'Backlog Quotes')

  // Generate filename with today's date
  const today = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `Backlog_Quotes_Report_${today}.xlsx`)
}
