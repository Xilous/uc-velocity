from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import DiscountCode, QuoteLineItem, Quote
from schemas import (
    DiscountCodeCreate, DiscountCodeUpdate, DiscountCode as DiscountCodeSchema
)

router = APIRouter(prefix="/discount-codes", tags=["discount-codes"])


@router.get("/", response_model=List[DiscountCodeSchema])
def get_all_discount_codes(
    include_archived: bool = False,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get all discount codes with optional archived filter."""
    query = db.query(DiscountCode)
    if not include_archived:
        query = query.filter(DiscountCode.is_archived == False)
    discount_codes = query.offset(skip).limit(limit).all()
    return discount_codes


@router.get("/{discount_code_id}", response_model=DiscountCodeSchema)
def get_discount_code(discount_code_id: int, db: Session = Depends(get_db)):
    """Get a single discount code by ID."""
    discount_code = db.query(DiscountCode).filter(DiscountCode.id == discount_code_id).first()
    if not discount_code:
        raise HTTPException(status_code=404, detail="Discount code not found")
    return discount_code


@router.post("/", response_model=DiscountCodeSchema)
def create_discount_code(data: DiscountCodeCreate, db: Session = Depends(get_db)):
    """Create a new discount code."""
    # Validate code length (max 10 chars)
    if len(data.code) > 10:
        raise HTTPException(status_code=400, detail="Discount code must be 10 characters or less")

    # Check for duplicate code
    existing = db.query(DiscountCode).filter(DiscountCode.code == data.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Discount code already exists")

    # Format discount_percent to 2 decimal places
    formatted_percent = round(data.discount_percent, 2)

    db_discount_code = DiscountCode(
        code=data.code,
        discount_percent=formatted_percent,
        is_archived=False
    )
    db.add(db_discount_code)
    db.commit()
    db.refresh(db_discount_code)
    return db_discount_code


@router.put("/{discount_code_id}", response_model=DiscountCodeSchema)
def update_discount_code(
    discount_code_id: int,
    data: DiscountCodeUpdate,
    db: Session = Depends(get_db)
):
    """Update a discount code."""
    db_discount_code = db.query(DiscountCode).filter(DiscountCode.id == discount_code_id).first()
    if not db_discount_code:
        raise HTTPException(status_code=404, detail="Discount code not found")

    if data.code is not None:
        # Validate code length
        if len(data.code) > 10:
            raise HTTPException(status_code=400, detail="Discount code must be 10 characters or less")
        # Check for duplicate
        existing = db.query(DiscountCode).filter(
            DiscountCode.code == data.code,
            DiscountCode.id != discount_code_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Discount code already exists")
        db_discount_code.code = data.code

    if data.discount_percent is not None:
        db_discount_code.discount_percent = round(data.discount_percent, 2)

    if data.is_archived is not None:
        # If trying to archive, check if used in active quotes
        if data.is_archived:
            active_usage = (
                db.query(QuoteLineItem)
                .join(Quote)
                .filter(
                    QuoteLineItem.discount_code_id == discount_code_id,
                    Quote.status == "Active"
                )
                .first()
            )
            if active_usage:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot archive discount code: it is used in active quotes"
                )
        db_discount_code.is_archived = data.is_archived

    db.commit()
    db.refresh(db_discount_code)
    return db_discount_code


@router.put("/{discount_code_id}/archive", response_model=DiscountCodeSchema)
def archive_discount_code(discount_code_id: int, db: Session = Depends(get_db)):
    """Archive a discount code (cannot be used in new line items)."""
    db_discount_code = db.query(DiscountCode).filter(DiscountCode.id == discount_code_id).first()
    if not db_discount_code:
        raise HTTPException(status_code=404, detail="Discount code not found")

    # Check if used in active quotes
    active_usage = (
        db.query(QuoteLineItem)
        .join(Quote)
        .filter(
            QuoteLineItem.discount_code_id == discount_code_id,
            Quote.status == "Active"
        )
        .first()
    )
    if active_usage:
        raise HTTPException(
            status_code=400,
            detail="Cannot archive discount code: it is used in active quotes"
        )

    db_discount_code.is_archived = True
    db.commit()
    db.refresh(db_discount_code)
    return db_discount_code


@router.delete("/{discount_code_id}")
def delete_discount_code(discount_code_id: int, db: Session = Depends(get_db)):
    """Delete a discount code (only if never used)."""
    db_discount_code = db.query(DiscountCode).filter(DiscountCode.id == discount_code_id).first()
    if not db_discount_code:
        raise HTTPException(status_code=404, detail="Discount code not found")

    # Check if ever used in any quote
    usage = db.query(QuoteLineItem).filter(
        QuoteLineItem.discount_code_id == discount_code_id
    ).first()
    if usage:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete discount code: it has been used in quotes. Archive it instead."
        )

    db.delete(db_discount_code)
    db.commit()
    return {"message": "Discount code deleted successfully"}
