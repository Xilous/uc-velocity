from sqlalchemy import Column, Integer, String, Float, ForeignKey, Enum, Table, DateTime, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from database import Base


# Association table for Part-Labor many-to-many relationship (Parts link to Labor)
part_labor_link = Table(
    'part_labor_link',
    Base.metadata,
    Column('part_id', Integer, ForeignKey('parts.id'), primary_key=True),
    Column('labor_id', Integer, ForeignKey('labor.id'), primary_key=True)
)


class ProfileType(str, enum.Enum):
    customer = "customer"
    vendor = "vendor"


class PhoneType(str, enum.Enum):
    work = "work"
    mobile = "mobile"


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # "part" or "labor"

    parts = relationship("Part", back_populates="category")
    labor_items = relationship("Labor", back_populates="category")


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(Enum(ProfileType), nullable=False)
    pst = Column(String, nullable=False)  # Provincial Tax Number
    address = Column(String, nullable=False)
    postal_code = Column(String, nullable=False)
    website = Column(String, nullable=True)  # Optional URL to official website

    # Relationships
    contacts = relationship("Contact", back_populates="profile", cascade="all, delete-orphan")
    projects = relationship("Project", back_populates="customer")
    purchase_orders = relationship("PurchaseOrder", back_populates="vendor")


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey('profiles.id', ondelete='CASCADE'), nullable=False)
    name = Column(String, nullable=False)
    job_title = Column(String, nullable=True)
    email = Column(String, nullable=True)

    # Relationships
    profile = relationship("Profile", back_populates="contacts")
    phone_numbers = relationship("ContactPhone", back_populates="contact", cascade="all, delete-orphan")


class ContactPhone(Base):
    __tablename__ = "contact_phones"

    id = Column(Integer, primary_key=True, index=True)
    contact_id = Column(Integer, ForeignKey('contacts.id', ondelete='CASCADE'), nullable=False)
    type = Column(Enum(PhoneType), nullable=False)
    number = Column(String, nullable=False)

    # Relationships
    contact = relationship("Contact", back_populates="phone_numbers")


class Part(Base):
    __tablename__ = "parts"

    id = Column(Integer, primary_key=True, index=True)
    part_number = Column(String, unique=True, nullable=False)
    description = Column(String, nullable=False)
    cost = Column(Float, nullable=False)
    markup_percent = Column(Float, default=0.0)
    category_id = Column(Integer, ForeignKey('categories.id'))

    # Relationships
    category = relationship("Category", back_populates="parts")
    labor_items = relationship("Labor", secondary=part_labor_link, back_populates="parts")


class Labor(Base):
    __tablename__ = "labor"

    id = Column(Integer, primary_key=True, index=True)
    description = Column(String, nullable=False)
    hours = Column(Float, nullable=False, default=1.0)
    rate = Column(Float, nullable=False)
    markup_percent = Column(Float, default=0.0)
    category_id = Column(Integer, ForeignKey('categories.id'))

    # Relationships
    category = relationship("Category", back_populates="labor_items")
    parts = relationship("Part", secondary=part_labor_link, back_populates="labor_items")


class Miscellaneous(Base):
    __tablename__ = "miscellaneous"

    id = Column(Integer, primary_key=True, index=True)
    description = Column(String, nullable=False)
    unit_price = Column(Float, nullable=False)
    markup_percent = Column(Float, default=0.0)
    category_id = Column(Integer, ForeignKey('categories.id'))
    is_system_item = Column(Boolean, default=False)

    # Relationships
    category = relationship("Category")


class DiscountCode(Base):
    __tablename__ = "discount_codes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(10), unique=True, nullable=False)
    discount_percent = Column(Float, nullable=False)  # Stored as decimal (e.g., 10.00)
    is_archived = Column(Boolean, default=False)


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    customer_id = Column(Integer, ForeignKey('profiles.id'), nullable=False)
    created_on = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="active")
    ucsh_project_number = Column(String, nullable=True)
    uca_project_number = Column(String, unique=True, nullable=False)
    project_lead = Column(String, nullable=True)  # Static contact name

    # Relationships
    customer = relationship("Profile", back_populates="projects")
    quotes = relationship("Quote", back_populates="project", cascade="all, delete-orphan")
    purchase_orders = relationship("PurchaseOrder", back_populates="project", cascade="all, delete-orphan")


class Quote(Base):
    __tablename__ = "quotes"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="Active")  # "Active" or "Invoiced"
    current_version = Column(Integer, default=0)  # Current snapshot version
    client_po_number = Column(String, nullable=True)  # Client's PO number (required for invoicing)
    work_description = Column(String, nullable=True)  # Optional work description
    markup_control_enabled = Column(Boolean, default=False)  # Markup Discount Control toggle
    global_markup_percent = Column(Float, nullable=True)  # Global markup % when control is enabled

    # Relationships
    project = relationship("Project", back_populates="quotes")
    line_items = relationship("QuoteLineItem", back_populates="quote", cascade="all, delete-orphan")
    invoices = relationship("Invoice", back_populates="quote", order_by="Invoice.created_at")
    snapshots = relationship("QuoteSnapshot", back_populates="quote", order_by="QuoteSnapshot.version")


class QuoteLineItem(Base):
    __tablename__ = "quote_line_items"

    id = Column(Integer, primary_key=True, index=True)
    quote_id = Column(Integer, ForeignKey('quotes.id'), nullable=False)
    item_type = Column(String, nullable=False)  # "labor", "part", "misc"
    labor_id = Column(Integer, ForeignKey('labor.id'), nullable=True)
    part_id = Column(Integer, ForeignKey('parts.id'), nullable=True)
    misc_id = Column(Integer, ForeignKey('miscellaneous.id'), nullable=True)
    discount_code_id = Column(Integer, ForeignKey('discount_codes.id'), nullable=True)
    description = Column(String)  # For misc items or override
    quantity = Column(Float, default=1.0)  # Qty Ordered
    unit_price = Column(Float)  # Override price if needed
    qty_pending = Column(Float, default=0.0)  # Remaining to fulfill
    qty_fulfilled = Column(Float, default=0.0)  # Total fulfilled across all invoices
    is_pms = Column(Boolean, default=False)  # True for PMS items (Project Management Services)
    pms_percent = Column(Float, nullable=True)  # Percentage value for PMS % items (null for PMS $ or non-PMS)
    original_markup_percent = Column(Float, nullable=True)  # Individual markup before global override
    base_cost = Column(Float, nullable=True)  # Base cost used for recalculation

    # Relationships
    quote = relationship("Quote", back_populates="line_items")
    labor = relationship("Labor")
    part = relationship("Part")
    miscellaneous = relationship("Miscellaneous")
    discount_code = relationship("DiscountCode")


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id'), nullable=False)
    vendor_id = Column(Integer, ForeignKey('profiles.id'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="draft")

    # Relationships
    project = relationship("Project", back_populates="purchase_orders")
    vendor = relationship("Profile", back_populates="purchase_orders")
    line_items = relationship("POLineItem", back_populates="purchase_order", cascade="all, delete-orphan")


class POLineItem(Base):
    __tablename__ = "po_line_items"

    id = Column(Integer, primary_key=True, index=True)
    purchase_order_id = Column(Integer, ForeignKey('purchase_orders.id'), nullable=False)
    item_type = Column(String, nullable=False)  # "part" or "misc" (NO labor for POs)
    part_id = Column(Integer, ForeignKey('parts.id'), nullable=True)
    description = Column(String)  # For misc items or override
    quantity = Column(Float, default=1.0)
    unit_price = Column(Float)

    # Relationships
    purchase_order = relationship("PurchaseOrder", back_populates="line_items")
    part = relationship("Part")


# ===== Invoice Models =====

class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    quote_id = Column(Integer, ForeignKey('quotes.id'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="Sent")  # "Sent", "Paid", "Voided"
    notes = Column(String)  # Optional notes for this invoice
    voided_at = Column(DateTime)  # When voided (if applicable)
    voided_by_snapshot_id = Column(Integer)  # Which revert voided this

    # Relationships
    quote = relationship("Quote", back_populates="invoices")
    line_items = relationship("InvoiceLineItem", back_populates="invoice", cascade="all, delete-orphan")


class InvoiceLineItem(Base):
    __tablename__ = "invoice_line_items"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey('invoices.id'), nullable=False)
    quote_line_item_id = Column(Integer)  # Reference to original line item

    # Snapshot of line item at invoice time
    item_type = Column(String, nullable=False)
    description = Column(String)
    unit_price = Column(Float)
    qty_ordered = Column(Float)  # Original ordered quantity
    qty_fulfilled_this_invoice = Column(Float)  # Amount fulfilled in THIS invoice
    qty_fulfilled_total = Column(Float)  # Total fulfilled up to this point
    qty_pending_after = Column(Float)  # Pending after this invoice

    # Foreign keys for reference data
    labor_id = Column(Integer)
    part_id = Column(Integer)
    misc_id = Column(Integer)
    discount_code_id = Column(Integer)

    # Relationships
    invoice = relationship("Invoice", back_populates="line_items")


# ===== Quote Snapshot Models (for versioning/revert) =====

class QuoteSnapshot(Base):
    __tablename__ = "quote_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    quote_id = Column(Integer, ForeignKey('quotes.id'), nullable=False)
    version = Column(Integer, nullable=False)
    action_type = Column(String, nullable=False)  # "create", "edit", "delete", "invoice", "revert"
    action_description = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    invoice_id = Column(Integer)  # If action_type="invoice", link to Invoice

    # Relationships
    quote = relationship("Quote", back_populates="snapshots")
    line_item_states = relationship("QuoteLineItemSnapshot", back_populates="snapshot", cascade="all, delete-orphan")


class QuoteLineItemSnapshot(Base):
    __tablename__ = "quote_line_item_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    snapshot_id = Column(Integer, ForeignKey('quote_snapshots.id'), nullable=False)
    original_line_item_id = Column(Integer)  # Reference to original line item (may be deleted)

    # Full state at this snapshot
    item_type = Column(String, nullable=False)
    labor_id = Column(Integer)
    part_id = Column(Integer)
    misc_id = Column(Integer)
    discount_code_id = Column(Integer)
    description = Column(String)
    quantity = Column(Float)  # qty_ordered
    unit_price = Column(Float)
    qty_pending = Column(Float)
    qty_fulfilled = Column(Float)
    is_deleted = Column(Boolean, default=False)  # Track if item was deleted at this snapshot
    is_pms = Column(Boolean, default=False)  # True for PMS items (Project Management Services)
    pms_percent = Column(Float, nullable=True)  # Percentage value for PMS % items
    original_markup_percent = Column(Float, nullable=True)  # Individual markup before global override
    base_cost = Column(Float, nullable=True)  # Base cost used for recalculation

    # Relationships
    snapshot = relationship("QuoteSnapshot", back_populates="line_item_states")
