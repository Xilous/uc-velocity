from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List

from database import get_db
from models import PurchaseOrder, POLineItem, Project, Profile, ProfileType, Part
from schemas import (
    PurchaseOrderCreate, PurchaseOrder as PurchaseOrderSchema,
    POLineItemCreate, POLineItem as POLineItemSchema
)

router = APIRouter(prefix="/purchase-orders", tags=["purchase-orders"])


@router.get("/", response_model=List[PurchaseOrderSchema])
def get_all_purchase_orders(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Get all purchase orders."""
    pos = (
        db.query(PurchaseOrder)
        .options(
            joinedload(PurchaseOrder.vendor),
            joinedload(PurchaseOrder.line_items)
        )
        .offset(skip)
        .limit(limit)
        .all()
    )
    return pos


@router.get("/{po_id}", response_model=PurchaseOrderSchema)
def get_purchase_order(po_id: int, db: Session = Depends(get_db)):
    """Get a single purchase order with line items."""
    po = (
        db.query(PurchaseOrder)
        .options(
            joinedload(PurchaseOrder.vendor),
            joinedload(PurchaseOrder.line_items).joinedload(POLineItem.part)
        )
        .filter(PurchaseOrder.id == po_id)
        .first()
    )
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    return po


@router.post("/", response_model=PurchaseOrderSchema)
def create_purchase_order(po_data: PurchaseOrderCreate, db: Session = Depends(get_db)):
    """Create a new purchase order for a project."""
    # Verify project exists
    project = db.query(Project).filter(Project.id == po_data.project_id).first()
    if not project:
        raise HTTPException(status_code=400, detail="Project not found")

    # Verify vendor exists and is of type VENDOR
    vendor = db.query(Profile).filter(Profile.id == po_data.vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=400, detail="Vendor not found")
    if vendor.type != ProfileType.vendor:
        raise HTTPException(status_code=400, detail="Profile must be of type 'vendor'")

    db_po = PurchaseOrder(
        project_id=po_data.project_id,
        vendor_id=po_data.vendor_id,
        status=po_data.status
    )
    db.add(db_po)
    db.commit()
    db.refresh(db_po)

    # Reload with vendor relationship
    db_po = (
        db.query(PurchaseOrder)
        .options(joinedload(PurchaseOrder.vendor))
        .filter(PurchaseOrder.id == db_po.id)
        .first()
    )
    return db_po


@router.put("/{po_id}", response_model=PurchaseOrderSchema)
def update_purchase_order(po_id: int, status: str, db: Session = Depends(get_db)):
    """Update purchase order status."""
    db_po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not db_po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    db_po.status = status
    db.commit()
    db.refresh(db_po)

    # Reload with vendor relationship
    db_po = (
        db.query(PurchaseOrder)
        .options(joinedload(PurchaseOrder.vendor))
        .filter(PurchaseOrder.id == db_po.id)
        .first()
    )
    return db_po


@router.delete("/{po_id}")
def delete_purchase_order(po_id: int, db: Session = Depends(get_db)):
    """Delete a purchase order and all its line items."""
    db_po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not db_po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    db.delete(db_po)
    db.commit()
    return {"message": "Purchase order deleted successfully"}


# ==================== Line Items ====================
# IMPORTANT: PO line items can only be "part" or "misc", NEVER "labor"

@router.get("/{po_id}/lines", response_model=List[POLineItemSchema])
def get_po_lines(po_id: int, db: Session = Depends(get_db)):
    """Get all line items for a purchase order."""
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    lines = (
        db.query(POLineItem)
        .options(joinedload(POLineItem.part))
        .filter(POLineItem.purchase_order_id == po_id)
        .all()
    )
    return lines


@router.post("/{po_id}/lines", response_model=POLineItemSchema)
def add_po_line(po_id: int, line_data: POLineItemCreate, db: Session = Depends(get_db)):
    """
    Add a line item to a purchase order.

    IMPORTANT: Purchase orders can only have 'part' or 'misc' line items.
    Labor items are NOT allowed on purchase orders.
    """
    # Verify PO exists
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    # CRITICAL: Validate item_type - NO LABOR ALLOWED
    if line_data.item_type not in ["part", "misc"]:
        raise HTTPException(
            status_code=400,
            detail="Purchase order line items must be 'part' or 'misc'. Labor items are not allowed on purchase orders."
        )

    # Validate references based on item_type
    if line_data.item_type == "part":
        if not line_data.part_id:
            raise HTTPException(status_code=400, detail="part_id required for part line items")
        part = db.query(Part).filter(Part.id == line_data.part_id).first()
        if not part:
            raise HTTPException(status_code=400, detail="Part not found")

    elif line_data.item_type == "misc":
        if not line_data.description:
            raise HTTPException(status_code=400, detail="description required for misc line items")

    db_line = POLineItem(
        purchase_order_id=po_id,
        item_type=line_data.item_type,
        part_id=line_data.part_id,
        description=line_data.description,
        quantity=line_data.quantity,
        unit_price=line_data.unit_price
    )
    db.add(db_line)
    db.commit()
    db.refresh(db_line)
    return db_line


@router.put("/{po_id}/lines/{line_id}", response_model=POLineItemSchema)
def update_po_line(
    po_id: int,
    line_id: int,
    line_data: POLineItemCreate,
    db: Session = Depends(get_db)
):
    """Update a purchase order line item."""
    db_line = (
        db.query(POLineItem)
        .filter(POLineItem.id == line_id, POLineItem.purchase_order_id == po_id)
        .first()
    )
    if not db_line:
        raise HTTPException(status_code=404, detail="Line item not found")

    # CRITICAL: Validate item_type - NO LABOR ALLOWED
    if line_data.item_type not in ["part", "misc"]:
        raise HTTPException(
            status_code=400,
            detail="Purchase order line items must be 'part' or 'misc'. Labor items are not allowed."
        )

    db_line.item_type = line_data.item_type
    db_line.part_id = line_data.part_id
    db_line.description = line_data.description
    db_line.quantity = line_data.quantity
    db_line.unit_price = line_data.unit_price

    db.commit()
    db.refresh(db_line)
    return db_line


@router.delete("/{po_id}/lines/{line_id}")
def delete_po_line(po_id: int, line_id: int, db: Session = Depends(get_db)):
    """Delete a line item from a purchase order."""
    db_line = (
        db.query(POLineItem)
        .filter(POLineItem.id == line_id, POLineItem.purchase_order_id == po_id)
        .first()
    )
    if not db_line:
        raise HTTPException(status_code=404, detail="Line item not found")

    db.delete(db_line)
    db.commit()
    return {"message": "Line item deleted successfully"}
