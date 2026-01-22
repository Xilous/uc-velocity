"""Initial baseline - stamps existing database

This migration establishes the baseline for the existing database schema.
It does not create or modify any tables since they already exist in production.

Future migrations will build on this revision.

Revision ID: 001_baseline
Revises:
Create Date: 2026-01-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '001_baseline'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Baseline migration - no changes needed.

    All tables already exist in production:
    - categories, profiles, contacts, contact_phones
    - parts, labor, part_labor_link, miscellaneous
    - discount_codes, projects, quotes, quote_line_items
    - purchase_orders, po_line_items
    - invoices, invoice_line_items
    - quote_snapshots, quote_line_item_snapshots
    """
    pass


def downgrade() -> None:
    """Cannot downgrade from baseline."""
    pass
