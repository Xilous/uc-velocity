-- Migration: Add client_po_number column to quotes table
-- Run this SQL against your PostgreSQL database to add the new field

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS client_po_number VARCHAR;

-- Verification query (optional):
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'quotes';
