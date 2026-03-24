"""Remove discount codes system entirely

Drops the discount_codes table and removes discount_code_id columns from
quote_line_items, invoice_line_items, and quote_line_item_snapshots.
Discount codes (sales discounts on quotes) are replaced by per-section
markup control. Vendor/part discount_percent is NOT affected.

Revision ID: 013_remove_discount_codes
Revises: 012_system_rates_settings
Create Date: 2026-03-24
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '013_remove_discount_codes'
down_revision = '012_system_rates_settings'
branch_labels = None
depends_on = None


def _table_exists(name):
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = :name)"
    ), {"name": name})
    return result.scalar()


def _column_exists(table, column):
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name = :table AND column_name = :column"
    ), {"table": table, "column": column})
    return result.fetchone() is not None


def _constraint_exists(table, constraint):
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM information_schema.table_constraints "
        "WHERE table_name = :table AND constraint_name = :constraint)"
    ), {"table": table, "constraint": constraint})
    return result.scalar()


def upgrade() -> None:
    # 1. Drop FK constraint on quote_line_items.discount_code_id BEFORE dropping the table
    if _constraint_exists('quote_line_items', 'quote_line_items_discount_code_id_fkey'):
        op.drop_constraint('quote_line_items_discount_code_id_fkey', 'quote_line_items', type_='foreignkey')

    # 2. Drop discount_code_id columns from all three tables
    if _column_exists('quote_line_items', 'discount_code_id'):
        op.drop_column('quote_line_items', 'discount_code_id')

    if _column_exists('invoice_line_items', 'discount_code_id'):
        op.drop_column('invoice_line_items', 'discount_code_id')

    if _column_exists('quote_line_item_snapshots', 'discount_code_id'):
        op.drop_column('quote_line_item_snapshots', 'discount_code_id')

    # 3. Drop the discount_codes table
    if _table_exists('discount_codes'):
        op.drop_index('ix_discount_codes_id', table_name='discount_codes')
        op.drop_table('discount_codes')


def downgrade() -> None:
    # 1. Recreate discount_codes table
    if not _table_exists('discount_codes'):
        op.create_table(
            'discount_codes',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('code', sa.String(10), unique=True, nullable=False),
            sa.Column('discount_percent', sa.Float(), nullable=False),
            sa.Column('is_archived', sa.Boolean(), default=False),
        )
        op.create_index('ix_discount_codes_id', 'discount_codes', ['id'])

    # 2. Re-add discount_code_id columns
    if not _column_exists('quote_line_items', 'discount_code_id'):
        op.add_column('quote_line_items', sa.Column(
            'discount_code_id', sa.Integer(),
            sa.ForeignKey('discount_codes.id'), nullable=True
        ))

    if not _column_exists('invoice_line_items', 'discount_code_id'):
        op.add_column('invoice_line_items', sa.Column(
            'discount_code_id', sa.Integer(), nullable=True
        ))

    if not _column_exists('quote_line_item_snapshots', 'discount_code_id'):
        op.add_column('quote_line_item_snapshots', sa.Column(
            'discount_code_id', sa.Integer(), nullable=True
        ))
