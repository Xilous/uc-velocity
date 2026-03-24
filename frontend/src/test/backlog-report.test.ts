import { describe, it, expect } from 'vitest'
import { generateBacklogExcel } from '@/lib/excel'

describe('Backlog Report - Excel generation', () => {
  it('does not throw with empty data', () => {
    // generateBacklogExcel calls XLSX.writeFile which tries to trigger a download.
    // In jsdom there's no real DOM download, but it should not throw.
    expect(() => generateBacklogExcel([])).not.toThrow()
  })

  it('does not throw with sample data', () => {
    expect(() =>
      generateBacklogExcel([
        {
          quote_id: 1,
          quote_number: 'A1000-0001-0',
          uca_project_number: 'A1000',
          customer_name: 'Test Customer',
          project_name: 'Test Project',
          client_po_number: 'PO-123',
          status: 'Work Order',
          quote_total: 5000,
          backlog_total: 3000,
          line_items: [
            {
              line_item_id: 10,
              item_type: 'labor',
              description: 'Labor: Electrical',
              quantity: 10,
              qty_fulfilled: 4,
              qty_pending: 6,
              unit_price: 500,
              backlog_value: 3000,
            },
          ],
        },
      ])
    ).not.toThrow()
  })
})
