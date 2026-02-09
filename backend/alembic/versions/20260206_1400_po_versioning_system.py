"""Add PO versioning and receiving system

This migration establishes the complete versioning infrastructure for Purchase Orders,
bringing them to feature parity with the Quote system.

Changes:
- Creates 4 new tables: po_snapshots, po_line_item_snapshots, po_receivings, po_receiving_line_items
- Enhances purchase_orders table with sequence, version, metadata, and status enum
- Enhances po_line_items table with fulfillment tracking (qty_pending, qty_received, actual_unit_price)
- Creates POStatus enum (Draft, Sent, Received, Closed)
- Adds unique constraint on (project_id, po_sequence)
- Deletes existing test data

NOTE: This migration is idempotent — it uses IF NOT EXISTS / IF EXISTS guards
so it can safely re-run against a partially-applied state.

Revision ID: 004_po_versioning
Revises: 003_integer_quantities
Create Date: 2026-02-06
"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime


# revision identifiers, used by Alembic.
revision = '004_po_versioning'
down_revision = '003_integer_quantities'
branch_labels = None
depends_on = None


def _table_exists(table_name):
    """Check if a table exists in the database."""
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = :name)"
    ), {"name": table_name})
    return result.scalar()


def _column_exists(table_name, column_name):
    """Check if a column exists in a table."""
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT FROM information_schema.columns "
        "WHERE table_name = :table AND column_name = :col)"
    ), {"table": table_name, "col": column_name})
    return result.scalar()


def _constraint_exists(constraint_name):
    """Check if a constraint exists."""
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT FROM information_schema.table_constraints "
        "WHERE constraint_name = :name)"
    ), {"name": constraint_name})
    return result.scalar()


def upgrade():
    conn = op.get_bind()

    # Step 2.1: Delete Existing Test Data (safe to re-run)
    op.execute('DELETE FROM po_line_items')
    op.execute('DELETE FROM purchase_orders')
    print("[CLEANUP] Deleted existing test PO data")

    # Step 2.2: Create POStatus Enum (checkfirst=True makes this idempotent)
    postatus_enum = sa.Enum('draft', 'sent', 'received', 'closed', name='postatus', create_type=True)
    postatus_enum.create(op.get_bind(), checkfirst=True)

    # Step 2.3: Create New Tables (skip if already exist from create_all fallback)

    if not _table_exists('po_snapshots'):
        op.create_table(
            'po_snapshots',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('purchase_order_id', sa.Integer(), nullable=False),
            sa.Column('version', sa.Integer(), nullable=False),
            sa.Column('action_type', sa.String(), nullable=False),
            sa.Column('action_description', sa.String(), nullable=True),
            sa.Column('created_at', sa.DateTime(), default=datetime.utcnow, nullable=True),
            sa.Column('receiving_id', sa.Integer(), nullable=True),
            sa.ForeignKeyConstraint(['purchase_order_id'], ['purchase_orders.id']),
            sa.PrimaryKeyConstraint('id')
        )
        print("[CREATED] po_snapshots table")
    else:
        print("[SKIPPED] po_snapshots table already exists")

    if not _table_exists('po_line_item_snapshots'):
        op.create_table(
            'po_line_item_snapshots',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('snapshot_id', sa.Integer(), nullable=False),
            sa.Column('original_line_item_id', sa.Integer(), nullable=True),
            sa.Column('item_type', sa.String(), nullable=False),
            sa.Column('part_id', sa.Integer(), nullable=True),
            sa.Column('description', sa.String(), nullable=True),
            sa.Column('quantity', sa.Integer(), nullable=True),
            sa.Column('unit_price', sa.Float(), nullable=True),
            sa.Column('qty_pending', sa.Integer(), nullable=True),
            sa.Column('qty_received', sa.Integer(), nullable=True),
            sa.Column('actual_unit_price', sa.Float(), nullable=True),
            sa.Column('is_deleted', sa.Boolean(), default=False, nullable=True),
            sa.ForeignKeyConstraint(['snapshot_id'], ['po_snapshots.id']),
            sa.PrimaryKeyConstraint('id')
        )
        print("[CREATED] po_line_item_snapshots table")
    else:
        print("[SKIPPED] po_line_item_snapshots table already exists")

    if not _table_exists('po_receivings'):
        op.create_table(
            'po_receivings',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('purchase_order_id', sa.Integer(), nullable=False),
            sa.Column('created_at', sa.DateTime(), default=datetime.utcnow, nullable=True),
            sa.Column('received_date', sa.DateTime(), nullable=False),
            sa.Column('notes', sa.String(), nullable=True),
            sa.Column('voided_at', sa.DateTime(), nullable=True),
            sa.Column('voided_by_snapshot_id', sa.Integer(), nullable=True),
            sa.ForeignKeyConstraint(['purchase_order_id'], ['purchase_orders.id']),
            sa.PrimaryKeyConstraint('id')
        )
        print("[CREATED] po_receivings table")
    else:
        print("[SKIPPED] po_receivings table already exists")

    if not _table_exists('po_receiving_line_items'):
        op.create_table(
            'po_receiving_line_items',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('receiving_id', sa.Integer(), nullable=False),
            sa.Column('po_line_item_id', sa.Integer(), nullable=True),
            sa.Column('item_type', sa.String(), nullable=False),
            sa.Column('description', sa.String(), nullable=True),
            sa.Column('unit_price', sa.Float(), nullable=True),
            sa.Column('actual_unit_price', sa.Float(), nullable=True),
            sa.Column('qty_ordered', sa.Integer(), nullable=True),
            sa.Column('qty_received_this_receiving', sa.Integer(), nullable=True),
            sa.Column('qty_received_total', sa.Integer(), nullable=True),
            sa.Column('qty_pending_after', sa.Integer(), nullable=True),
            sa.Column('part_id', sa.Integer(), nullable=True),
            sa.ForeignKeyConstraint(['receiving_id'], ['po_receivings.id']),
            sa.PrimaryKeyConstraint('id')
        )
        print("[CREATED] po_receiving_line_items table")
    else:
        print("[SKIPPED] po_receiving_line_items table already exists")

    # Step 2.4: Add Foreign Key for receiving_id in po_snapshots
    if not _constraint_exists('fk_po_snapshots_receiving_id'):
        op.create_foreign_key(
            'fk_po_snapshots_receiving_id',
            'po_snapshots',
            'po_receivings',
            ['receiving_id'],
            ['id']
        )
        print("[CREATED] fk_po_snapshots_receiving_id constraint")
    else:
        print("[SKIPPED] fk_po_snapshots_receiving_id constraint already exists")

    # Step 2.5: Alter purchase_orders Table (ADD COLUMN IF NOT EXISTS via raw SQL)
    conn.execute(sa.text("ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS po_sequence INTEGER"))
    conn.execute(sa.text("ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS current_version INTEGER DEFAULT 0 NOT NULL"))
    conn.execute(sa.text("ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS work_description VARCHAR"))
    conn.execute(sa.text("ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS vendor_po_number VARCHAR"))
    conn.execute(sa.text("ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS expected_delivery_date TIMESTAMP"))
    print("[COLUMNS] purchase_orders columns ensured")

    # Alter status column from String to Enum (check current type first)
    result = conn.execute(sa.text(
        "SELECT data_type, udt_name FROM information_schema.columns "
        "WHERE table_name = 'purchase_orders' AND column_name = 'status'"
    ))
    row = result.fetchone()
    if row and row[1] != 'postatus':
        op.alter_column(
            'purchase_orders',
            'status',
            type_=sa.Enum('draft', 'sent', 'received', 'closed', name='postatus'),
            server_default='draft',
            postgresql_using='status::postatus'
        )
        print("[ALTERED] purchase_orders.status to POStatus enum")
    else:
        print("[SKIPPED] purchase_orders.status already POStatus enum")

    # Step 2.6: Make po_sequence Non-Nullable (only if currently nullable)
    result = conn.execute(sa.text(
        "SELECT is_nullable FROM information_schema.columns "
        "WHERE table_name = 'purchase_orders' AND column_name = 'po_sequence'"
    ))
    row = result.fetchone()
    if row and row[0] == 'YES':
        op.alter_column('purchase_orders', 'po_sequence', nullable=False)
        print("[ALTERED] purchase_orders.po_sequence to NOT NULL")
    else:
        print("[SKIPPED] purchase_orders.po_sequence already NOT NULL")

    # Step 2.7: Add Unique Constraint
    if not _constraint_exists('uq_po_project_sequence'):
        op.create_unique_constraint(
            'uq_po_project_sequence',
            'purchase_orders',
            ['project_id', 'po_sequence']
        )
        print("[CREATED] uq_po_project_sequence constraint")
    else:
        print("[SKIPPED] uq_po_project_sequence constraint already exists")

    # Step 2.8: Alter po_line_items Table (ADD COLUMN IF NOT EXISTS)
    conn.execute(sa.text("ALTER TABLE po_line_items ADD COLUMN IF NOT EXISTS qty_pending INTEGER DEFAULT 0 NOT NULL"))
    conn.execute(sa.text("ALTER TABLE po_line_items ADD COLUMN IF NOT EXISTS qty_received INTEGER DEFAULT 0 NOT NULL"))
    conn.execute(sa.text("ALTER TABLE po_line_items ADD COLUMN IF NOT EXISTS actual_unit_price FLOAT"))
    print("[COLUMNS] po_line_items columns ensured")

    # Step 2.9: Add Success Message
    print("[SUCCESS] PO versioning system tables created and schema updated")


def downgrade():
    # Step 3.1: Drop Constraints
    op.drop_constraint('uq_po_project_sequence', 'purchase_orders', type_='unique')
    op.drop_constraint('fk_po_snapshots_receiving_id', 'po_snapshots', type_='foreignkey')

    # Step 3.2: Revert purchase_orders Columns
    op.drop_column('purchase_orders', 'expected_delivery_date')
    op.drop_column('purchase_orders', 'vendor_po_number')
    op.drop_column('purchase_orders', 'work_description')
    op.drop_column('purchase_orders', 'current_version')
    op.drop_column('purchase_orders', 'po_sequence')

    # Alter status column back to String
    op.alter_column(
        'purchase_orders',
        'status',
        type_=sa.String(),
        server_default='draft'
    )

    # Step 3.3: Revert po_line_items Columns
    op.drop_column('po_line_items', 'actual_unit_price')
    op.drop_column('po_line_items', 'qty_received')
    op.drop_column('po_line_items', 'qty_pending')

    # Step 3.4: Drop New Tables (in reverse dependency order)
    op.drop_table('po_receiving_line_items')
    op.drop_table('po_line_item_snapshots')
    op.drop_table('po_receivings')
    op.drop_table('po_snapshots')

    # Step 3.5: Drop POStatus Enum
    sa.Enum(name='postatus').drop(op.get_bind(), checkfirst=True)

    # Step 3.6: Add Revert Message
    print("[REVERTED] PO versioning system removed, schema restored to previous state")
