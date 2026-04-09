"""Backfill base_cost and markup_percent for all quote line items.

Previously these fields were only populated when Markup Control was enabled.
Now they are always required so markup is a transparent layer on top of
an immutable base cost (Issue #60).

Revision ID: 014_backfill_base_cost_markup
Revises: 013_remove_discount_codes
"""

from alembic import op
import sqlalchemy as sa

revision = '014_backfill_base_cost_markup'
down_revision = '013_remove_discount_codes'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    # --- Backfill quote_line_items ---

    # Parts: base_cost = parts.cost
    conn.execute(sa.text("""
        UPDATE quote_line_items
        SET base_cost = p.cost
        FROM parts p
        WHERE quote_line_items.part_id = p.id
          AND quote_line_items.item_type = 'part'
          AND quote_line_items.base_cost IS NULL
    """))

    # Labor: base_cost = labor.rate * labor.hours
    conn.execute(sa.text("""
        UPDATE quote_line_items
        SET base_cost = l.rate * l.hours
        FROM labor l
        WHERE quote_line_items.labor_id = l.id
          AND quote_line_items.item_type = 'labor'
          AND quote_line_items.base_cost IS NULL
    """))

    # Misc (linked): base_cost = miscellaneous.unit_price
    conn.execute(sa.text("""
        UPDATE quote_line_items
        SET base_cost = m.unit_price
        FROM miscellaneous m
        WHERE quote_line_items.misc_id = m.id
          AND quote_line_items.item_type = 'misc'
          AND quote_line_items.base_cost IS NULL
          AND quote_line_items.misc_id IS NOT NULL
    """))

    # Misc (unlinked) / any remaining: base_cost = unit_price
    conn.execute(sa.text("""
        UPDATE quote_line_items
        SET base_cost = COALESCE(unit_price, 0)
        WHERE base_cost IS NULL
    """))

    # Parts: markup_percent from inventory
    conn.execute(sa.text("""
        UPDATE quote_line_items
        SET markup_percent = COALESCE(p.markup_percent, 0)
        FROM parts p
        WHERE quote_line_items.part_id = p.id
          AND quote_line_items.item_type = 'part'
          AND quote_line_items.markup_percent IS NULL
          AND quote_line_items.is_pms = false
    """))

    # Labor: markup_percent from inventory
    conn.execute(sa.text("""
        UPDATE quote_line_items
        SET markup_percent = COALESCE(l.markup_percent, 0)
        FROM labor l
        WHERE quote_line_items.labor_id = l.id
          AND quote_line_items.item_type = 'labor'
          AND quote_line_items.markup_percent IS NULL
          AND quote_line_items.is_pms = false
    """))

    # Misc (linked): markup_percent from inventory
    conn.execute(sa.text("""
        UPDATE quote_line_items
        SET markup_percent = COALESCE(m.markup_percent, 0)
        FROM miscellaneous m
        WHERE quote_line_items.misc_id = m.id
          AND quote_line_items.item_type = 'misc'
          AND quote_line_items.markup_percent IS NULL
          AND quote_line_items.misc_id IS NOT NULL
          AND quote_line_items.is_pms = false
    """))

    # PMS items: markup_percent = 0
    conn.execute(sa.text("""
        UPDATE quote_line_items
        SET markup_percent = 0
        WHERE markup_percent IS NULL
          AND is_pms = true
    """))

    # Any remaining (unlinked misc, etc.): back-calculate or default to 0
    conn.execute(sa.text("""
        UPDATE quote_line_items
        SET markup_percent = CASE
            WHEN base_cost > 0 AND unit_price IS NOT NULL AND unit_price > 0
                THEN ROUND(((unit_price / base_cost) - 1) * 100, 2)
            ELSE 0
        END
        WHERE markup_percent IS NULL
    """))

    # --- Backfill quote_line_item_snapshots (same logic) ---

    # Parts
    conn.execute(sa.text("""
        UPDATE quote_line_item_snapshots
        SET base_cost = p.cost
        FROM parts p
        WHERE quote_line_item_snapshots.part_id = p.id
          AND quote_line_item_snapshots.item_type = 'part'
          AND quote_line_item_snapshots.base_cost IS NULL
    """))

    # Labor
    conn.execute(sa.text("""
        UPDATE quote_line_item_snapshots
        SET base_cost = l.rate * l.hours
        FROM labor l
        WHERE quote_line_item_snapshots.labor_id = l.id
          AND quote_line_item_snapshots.item_type = 'labor'
          AND quote_line_item_snapshots.base_cost IS NULL
    """))

    # Misc (linked)
    conn.execute(sa.text("""
        UPDATE quote_line_item_snapshots
        SET base_cost = m.unit_price
        FROM miscellaneous m
        WHERE quote_line_item_snapshots.misc_id = m.id
          AND quote_line_item_snapshots.item_type = 'misc'
          AND quote_line_item_snapshots.base_cost IS NULL
          AND quote_line_item_snapshots.misc_id IS NOT NULL
    """))

    # Remaining
    conn.execute(sa.text("""
        UPDATE quote_line_item_snapshots
        SET base_cost = COALESCE(unit_price, 0)
        WHERE base_cost IS NULL
    """))

    # Parts markup
    conn.execute(sa.text("""
        UPDATE quote_line_item_snapshots
        SET markup_percent = COALESCE(p.markup_percent, 0)
        FROM parts p
        WHERE quote_line_item_snapshots.part_id = p.id
          AND quote_line_item_snapshots.item_type = 'part'
          AND quote_line_item_snapshots.markup_percent IS NULL
          AND quote_line_item_snapshots.is_pms = false
    """))

    # Labor markup
    conn.execute(sa.text("""
        UPDATE quote_line_item_snapshots
        SET markup_percent = COALESCE(l.markup_percent, 0)
        FROM labor l
        WHERE quote_line_item_snapshots.labor_id = l.id
          AND quote_line_item_snapshots.item_type = 'labor'
          AND quote_line_item_snapshots.markup_percent IS NULL
          AND quote_line_item_snapshots.is_pms = false
    """))

    # Misc markup
    conn.execute(sa.text("""
        UPDATE quote_line_item_snapshots
        SET markup_percent = COALESCE(m.markup_percent, 0)
        FROM miscellaneous m
        WHERE quote_line_item_snapshots.misc_id = m.id
          AND quote_line_item_snapshots.item_type = 'misc'
          AND quote_line_item_snapshots.markup_percent IS NULL
          AND quote_line_item_snapshots.misc_id IS NOT NULL
          AND quote_line_item_snapshots.is_pms = false
    """))

    # PMS snapshots
    conn.execute(sa.text("""
        UPDATE quote_line_item_snapshots
        SET markup_percent = 0
        WHERE markup_percent IS NULL
          AND is_pms = true
    """))

    # Remaining snapshots
    conn.execute(sa.text("""
        UPDATE quote_line_item_snapshots
        SET markup_percent = CASE
            WHEN base_cost > 0 AND unit_price IS NOT NULL AND unit_price > 0
                THEN ROUND(((unit_price / base_cost) - 1) * 100, 2)
            ELSE 0
        END
        WHERE markup_percent IS NULL
    """))


def downgrade():
    # No schema changes to revert — this was a data-only migration.
    # Setting values back to NULL is not necessary since the columns
    # were already nullable before this migration.
    pass
