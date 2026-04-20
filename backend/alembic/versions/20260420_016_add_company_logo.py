"""Add logo_data_url column to company_settings

Stores the company logo as a base64 data URL (e.g. 'data:image/png;base64,...').
Nullable — when NULL the frontend falls back to the bundled default logo.

Revision ID: 016_add_company_logo
Revises: 015_fix_backfill_base_cost
Create Date: 2026-04-20
"""
from alembic import op
import sqlalchemy as sa


revision = '016_add_company_logo'
down_revision = '015_fix_backfill_base_cost'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    conn.execute(sa.text(
        "ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS logo_data_url TEXT"
    ))


def downgrade():
    op.drop_column('company_settings', 'logo_data_url')
