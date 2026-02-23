"""Add hst_rate column to company_settings

Adds a configurable HST (Harmonized Sales Tax) rate to company settings.
Defaults to 13.0 (Ontario HST rate). This column is used to calculate
tax amounts on quotes, invoices, POs, and PDF reports.

Revision ID: 007_add_hst_rate
Revises: 006_fix_missing_po_columns
Create Date: 2026-02-23
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '007_add_hst_rate'
down_revision = '006_fix_missing_po_columns'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    # Add hst_rate column with default 13.0 (Ontario HST)
    conn.execute(sa.text(
        "ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS hst_rate FLOAT DEFAULT 13.0"
    ))

    # Backfill existing rows
    conn.execute(sa.text(
        "UPDATE company_settings SET hst_rate = 13.0 WHERE hst_rate IS NULL"
    ))


def downgrade():
    op.drop_column('company_settings', 'hst_rate')
