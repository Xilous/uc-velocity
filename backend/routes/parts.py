from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List

from database import get_db
from models import Part, Labor
from schemas import PartCreate, PartUpdate, Part as PartSchema, PartWithLabor

router = APIRouter(prefix="/parts", tags=["parts"])


@router.get("/", response_model=List[PartWithLabor])
def get_all_parts(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Get all parts with their linked labor items."""
    parts = (
        db.query(Part)
        .options(joinedload(Part.labor_items))
        .offset(skip)
        .limit(limit)
        .all()
    )
    return parts


@router.get("/{part_id}", response_model=PartWithLabor)
def get_part(part_id: int, db: Session = Depends(get_db)):
    """Get a single part by ID with linked labor items."""
    part = (
        db.query(Part)
        .options(joinedload(Part.labor_items))
        .filter(Part.id == part_id)
        .first()
    )
    if not part:
        raise HTTPException(status_code=404, detail="Part not found")
    return part


@router.post("/", response_model=PartWithLabor)
def create_part(part_data: PartCreate, db: Session = Depends(get_db)):
    """Create a new part with optional labor linking."""
    # Check for duplicate part number
    existing = db.query(Part).filter(Part.part_number == part_data.part_number).first()
    if existing:
        raise HTTPException(status_code=400, detail="Part number already exists")

    # Validate all labor IDs exist BEFORE creating part
    labor_to_link = []
    if part_data.linked_labor_ids:
        labor_to_link = db.query(Labor).filter(
            Labor.id.in_(part_data.linked_labor_ids)
        ).all()

        # Verify all requested labor items were found
        found_ids = {l.id for l in labor_to_link}
        missing_ids = set(part_data.linked_labor_ids) - found_ids
        if missing_ids:
            raise HTTPException(
                status_code=400,
                detail=f"Labor items not found: {list(missing_ids)}"
            )

    # Round markup_percent to 2 decimal places
    formatted_markup = round(part_data.markup_percent, 2) if part_data.markup_percent else 0.0

    db_part = Part(
        part_number=part_data.part_number,
        description=part_data.description,
        cost=part_data.cost,
        markup_percent=formatted_markup,
        category_id=part_data.category_id
    )

    # Link the labor items
    db_part.labor_items = labor_to_link

    db.add(db_part)
    db.commit()
    db.refresh(db_part)
    return db_part


@router.put("/{part_id}", response_model=PartWithLabor)
def update_part(part_id: int, part_data: PartUpdate, db: Session = Depends(get_db)):
    """Update an existing part and its labor links."""
    db_part = db.query(Part).filter(Part.id == part_id).first()
    if not db_part:
        raise HTTPException(status_code=404, detail="Part not found")

    # Update fields if provided
    if part_data.part_number is not None:
        # Check for duplicate part number
        existing = db.query(Part).filter(
            Part.part_number == part_data.part_number,
            Part.id != part_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Part number already exists")
        db_part.part_number = part_data.part_number

    if part_data.description is not None:
        db_part.description = part_data.description
    if part_data.cost is not None:
        db_part.cost = part_data.cost
    if part_data.markup_percent is not None:
        db_part.markup_percent = round(part_data.markup_percent, 2)
    if part_data.category_id is not None:
        db_part.category_id = part_data.category_id

    # Update labor links if provided
    if part_data.linked_labor_ids is not None:
        if part_data.linked_labor_ids:
            labor_to_link = db.query(Labor).filter(
                Labor.id.in_(part_data.linked_labor_ids)
            ).all()

            # Verify all requested labor items were found
            found_ids = {l.id for l in labor_to_link}
            missing_ids = set(part_data.linked_labor_ids) - found_ids
            if missing_ids:
                raise HTTPException(
                    status_code=400,
                    detail=f"Labor items not found: {list(missing_ids)}"
                )
            db_part.labor_items = labor_to_link
        else:
            db_part.labor_items = []

    db.commit()
    db.refresh(db_part)
    return db_part


@router.delete("/{part_id}")
def delete_part(part_id: int, db: Session = Depends(get_db)):
    """Delete a part."""
    db_part = db.query(Part).filter(Part.id == part_id).first()
    if not db_part:
        raise HTTPException(status_code=404, detail="Part not found")

    db.delete(db_part)
    db.commit()
    return {"message": "Part deleted successfully"}
