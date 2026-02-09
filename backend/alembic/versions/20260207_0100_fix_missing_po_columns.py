"""Fix missing PO columns from partially applied migration

The original 004_po_versioning migration was stamped as applied but the
ALTER TABLE steps that add columns to existing tables (purchase_orders,
po_line_items) were never executed. This migration ensures all required
columns exist using IF NOT EXISTS guards so it is safe to run regardless
of the current column state.

Revision ID: 006_fix_missing_po_columns
Revises: 005_receiving_fk
Create Date: 2026-02-07
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '006_fix_missing_po_columns'
down_revision = '005_receiving_fk'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    # ── purchase_orders: ensure all PO versioning columns exist ──
    conn.execute(sa.text("ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS po_sequence INTEGER"))
    conn.execute(sa.text("ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS current_version INTEGER DEFAULT 0 NOT NULL"))
    conn.execute(sa.text("ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS work_description VARCHAR"))
    conn.execute(sa.text("ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS vendor_po_number VARCHAR"))
    conn.execute(sa.text("ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS expected_delivery_date TIMESTAMP"))
    print("[006] purchase_orders columns ensured")

    # ── po_line_items: ensure fulfillment tracking columns exist ──
    conn.execute(sa.text("ALTER TABLE po_line_items ADD COLUMN IF NOT EXISTS qty_pending INTEGER DEFAULT 0 NOT NULL"))
    conn.execute(sa.text("ALTER TABLE po_line_items ADD COLUMN IF NOT EXISTS qty_received INTEGER DEFAULT 0 NOT NULL"))
    conn.execute(sa.text("ALTER TABLE po_line_items ADD COLUMN IF NOT EXISTS actual_unit_price FLOAT"))
    print("[006] po_line_items columns ensured")

    # ── POStatus enum: ensure it exists ──
    # ── POStatus enum: ensure it exists (lowercase values match SQLAlchemy member names) ──
    postatus_enum = sa.Enum('draft', 'sent', 'received', 'closed', name='postatus', create_type=True)
    postatus_enum.create(conn, checkfirst=True)

    # ── purchase_orders.status: ensure it uses the enum type ──
    result = conn.execute(sa.text(
        "SELECT data_type, udt_name FROM information_schema.columns "
        "WHERE table_name = 'purchase_orders' AND column_name = 'status'"
    ))
    row = result.fetchone()
    if row and row[1] != 'postatus':
        conn.execute(sa.text("UPDATE purchase_orders SET status = lower(status)"))
        conn.execute(sa.text(
            "ALTER TABLE purchase_orders "
            "ALTER COLUMN status TYPE postatus USING status::postatus"
        ))
        conn.execute(sa.text(
            "ALTER TABLE purchase_orders "
            "ALTER COLUMN status SET DEFAULT 'draft'::postatus"
        ))
        print("[006] purchase_orders.status converted to POStatus enum")
    else:
        print("[006] purchase_orders.status already correct")

    # ── po_sequence: ensure NOT NULL ──
    result = conn.execute(sa.text(
        "SELECT is_nullable FROM information_schema.columns "
        "WHERE table_name = 'purchase_orders' AND column_name = 'po_sequence'"
    ))
    row = result.fetchone()
    if row and row[0] == 'YES':
        # Backfill any NULL po_sequence values before adding NOT NULL
        conn.execute(sa.text(
            "UPDATE purchase_orders SET po_sequence = id WHERE po_sequence IS NULL"
        ))
        conn.execute(sa.text(
            "ALTER TABLE purchase_orders ALTER COLUMN po_sequence SET NOT NULL"
        ))
        print("[006] purchase_orders.po_sequence set to NOT NULL")
    else:
        print("[006] purchase_orders.po_sequence already NOT NULL")

    # ── Unique constraint on (project_id, po_sequence) ──
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT FROM information_schema.table_constraints "
        "WHERE constraint_name = 'uq_po_project_sequence')"
    ))
    if not result.scalar():
        op.create_unique_constraint(
            'uq_po_project_sequence',
            'purchase_orders',
            ['project_id', 'po_sequence']
        )
        print("[006] Created uq_po_project_sequence constraint")
    else:
        print("[006] uq_po_project_sequence constraint already exists")

    # ── FK from po_snapshots.receiving_id to po_receivings.id ──
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT FROM information_schema.table_constraints "
        "WHERE constraint_name = 'fk_po_snapshots_receiving_id')"
    ))
    if not result.scalar():
        op.create_foreign_key(
            'fk_po_snapshots_receiving_id',
            'po_snapshots',
            'po_receivings',
            ['receiving_id'],
            ['id']
        )
        print("[006] Created fk_po_snapshots_receiving_id")
    else:
        print("[006] fk_po_snapshots_receiving_id already exists")

    # ── FK from po_receiving_line_items.po_line_item_id to po_line_items.id ──
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT FROM information_schema.table_constraints "
        "WHERE constraint_name = 'fk_po_receiving_line_items_po_line_item_id')"
    ))
    if not result.scalar():
        op.create_foreign_key(
            'fk_po_receiving_line_items_po_line_item_id',
            'po_receiving_line_items',
            'po_line_items',
            ['po_line_item_id'],
            ['id']
        )
        print("[006] Created fk_po_receiving_line_items_po_line_item_id")
    else:
        print("[006] fk_po_receiving_line_items_po_line_item_id already exists")

    print("[006] SUCCESS — all PO columns, constraints, and enums verified")


def downgrade():
    # This is a recovery migration — downgrade is intentionally a no-op
    # since we don't know what state 004/005 left the DB in.
    pass
