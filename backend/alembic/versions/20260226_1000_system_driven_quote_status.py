"""System-driven quote statuses

Convert quote status from user-selectable ('Active'/'Invoiced') to
system-computed ('Draft'/'Work Order'/'Invoiced'/'Closed'). Status is
now derived from line item fulfillment state and client_po_number.

Truncates all quote-related data (dev-only, safe to wipe) and updates
the column default from 'Active' to 'Draft'.

Revision ID: 008_system_driven_quote_status
Revises: 007_add_hst_rate
Create Date: 2026-02-26
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '008_system_driven_quote_status'
down_revision = '007_add_hst_rate'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    # Truncate all quote-related tables in dependency order (dev-only, safe to wipe)
    conn.execute(sa.text("TRUNCATE TABLE invoice_line_items, invoices, quote_line_item_snapshots, quote_snapshots, quote_line_items, quotes CASCADE"))

    # Update default from 'Active' to 'Draft'
    conn.execute(sa.text("ALTER TABLE quotes ALTER COLUMN status SET DEFAULT 'Draft'"))


def downgrade():
    conn = op.get_bind()
    conn.execute(sa.text("ALTER TABLE quotes ALTER COLUMN status SET DEFAULT 'Active'"))
