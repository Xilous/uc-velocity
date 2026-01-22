"""
Database seeding for system items.
Run this at application startup to ensure system items exist.
"""
from sqlalchemy.orm import Session
from models import Miscellaneous

SYSTEM_MISC_ITEMS = [
    # Parking
    {
        "description": "Parking (1 Hour)",
        "unit_price": 20.0,
        "markup_percent": 50.0,
        "is_system_item": True
    },
    # Travel Distance items
    {
        "description": "Travel Distance (40km) (1 Day)",
        "unit_price": 160.0,
        "markup_percent": 50.0,
        "is_system_item": True
    },
    {
        "description": "Travel Distance (60km) (1 Day)",
        "unit_price": 295.0,
        "markup_percent": 88.0,
        "is_system_item": True
    },
    {
        "description": "Travel Distance (80km) (1 Day)",
        "unit_price": 365.0,
        "markup_percent": 111.0,
        "is_system_item": True
    },
    {
        "description": "Travel Distance (120km) (1 Day)",
        "unit_price": 565.0,
        "markup_percent": 170.0,
        "is_system_item": True
    },
    {
        "description": "Travel Distance (180km) (1 Day)",
        "unit_price": 750.0,
        "markup_percent": 225.0,
        "is_system_item": True
    },
    {
        "description": "Travel Distance (260km) (1 Day)",
        "unit_price": 745.0,
        "markup_percent": 224.0,
        "is_system_item": True
    },
    {
        "description": "Unlimited Travel Distance (1 Day)",
        "unit_price": 1320.0,
        "markup_percent": 396.0,
        "is_system_item": True
    },
]


def seed_system_items(db: Session) -> None:
    """
    Seed system miscellaneous items if they don't exist.
    Called at application startup.
    """
    for item_data in SYSTEM_MISC_ITEMS:
        # Check if item already exists by description
        existing = db.query(Miscellaneous).filter(
            Miscellaneous.description == item_data["description"],
            Miscellaneous.is_system_item == True
        ).first()

        if not existing:
            db_item = Miscellaneous(**item_data)
            db.add(db_item)

    db.commit()
