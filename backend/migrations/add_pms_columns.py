"""
Migration: Add PMS (Project Management Services) columns to quote_line_items and quote_line_item_snapshots tables.

Run this script to add the new columns for the PMS feature:
    cd backend
    python migrations/add_pms_columns.py
"""

import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("ERROR: DATABASE_URL environment variable is required.")
    print("Make sure you have a .env file with the DATABASE_URL set.")
    sys.exit(1)

print(f"Connecting to database...")

engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    # Check if columns already exist in quote_line_items
    result = conn.execute(text("""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'quote_line_items'
    """))
    existing_columns = [row[0] for row in result]
    print(f"Existing columns in quote_line_items: {existing_columns}")

    # Add is_pms column if it doesn't exist
    if 'is_pms' not in existing_columns:
        conn.execute(text("""
            ALTER TABLE quote_line_items
            ADD COLUMN is_pms BOOLEAN DEFAULT FALSE
        """))
        print("Added is_pms column to quote_line_items")
    else:
        print("is_pms column already exists in quote_line_items")

    # Add pms_percent column if it doesn't exist
    if 'pms_percent' not in existing_columns:
        conn.execute(text("""
            ALTER TABLE quote_line_items
            ADD COLUMN pms_percent FLOAT
        """))
        print("Added pms_percent column to quote_line_items")
    else:
        print("pms_percent column already exists in quote_line_items")

    # Check if columns already exist in quote_line_item_snapshots
    result = conn.execute(text("""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'quote_line_item_snapshots'
    """))
    snapshot_columns = [row[0] for row in result]
    print(f"Existing columns in quote_line_item_snapshots: {snapshot_columns}")

    # Add is_pms column if it doesn't exist
    if 'is_pms' not in snapshot_columns:
        conn.execute(text("""
            ALTER TABLE quote_line_item_snapshots
            ADD COLUMN is_pms BOOLEAN DEFAULT FALSE
        """))
        print("Added is_pms column to quote_line_item_snapshots")
    else:
        print("is_pms column already exists in quote_line_item_snapshots")

    # Add pms_percent column if it doesn't exist
    if 'pms_percent' not in snapshot_columns:
        conn.execute(text("""
            ALTER TABLE quote_line_item_snapshots
            ADD COLUMN pms_percent FLOAT
        """))
        print("Added pms_percent column to quote_line_item_snapshots")
    else:
        print("pms_percent column already exists in quote_line_item_snapshots")

    conn.commit()

print("\nMigration complete!")
