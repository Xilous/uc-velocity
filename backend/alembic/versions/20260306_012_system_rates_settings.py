"""Add system_rates table and default_pms_percent to company_settings

Moves system inventory items (parking, travel distance) into a dedicated
system_rates table for user-configurable management via Settings UI.
Shadow records in miscellaneous are preserved for FK backward compatibility.

Revision ID: 012_system_rates_settings
Revises: 011_nullable_cost_code
Create Date: 2026-03-06
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '012_system_rates_settings'
down_revision = '011_nullable_cost_code'
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


# Map descriptions to (rate_type, sort_order)
SYSTEM_ITEM_MAP = {
    "Parking (1 Hour)": ("parking", 0),
    "Travel Distance (40km) (1 Day)": ("travel_distance", 1),
    "Travel Distance (60km) (1 Day)": ("travel_distance", 2),
    "Travel Distance (80km) (1 Day)": ("travel_distance", 3),
    "Travel Distance (120km) (1 Day)": ("travel_distance", 4),
    "Travel Distance (180km) (1 Day)": ("travel_distance", 5),
    "Travel Distance (260km) (1 Day)": ("travel_distance", 6),
    "Unlimited Travel Distance (1 Day)": ("travel_distance", 7),
}


def upgrade() -> None:
    # 1. Create system_rates table
    if not _table_exists('system_rates'):
        op.create_table(
            'system_rates',
            sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
            sa.Column('rate_type', sa.String, nullable=False),
            sa.Column('description', sa.String, nullable=False),
            sa.Column('unit_price', sa.Float, nullable=False),
            sa.Column('markup_percent', sa.Float, nullable=False, server_default='0.0'),
            sa.Column('sort_order', sa.Integer, nullable=False, server_default='0'),
            sa.Column('is_active', sa.Boolean, nullable=False, server_default='true'),
            sa.Column('linked_misc_id', sa.Integer, sa.ForeignKey('miscellaneous.id'), nullable=True),
        )

    # 2. Add default_pms_percent to company_settings
    if not _column_exists('company_settings', 'default_pms_percent'):
        op.add_column('company_settings', sa.Column('default_pms_percent', sa.Float, nullable=True))

    # 3. Data migration: copy system misc items → system_rates
    conn = op.get_bind()

    # Check if system_rates already has data (idempotent)
    count = conn.execute(sa.text("SELECT COUNT(*) FROM system_rates")).scalar()
    if count == 0:
        # Read existing system misc items
        rows = conn.execute(sa.text(
            "SELECT id, description, unit_price, markup_percent "
            "FROM miscellaneous WHERE is_system_item = true"
        )).fetchall()

        for row in rows:
            misc_id, description, unit_price, markup_percent = row
            mapping = SYSTEM_ITEM_MAP.get(description)
            if mapping:
                rate_type, sort_order = mapping
                conn.execute(sa.text(
                    "INSERT INTO system_rates (rate_type, description, unit_price, markup_percent, sort_order, is_active, linked_misc_id) "
                    "VALUES (:rate_type, :description, :unit_price, :markup_percent, :sort_order, true, :linked_misc_id)"
                ), {
                    "rate_type": rate_type,
                    "description": description,
                    "unit_price": unit_price,
                    "markup_percent": markup_percent,
                    "sort_order": sort_order,
                    "linked_misc_id": misc_id,
                })


def downgrade() -> None:
    if _table_exists('system_rates'):
        op.drop_table('system_rates')
    if _column_exists('company_settings', 'default_pms_percent'):
        op.drop_column('company_settings', 'default_pms_percent')
