"""Add vendor pricebook fields, section-level markup, and per-line-item markup

- parts: add vendor_id, list_price, discount_percent
- profiles: add default_discount_percent
- quote_line_items: add markup_percent
- quotes: add parts_markup_percent, labor_markup_percent, misc_markup_percent
  (replace global_markup_percent — data migrated before drop)
- quote_line_item_snapshots: add markup_percent

Revision ID: 010_price_flow_changes
Revises: 009_labor_hours_decimal
Create Date: 2026-02-27
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '010_price_flow_changes'
down_revision = '009_labor_hours_decimal'
branch_labels = None
depends_on = None


def _column_exists(table, column):
    """Check if a column already exists (idempotent guard)."""
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name = :table AND column_name = :column"
    ), {"table": table, "column": column})
    return result.fetchone() is not None


def upgrade():
    # 1. Part model: add vendor linkage + pricebook fields
    if not _column_exists('parts', 'vendor_id'):
        op.add_column('parts', sa.Column('vendor_id', sa.Integer(), nullable=True))
        op.create_foreign_key('fk_parts_vendor_id', 'parts', 'profiles', ['vendor_id'], ['id'])

    if not _column_exists('parts', 'list_price'):
        op.add_column('parts', sa.Column('list_price', sa.Float(), nullable=True))

    if not _column_exists('parts', 'discount_percent'):
        op.add_column('parts', sa.Column('discount_percent', sa.Float(), nullable=True))

    # 2. Profile (vendor): add default discount
    if not _column_exists('profiles', 'default_discount_percent'):
        op.add_column('profiles', sa.Column('default_discount_percent', sa.Float(), nullable=True))

    # 3. QuoteLineItem: add per-line-item markup
    if not _column_exists('quote_line_items', 'markup_percent'):
        op.add_column('quote_line_items', sa.Column('markup_percent', sa.Float(), nullable=True))

    # 4. Quote: add section-level markup columns, migrate data, drop old column
    if not _column_exists('quotes', 'parts_markup_percent'):
        op.add_column('quotes', sa.Column('parts_markup_percent', sa.Float(), nullable=True))

    if not _column_exists('quotes', 'labor_markup_percent'):
        op.add_column('quotes', sa.Column('labor_markup_percent', sa.Float(), nullable=True))

    if not _column_exists('quotes', 'misc_markup_percent'):
        op.add_column('quotes', sa.Column('misc_markup_percent', sa.Float(), nullable=True))

    # Migrate existing data: copy global → all three sections
    if _column_exists('quotes', 'global_markup_percent'):
        conn = op.get_bind()
        conn.execute(sa.text("""
            UPDATE quotes
            SET parts_markup_percent = global_markup_percent,
                labor_markup_percent = global_markup_percent,
                misc_markup_percent = global_markup_percent
            WHERE markup_control_enabled = true AND global_markup_percent IS NOT NULL
        """))
        op.drop_column('quotes', 'global_markup_percent')

    # 5. QuoteLineItemSnapshot: add markup_percent
    if not _column_exists('quote_line_item_snapshots', 'markup_percent'):
        op.add_column('quote_line_item_snapshots', sa.Column('markup_percent', sa.Float(), nullable=True))


def downgrade():
    conn = op.get_bind()

    # 5. Drop markup_percent from snapshots
    if _column_exists('quote_line_item_snapshots', 'markup_percent'):
        op.drop_column('quote_line_item_snapshots', 'markup_percent')

    # 4. Restore global_markup_percent on quotes, migrate data back, drop section columns
    if not _column_exists('quotes', 'global_markup_percent'):
        op.add_column('quotes', sa.Column('global_markup_percent', sa.Float(), nullable=True))

    # Copy parts_markup_percent back to global (best approximation)
    if _column_exists('quotes', 'parts_markup_percent'):
        conn.execute(sa.text("""
            UPDATE quotes
            SET global_markup_percent = parts_markup_percent
            WHERE markup_control_enabled = true AND parts_markup_percent IS NOT NULL
        """))
        op.drop_column('quotes', 'misc_markup_percent')
        op.drop_column('quotes', 'labor_markup_percent')
        op.drop_column('quotes', 'parts_markup_percent')

    # 3. Drop markup_percent from quote_line_items
    if _column_exists('quote_line_items', 'markup_percent'):
        op.drop_column('quote_line_items', 'markup_percent')

    # 2. Drop default_discount_percent from profiles
    if _column_exists('profiles', 'default_discount_percent'):
        op.drop_column('profiles', 'default_discount_percent')

    # 1. Drop pricebook fields from parts
    if _column_exists('parts', 'discount_percent'):
        op.drop_column('parts', 'discount_percent')

    if _column_exists('parts', 'list_price'):
        op.drop_column('parts', 'list_price')

    if _column_exists('parts', 'vendor_id'):
        op.drop_constraint('fk_parts_vendor_id', 'parts', type_='foreignkey')
        op.drop_column('parts', 'vendor_id')
