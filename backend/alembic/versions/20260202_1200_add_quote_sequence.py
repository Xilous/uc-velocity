"""Add quote_sequence column to quotes table

This migration adds a per-project sequence number for quotes, enabling
the new quote numbering format: {UCA Project Number}-{Sequence}-{Version}

Example: A2132-0001-0

Revision ID: 002_quote_sequence
Revises: 001_baseline
Create Date: 2026-02-02

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '002_quote_sequence'
down_revision: Union[str, None] = '001_baseline'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add quote_sequence column and populate existing quotes."""

    # 1. Add column as nullable first (allows us to populate existing rows)
    op.add_column('quotes', sa.Column('quote_sequence', sa.Integer(), nullable=True))

    # 2. Populate existing quotes with sequence numbers based on creation order within each project
    # Uses ROW_NUMBER() window function to assign 1, 2, 3... per project ordered by created_at
    op.execute("""
        UPDATE quotes
        SET quote_sequence = subquery.seq
        FROM (
            SELECT id,
                   ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at ASC, id ASC) as seq
            FROM quotes
        ) AS subquery
        WHERE quotes.id = subquery.id
    """)

    # 3. Make column non-nullable now that all rows have values
    op.alter_column('quotes', 'quote_sequence', nullable=False)

    # 4. Add unique constraint to prevent duplicate sequences within a project
    op.create_unique_constraint('uq_quote_project_sequence', 'quotes', ['project_id', 'quote_sequence'])


def downgrade() -> None:
    """Remove quote_sequence column and constraint."""
    op.drop_constraint('uq_quote_project_sequence', 'quotes', type_='unique')
    op.drop_column('quotes', 'quote_sequence')
