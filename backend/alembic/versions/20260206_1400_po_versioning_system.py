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


def upgrade():
    # Step 2.1: Delete Existing Test Data
    op.execute('DELETE FROM po_line_items')
    op.execute('DELETE FROM purchase_orders')
    print("[CLEANUP] Deleted existing test PO data")

    # Step 2.2: Create POStatus Enum
    postatus_enum = sa.Enum('Draft', 'Sent', 'Received', 'Closed', name='postatus', create_type=True)
    postatus_enum.create(op.get_bind(), checkfirst=True)

    # Step 2.3: Create New Tables

    # Create po_snapshots table (without receiving_id FK initially)
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

    # Create po_line_item_snapshots table
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

    # Create po_receivings table
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

    # Create po_receiving_line_items table
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

    # Step 2.4: Add Foreign Key for receiving_id in po_snapshots
    op.create_foreign_key(
        'fk_po_snapshots_receiving_id',
        'po_snapshots',
        'po_receivings',
        ['receiving_id'],
        ['id']
    )

    # Step 2.5: Alter purchase_orders Table
    op.add_column('purchase_orders', sa.Column('po_sequence', sa.Integer(), nullable=True))
    op.add_column('purchase_orders', sa.Column('current_version', sa.Integer(), server_default='0', nullable=False))
    op.add_column('purchase_orders', sa.Column('work_description', sa.String(), nullable=True))
    op.add_column('purchase_orders', sa.Column('vendor_po_number', sa.String(), nullable=True))
    op.add_column('purchase_orders', sa.Column('expected_delivery_date', sa.DateTime(), nullable=True))

    # Alter status column from String to Enum
    op.alter_column(
        'purchase_orders',
        'status',
        type_=sa.Enum('Draft', 'Sent', 'Received', 'Closed', name='postatus'),
        server_default='Draft',
        postgresql_using='status::postatus'
    )

    # Step 2.6: Make po_sequence Non-Nullable
    op.alter_column('purchase_orders', 'po_sequence', nullable=False)

    # Step 2.7: Add Unique Constraint
    op.create_unique_constraint(
        'uq_po_project_sequence',
        'purchase_orders',
        ['project_id', 'po_sequence']
    )

    # Step 2.8: Alter po_line_items Table
    op.add_column('po_line_items', sa.Column('qty_pending', sa.Integer(), server_default='0', nullable=False))
    op.add_column('po_line_items', sa.Column('qty_received', sa.Integer(), server_default='0', nullable=False))
    op.add_column('po_line_items', sa.Column('actual_unit_price', sa.Float(), nullable=True))

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
