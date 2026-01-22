from pydantic import BaseModel, validator
from typing import List, Optional
from datetime import datetime
from enum import Enum


class ProfileType(str, Enum):
    customer = "customer"
    vendor = "vendor"


class PhoneType(str, Enum):
    work = "work"
    mobile = "mobile"


# ===== Category Schemas =====
class CategoryBase(BaseModel):
    name: str
    type: str  # "part" or "labor"


class CategoryCreate(CategoryBase):
    pass


class Category(CategoryBase):
    id: int

    class Config:
        from_attributes = True


# ===== Part Schemas =====
class PartBase(BaseModel):
    part_number: str
    description: str
    cost: float
    markup_percent: float = 0.0
    category_id: Optional[int] = None


class PartCreate(PartBase):
    linked_labor_ids: List[int] = []  # IDs of labor items to link


class PartUpdate(BaseModel):
    part_number: Optional[str] = None
    description: Optional[str] = None
    cost: Optional[float] = None
    markup_percent: Optional[float] = None
    category_id: Optional[int] = None
    linked_labor_ids: Optional[List[int]] = None


class Part(PartBase):
    id: int

    class Config:
        from_attributes = True


# ===== Labor Schemas =====
class LaborBase(BaseModel):
    description: str
    hours: float = 1.0
    rate: float
    markup_percent: float = 0.0
    category_id: Optional[int] = None


class LaborCreate(LaborBase):
    pass


class LaborUpdate(BaseModel):
    description: Optional[str] = None
    hours: Optional[float] = None
    rate: Optional[float] = None
    markup_percent: Optional[float] = None
    category_id: Optional[int] = None


class Labor(LaborBase):
    id: int

    class Config:
        from_attributes = True


# ===== Miscellaneous Schemas =====
class MiscellaneousBase(BaseModel):
    description: str
    hours: float = 1.0
    rate: float
    markup_percent: float = 0.0
    category_id: Optional[int] = None


class MiscellaneousCreate(MiscellaneousBase):
    pass


class MiscellaneousUpdate(BaseModel):
    description: Optional[str] = None
    hours: Optional[float] = None
    rate: Optional[float] = None
    markup_percent: Optional[float] = None
    category_id: Optional[int] = None


class Miscellaneous(MiscellaneousBase):
    id: int

    class Config:
        from_attributes = True


# ===== Discount Code Schemas =====
class DiscountCodeBase(BaseModel):
    code: str  # max 10 chars, validated in route
    discount_percent: float  # 2 decimal places


class DiscountCodeCreate(DiscountCodeBase):
    pass


class DiscountCodeUpdate(BaseModel):
    code: Optional[str] = None
    discount_percent: Optional[float] = None
    is_archived: Optional[bool] = None


class DiscountCode(DiscountCodeBase):
    id: int
    is_archived: bool

    class Config:
        from_attributes = True


# Part with nested labor items for read operations
class PartWithLabor(Part):
    labor_items: List[Labor] = []

    class Config:
        from_attributes = True


# ===== ContactPhone Schemas =====
class ContactPhoneBase(BaseModel):
    type: PhoneType
    number: str


class ContactPhoneCreate(ContactPhoneBase):
    pass


class ContactPhone(ContactPhoneBase):
    id: int
    contact_id: int

    class Config:
        from_attributes = True


# ===== Contact Schemas =====
class ContactBase(BaseModel):
    name: str
    job_title: Optional[str] = None
    email: Optional[str] = None


class ContactCreate(ContactBase):
    phone_numbers: List[ContactPhoneCreate] = []


class ContactUpdate(BaseModel):
    name: Optional[str] = None
    job_title: Optional[str] = None
    email: Optional[str] = None
    phone_numbers: Optional[List[ContactPhoneCreate]] = None


class Contact(ContactBase):
    id: int
    profile_id: int
    phone_numbers: List[ContactPhone] = []

    class Config:
        from_attributes = True


# ===== Profile Schemas =====
class ProfileBase(BaseModel):
    name: str
    type: ProfileType
    pst: str
    address: str
    postal_code: str
    website: Optional[str] = None


class ProfileCreate(ProfileBase):
    contacts: List[ContactCreate]

    @validator('contacts')
    def validate_at_least_one_contact(cls, v: List[ContactCreate]) -> List[ContactCreate]:
        if not v or len(v) == 0:
            raise ValueError('At least one contact is required')
        return v


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[ProfileType] = None
    pst: Optional[str] = None
    address: Optional[str] = None
    postal_code: Optional[str] = None
    website: Optional[str] = None


class Profile(ProfileBase):
    id: int
    contacts: List[Contact] = []

    class Config:
        from_attributes = True


# ===== Project Schemas =====
class ProjectBase(BaseModel):
    name: str
    customer_id: int
    status: str = "active"
    ucsh_project_number: Optional[str] = None
    project_lead: Optional[str] = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    customer_id: Optional[int] = None
    status: Optional[str] = None
    ucsh_project_number: Optional[str] = None
    project_lead: Optional[str] = None


class Project(ProjectBase):
    id: int
    created_on: datetime
    uca_project_number: str
    customer: Profile

    class Config:
        from_attributes = True


# ===== Quote Line Item Schemas =====
class QuoteLineItemBase(BaseModel):
    item_type: str  # "labor", "part", "misc"
    labor_id: Optional[int] = None
    part_id: Optional[int] = None
    misc_id: Optional[int] = None
    discount_code_id: Optional[int] = None
    description: Optional[str] = None
    quantity: float = 1.0
    unit_price: Optional[float] = None
    is_pms: bool = False  # True for PMS items (Project Management Services)
    pms_percent: Optional[float] = None  # Percentage value for PMS % items


class QuoteLineItemCreate(QuoteLineItemBase):
    pass


class QuoteLineItemUpdate(BaseModel):
    quantity: Optional[float] = None
    unit_price: Optional[float] = None
    discount_code_id: Optional[int] = None


class QuoteLineItem(QuoteLineItemBase):
    id: int
    quote_id: int
    qty_pending: float = 0.0
    qty_fulfilled: float = 0.0
    labor: Optional[Labor] = None
    part: Optional[Part] = None
    miscellaneous: Optional[Miscellaneous] = None
    discount_code: Optional[DiscountCode] = None

    class Config:
        from_attributes = True


# ===== Quote Schemas =====
class QuoteBase(BaseModel):
    project_id: int
    status: str = "Active"  # "Active" or "Invoiced"
    client_po_number: Optional[str] = None
    work_description: Optional[str] = None


class QuoteCreate(QuoteBase):
    pass


class QuoteUpdate(BaseModel):
    status: Optional[str] = None
    client_po_number: Optional[str] = None
    work_description: Optional[str] = None


class Quote(QuoteBase):
    id: int
    created_at: datetime
    current_version: int = 0
    line_items: List[QuoteLineItem] = []

    class Config:
        from_attributes = True


# ===== PO Line Item Schemas =====
class POLineItemBase(BaseModel):
    item_type: str  # "part" or "misc" (NO labor for POs)
    part_id: Optional[int] = None
    description: Optional[str] = None
    quantity: float = 1.0
    unit_price: Optional[float] = None


class POLineItemCreate(POLineItemBase):
    pass


class POLineItem(POLineItemBase):
    id: int
    purchase_order_id: int

    class Config:
        from_attributes = True


# ===== Purchase Order Schemas =====
class PurchaseOrderBase(BaseModel):
    project_id: int
    vendor_id: int
    status: str = "draft"


class PurchaseOrderCreate(PurchaseOrderBase):
    pass


class PurchaseOrder(PurchaseOrderBase):
    id: int
    created_at: datetime
    vendor: Profile
    line_items: List[POLineItem] = []

    class Config:
        from_attributes = True


# ===== Project with nested documents =====
class ProjectFull(Project):
    quotes: List[Quote] = []
    purchase_orders: List[PurchaseOrder] = []

    class Config:
        from_attributes = True


# ===== Invoice Line Item Schemas =====
class InvoiceLineItemBase(BaseModel):
    quote_line_item_id: Optional[int] = None
    item_type: str
    description: Optional[str] = None
    unit_price: Optional[float] = None
    qty_ordered: float
    qty_fulfilled_this_invoice: float
    qty_fulfilled_total: float
    qty_pending_after: float
    labor_id: Optional[int] = None
    part_id: Optional[int] = None
    misc_id: Optional[int] = None
    discount_code_id: Optional[int] = None


class InvoiceLineItem(InvoiceLineItemBase):
    id: int
    invoice_id: int

    class Config:
        from_attributes = True


# ===== Invoice Schemas =====
class InvoiceBase(BaseModel):
    quote_id: int
    notes: Optional[str] = None


class LineItemFulfillment(BaseModel):
    line_item_id: int
    quantity: float  # Amount to fulfill


class InvoiceCreate(BaseModel):
    fulfillments: List[LineItemFulfillment]
    notes: Optional[str] = None


class InvoiceStatusUpdate(BaseModel):
    status: str  # "Sent", "Paid"


class Invoice(InvoiceBase):
    id: int
    created_at: datetime
    status: str
    voided_at: Optional[datetime] = None
    voided_by_snapshot_id: Optional[int] = None
    line_items: List[InvoiceLineItem] = []

    class Config:
        from_attributes = True


# ===== Quote Line Item Snapshot Schemas =====
class QuoteLineItemSnapshotBase(BaseModel):
    original_line_item_id: Optional[int] = None
    item_type: str
    labor_id: Optional[int] = None
    part_id: Optional[int] = None
    misc_id: Optional[int] = None
    discount_code_id: Optional[int] = None
    description: Optional[str] = None
    quantity: float
    unit_price: Optional[float] = None
    qty_pending: float
    qty_fulfilled: float
    is_deleted: bool = False
    is_pms: bool = False  # True for PMS items (Project Management Services)
    pms_percent: Optional[float] = None  # Percentage value for PMS % items


class QuoteLineItemSnapshot(QuoteLineItemSnapshotBase):
    id: int
    snapshot_id: int

    class Config:
        from_attributes = True


# ===== Quote Snapshot Schemas =====
class QuoteSnapshotBase(BaseModel):
    quote_id: int
    version: int
    action_type: str  # "create", "edit", "delete", "invoice", "revert"
    action_description: Optional[str] = None
    invoice_id: Optional[int] = None


class QuoteSnapshot(QuoteSnapshotBase):
    id: int
    created_at: datetime
    line_item_states: List[QuoteLineItemSnapshot] = []

    class Config:
        from_attributes = True


# ===== Revert Preview Schema =====
class RevertPreview(BaseModel):
    target_version: int
    invoices_to_void: List[Invoice] = []
    changes_summary: str
