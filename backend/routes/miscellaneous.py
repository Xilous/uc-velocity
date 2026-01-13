from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import Miscellaneous
from schemas import (
    MiscellaneousCreate, MiscellaneousUpdate, Miscellaneous as MiscellaneousSchema
)

router = APIRouter(prefix="/misc", tags=["miscellaneous"])


@router.get("/", response_model=List[MiscellaneousSchema])
def get_all_miscellaneous(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Get all miscellaneous items with pagination."""
    misc_items = db.query(Miscellaneous).offset(skip).limit(limit).all()
    return misc_items


@router.get("/{misc_id}", response_model=MiscellaneousSchema)
def get_miscellaneous(misc_id: int, db: Session = Depends(get_db)):
    """Get a single miscellaneous item by ID."""
    misc = db.query(Miscellaneous).filter(Miscellaneous.id == misc_id).first()
    if not misc:
        raise HTTPException(status_code=404, detail="Miscellaneous item not found")
    return misc


@router.post("/", response_model=MiscellaneousSchema)
def create_miscellaneous(misc_data: MiscellaneousCreate, db: Session = Depends(get_db)):
    """Create a new miscellaneous item."""
    # Round markup_percent to 2 decimal places
    formatted_markup = round(misc_data.markup_percent, 2)

    db_misc = Miscellaneous(
        description=misc_data.description,
        hours=misc_data.hours,
        rate=misc_data.rate,
        markup_percent=formatted_markup,
        category_id=misc_data.category_id
    )
    db.add(db_misc)
    db.commit()
    db.refresh(db_misc)
    return db_misc


@router.put("/{misc_id}", response_model=MiscellaneousSchema)
def update_miscellaneous(
    misc_id: int,
    misc_data: MiscellaneousUpdate,
    db: Session = Depends(get_db)
):
    """Update a miscellaneous item."""
    db_misc = db.query(Miscellaneous).filter(Miscellaneous.id == misc_id).first()
    if not db_misc:
        raise HTTPException(status_code=404, detail="Miscellaneous item not found")

    if misc_data.description is not None:
        db_misc.description = misc_data.description
    if misc_data.hours is not None:
        db_misc.hours = misc_data.hours
    if misc_data.rate is not None:
        db_misc.rate = misc_data.rate
    if misc_data.markup_percent is not None:
        db_misc.markup_percent = round(misc_data.markup_percent, 2)
    if misc_data.category_id is not None:
        db_misc.category_id = misc_data.category_id

    db.commit()
    db.refresh(db_misc)
    return db_misc


@router.delete("/{misc_id}")
def delete_miscellaneous(misc_id: int, db: Session = Depends(get_db)):
    """Delete a miscellaneous item."""
    db_misc = db.query(Miscellaneous).filter(Miscellaneous.id == misc_id).first()
    if not db_misc:
        raise HTTPException(status_code=404, detail="Miscellaneous item not found")

    db.delete(db_misc)
    db.commit()
    return {"message": "Miscellaneous item deleted successfully"}
