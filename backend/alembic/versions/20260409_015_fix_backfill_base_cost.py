"""Fix backfilled base_cost to preserve original displayed prices.

Migration 014 set base_cost from current inventory prices, which may
have changed since items were added. This caused old quotes to show
different prices. Fix: back-calculate base_cost from the stored
unit_price and markup_percent so that base_cost * (1 + markup/100)
always equals the original unit_price.

Revision ID: 015_fix_backfill_base_cost
Revises: 014_backfill_base_cost_markup
"""

from alembic import op
import sqlalchemy as sa

revision = '015_fix_backfill_base_cost'
down_revision = '014_backfill_base_cost_markup'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    # For all non-PMS items that have both unit_price and markup_percent,
    # back-calculate base_cost so the displayed price is preserved:
    #   base_cost = unit_price / (1 + markup_percent / 100)
    #
    # This ensures getLineItemUnitPrice (base_cost * (1 + markup/100))
    # returns the same value as the stored unit_price.
    conn.execute(sa.text("""
        UPDATE quote_line_items
        SET base_cost = unit_price / (1 + markup_percent / 100.0)
        WHERE unit_price IS NOT NULL
          AND unit_price > 0
          AND markup_percent IS NOT NULL
          AND (1 + markup_percent / 100.0) > 0
          AND is_pms = false
    """))

    # Same fix for snapshots
    conn.execute(sa.text("""
        UPDATE quote_line_item_snapshots
        SET base_cost = unit_price / (1 + markup_percent / 100.0)
        WHERE unit_price IS NOT NULL
          AND unit_price > 0
          AND markup_percent IS NOT NULL
          AND (1 + markup_percent / 100.0) > 0
          AND is_pms = false
    """))


def downgrade():
    # Data-only migration — no schema changes to revert.
    pass
