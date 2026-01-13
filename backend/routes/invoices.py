from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from datetime import datetime

from database import get_db
from models import (
    Quote, QuoteLineItem, Invoice, InvoiceLineItem,
    QuoteSnapshot, QuoteLineItemSnapshot, Labor, Part, Miscellaneous
)
from schemas import (
    Invoice as InvoiceSchema,
    InvoiceCreate,
    InvoiceStatusUpdate,
    LineItemFulfillment
)

router = APIRouter(prefix="/invoices", tags=["invoices"])


def get_line_item_description_for_invoice(item: QuoteLineItem, db: Session) -> str:
    """Get a human-readable description for a line item."""
    if item.item_type == "labor" and item.labor_id:
        labor = db.query(Labor).filter(Labor.id == item.labor_id).first()
        return labor.description if labor else "Labor"
    elif item.item_type == "part" and item.part_id:
        part = db.query(Part).filter(Part.id == item.part_id).first()
        return part.part_number if part else "Part"
    elif item.item_type == "misc":
        if item.misc_id:
            misc = db.query(Miscellaneous).filter(Miscellaneous.id == item.misc_id).first()
            return misc.description if misc else "Misc"
        return item.description or "Misc"
    return "Unknown item"


@router.get("/{invoice_id}", response_model=InvoiceSchema)
def get_invoice(invoice_id: int, db: Session = Depends(get_db)):
    """Get a single invoice with all line items."""
    invoice = (
        db.query(Invoice)
        .options(joinedload(Invoice.line_items))
        .filter(Invoice.id == invoice_id)
        .first()
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


@router.put("/{invoice_id}", response_model=InvoiceSchema)
def update_invoice_status(
    invoice_id: int,
    status_update: InvoiceStatusUpdate,
    db: Session = Depends(get_db)
):
    """Update invoice status (Sent → Paid only). Cannot change Voided invoices."""
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    # Cannot modify voided invoices
    if invoice.status == "Voided":
        raise HTTPException(status_code=400, detail="Cannot modify voided invoices")

    # Validate status transition
    valid_statuses = ["Sent", "Paid"]
    if status_update.status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Status must be one of: {', '.join(valid_statuses)}"
        )

    # Can only go from Sent → Paid
    if invoice.status == "Paid" and status_update.status == "Sent":
        raise HTTPException(status_code=400, detail="Cannot change status from Paid to Sent")

    invoice.status = status_update.status
    db.commit()
    db.refresh(invoice)

    # Reload with relationships
    invoice = (
        db.query(Invoice)
        .options(joinedload(Invoice.line_items))
        .filter(Invoice.id == invoice_id)
        .first()
    )
    return invoice


# Invoice creation endpoint on quotes router (will be added to quotes.py)
# POST /quotes/{quote_id}/invoices - handled in quotes.py
