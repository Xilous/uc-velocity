from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime

from database import get_db
from models import (
    PurchaseOrder, POLineItem, Project, Profile, ProfileType, Part,
    POReceiving, POReceivingLineItem, POSnapshot, POLineItemSnapshot, POStatus
)
from schemas import (
    PurchaseOrderCreate, PurchaseOrderUpdate, PurchaseOrder as PurchaseOrderSchema,
    POLineItemCreate, POLineItem as POLineItemSchema,
    POReceiving as POReceivingSchema, POReceivingCreate, POReceivingLineItemCreate,
    POReceivingLineItem as POReceivingLineItemSchema,
    POSnapshot as POSnapshotSchema, POLineItemSnapshot as POLineItemSnapshotSchema,
    PORevertPreview, POCommitEditsRequest, POCommitEditsResponse, StagedPOLineItemChange
)


def create_po_snapshot(
    db: Session,
    po: PurchaseOrder,
    action_type: str,
    action_description: str,
    receiving_id: Optional[int] = None,
    deleted_line_item: Optional[POLineItem] = None
) -> POSnapshot:
    """
    Create a snapshot of the current PO state.

    Args:
        db: Database session
        po: The purchase order to snapshot
        action_type: Type of action ("create", "edit", "delete", "receive", "status_change", "revert")
        action_description: Human-readable description of the action
        receiving_id: Optional receiving ID if action_type is "receive"
        deleted_line_item: Optional line item being deleted (marked as is_deleted=True in snapshot)

    Returns:
        The created POSnapshot
    """
    # Increment version for substantive changes only
    # Version stays unchanged for: initial creation, status changes
    # Version increments for: edit, delete, receive, revert (substantive changes)
    if action_type in ["create", "status_change"]:
        # Keep version unchanged - these don't affect PO number
        new_version = po.current_version
    else:
        # Increment version for substantive changes to line items or receivings
        new_version = po.current_version + 1
        po.current_version = new_version

    # Create the snapshot
    snapshot = POSnapshot(
        purchase_order_id=po.id,
        version=new_version,
        action_type=action_type,
        action_description=action_description,
        receiving_id=receiving_id
    )
    db.add(snapshot)
    db.flush()  # Get the snapshot ID

    # Snapshot all current line items
    line_items = (
        db.query(POLineItem)
        .filter(POLineItem.purchase_order_id == po.id)
        .all()
    )

    for item in line_items:
        # Skip the deleted line item - it will be added separately with is_deleted=True
        if deleted_line_item and item.id == deleted_line_item.id:
            continue

        item_snapshot = POLineItemSnapshot(
            snapshot_id=snapshot.id,
            original_line_item_id=item.id,
            item_type=item.item_type,
            part_id=item.part_id,
            description=item.description,
            quantity=item.quantity,
            unit_price=item.unit_price,
            qty_pending=item.qty_pending,
            qty_received=item.qty_received,
            actual_unit_price=item.actual_unit_price,
            is_deleted=False
        )
        db.add(item_snapshot)

    # If a line item is being deleted, include it in the snapshot with is_deleted=True
    if deleted_line_item:
        deleted_snapshot = POLineItemSnapshot(
            snapshot_id=snapshot.id,
            original_line_item_id=deleted_line_item.id,
            item_type=deleted_line_item.item_type,
            part_id=deleted_line_item.part_id,
            description=deleted_line_item.description,
            quantity=deleted_line_item.quantity,
            unit_price=deleted_line_item.unit_price,
            qty_pending=deleted_line_item.qty_pending,
            qty_received=deleted_line_item.qty_received,
            actual_unit_price=deleted_line_item.actual_unit_price,
            is_deleted=True
        )
        db.add(deleted_snapshot)

    return snapshot


def get_next_po_sequence(db: Session, project_id: int) -> int:
    """
    Get the next PO sequence number for a project.

    This function should be called within a transaction where the project
    row is locked (using with_for_update()) to prevent race conditions.

    Args:
        db: Database session
        project_id: The project ID to get next sequence for

    Returns:
        The next sequence number (1-based, increments from max existing)
    """
    max_seq = db.query(func.max(PurchaseOrder.po_sequence)).filter(
        PurchaseOrder.project_id == project_id
    ).scalar()
    return (max_seq or 0) + 1


def format_po_number(uca_project_number: str, po_sequence: int, current_version: int) -> str:
    """
    Format the full PO number string.

    Format: PO-{UCA Project Number}-{Sequence:04d}-{Version}
    Example: PO-A2132-0001-0, PO-A2132-0001-10

    Args:
        uca_project_number: The project's UCA number (e.g., "A2132")
        po_sequence: The per-project sequence number (1, 2, 3...)
        current_version: The audit trail version (0, 1, 2, 10...)

    Returns:
        Formatted PO number string
    """
    return f"PO-{uca_project_number}-{po_sequence:04d}-{current_version}"


def populate_po_number(po: PurchaseOrder, uca_project_number: str) -> PurchaseOrderSchema:
    """
    Convert a PurchaseOrder ORM object to a PurchaseOrderSchema with computed po_number.

    Args:
        po: The PurchaseOrder ORM object
        uca_project_number: The project's UCA number

    Returns:
        PurchaseOrderSchema with po_number populated
    """
    response = PurchaseOrderSchema.model_validate(po)
    response.po_number = format_po_number(
        uca_project_number,
        po.po_sequence,
        po.current_version
    )
    return response


def check_po_editable(po_id: int, db: Session) -> None:
    """
    Check if a PO is in Draft status (editable) and raise 400 if not.

    POs can only be edited when in Draft status. Once status becomes Sent,
    line items are locked and only receiving operations are allowed.

    Args:
        po_id: The PO ID to check
        db: Database session

    Raises:
        HTTPException: 400 error if PO is not in Draft status
    """
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    if po.status != POStatus.draft:
        raise HTTPException(
            status_code=400,
            detail=f"This PO has status '{po.status.value}' and cannot be edited. Only Draft POs can be modified."
        )


def calculate_weighted_average_price(line_item: POLineItem, db: Session) -> Optional[float]:
    """
    Calculate weighted average actual price from all non-voided receiving history.

    Formula: Sum(qty_received * actual_price) / Sum(qty_received)

    Args:
        line_item: The PO line item to calculate for
        db: Database session

    Returns:
        Weighted average price, or None if no receivings exist
    """
    # Get all non-voided receiving line items for this PO line item
    receiving_items = (
        db.query(POReceivingLineItem)
        .join(POReceiving)
        .filter(
            POReceivingLineItem.po_line_item_id == line_item.id,
            POReceiving.voided_at.is_(None)  # Exclude voided receivings
        )
        .all()
    )

    if not receiving_items:
        return None

    total_cost = 0.0
    total_qty = 0

    for item in receiving_items:
        if item.actual_unit_price is not None and item.qty_received_this_receiving:
            total_cost += item.actual_unit_price * item.qty_received_this_receiving
            total_qty += item.qty_received_this_receiving

    if total_qty == 0:
        return None

    return total_cost / total_qty


def recompute_line_item_aggregates(db: Session, line_item: POLineItem) -> None:
    """
    Recompute qty_received, qty_pending, and actual_unit_price from non-voided receiving history.

    This function is called after revert operations to recalculate aggregates
    based on remaining valid receivings.

    Args:
        db: Database session
        line_item: The PO line item to recompute
    """
    # Get all non-voided receiving line items
    receiving_items = (
        db.query(POReceivingLineItem)
        .join(POReceiving)
        .filter(
            POReceivingLineItem.po_line_item_id == line_item.id,
            POReceiving.voided_at.is_(None)
        )
        .all()
    )

    # Sum up quantities from non-voided receivings
    total_received = sum(item.qty_received_this_receiving or 0 for item in receiving_items)

    # Update line item aggregates
    line_item.qty_received = total_received
    line_item.qty_pending = max(0, line_item.quantity - total_received)

    # Recalculate weighted average price
    line_item.actual_unit_price = calculate_weighted_average_price(line_item, db)


router = APIRouter(prefix="/purchase-orders", tags=["purchase-orders"])


@router.get("/", response_model=List[PurchaseOrderSchema])
def get_all_purchase_orders(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Get all purchase orders."""
    pos = (
        db.query(PurchaseOrder)
        .options(
            joinedload(PurchaseOrder.vendor),
            joinedload(PurchaseOrder.line_items),
            joinedload(PurchaseOrder.project)
        )
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [populate_po_number(po, po.project.uca_project_number) for po in pos]


@router.get("/{po_id}", response_model=PurchaseOrderSchema)
def get_purchase_order(po_id: int, db: Session = Depends(get_db)):
    """Get a single purchase order with line items."""
    po = (
        db.query(PurchaseOrder)
        .options(
            joinedload(PurchaseOrder.vendor),
            joinedload(PurchaseOrder.line_items).joinedload(POLineItem.part),
            joinedload(PurchaseOrder.project)
        )
        .filter(PurchaseOrder.id == po_id)
        .first()
    )
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    return populate_po_number(po, po.project.uca_project_number)


@router.post("/", response_model=PurchaseOrderSchema)
def create_purchase_order(po_data: PurchaseOrderCreate, db: Session = Depends(get_db)):
    """Create a new purchase order for a project."""
    # Verify project exists and lock row for sequence generation
    project = db.query(Project).filter(Project.id == po_data.project_id).with_for_update().first()
    if not project:
        raise HTTPException(status_code=400, detail="Project not found")

    # Verify vendor exists and is of type VENDOR
    vendor = db.query(Profile).filter(Profile.id == po_data.vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=400, detail="Vendor not found")
    if vendor.type != ProfileType.vendor:
        raise HTTPException(status_code=400, detail="Profile must be of type 'vendor'")

    # Get next sequence number
    next_sequence = get_next_po_sequence(db, po_data.project_id)

    db_po = PurchaseOrder(
        project_id=po_data.project_id,
        vendor_id=po_data.vendor_id,
        po_sequence=next_sequence,
        status=po_data.status,
        work_description=po_data.work_description,
        vendor_po_number=po_data.vendor_po_number,
        expected_delivery_date=po_data.expected_delivery_date
    )
    db.add(db_po)
    db.flush()  # Get the PO ID without committing

    # Create initial snapshot within same transaction
    create_po_snapshot(db, db_po, "create", "Purchase order created")

    # Commit both PO and snapshot together
    db.commit()
    db.refresh(db_po)

    # Reload with vendor and project relationship
    db_po = (
        db.query(PurchaseOrder)
        .options(
            joinedload(PurchaseOrder.vendor),
            joinedload(PurchaseOrder.project)
        )
        .filter(PurchaseOrder.id == db_po.id)
        .first()
    )
    return populate_po_number(db_po, project.uca_project_number)


@router.put("/{po_id}", response_model=PurchaseOrderSchema)
def update_purchase_order(
    po_id: int,
    po_data: PurchaseOrderUpdate,
    db: Session = Depends(get_db)
):
    """Update purchase order metadata and status."""
    db_po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not db_po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    # Track if status changed
    status_changed = False
    old_status = db_po.status

    # Update fields if provided
    if po_data.status is not None and po_data.status != db_po.status:
        db_po.status = po_data.status
        status_changed = True

    if po_data.work_description is not None:
        db_po.work_description = po_data.work_description

    if po_data.vendor_po_number is not None:
        db_po.vendor_po_number = po_data.vendor_po_number

    if po_data.expected_delivery_date is not None:
        db_po.expected_delivery_date = po_data.expected_delivery_date

    # Create snapshot if status changed
    if status_changed:
        create_po_snapshot(db, db_po, "status_change", f"Status changed from {old_status.value} to {po_data.status.value}")

    db.commit()
    db.refresh(db_po)

    # Reload with vendor and project relationship
    db_po = (
        db.query(PurchaseOrder)
        .options(
            joinedload(PurchaseOrder.vendor),
            joinedload(PurchaseOrder.project)
        )
        .filter(PurchaseOrder.id == db_po.id)
        .first()
    )
    return populate_po_number(db_po, db_po.project.uca_project_number)


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
    # Check if PO is editable (Draft status)
    check_po_editable(po_id, db)

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
        unit_price=line_data.unit_price,
        qty_pending=line_data.quantity
    )
    db.add(db_line)
    db.flush()

    # Create snapshot
    create_po_snapshot(db, po, "edit", f"Added line item: {line_data.description or 'Part'}")

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
    # Check if PO is editable (Draft status)
    check_po_editable(po_id, db)

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

    db_line.item_type = line_data.item_type
    db_line.part_id = line_data.part_id
    db_line.description = line_data.description
    db_line.quantity = line_data.quantity
    db_line.unit_price = line_data.unit_price

    # Recompute qty_pending based on new quantity and existing qty_received
    db_line.qty_pending = max(0, db_line.quantity - db_line.qty_received)

    # Get PO for snapshot
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()

    # Create snapshot
    create_po_snapshot(db, po, "edit", f"Updated line item: {db_line.description or 'Part'}")

    db.commit()
    db.refresh(db_line)
    return db_line


@router.delete("/{po_id}/lines/{line_id}")
def delete_po_line(po_id: int, line_id: int, db: Session = Depends(get_db)):
    """Delete a line item from a purchase order."""
    # Check if PO is editable (Draft status)
    check_po_editable(po_id, db)

    db_line = (
        db.query(POLineItem)
        .filter(POLineItem.id == line_id, POLineItem.purchase_order_id == po_id)
        .first()
    )
    if not db_line:
        raise HTTPException(status_code=404, detail="Line item not found")

    # Store description before delete for snapshot
    description = db_line.description or 'Part'

    # Get PO for snapshot
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()

    # Create snapshot BEFORE deleting, passing the deleted line item
    create_po_snapshot(db, po, "delete", f"Deleted line item: {description}", deleted_line_item=db_line)

    # Now delete the line item after snapshot is created
    db.delete(db_line)

    db.commit()
    return {"message": "Line item deleted successfully"}
