from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from typing import List

from database import get_db
from models import Quote, QuoteLineItem, Project, Profile
from schemas import BacklogQuoteItem, BacklogLineItem
from routes.quotes import compute_quote_status, format_quote_number, get_line_item_description

router = APIRouter(prefix="/reports", tags=["reports"])


def _line_item_unit_price(item: QuoteLineItem) -> float:
    """Resolve effective unit price from the line item or its linked inventory record."""
    # Prefer dynamic calculation from base_cost + markup (Issue #60)
    if item.base_cost is not None and item.markup_percent is not None:
        return item.base_cost * (1 + item.markup_percent / 100)
    if item.unit_price is not None:
        return item.unit_price
    if item.labor:
        return item.labor.hours * item.labor.rate * (1 + item.labor.markup_percent / 100)
    if item.part:
        return item.part.cost * (1 + (item.part.markup_percent or 0) / 100)
    if item.miscellaneous:
        return item.miscellaneous.unit_price * (1 + item.miscellaneous.markup_percent / 100)
    return 0.0


def _line_item_total(item: QuoteLineItem) -> float:
    """Unit price * quantity."""
    return _line_item_unit_price(item) * item.quantity


def _line_item_backlog_value(item: QuoteLineItem) -> float:
    """Backlog = unit price * qty_pending."""
    return _line_item_unit_price(item) * item.qty_pending


@router.get("/backlog-quotes", response_model=List[BacklogQuoteItem])
def get_backlog_quotes(db: Session = Depends(get_db)):
    """Return all quotes with uninvoiced line items (Work Order or Invoiced status)."""
    quotes = (
        db.query(Quote)
        .options(
            joinedload(Quote.project).joinedload(Project.customer),
            joinedload(Quote.line_items).joinedload(QuoteLineItem.labor),
            joinedload(Quote.line_items).joinedload(QuoteLineItem.part),
            joinedload(Quote.line_items).joinedload(QuoteLineItem.miscellaneous),
        )
        .all()
    )

    result: List[BacklogQuoteItem] = []

    for quote in quotes:
        status = compute_quote_status(quote)
        if status not in ("Work Order", "Invoiced"):
            continue

        # Only include line items with remaining qty
        pending_items = [li for li in quote.line_items if li.qty_pending > 0]
        if not pending_items:
            continue

        project = quote.project
        customer_name = project.customer.name if project.customer else "Unknown"

        # Build backlog line items
        backlog_lines: List[BacklogLineItem] = []
        backlog_total = 0.0
        for li in pending_items:
            unit = _line_item_unit_price(li)
            value = _line_item_backlog_value(li)
            backlog_total += value

            backlog_lines.append(BacklogLineItem(
                line_item_id=li.id,
                item_type=li.item_type,
                description=get_line_item_description(li, db),
                quantity=li.quantity,
                qty_fulfilled=li.qty_fulfilled,
                qty_pending=li.qty_pending,
                unit_price=round(unit, 2),
                backlog_value=round(value, 2),
            ))

        # Calculate full quote total
        quote_total = sum(_line_item_total(li) for li in quote.line_items)

        quote_number = format_quote_number(
            project.uca_project_number,
            quote.quote_sequence,
            quote.current_version,
        )

        result.append(BacklogQuoteItem(
            quote_id=quote.id,
            quote_number=quote_number,
            uca_project_number=project.uca_project_number,
            customer_name=customer_name,
            project_name=project.name,
            client_po_number=quote.client_po_number,
            status=status,
            quote_total=round(quote_total, 2),
            backlog_total=round(backlog_total, 2),
            line_items=backlog_lines,
        ))

    # Sort by quote number for consistent output
    result.sort(key=lambda q: q.quote_number)
    return result
