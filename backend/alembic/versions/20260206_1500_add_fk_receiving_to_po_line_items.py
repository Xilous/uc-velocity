"""Add foreign key from po_receiving_line_items to po_line_items

This migration adds a foreign key constraint from po_receiving_line_items.po_line_item_id
to po_line_items.id, establishing referential integrity for receiving operations.

Changes:
- Adds foreign key constraint fk_po_receiving_line_items_po_line_item_id on po_receiving_line_items(po_line_item_id) -> po_line_items(id)

Revision ID: 005_receiving_fk
Revises: 004_po_versioning
Create Date: 2026-02-06
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '005_receiving_fk'
down_revision = '004_po_versioning'
branch_labels = None
depends_on = None


def upgrade():
    # Add foreign key constraint from po_receiving_line_items to po_line_items
    op.create_foreign_key(
        'fk_po_receiving_line_items_po_line_item_id',  # constraint name
        'po_receiving_line_items',  # source table
        'po_line_items',  # referent table
        ['po_line_item_id'],  # source columns
        ['id']  # referent columns
    )
    print("[MIGRATION] Added foreign key constraint from po_receiving_line_items.po_line_item_id to po_line_items.id")


def downgrade():
    # Remove foreign key constraint
    op.drop_constraint(
        'fk_po_receiving_line_items_po_line_item_id',
        'po_receiving_line_items',
        type_='foreignkey'
    )
    print("[ROLLBACK] Removed foreign key constraint fk_po_receiving_line_items_po_line_item_id")
