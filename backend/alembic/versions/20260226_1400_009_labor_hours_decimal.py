"""Convert labor.hours from Integer to Float for decimal hours

Labor hours genuinely need fractional values (1.5 hrs, 0.25 hrs, etc.)
while the original migration 003 converted all quantities to integers.
This restores float support specifically for labor hours.

Revision ID: 009_labor_hours_decimal
Revises: 008_add_cost_codes
Create Date: 2026-02-26
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '009_labor_hours_decimal'
down_revision = '008_add_cost_codes'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    # Convert hours column from Integer to Float (Double Precision)
    # Existing integer values are losslessly promoted (1 -> 1.0)
    conn.execute(sa.text(
        "ALTER TABLE labor ALTER COLUMN hours TYPE DOUBLE PRECISION USING hours::DOUBLE PRECISION"
    ))


def downgrade():
    conn = op.get_bind()
    # Round any fractional values before converting back to Integer
    conn.execute(sa.text(
        "UPDATE labor SET hours = ROUND(hours) WHERE hours != ROUND(hours)"
    ))
    conn.execute(sa.text(
        "ALTER TABLE labor ALTER COLUMN hours TYPE INTEGER USING hours::INTEGER"
    ))
