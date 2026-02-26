"""Add cost_codes table and cost_code_id FK to quotes and purchase_orders

Creates a reference table for cost codes (~50 initial entries) used to classify
work by type (hardware, doors & frames, field install, etc.). Each quote and
PO gets exactly one required cost code. Existing records are backfilled to
"200-000" (Supply of Hardware Series).

Revision ID: 008_add_cost_codes
Revises: 007_add_hst_rate
Create Date: 2026-02-26
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '008_add_cost_codes'
down_revision = '007_add_hst_rate'
branch_labels = None
depends_on = None


# All cost codes to seed
COST_CODES = [
    ("100-000", "Doors & Frames Series", None, None),
    ("100-100", "Supply of Doors & Frames", None, None),
    ("100-200", "Install of Doors & Frames", None, None),
    ("100-300", "Supply & Install of Doors & Frames", None, None),
    ("200-000", "Supply of Hardware Series", None, None),
    ("200-100", "Supply of Door Hardware", None, None),
    ("200-200", "Supply of Bathroom Hardware", None, None),
    ("200-300", "Supply of Specialty Hardware", None, None),
    ("200-400", "Supply of Electronic Hardware", None, None),
    ("200-500", "Supply of Access Control Hardware", None, None),
    ("200-600", "Supply of Misc Hardware/Materials", None, None),
    ("300-000", "Field Install Series", None, None),
    ("300-100", "Field Install of Door Hardware", None, None),
    ("300-200", "Field Install of Bathroom Hardware", None, None),
    ("300-300", "Field Install of Specialty Hardware", None, None),
    ("300-400", "Field Install of Electronic Hardware", None, None),
    ("300-500", "Field Install of Access Control", None, None),
    ("300-600", "Field Install of Misc Hardware", None, None),
    ("400-000", "Supply & Install Hardware Series", None, None),
    ("400-100", "Supply & Install Door Hardware", None, None),
    ("400-200", "Supply & Install Bathroom Hardware", None, None),
    ("400-300", "Supply & Install Specialty Hardware", None, None),
    ("400-400", "Supply & Install Electronic Hardware", None, None),
    ("400-500", "Supply & Install Access Control", None, None),
    ("400-600", "Supply & Install Misc Hardware", None, None),
    ("500-000", "Service & Maintenance Series", None, None),
    ("500-100", "Service Call - Door Hardware", None, None),
    ("500-200", "Service Call - Bathroom Hardware", None, None),
    ("500-300", "Service Call - Specialty Hardware", None, None),
    ("500-400", "Service Call - Electronic Hardware", None, None),
    ("500-500", "Service Call - Access Control", None, None),
    ("500-600", "Preventive Maintenance", None, None),
    ("500-700", "Warranty Service", None, None),
    ("600-000", "Keying & Locking Series", None, None),
    ("600-100", "Keying - New Construction", None, None),
    ("600-200", "Keying - Renovation/Rekey", None, None),
    ("600-300", "Master Key System", None, None),
    ("600-400", "Key Cutting & Duplication", None, None),
    ("700-000", "Consulting & Engineering Series", None, None),
    ("700-100", "Hardware Consulting", None, None),
    ("700-200", "Specification Writing", None, None),
    ("700-300", "Security Assessment", None, None),
    ("700-400", "Project Management", None, None),
    ("800-000", "Div 10 Specialties Series", None, None),
    ("800-100", "Washroom Accessories", None, None),
    ("800-200", "Toilet Partitions", None, None),
    ("800-300", "Lockers", None, None),
    ("800-400", "Signage", None, None),
    ("900-000", "Internal / Admin Series", None, None),
    ("900-100", "Internal Transfer", None, None),
    ("900-200", "Stock Replenishment", None, None),
]


def upgrade():
    conn = op.get_bind()

    # 1. Create cost_codes table
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS cost_codes (
            id SERIAL PRIMARY KEY,
            code VARCHAR NOT NULL UNIQUE,
            description VARCHAR NOT NULL,
            gp_cost_code_properties VARCHAR,
            uch_dept_properties VARCHAR
        )
    """))

    # 2. Seed all cost codes
    for code, description, gp_props, uch_props in COST_CODES:
        conn.execute(sa.text(
            "INSERT INTO cost_codes (code, description, gp_cost_code_properties, uch_dept_properties) "
            "VALUES (:code, :description, :gp_props, :uch_props) "
            "ON CONFLICT (code) DO NOTHING"
        ), {"code": code, "description": description, "gp_props": gp_props, "uch_props": uch_props})

    # 3. Add cost_code_id to quotes (nullable first for backfill)
    conn.execute(sa.text(
        "ALTER TABLE quotes ADD COLUMN IF NOT EXISTS cost_code_id INTEGER REFERENCES cost_codes(id)"
    ))

    # 4. Add cost_code_id to purchase_orders (nullable first for backfill)
    conn.execute(sa.text(
        "ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS cost_code_id INTEGER REFERENCES cost_codes(id)"
    ))

    # 5. Backfill existing records to "200-000" (Supply of Hardware Series)
    conn.execute(sa.text(
        "UPDATE quotes SET cost_code_id = (SELECT id FROM cost_codes WHERE code = '200-000') "
        "WHERE cost_code_id IS NULL"
    ))
    conn.execute(sa.text(
        "UPDATE purchase_orders SET cost_code_id = (SELECT id FROM cost_codes WHERE code = '200-000') "
        "WHERE cost_code_id IS NULL"
    ))

    # 6. Set NOT NULL constraint
    conn.execute(sa.text("ALTER TABLE quotes ALTER COLUMN cost_code_id SET NOT NULL"))
    conn.execute(sa.text("ALTER TABLE purchase_orders ALTER COLUMN cost_code_id SET NOT NULL"))


def downgrade():
    conn = op.get_bind()

    # Drop cost_code_id from quotes and purchase_orders
    conn.execute(sa.text("ALTER TABLE quotes DROP COLUMN IF EXISTS cost_code_id"))
    conn.execute(sa.text("ALTER TABLE purchase_orders DROP COLUMN IF EXISTS cost_code_id"))

    # Drop cost_codes table
    conn.execute(sa.text("DROP TABLE IF EXISTS cost_codes"))
