import os
from pathlib import Path

# Load environment variables from .env file (for local development)
from dotenv import load_dotenv
env_path = Path(__file__).parent / ".env"
if env_path.exists():
    load_dotenv(env_path)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import text
from database import engine, Base, SessionLocal
from routes import parts, labor, profiles, projects, quotes, purchase_orders, discount_codes, miscellaneous, invoices
from seed import seed_system_items


def ensure_po_columns():
    """Ensure PO versioning columns exist on existing tables.

    create_all() can create new tables but cannot ALTER existing ones.
    This runs idempotent DDL to add any missing columns before the ORM
    starts querying them.
    """
    with engine.connect() as conn:
        # purchase_orders columns
        conn.execute(text("ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS po_sequence INTEGER"))
        conn.execute(text("ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS current_version INTEGER DEFAULT 0 NOT NULL"))
        conn.execute(text("ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS work_description VARCHAR"))
        conn.execute(text("ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS vendor_po_number VARCHAR"))
        conn.execute(text("ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS expected_delivery_date TIMESTAMP"))

        # po_line_items columns
        conn.execute(text("ALTER TABLE po_line_items ADD COLUMN IF NOT EXISTS qty_pending INTEGER DEFAULT 0 NOT NULL"))
        conn.execute(text("ALTER TABLE po_line_items ADD COLUMN IF NOT EXISTS qty_received INTEGER DEFAULT 0 NOT NULL"))
        conn.execute(text("ALTER TABLE po_line_items ADD COLUMN IF NOT EXISTS actual_unit_price FLOAT"))

        # POStatus enum and status column type
        conn.execute(text("DO $$ BEGIN CREATE TYPE postatus AS ENUM ('Draft', 'Sent', 'Received', 'Closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$"))
        result = conn.execute(text(
            "SELECT udt_name FROM information_schema.columns "
            "WHERE table_name = 'purchase_orders' AND column_name = 'status'"
        ))
        row = result.fetchone()
        if row and row[0] != 'postatus':
            conn.execute(text("ALTER TABLE purchase_orders ALTER COLUMN status TYPE postatus USING status::postatus"))
            conn.execute(text("ALTER TABLE purchase_orders ALTER COLUMN status SET DEFAULT 'Draft'"))

        conn.commit()
        print("[STARTUP] PO versioning columns ensured")


# Ensure columns exist on existing tables before create_all
try:
    ensure_po_columns()
except Exception as e:
    # Table may not exist yet on fresh install — create_all will handle it
    print(f"[STARTUP] Skipped column check (fresh install?): {e}")

# Create all database tables (idempotent - safe fallback for fresh installs)
Base.metadata.create_all(bind=engine)

# Seed system items on startup
def init_db():
    db = SessionLocal()
    try:
        seed_system_items(db)
    finally:
        db.close()

init_db()

app = FastAPI(
    title="UC Velocity ERP",
    description="Enterprise Resource Planning System for managing Customers, Vendors, Inventory, and Projects",
    version="1.0.0"
)

# Get CORS origins from environment variable, with sensible defaults for local dev
default_origins = [
    "http://localhost:5173",  # Vite dev server
    "http://localhost:3000",  # Alternative dev port
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
]

cors_origins_env = os.getenv("CORS_ORIGINS", "")
if cors_origins_env:
    # Add production origins from environment variable
    additional_origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]
    allowed_origins = default_origins + additional_origins
else:
    allowed_origins = default_origins

# CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(parts.router)
app.include_router(labor.router)
app.include_router(profiles.router)
app.include_router(projects.router)
app.include_router(quotes.router)
app.include_router(purchase_orders.router)
app.include_router(discount_codes.router)
app.include_router(miscellaneous.router)
app.include_router(invoices.router)


@app.get("/")
def root():
    """Root endpoint to verify API is running."""
    return {
        "message": "UC Velocity ERP API",
        "status": "running",
        "version": "1.0.0"
    }


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}
