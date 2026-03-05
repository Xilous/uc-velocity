"""Make cost_code_id nullable on quotes and purchase_orders

Legacy data from UC Vision has no cost codes, so imported quotes and POs
need cost_code_id = NULL.

Revision ID: 011_nullable_cost_code
Revises: 010_price_flow_changes
Create Date: 2026-03-05
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '011_nullable_cost_code'
down_revision = '010_price_flow_changes'
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


def upgrade() -> None:
    if _column_exists('quotes', 'cost_code_id'):
        op.alter_column('quotes', 'cost_code_id', existing_type=sa.Integer(), nullable=True)
    if _column_exists('purchase_orders', 'cost_code_id'):
        op.alter_column('purchase_orders', 'cost_code_id', existing_type=sa.Integer(), nullable=True)


def downgrade() -> None:
    # Set any NULLs to a default before re-adding NOT NULL
    op.execute("UPDATE quotes SET cost_code_id = 1 WHERE cost_code_id IS NULL")
    op.alter_column('quotes', 'cost_code_id', existing_type=sa.Integer(), nullable=False)
    op.execute("UPDATE purchase_orders SET cost_code_id = 1 WHERE cost_code_id IS NULL")
    op.alter_column('purchase_orders', 'cost_code_id', existing_type=sa.Integer(), nullable=False)
