// TypeScript interfaces matching backend schemas

// ===== Labor =====
export interface Labor {
  id: number;
  description: string;
  hours: number;
  rate: number;
  markup_percent: number;
  category_id?: number;
}

export interface LaborCreate {
  description: string;
  hours: number;
  rate: number;
  markup_percent: number;
  category_id?: number;
}

// ===== Parts =====
export interface Part {
  id: number;
  part_number: string;
  description: string;
  cost: number;
  markup_percent: number;
  category_id?: number;
  labor_items?: Labor[];  // Linked labor items
}

export interface PartCreate {
  part_number: string;
  description: string;
  cost: number;
  markup_percent?: number;
  category_id?: number;
  linked_labor_ids?: number[];
}

// ===== Miscellaneous =====
export interface Miscellaneous {
  id: number;
  description: string;
  hours: number;
  rate: number;
  markup_percent: number;
  category_id?: number;
}

export interface MiscellaneousCreate {
  description: string;
  hours: number;
  rate: number;
  markup_percent: number;
  category_id?: number;
}

// ===== Discount Codes =====
export interface DiscountCode {
  id: number;
  code: string;
  discount_percent: number;
  is_archived: boolean;
}

export interface DiscountCodeCreate {
  code: string;
  discount_percent: number;
}

// ===== Contact Phone =====
export type PhoneType = 'work' | 'mobile';

export interface ContactPhone {
  id: number;
  contact_id: number;
  type: PhoneType;
  number: string;
}

export interface ContactPhoneCreate {
  type: PhoneType;
  number: string;
}

// ===== Contacts =====
export interface Contact {
  id: number;
  profile_id: number;
  name: string;
  job_title?: string;
  email?: string;
  phone_numbers: ContactPhone[];
}

export interface ContactCreate {
  name: string;
  job_title?: string;
  email?: string;
  phone_numbers: ContactPhoneCreate[];
}

export interface ContactUpdate {
  name?: string;
  job_title?: string;
  email?: string;
  phone_numbers?: ContactPhoneCreate[];
}

// ===== Profiles =====
export type ProfileType = 'customer' | 'vendor';

export interface Profile {
  id: number;
  name: string;
  type: ProfileType;
  pst: string;
  address: string;
  postal_code: string;
  website?: string;
  contacts: Contact[];
}

export interface ProfileCreate {
  name: string;
  type: ProfileType;
  pst: string;
  address: string;
  postal_code: string;
  website?: string;
  contacts: ContactCreate[];
}

export interface ProfileUpdate {
  name?: string;
  type?: ProfileType;
  pst?: string;
  address?: string;
  postal_code?: string;
  website?: string;
}

// ===== Projects =====
export interface Project {
  id: number;
  name: string;
  customer_id: number;
  created_on: string;
  status: string;
  ucsh_project_number: string | null;
  uca_project_number: string;
  customer: Profile;
}

export interface ProjectCreate {
  name: string;
  customer_id: number;
  status?: string;
  ucsh_project_number?: string;
}

export interface ProjectUpdate {
  name?: string;
  customer_id?: number;
  status?: string;
  ucsh_project_number?: string;
}

export interface ProjectFull extends Project {
  quotes: Quote[];
  purchase_orders: PurchaseOrder[];
}

// ===== Quote Line Items =====
export type LineItemType = 'labor' | 'part' | 'misc';

export interface QuoteLineItem {
  id: number;
  quote_id: number;
  item_type: LineItemType;
  labor_id?: number;
  part_id?: number;
  misc_id?: number;
  discount_code_id?: number;
  description?: string;
  quantity: number;  // Qty Ordered
  unit_price?: number;
  qty_pending: number;  // Remaining to fulfill
  qty_fulfilled: number;  // Total fulfilled across all invoices
  labor?: Labor;
  part?: Part;
  miscellaneous?: Miscellaneous;
  discount_code?: DiscountCode;
}

export interface QuoteLineItemCreate {
  item_type: LineItemType;
  labor_id?: number;
  part_id?: number;
  misc_id?: number;
  discount_code_id?: number;
  description?: string;
  quantity: number;
  unit_price?: number;
}

export interface QuoteLineItemUpdate {
  quantity?: number;
  unit_price?: number;
  discount_code_id?: number;
}

// ===== Quotes =====
export type QuoteStatus = 'Active' | 'Invoiced';

export interface Quote {
  id: number;
  project_id: number;
  created_at: string;
  status: QuoteStatus;
  current_version: number;
  line_items: QuoteLineItem[];
}

export interface QuoteCreate {
  project_id: number;
  status?: QuoteStatus;
}

export interface QuoteUpdate {
  status?: QuoteStatus;
}

// ===== PO Line Items =====
export type POLineItemType = 'part' | 'misc'; // NO labor for POs

export interface POLineItem {
  id: number;
  purchase_order_id: number;
  item_type: POLineItemType;
  part_id?: number;
  description?: string;
  quantity: number;
  unit_price?: number;
  part?: Part;
}

export interface POLineItemCreate {
  item_type: POLineItemType;
  part_id?: number;
  description?: string;
  quantity: number;
  unit_price?: number;
}

// ===== Purchase Orders =====
export interface PurchaseOrder {
  id: number;
  project_id: number;
  vendor_id: number;
  created_at: string;
  status: string;
  vendor: Profile;
  line_items: POLineItem[];
}

export interface PurchaseOrderCreate {
  project_id: number;
  vendor_id: number;
  status?: string;
}

// ===== Invoice Line Items =====
export interface InvoiceLineItem {
  id: number;
  invoice_id: number;
  quote_line_item_id?: number;
  item_type: LineItemType;
  description?: string;
  unit_price?: number;
  qty_ordered: number;
  qty_fulfilled_this_invoice: number;
  qty_fulfilled_total: number;
  qty_pending_after: number;
  labor_id?: number;
  part_id?: number;
  misc_id?: number;
  discount_code_id?: number;
}

// ===== Invoices =====
export type InvoiceStatus = 'Sent' | 'Paid' | 'Voided';

export interface Invoice {
  id: number;
  quote_id: number;
  created_at: string;
  status: InvoiceStatus;
  notes?: string;
  voided_at?: string;
  voided_by_snapshot_id?: number;
  line_items: InvoiceLineItem[];
}

export interface LineItemFulfillment {
  line_item_id: number;
  quantity: number;
}

export interface InvoiceCreate {
  fulfillments: LineItemFulfillment[];
  notes?: string;
}

export interface InvoiceStatusUpdate {
  status: 'Sent' | 'Paid';
}

// ===== Quote Line Item Snapshots =====
export interface QuoteLineItemSnapshot {
  id: number;
  snapshot_id: number;
  original_line_item_id?: number;
  item_type: LineItemType;
  labor_id?: number;
  part_id?: number;
  misc_id?: number;
  discount_code_id?: number;
  description?: string;
  quantity: number;
  unit_price?: number;
  qty_pending: number;
  qty_fulfilled: number;
  is_deleted: boolean;
}

// ===== Quote Snapshots =====
export type SnapshotActionType = 'create' | 'edit' | 'delete' | 'invoice' | 'revert';

export interface QuoteSnapshot {
  id: number;
  quote_id: number;
  version: number;
  action_type: SnapshotActionType;
  action_description?: string;
  created_at: string;
  invoice_id?: number;
  line_item_states: QuoteLineItemSnapshot[];
}

// ===== Revert Preview =====
export interface RevertPreview {
  target_version: number;
  invoices_to_void: Invoice[];
  changes_summary: string;
}

// ===== Staged Fulfillment (frontend-only state) =====
export interface StagedFulfillment {
  lineItemId: number;
  quantity: number;
}
