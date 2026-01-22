from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional

from database import get_db
from models import (
    Quote, QuoteLineItem, Project, Labor, Part, Miscellaneous, DiscountCode,
    QuoteSnapshot, QuoteLineItemSnapshot, Invoice, InvoiceLineItem
)
from datetime import datetime

from schemas import (
    QuoteCreate, QuoteUpdate, Quote as QuoteSchema,
    QuoteLineItemCreate, QuoteLineItemUpdate, QuoteLineItem as QuoteLineItemSchema,
    QuoteSnapshot as QuoteSnapshotSchema,
    Invoice as InvoiceSchema, InvoiceCreate, LineItemFulfillment,
    RevertPreview, MarkupControlToggleRequest, MarkupControlToggleResponse
)


def create_snapshot(
    db: Session,
    quote: Quote,
    action_type: str,
    action_description: str,
    invoice_id: Optional[int] = None
) -> QuoteSnapshot:
    """
    Create a snapshot of the current quote state.

    Args:
        db: Database session
        quote: The quote to snapshot
        action_type: Type of action ("create", "edit", "delete", "invoice", "revert")
        action_description: Human-readable description of the action
        invoice_id: Optional invoice ID if action_type is "invoice"

    Returns:
        The created QuoteSnapshot
    """
    # Increment version
    new_version = quote.current_version + 1
    quote.current_version = new_version

    # Create the snapshot
    snapshot = QuoteSnapshot(
        quote_id=quote.id,
        version=new_version,
        action_type=action_type,
        action_description=action_description,
        invoice_id=invoice_id
    )
    db.add(snapshot)
    db.flush()  # Get the snapshot ID

    # Snapshot all current line items
    line_items = (
        db.query(QuoteLineItem)
        .filter(QuoteLineItem.quote_id == quote.id)
        .all()
    )

    for item in line_items:
        item_snapshot = QuoteLineItemSnapshot(
            snapshot_id=snapshot.id,
            original_line_item_id=item.id,
            item_type=item.item_type,
            labor_id=item.labor_id,
            part_id=item.part_id,
            misc_id=item.misc_id,
            discount_code_id=item.discount_code_id,
            description=item.description,
            quantity=item.quantity,
            unit_price=item.unit_price,
            qty_pending=item.qty_pending,
            qty_fulfilled=item.qty_fulfilled,
            is_deleted=False,
            is_pms=item.is_pms,
            pms_percent=item.pms_percent,
            original_markup_percent=item.original_markup_percent,
            base_cost=item.base_cost
        )
        db.add(item_snapshot)

    return snapshot


def get_line_item_description(item: QuoteLineItem, db: Session) -> str:
    """Get a human-readable description for a line item."""
    if item.item_type == "labor":
        if item.labor_id:
            labor = db.query(Labor).filter(Labor.id == item.labor_id).first()
            return f"Labor: {labor.description}" if labor else "Labor"
        elif item.is_pms:
            # PMS item (custom labor without inventory reference)
            pms_suffix = f" ({item.pms_percent}%)" if item.pms_percent else ""
            return f"Labor: {item.description or 'PMS'}{pms_suffix}"
        return f"Labor: {item.description or 'Unknown'}"
    elif item.item_type == "part" and item.part_id:
        part = db.query(Part).filter(Part.id == item.part_id).first()
        return f"Part: {part.part_number}" if part else "Part"
    elif item.item_type == "misc":
        if item.misc_id:
            misc = db.query(Miscellaneous).filter(Miscellaneous.id == item.misc_id).first()
            return f"Misc: {misc.description}" if misc else "Misc"
        return f"Misc: {item.description or 'Unknown'}"
    return "Unknown item"


def calculate_base_cost(item: QuoteLineItem, db: Session) -> float:
    """
    Calculate the base cost (before markup) for a line item.

    - Part: part.cost
    - Labor: labor.rate * labor.hours
    - Misc (linked): misc.unit_price
    - Misc (not linked): current unit_price (treated as base)
    - PMS items: returns 0 (they are exempt)
    """
    if item.is_pms:
        return 0  # PMS items are exempt

    if item.item_type == "part" and item.part_id:
        part = db.query(Part).filter(Part.id == item.part_id).first()
        return part.cost if part else 0

    if item.item_type == "labor" and item.labor_id:
        labor = db.query(Labor).filter(Labor.id == item.labor_id).first()
        return labor.rate * labor.hours if labor else 0

    if item.item_type == "misc":
        if item.misc_id:
            misc = db.query(Miscellaneous).filter(Miscellaneous.id == item.misc_id).first()
            return misc.unit_price if misc else 0
        else:
            # Misc without linked inventory - treat unit_price as base cost
            return item.unit_price or 0

    return 0


def get_original_markup(item: QuoteLineItem, db: Session) -> float:
    """
    Get the original/individual markup percent for a line item from its linked inventory.
    """
    if item.is_pms:
        return 0  # PMS items don't have markup

    if item.item_type == "part" and item.part_id:
        part = db.query(Part).filter(Part.id == item.part_id).first()
        return part.markup_percent if part else 0

    if item.item_type == "labor" and item.labor_id:
        labor = db.query(Labor).filter(Labor.id == item.labor_id).first()
        return labor.markup_percent if labor else 0

    if item.item_type == "misc" and item.misc_id:
        misc = db.query(Miscellaneous).filter(Miscellaneous.id == item.misc_id).first()
        return misc.markup_percent if misc else 0

    # Misc without linked inventory - no original markup
    return 0


router = APIRouter(prefix="/quotes", tags=["quotes"])


@router.get("/", response_model=List[QuoteSchema])
def get_all_quotes(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Get all quotes."""
    quotes = (
        db.query(Quote)
        .options(joinedload(Quote.line_items))
        .offset(skip)
        .limit(limit)
        .all()
    )
    return quotes


@router.get("/{quote_id}", response_model=QuoteSchema)
def get_quote(quote_id: int, db: Session = Depends(get_db)):
    """Get a single quote with line items and all relationships."""
    quote = (
        db.query(Quote)
        .options(
            joinedload(Quote.line_items).joinedload(QuoteLineItem.labor),
            joinedload(Quote.line_items).joinedload(QuoteLineItem.part),
            joinedload(Quote.line_items).joinedload(QuoteLineItem.miscellaneous),
            joinedload(Quote.line_items).joinedload(QuoteLineItem.discount_code)
        )
        .filter(Quote.id == quote_id)
        .first()
    )
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    return quote


@router.post("/", response_model=QuoteSchema)
def create_quote(quote_data: QuoteCreate, db: Session = Depends(get_db)):
    """Create a new quote for a project."""
    # Verify project exists
    project = db.query(Project).filter(Project.id == quote_data.project_id).first()
    if not project:
        raise HTTPException(status_code=400, detail="Project not found")

    db_quote = Quote(
        project_id=quote_data.project_id,
        status=quote_data.status,
        client_po_number=quote_data.client_po_number,
        work_description=quote_data.work_description
    )
    db.add(db_quote)
    db.commit()
    db.refresh(db_quote)
    return db_quote


@router.put("/{quote_id}", response_model=QuoteSchema)
def update_quote(quote_id: int, quote_data: QuoteUpdate, db: Session = Depends(get_db)):
    """Update quote status."""
    db_quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not db_quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    if quote_data.status is not None:
        if quote_data.status not in ["Active", "Invoiced"]:
            raise HTTPException(status_code=400, detail="Status must be 'Active' or 'Invoiced'")
        db_quote.status = quote_data.status

    if quote_data.client_po_number is not None:
        db_quote.client_po_number = quote_data.client_po_number.strip() or None

    if quote_data.work_description is not None:
        db_quote.work_description = quote_data.work_description.strip() or None

    db.commit()
    db.refresh(db_quote)
    return db_quote


@router.delete("/{quote_id}")
def delete_quote(quote_id: int, db: Session = Depends(get_db)):
    """Delete a quote and all its line items."""
    db_quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not db_quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    db.delete(db_quote)
    db.commit()
    return {"message": "Quote deleted successfully"}


@router.post("/{quote_id}/clone", response_model=QuoteSchema)
def clone_quote(quote_id: int, db: Session = Depends(get_db)):
    """
    Clone a quote and all its line items.

    Creates an exact copy of the quote with:
    - Status reset to "Active"
    - Fulfillment quantities reset (qty_fulfilled=0, qty_pending=quantity)
    - Markup control disabled
    - Same project, client_po_number, and work_description
    """
    # Fetch the source quote with all line items
    source_quote = (
        db.query(Quote)
        .options(joinedload(Quote.line_items))
        .filter(Quote.id == quote_id)
        .first()
    )
    if not source_quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    # Create new quote with copied fields
    new_quote = Quote(
        project_id=source_quote.project_id,
        status="Active",  # Always reset to Active
        client_po_number=source_quote.client_po_number,
        work_description=source_quote.work_description,
        markup_control_enabled=False,  # Reset to disabled
        global_markup_percent=None,  # Reset to None
    )
    db.add(new_quote)
    db.flush()  # Get new quote ID

    # Clone all line items
    for item in source_quote.line_items:
        new_item = QuoteLineItem(
            quote_id=new_quote.id,
            item_type=item.item_type,
            labor_id=item.labor_id,
            part_id=item.part_id,
            misc_id=item.misc_id,
            discount_code_id=item.discount_code_id,
            description=item.description,
            quantity=item.quantity,
            unit_price=item.unit_price,
            qty_pending=item.quantity,  # Reset: pending = quantity
            qty_fulfilled=0.0,  # Reset: fulfilled = 0
            is_pms=item.is_pms,
            pms_percent=item.pms_percent,
            original_markup_percent=item.original_markup_percent,
            base_cost=item.base_cost,
        )
        db.add(new_item)

    db.commit()

    # Return the new quote with all relationships loaded
    new_quote = (
        db.query(Quote)
        .options(
            joinedload(Quote.line_items).joinedload(QuoteLineItem.labor),
            joinedload(Quote.line_items).joinedload(QuoteLineItem.part),
            joinedload(Quote.line_items).joinedload(QuoteLineItem.miscellaneous),
            joinedload(Quote.line_items).joinedload(QuoteLineItem.discount_code)
        )
        .filter(Quote.id == new_quote.id)
        .first()
    )
    return new_quote


# ==================== Markup Discount Control ====================

@router.post("/{quote_id}/markup-control", response_model=MarkupControlToggleResponse)
def toggle_markup_control(
    quote_id: int,
    request: MarkupControlToggleRequest,
    db: Session = Depends(get_db)
):
    """
    Toggle the Markup Discount Control feature for a quote.

    When enabling (request.enabled=True):
    - Validates no discount codes are applied to any line items
    - Requires global_markup_percent to be provided
    - Stores original markups and base costs for each line item
    - Recalculates all unit_prices using the global markup
    - PMS items are EXEMPT and not recalculated

    When disabling (request.enabled=False):
    - Restores original markups to all line items
    - Recalculates unit_prices from original individual markups
    """
    quote = (
        db.query(Quote)
        .options(joinedload(Quote.line_items))
        .filter(Quote.id == quote_id)
        .first()
    )
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    if request.enabled:
        # Validate: No discount codes applied
        lines_with_discounts = [
            item for item in quote.line_items
            if item.discount_code_id is not None
        ]
        if lines_with_discounts:
            raise HTTPException(
                status_code=400,
                detail="Remove discount codes first to enable this feature"
            )

        if request.global_markup_percent is None:
            raise HTTPException(
                status_code=400,
                detail="global_markup_percent is required when enabling markup control"
            )

        # Enable markup control
        quote.markup_control_enabled = True
        quote.global_markup_percent = request.global_markup_percent

        # Recalculate all line items
        for item in quote.line_items:
            if item.is_pms:
                continue  # Skip PMS items - they are EXEMPT

            # Store original markup and base cost
            item.original_markup_percent = get_original_markup(item, db)
            item.base_cost = calculate_base_cost(item, db)

            # Recalculate unit_price with global markup
            if item.base_cost:
                item.unit_price = item.base_cost * (1 + request.global_markup_percent / 100)

        # Create snapshot
        create_snapshot(
            db=db,
            quote=quote,
            action_type="edit",
            action_description=f"Enabled Markup Discount Control ({request.global_markup_percent}%)"
        )

        message = f"Markup Discount Control enabled with {request.global_markup_percent}% markup"

    else:
        # Disable markup control
        quote.markup_control_enabled = False
        quote.global_markup_percent = None

        # Restore original markups
        for item in quote.line_items:
            if item.is_pms:
                continue  # Skip PMS items

            # Restore unit_price using original markup
            if item.base_cost is not None and item.original_markup_percent is not None:
                item.unit_price = item.base_cost * (1 + item.original_markup_percent / 100)

        # Create snapshot
        create_snapshot(
            db=db,
            quote=quote,
            action_type="edit",
            action_description="Disabled Markup Discount Control (restored individual markups)"
        )

        message = "Markup Discount Control disabled, original markups restored"

    db.commit()

    # Reload quote with all relationships
    quote = (
        db.query(Quote)
        .options(
            joinedload(Quote.line_items).joinedload(QuoteLineItem.labor),
            joinedload(Quote.line_items).joinedload(QuoteLineItem.part),
            joinedload(Quote.line_items).joinedload(QuoteLineItem.miscellaneous),
            joinedload(Quote.line_items).joinedload(QuoteLineItem.discount_code)
        )
        .filter(Quote.id == quote_id)
        .first()
    )

    return MarkupControlToggleResponse(
        success=True,
        message=message,
        quote=quote
    )


# ==================== Line Items ====================

@router.get("/{quote_id}/lines", response_model=List[QuoteLineItemSchema])
def get_quote_lines(quote_id: int, db: Session = Depends(get_db)):
    """Get all line items for a quote with all relationships."""
    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    lines = (
        db.query(QuoteLineItem)
        .options(
            joinedload(QuoteLineItem.labor),
            joinedload(QuoteLineItem.part),
            joinedload(QuoteLineItem.miscellaneous),
            joinedload(QuoteLineItem.discount_code)
        )
        .filter(QuoteLineItem.quote_id == quote_id)
        .all()
    )
    return lines


@router.post("/{quote_id}/lines", response_model=QuoteLineItemSchema)
def add_quote_line(quote_id: int, line_data: QuoteLineItemCreate, db: Session = Depends(get_db)):
    """Add a line item to a quote."""
    # Verify quote exists
    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    # Validate item_type
    if line_data.item_type not in ["labor", "part", "misc"]:
        raise HTTPException(status_code=400, detail="item_type must be 'labor', 'part', or 'misc'")

    # Validate references based on item_type
    if line_data.item_type == "labor":
        if not line_data.labor_id:
            # Allow PMS items (custom labor items) if is_pms=True and description provided
            if not line_data.is_pms or not line_data.description:
                raise HTTPException(
                    status_code=400,
                    detail="labor_id required for labor line items, or set is_pms=True with a description"
                )
            # For PMS items, require either unit_price (for PMS $) or pms_percent (for PMS %)
            if line_data.unit_price is None and line_data.pms_percent is None:
                raise HTTPException(
                    status_code=400,
                    detail="PMS items require either unit_price (for PMS $) or pms_percent (for PMS %)"
                )
        else:
            labor = db.query(Labor).filter(Labor.id == line_data.labor_id).first()
            if not labor:
                raise HTTPException(status_code=400, detail="Labor not found")

    elif line_data.item_type == "part":
        if not line_data.part_id:
            raise HTTPException(status_code=400, detail="part_id required for part line items")
        part = db.query(Part).filter(Part.id == line_data.part_id).first()
        if not part:
            raise HTTPException(status_code=400, detail="Part not found")

    elif line_data.item_type == "misc":
        # Misc items can now reference a Miscellaneous inventory item
        if line_data.misc_id:
            misc = db.query(Miscellaneous).filter(Miscellaneous.id == line_data.misc_id).first()
            if not misc:
                raise HTTPException(status_code=400, detail="Miscellaneous item not found")
        elif not line_data.description:
            raise HTTPException(status_code=400, detail="misc_id or description required for misc line items")

    # Validate discount code if provided
    if line_data.discount_code_id:
        # Block discount codes when markup control is enabled
        if quote.markup_control_enabled:
            raise HTTPException(
                status_code=400,
                detail="Cannot apply discount codes while Markup Discount Control is enabled"
            )
        discount_code = db.query(DiscountCode).filter(
            DiscountCode.id == line_data.discount_code_id,
            DiscountCode.is_archived == False
        ).first()
        if not discount_code:
            raise HTTPException(status_code=400, detail="Discount code not found or is archived")

    db_line = QuoteLineItem(
        quote_id=quote_id,
        item_type=line_data.item_type,
        labor_id=line_data.labor_id,
        part_id=line_data.part_id,
        misc_id=line_data.misc_id,
        discount_code_id=line_data.discount_code_id,
        description=line_data.description,
        quantity=line_data.quantity,
        unit_price=line_data.unit_price,
        qty_pending=line_data.quantity,  # Initialize qty_pending = quantity
        qty_fulfilled=0.0,
        is_pms=line_data.is_pms,
        pms_percent=line_data.pms_percent
    )
    db.add(db_line)
    db.flush()  # Need ID for calculate_base_cost

    # If markup control is enabled, apply global markup to new items
    if quote.markup_control_enabled and not line_data.is_pms:
        db_line.original_markup_percent = get_original_markup(db_line, db)
        db_line.base_cost = calculate_base_cost(db_line, db)
        if db_line.base_cost and quote.global_markup_percent is not None:
            db_line.unit_price = db_line.base_cost * (1 + quote.global_markup_percent / 100)

    # Create snapshot after adding line item
    item_desc = get_line_item_description(db_line, db)
    create_snapshot(
        db=db,
        quote=quote,
        action_type="create",
        action_description=f"Added {item_desc} (qty: {line_data.quantity})"
    )

    db.commit()
    db.refresh(db_line)

    # Reload with relationships
    db_line = (
        db.query(QuoteLineItem)
        .options(
            joinedload(QuoteLineItem.labor),
            joinedload(QuoteLineItem.part),
            joinedload(QuoteLineItem.miscellaneous),
            joinedload(QuoteLineItem.discount_code)
        )
        .filter(QuoteLineItem.id == db_line.id)
        .first()
    )
    return db_line


@router.put("/{quote_id}/lines/{line_id}", response_model=QuoteLineItemSchema)
def update_quote_line(
    quote_id: int,
    line_id: int,
    line_data: QuoteLineItemUpdate,
    db: Session = Depends(get_db)
):
    """Update a line item (quantity, unit_price, discount_code)."""
    # Get quote for snapshot
    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    db_line = (
        db.query(QuoteLineItem)
        .filter(QuoteLineItem.id == line_id, QuoteLineItem.quote_id == quote_id)
        .first()
    )
    if not db_line:
        raise HTTPException(status_code=404, detail="Line item not found")

    # Track changes for snapshot description
    changes = []
    old_quantity = db_line.quantity

    if line_data.quantity is not None:
        # Validate: cannot reduce quantity below what's already fulfilled
        if line_data.quantity < db_line.qty_fulfilled:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot reduce quantity below fulfilled amount ({db_line.qty_fulfilled})"
            )
        if line_data.quantity != old_quantity:
            changes.append(f"quantity: {old_quantity} → {line_data.quantity}")
        # Update quantity and recalculate qty_pending
        db_line.quantity = line_data.quantity
        db_line.qty_pending = line_data.quantity - db_line.qty_fulfilled
    if line_data.unit_price is not None:
        if db_line.unit_price != line_data.unit_price:
            changes.append(f"unit_price: ${db_line.unit_price or 0:.2f} → ${line_data.unit_price:.2f}")
        db_line.unit_price = line_data.unit_price

    # Handle discount code update
    if line_data.discount_code_id is not None:
        if line_data.discount_code_id == 0:
            if db_line.discount_code_id:
                changes.append("removed discount code")
            db_line.discount_code_id = None
        else:
            # Block discount codes when markup control is enabled
            if quote.markup_control_enabled:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot apply discount codes while Markup Discount Control is enabled"
                )
            # Validate discount code exists and is not archived
            discount_code = db.query(DiscountCode).filter(
                DiscountCode.id == line_data.discount_code_id,
                DiscountCode.is_archived == False
            ).first()
            if not discount_code:
                raise HTTPException(status_code=400, detail="Discount code not found or is archived")
            if db_line.discount_code_id != line_data.discount_code_id:
                changes.append(f"applied discount: {discount_code.code}")
            db_line.discount_code_id = line_data.discount_code_id

    # Create snapshot if there were actual changes
    if changes:
        item_desc = get_line_item_description(db_line, db)
        create_snapshot(
            db=db,
            quote=quote,
            action_type="edit",
            action_description=f"Edited {item_desc}: {', '.join(changes)}"
        )

    db.commit()
    db.refresh(db_line)

    # Reload with relationships
    db_line = (
        db.query(QuoteLineItem)
        .options(
            joinedload(QuoteLineItem.labor),
            joinedload(QuoteLineItem.part),
            joinedload(QuoteLineItem.miscellaneous),
            joinedload(QuoteLineItem.discount_code)
        )
        .filter(QuoteLineItem.id == db_line.id)
        .first()
    )
    return db_line


@router.delete("/{quote_id}/lines/{line_id}")
def delete_quote_line(quote_id: int, line_id: int, db: Session = Depends(get_db)):
    """Delete a line item from a quote."""
    # Get quote for snapshot
    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    db_line = (
        db.query(QuoteLineItem)
        .filter(QuoteLineItem.id == line_id, QuoteLineItem.quote_id == quote_id)
        .first()
    )
    if not db_line:
        raise HTTPException(status_code=404, detail="Line item not found")

    # Get description before deleting
    item_desc = get_line_item_description(db_line, db)

    # Create snapshot BEFORE deleting - we need to manually include the deleted item
    new_version = quote.current_version + 1
    quote.current_version = new_version

    snapshot = QuoteSnapshot(
        quote_id=quote.id,
        version=new_version,
        action_type="delete",
        action_description=f"Deleted {item_desc}"
    )
    db.add(snapshot)
    db.flush()

    # Snapshot all current line items (including the one being deleted, marked as deleted)
    all_line_items = (
        db.query(QuoteLineItem)
        .filter(QuoteLineItem.quote_id == quote_id)
        .all()
    )

    for item in all_line_items:
        item_snapshot = QuoteLineItemSnapshot(
            snapshot_id=snapshot.id,
            original_line_item_id=item.id,
            item_type=item.item_type,
            labor_id=item.labor_id,
            part_id=item.part_id,
            misc_id=item.misc_id,
            discount_code_id=item.discount_code_id,
            description=item.description,
            quantity=item.quantity,
            unit_price=item.unit_price,
            qty_pending=item.qty_pending,
            qty_fulfilled=item.qty_fulfilled,
            is_deleted=(item.id == line_id),  # Mark the deleted item
            is_pms=item.is_pms,
            pms_percent=item.pms_percent,
            original_markup_percent=item.original_markup_percent,
            base_cost=item.base_cost
        )
        db.add(item_snapshot)

    # Now delete the line item
    db.delete(db_line)
    db.commit()
    return {"message": "Line item deleted successfully"}


# ==================== Invoices ====================

@router.get("/{quote_id}/invoices", response_model=List[InvoiceSchema])
def get_quote_invoices(quote_id: int, db: Session = Depends(get_db)):
    """Get all invoices for a quote."""
    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    invoices = (
        db.query(Invoice)
        .options(joinedload(Invoice.line_items))
        .filter(Invoice.quote_id == quote_id)
        .order_by(Invoice.created_at.desc())
        .all()
    )
    return invoices


@router.post("/{quote_id}/invoices", response_model=InvoiceSchema)
def create_invoice(
    quote_id: int,
    invoice_data: InvoiceCreate,
    db: Session = Depends(get_db)
):
    """
    Create an invoice from staged fulfillments.
    Moves quantities from qty_pending to qty_fulfilled for each line item.
    """
    # Get quote
    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    # Validate client PO number is present before allowing invoice creation
    if not quote.client_po_number or not quote.client_po_number.strip():
        raise HTTPException(
            status_code=400,
            detail="Cannot create invoice: Client PO Number is required. Please add a Client PO Number to this quote before creating an invoice."
        )

    if not invoice_data.fulfillments:
        raise HTTPException(status_code=400, detail="At least one fulfillment is required")

    # Validate all fulfillments before processing
    line_items_to_fulfill = []
    for fulfillment in invoice_data.fulfillments:
        line_item = (
            db.query(QuoteLineItem)
            .filter(
                QuoteLineItem.id == fulfillment.line_item_id,
                QuoteLineItem.quote_id == quote_id
            )
            .first()
        )
        if not line_item:
            raise HTTPException(
                status_code=400,
                detail=f"Line item {fulfillment.line_item_id} not found in this quote"
            )
        if fulfillment.quantity <= 0:
            raise HTTPException(
                status_code=400,
                detail=f"Fulfillment quantity must be positive for line item {fulfillment.line_item_id}"
            )
        if fulfillment.quantity > line_item.qty_pending:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot fulfill {fulfillment.quantity} units of line item {fulfillment.line_item_id}. Only {line_item.qty_pending} pending."
            )
        line_items_to_fulfill.append((line_item, fulfillment.quantity))

    # Create the invoice
    invoice = Invoice(
        quote_id=quote_id,
        status="Sent",
        notes=invoice_data.notes
    )
    db.add(invoice)
    db.flush()  # Get invoice ID

    # Create invoice line items and update quote line items
    fulfilled_descriptions = []
    for line_item, fulfill_qty in line_items_to_fulfill:
        # Get description for audit trail
        item_desc = get_line_item_description(line_item, db)
        fulfilled_descriptions.append(f"{item_desc} ({fulfill_qty})")

        # Create invoice line item (snapshot)
        invoice_line = InvoiceLineItem(
            invoice_id=invoice.id,
            quote_line_item_id=line_item.id,
            item_type=line_item.item_type,
            description=line_item.description or item_desc,
            unit_price=line_item.unit_price,
            qty_ordered=line_item.quantity,
            qty_fulfilled_this_invoice=fulfill_qty,
            qty_fulfilled_total=line_item.qty_fulfilled + fulfill_qty,
            qty_pending_after=line_item.qty_pending - fulfill_qty,
            labor_id=line_item.labor_id,
            part_id=line_item.part_id,
            misc_id=line_item.misc_id,
            discount_code_id=line_item.discount_code_id
        )
        db.add(invoice_line)

        # Update quote line item quantities
        line_item.qty_fulfilled += fulfill_qty
        line_item.qty_pending -= fulfill_qty

    # Create snapshot for this invoice action
    create_snapshot(
        db=db,
        quote=quote,
        action_type="invoice",
        action_description=f"Created Invoice #{invoice.id}: {', '.join(fulfilled_descriptions)}",
        invoice_id=invoice.id
    )

    db.commit()
    db.refresh(invoice)

    # Reload with relationships
    invoice = (
        db.query(Invoice)
        .options(joinedload(Invoice.line_items))
        .filter(Invoice.id == invoice.id)
        .first()
    )
    return invoice


# ==================== Snapshots (Audit Trail) ====================

@router.get("/{quote_id}/snapshots", response_model=List[QuoteSnapshotSchema])
def get_quote_snapshots(quote_id: int, db: Session = Depends(get_db)):
    """Get all snapshots (audit trail) for a quote."""
    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    snapshots = (
        db.query(QuoteSnapshot)
        .options(joinedload(QuoteSnapshot.line_item_states))
        .filter(QuoteSnapshot.quote_id == quote_id)
        .order_by(QuoteSnapshot.version.desc())
        .all()
    )
    return snapshots


@router.get("/{quote_id}/snapshots/{version}", response_model=QuoteSnapshotSchema)
def get_quote_snapshot(quote_id: int, version: int, db: Session = Depends(get_db)):
    """Get a specific snapshot by version."""
    snapshot = (
        db.query(QuoteSnapshot)
        .options(joinedload(QuoteSnapshot.line_item_states))
        .filter(QuoteSnapshot.quote_id == quote_id, QuoteSnapshot.version == version)
        .first()
    )
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return snapshot


# ==================== Revert ====================

@router.get("/{quote_id}/revert/{version}/preview", response_model=RevertPreview)
def preview_revert(quote_id: int, version: int, db: Session = Depends(get_db)):
    """
    Preview what would happen if we revert to a specific version.
    Shows which invoices would be voided.
    """
    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    # Get the target snapshot
    target_snapshot = (
        db.query(QuoteSnapshot)
        .filter(QuoteSnapshot.quote_id == quote_id, QuoteSnapshot.version == version)
        .first()
    )
    if not target_snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")

    # Find all invoices created after this snapshot (they will be voided)
    invoices_to_void = (
        db.query(Invoice)
        .options(joinedload(Invoice.line_items))
        .filter(
            Invoice.quote_id == quote_id,
            Invoice.status != "Voided"
        )
        .join(QuoteSnapshot, QuoteSnapshot.invoice_id == Invoice.id)
        .filter(QuoteSnapshot.version > version)
        .all()
    )

    # Build summary
    if invoices_to_void:
        invoice_ids = [str(inv.id) for inv in invoices_to_void]
        summary = f"Reverting will void {len(invoices_to_void)} invoice(s): #{', #'.join(invoice_ids)}"
    else:
        summary = "No invoices will be affected by this revert."

    return RevertPreview(
        target_version=version,
        invoices_to_void=invoices_to_void,
        changes_summary=summary
    )


@router.post("/{quote_id}/revert/{version}", response_model=QuoteSchema)
def revert_to_snapshot(quote_id: int, version: int, db: Session = Depends(get_db)):
    """
    Revert the quote to a specific snapshot version.
    - Restores all line items to their state at that version
    - Voids any invoices created after that version
    - Creates a new snapshot recording the revert action
    """
    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    # Get the target snapshot with line item states
    target_snapshot = (
        db.query(QuoteSnapshot)
        .options(joinedload(QuoteSnapshot.line_item_states))
        .filter(QuoteSnapshot.quote_id == quote_id, QuoteSnapshot.version == version)
        .first()
    )
    if not target_snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")

    # Cannot revert to current version
    if version >= quote.current_version:
        raise HTTPException(status_code=400, detail="Cannot revert to current or future version")

    # Void all invoices created after this snapshot
    invoices_after = (
        db.query(Invoice)
        .filter(
            Invoice.quote_id == quote_id,
            Invoice.status != "Voided"
        )
        .join(QuoteSnapshot, QuoteSnapshot.invoice_id == Invoice.id)
        .filter(QuoteSnapshot.version > version)
        .all()
    )

    voided_invoice_ids = []
    for invoice in invoices_after:
        invoice.status = "Voided"
        invoice.voided_at = datetime.utcnow()
        voided_invoice_ids.append(str(invoice.id))

    # Delete all current line items
    db.query(QuoteLineItem).filter(QuoteLineItem.quote_id == quote_id).delete()

    # Restore line items from snapshot
    restored_count = 0
    for item_state in target_snapshot.line_item_states:
        if not item_state.is_deleted:
            restored_item = QuoteLineItem(
                quote_id=quote_id,
                item_type=item_state.item_type,
                labor_id=item_state.labor_id,
                part_id=item_state.part_id,
                misc_id=item_state.misc_id,
                discount_code_id=item_state.discount_code_id,
                description=item_state.description,
                quantity=item_state.quantity,
                unit_price=item_state.unit_price,
                qty_pending=item_state.qty_pending,
                qty_fulfilled=item_state.qty_fulfilled,
                is_pms=item_state.is_pms,
                pms_percent=item_state.pms_percent,
                original_markup_percent=item_state.original_markup_percent,
                base_cost=item_state.base_cost
            )
            db.add(restored_item)
            restored_count += 1

    # Create snapshot for the revert action
    revert_desc = f"Reverted to version {version}"
    if voided_invoice_ids:
        revert_desc += f". Voided invoice(s): #{', #'.join(voided_invoice_ids)}"

    new_version = quote.current_version + 1
    quote.current_version = new_version

    revert_snapshot = QuoteSnapshot(
        quote_id=quote.id,
        version=new_version,
        action_type="revert",
        action_description=revert_desc
    )
    db.add(revert_snapshot)
    db.flush()

    # Snapshot the restored state
    restored_items = db.query(QuoteLineItem).filter(QuoteLineItem.quote_id == quote_id).all()
    for item in restored_items:
        item_snapshot = QuoteLineItemSnapshot(
            snapshot_id=revert_snapshot.id,
            original_line_item_id=item.id,
            item_type=item.item_type,
            labor_id=item.labor_id,
            part_id=item.part_id,
            misc_id=item.misc_id,
            discount_code_id=item.discount_code_id,
            description=item.description,
            quantity=item.quantity,
            unit_price=item.unit_price,
            qty_pending=item.qty_pending,
            qty_fulfilled=item.qty_fulfilled,
            is_deleted=False,
            is_pms=item.is_pms,
            pms_percent=item.pms_percent,
            original_markup_percent=item.original_markup_percent,
            base_cost=item.base_cost
        )
        db.add(item_snapshot)

    db.commit()

    # Return updated quote
    quote = (
        db.query(Quote)
        .options(
            joinedload(Quote.line_items).joinedload(QuoteLineItem.labor),
            joinedload(Quote.line_items).joinedload(QuoteLineItem.part),
            joinedload(Quote.line_items).joinedload(QuoteLineItem.miscellaneous),
            joinedload(Quote.line_items).joinedload(QuoteLineItem.discount_code)
        )
        .filter(Quote.id == quote_id)
        .first()
    )
    return quote
