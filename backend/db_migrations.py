"""Database migrations for UC Velocity ERP.

This module handles schema migrations that need to run on startup.
Migrations are idempotent - they check if they've already been applied.
"""
from sqlalchemy import text, inspect
from sqlalchemy.orm import Session


def run_migrations(db: Session) -> None:
    """Run all pending migrations."""
    migrate_miscellaneous_schema(db)


def migrate_miscellaneous_schema(db: Session) -> None:
    """Migrate miscellaneous table: remove hours, rename rate to unit_price, add is_system_item.

    This migration:
    1. Adds unit_price column (if not exists)
    2. Copies rate values to unit_price (if rate exists)
    3. Adds is_system_item column (if not exists)
    4. Drops hours column (if exists)
    5. Drops rate column (if exists)
    """
    # Get database inspector to check column existence
    inspector = inspect(db.get_bind())
    columns = {col['name'] for col in inspector.get_columns('miscellaneous')}

    # Check if migration is needed
    has_rate = 'rate' in columns
    has_hours = 'hours' in columns
    has_unit_price = 'unit_price' in columns
    has_is_system_item = 'is_system_item' in columns

    # If already migrated, skip
    if has_unit_price and has_is_system_item and not has_rate and not has_hours:
        print("Migration: miscellaneous table already migrated, skipping.")
        return

    print("Migration: Updating miscellaneous table schema...")

    # Step 1: Add unit_price column if it doesn't exist
    if not has_unit_price:
        print("  - Adding unit_price column...")
        db.execute(text("ALTER TABLE miscellaneous ADD COLUMN unit_price FLOAT"))
        db.commit()

    # Step 2: Copy rate to unit_price if rate exists
    if has_rate:
        print("  - Copying rate values to unit_price...")
        db.execute(text("UPDATE miscellaneous SET unit_price = rate WHERE unit_price IS NULL"))
        db.commit()

    # Step 3: Set default for unit_price if any nulls remain
    db.execute(text("UPDATE miscellaneous SET unit_price = 0 WHERE unit_price IS NULL"))
    db.commit()

    # Step 4: Add is_system_item column if it doesn't exist
    if not has_is_system_item:
        print("  - Adding is_system_item column...")
        db.execute(text("ALTER TABLE miscellaneous ADD COLUMN is_system_item BOOLEAN DEFAULT FALSE"))
        db.commit()

    # Step 5: Drop hours column if it exists
    if has_hours:
        print("  - Dropping hours column...")
        db.execute(text("ALTER TABLE miscellaneous DROP COLUMN hours"))
        db.commit()

    # Step 6: Drop rate column if it exists
    if has_rate:
        print("  - Dropping rate column...")
        db.execute(text("ALTER TABLE miscellaneous DROP COLUMN rate"))
        db.commit()

    print("Migration: miscellaneous table schema updated successfully.")
