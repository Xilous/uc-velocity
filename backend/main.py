import os
from pathlib import Path

# Load environment variables from .env file (for local development)
from dotenv import load_dotenv
env_path = Path(__file__).parent / ".env"
if env_path.exists():
    load_dotenv(env_path)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base, SessionLocal
from routes import parts, labor, profiles, projects, quotes, purchase_orders, discount_codes, miscellaneous, invoices
from migrations import run_migrations
from seed import seed_system_items

# Create all database tables
Base.metadata.create_all(bind=engine)

# Run migrations and seed system items on startup
def init_db():
    db = SessionLocal()
    try:
        # Run any pending migrations first
        run_migrations(db)
        # Then seed system items
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
