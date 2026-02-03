"""Convert quantity columns from Float to Integer

This migration enforces integer-only quantities across all line item tables.
Business requirement: All quantities must be whole numbers.

Tables modified:
- labor: hours column
- quote_line_items: quantity, qty_pending, qty_fulfilled
- po_line_items: quantity
- invoice_line_items: qty_ordered, qty_fulfilled_this_invoice, qty_fulfilled_total, qty_pending_after
- quote_line_item_snapshots: quantity, qty_pending, qty_fulfilled

Strategy:
1. Round existing float values to nearest integer
2. Convert column types from Float to Integer
3. Log any values that were rounded (for audit purposes)

Note: SQLite requires table recreation for type changes, handled via batch operations.

Revision ID: 003_integer_quantities
Revises: 002_quote_sequence
Create Date: 2026-02-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '003_integer_quantities'
down_revision: Union[str, None] = '002_quote_sequence'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Convert quantity columns from Float to Integer with rounding."""

    # Get connection for raw SQL operations
    conn = op.get_bind()

    # ===== STEP 1: Log fractional values before rounding (for audit) =====

    # Check for fractional values in labor.hours
    result = conn.execute(sa.text("""
        SELECT id, description, hours
        FROM labor
        WHERE hours != ROUND(hours)
    """))
    fractional_labor = result.fetchall()
    if fractional_labor:
        print(f"[AUDIT] Found {len(fractional_labor)} labor items with fractional hours:")
        for row in fractional_labor:
            print(f"  - Labor ID {row[0]} '{row[1]}': {row[2]} -> {round(row[2])}")

    # Check for fractional values in quote_line_items
    result = conn.execute(sa.text("""
        SELECT id, description, quantity, qty_pending, qty_fulfilled
        FROM quote_line_items
        WHERE quantity != ROUND(quantity)
           OR qty_pending != ROUND(qty_pending)
           OR qty_fulfilled != ROUND(qty_fulfilled)
    """))
    fractional_qli = result.fetchall()
    if fractional_qli:
        print(f"[AUDIT] Found {len(fractional_qli)} quote line items with fractional quantities:")
        for row in fractional_qli:
            print(f"  - QLI ID {row[0]} '{row[1]}': qty={row[2]}, pending={row[3]}, fulfilled={row[4]}")

    # Check for fractional values in po_line_items
    result = conn.execute(sa.text("""
        SELECT id, description, quantity
        FROM po_line_items
        WHERE quantity != ROUND(quantity)
    """))
    fractional_poli = result.fetchall()
    if fractional_poli:
        print(f"[AUDIT] Found {len(fractional_poli)} PO line items with fractional quantities:")
        for row in fractional_poli:
            print(f"  - PO Line Item ID {row[0]} '{row[1]}': {row[2]} -> {round(row[2])}")

    # Check for fractional values in invoice_line_items
    result = conn.execute(sa.text("""
        SELECT id, description, qty_ordered, qty_fulfilled_this_invoice, qty_fulfilled_total, qty_pending_after
        FROM invoice_line_items
        WHERE qty_ordered != ROUND(qty_ordered)
           OR qty_fulfilled_this_invoice != ROUND(qty_fulfilled_this_invoice)
           OR qty_fulfilled_total != ROUND(qty_fulfilled_total)
           OR qty_pending_after != ROUND(qty_pending_after)
    """))
    fractional_ili = result.fetchall()
    if fractional_ili:
        print(f"[AUDIT] Found {len(fractional_ili)} invoice line items with fractional quantities:")
        for row in fractional_ili:
            print(f"  - ILI ID {row[0]} '{row[1]}': ordered={row[2]}, this_invoice={row[3]}, total={row[4]}, pending_after={row[5]}")

    # Check for fractional values in quote_line_item_snapshots
    result = conn.execute(sa.text("""
        SELECT id, description, quantity, qty_pending, qty_fulfilled
        FROM quote_line_item_snapshots
        WHERE quantity != ROUND(quantity)
           OR qty_pending != ROUND(qty_pending)
           OR qty_fulfilled != ROUND(qty_fulfilled)
    """))
    fractional_qlis = result.fetchall()
    if fractional_qlis:
        print(f"[AUDIT] Found {len(fractional_qlis)} snapshot line items with fractional quantities:")
        for row in fractional_qlis:
            print(f"  - Snapshot LI ID {row[0]} '{row[1]}': qty={row[2]}, pending={row[3]}, fulfilled={row[4]}")

    # ===== STEP 2: Round values first (while columns are still Float) =====

    # Round labor hours
    conn.execute(sa.text("UPDATE labor SET hours = ROUND(hours)"))

    # Round quote_line_items quantities
    conn.execute(sa.text("""
        UPDATE quote_line_items
        SET quantity = ROUND(quantity),
            qty_pending = ROUND(qty_pending),
            qty_fulfilled = ROUND(qty_fulfilled)
    """))

    # Round po_line_items quantities
    conn.execute(sa.text("UPDATE po_line_items SET quantity = ROUND(quantity)"))

    # Round invoice_line_items quantities
    conn.execute(sa.text("""
        UPDATE invoice_line_items
        SET qty_ordered = ROUND(qty_ordered),
            qty_fulfilled_this_invoice = ROUND(qty_fulfilled_this_invoice),
            qty_fulfilled_total = ROUND(qty_fulfilled_total),
            qty_pending_after = ROUND(qty_pending_after)
    """))

    # Round quote_line_item_snapshots quantities
    conn.execute(sa.text("""
        UPDATE quote_line_item_snapshots
        SET quantity = ROUND(quantity),
            qty_pending = ROUND(qty_pending),
            qty_fulfilled = ROUND(qty_fulfilled)
    """))

    # ===== STEP 3: Convert column types to Integer =====
    # SQLite requires batch operations to change column types

    # Convert labor.hours
    with op.batch_alter_table('labor', schema=None) as batch_op:
        batch_op.alter_column('hours',
                              existing_type=sa.Float(),
                              type_=sa.Integer(),
                              existing_nullable=False,
                              existing_server_default=sa.text('1.0'))

    # Convert quote_line_items columns
    with op.batch_alter_table('quote_line_items', schema=None) as batch_op:
        batch_op.alter_column('quantity',
                              existing_type=sa.Float(),
                              type_=sa.Integer(),
                              existing_nullable=True,
                              existing_server_default=sa.text('1.0'))
        batch_op.alter_column('qty_pending',
                              existing_type=sa.Float(),
                              type_=sa.Integer(),
                              existing_nullable=True,
                              existing_server_default=sa.text('0.0'))
        batch_op.alter_column('qty_fulfilled',
                              existing_type=sa.Float(),
                              type_=sa.Integer(),
                              existing_nullable=True,
                              existing_server_default=sa.text('0.0'))

    # Convert po_line_items.quantity
    with op.batch_alter_table('po_line_items', schema=None) as batch_op:
        batch_op.alter_column('quantity',
                              existing_type=sa.Float(),
                              type_=sa.Integer(),
                              existing_nullable=True,
                              existing_server_default=sa.text('1.0'))

    # Convert invoice_line_items columns
    with op.batch_alter_table('invoice_line_items', schema=None) as batch_op:
        batch_op.alter_column('qty_ordered',
                              existing_type=sa.Float(),
                              type_=sa.Integer(),
                              existing_nullable=True)
        batch_op.alter_column('qty_fulfilled_this_invoice',
                              existing_type=sa.Float(),
                              type_=sa.Integer(),
                              existing_nullable=True)
        batch_op.alter_column('qty_fulfilled_total',
                              existing_type=sa.Float(),
                              type_=sa.Integer(),
                              existing_nullable=True)
        batch_op.alter_column('qty_pending_after',
                              existing_type=sa.Float(),
                              type_=sa.Integer(),
                              existing_nullable=True)

    # Convert quote_line_item_snapshots columns
    with op.batch_alter_table('quote_line_item_snapshots', schema=None) as batch_op:
        batch_op.alter_column('quantity',
                              existing_type=sa.Float(),
                              type_=sa.Integer(),
                              existing_nullable=True)
        batch_op.alter_column('qty_pending',
                              existing_type=sa.Float(),
                              type_=sa.Integer(),
                              existing_nullable=True)
        batch_op.alter_column('qty_fulfilled',
                              existing_type=sa.Float(),
                              type_=sa.Integer(),
                              existing_nullable=True)

    print("[SUCCESS] All quantity columns converted to Integer type")


def downgrade() -> None:
    """Revert Integer columns back to Float."""

    # Convert labor.hours back to Float
    with op.batch_alter_table('labor', schema=None) as batch_op:
        batch_op.alter_column('hours',
                              existing_type=sa.Integer(),
                              type_=sa.Float(),
                              existing_nullable=False)

    # Convert quote_line_items columns back to Float
    with op.batch_alter_table('quote_line_items', schema=None) as batch_op:
        batch_op.alter_column('quantity',
                              existing_type=sa.Integer(),
                              type_=sa.Float(),
                              existing_nullable=True)
        batch_op.alter_column('qty_pending',
                              existing_type=sa.Integer(),
                              type_=sa.Float(),
                              existing_nullable=True)
        batch_op.alter_column('qty_fulfilled',
                              existing_type=sa.Integer(),
                              type_=sa.Float(),
                              existing_nullable=True)

    # Convert po_line_items.quantity back to Float
    with op.batch_alter_table('po_line_items', schema=None) as batch_op:
        batch_op.alter_column('quantity',
                              existing_type=sa.Integer(),
                              type_=sa.Float(),
                              existing_nullable=True)

    # Convert invoice_line_items columns back to Float
    with op.batch_alter_table('invoice_line_items', schema=None) as batch_op:
        batch_op.alter_column('qty_ordered',
                              existing_type=sa.Integer(),
                              type_=sa.Float(),
                              existing_nullable=True)
        batch_op.alter_column('qty_fulfilled_this_invoice',
                              existing_type=sa.Integer(),
                              type_=sa.Float(),
                              existing_nullable=True)
        batch_op.alter_column('qty_fulfilled_total',
                              existing_type=sa.Integer(),
                              type_=sa.Float(),
                              existing_nullable=True)
        batch_op.alter_column('qty_pending_after',
                              existing_type=sa.Integer(),
                              type_=sa.Float(),
                              existing_nullable=True)

    # Convert quote_line_item_snapshots columns back to Float
    with op.batch_alter_table('quote_line_item_snapshots', schema=None) as batch_op:
        batch_op.alter_column('quantity',
                              existing_type=sa.Integer(),
                              type_=sa.Float(),
                              existing_nullable=True)
        batch_op.alter_column('qty_pending',
                              existing_type=sa.Integer(),
                              type_=sa.Float(),
                              existing_nullable=True)
        batch_op.alter_column('qty_fulfilled',
                              existing_type=sa.Integer(),
                              type_=sa.Float(),
                              existing_nullable=True)

    print("[REVERTED] All quantity columns converted back to Float type")
