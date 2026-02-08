import type {
  Part, PartCreate,
  Labor, LaborCreate,
  Miscellaneous, MiscellaneousCreate,
  DiscountCode, DiscountCodeCreate,
  Profile, ProfileCreate, ProfileUpdate, ProfileType,
  Contact, ContactCreate, ContactUpdate,
  Project, ProjectCreate, ProjectFull,
  Quote, QuoteCreate, QuoteUpdate, QuoteLineItem, QuoteLineItemCreate, QuoteLineItemUpdate,
  PurchaseOrder, PurchaseOrderCreate, PurchaseOrderUpdate, POLineItem, POLineItemCreate,
  POReceiving, POReceivingCreate, POSnapshot, PORevertPreview,
  POCommitEditsRequest, POCommitEditsResponse,
  Invoice, InvoiceCreate, InvoiceStatusUpdate, QuoteSnapshot, RevertPreview,
  MarkupControlToggleRequest, MarkupControlToggleResponse,
  CommitEditsRequest, CommitEditsResponse
} from '@/types';

// API base URL - configurable via environment variable for production
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

/** Fetch wrapper that handles JSON serialization and extracts error details from FastAPI responses. */
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    let message = `API error: ${response.status}`;
    if (typeof error.detail === 'string') {
      message = error.detail;
    } else if (Array.isArray(error.detail)) {
      message = error.detail.map((e: any) => e.msg).join('; ');
    }
    throw new Error(message);
  }

  return response.json();
}

export const api = {
  // ===== Parts =====
  parts: {
    getAll: () => request<Part[]>('/parts/'),
    get: (id: number) => request<Part>(`/parts/${id}`),
    create: (data: PartCreate) =>
      request<Part>('/parts/', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<PartCreate>) =>
      request<Part>(`/parts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<{ message: string }>(`/parts/${id}`, { method: 'DELETE' }),
  },

  // ===== Labor =====
  labor: {
    getAll: () => request<Labor[]>('/labor/'),
    get: (id: number) => request<Labor>(`/labor/${id}`),
    create: (data: LaborCreate) =>
      request<Labor>('/labor/', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<LaborCreate>) =>
      request<Labor>(`/labor/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<{ message: string }>(`/labor/${id}`, { method: 'DELETE' }),
  },

  // ===== Profiles =====
  profiles: {
    getAll: (type?: ProfileType) =>
      request<Profile[]>(`/profiles/${type ? `?profile_type=${type}` : ''}`),
    get: (id: number) => request<Profile>(`/profiles/${id}`),
    create: (data: ProfileCreate) =>
      request<Profile>('/profiles/', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: ProfileUpdate) =>
      request<Profile>(`/profiles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<{ message: string }>(`/profiles/${id}`, { method: 'DELETE' }),

    // Contact management
    addContact: (profileId: number, data: ContactCreate) =>
      request<Contact>(`/profiles/${profileId}/contacts`, { method: 'POST', body: JSON.stringify(data) }),
    updateContact: (profileId: number, contactId: number, data: ContactUpdate) =>
      request<Contact>(`/profiles/${profileId}/contacts/${contactId}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteContact: (profileId: number, contactId: number) =>
      request<{ message: string }>(`/profiles/${profileId}/contacts/${contactId}`, { method: 'DELETE' }),
  },

  // ===== Projects =====
  projects: {
    getAll: () => request<Project[]>('/projects/'),
    get: (id: number) => request<ProjectFull>(`/projects/${id}`),
    create: (data: ProjectCreate) =>
      request<Project>('/projects/', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<ProjectCreate>) =>
      request<Project>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<{ message: string }>(`/projects/${id}`, { method: 'DELETE' }),
  },

  // ===== Miscellaneous =====
  misc: {
    getAll: () => request<Miscellaneous[]>('/misc/'),
    get: (id: number) => request<Miscellaneous>(`/misc/${id}`),
    create: (data: MiscellaneousCreate) =>
      request<Miscellaneous>('/misc/', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<MiscellaneousCreate>) =>
      request<Miscellaneous>(`/misc/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<{ message: string }>(`/misc/${id}`, { method: 'DELETE' }),
    // System items
    getSystemItems: () => request<Miscellaneous[]>('/misc/system-items/'),
    getParkingItem: () => request<Miscellaneous>('/misc/system-items/parking'),
    getTravelDistanceItems: () => request<Miscellaneous[]>('/misc/system-items/travel-distance'),
  },

  // ===== Discount Codes =====
  discountCodes: {
    getAll: (includeArchived = false) =>
      request<DiscountCode[]>(`/discount-codes/?include_archived=${includeArchived}`),
    get: (id: number) => request<DiscountCode>(`/discount-codes/${id}`),
    create: (data: DiscountCodeCreate) =>
      request<DiscountCode>('/discount-codes/', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<DiscountCode>) =>
      request<DiscountCode>(`/discount-codes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    archive: (id: number) =>
      request<DiscountCode>(`/discount-codes/${id}/archive`, { method: 'PUT' }),
    delete: (id: number) =>
      request<{ message: string }>(`/discount-codes/${id}`, { method: 'DELETE' }),
  },

  // ===== Quotes =====
  quotes: {
    getAll: () => request<Quote[]>('/quotes/'),
    get: (id: number) => request<Quote>(`/quotes/${id}`),
    create: (data: QuoteCreate) =>
      request<Quote>('/quotes/', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: QuoteUpdate) =>
      request<Quote>(`/quotes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<{ message: string }>(`/quotes/${id}`, { method: 'DELETE' }),

    // Line items
    getLines: (quoteId: number) =>
      request<QuoteLineItem[]>(`/quotes/${quoteId}/lines`),
    addLine: (quoteId: number, data: QuoteLineItemCreate) =>
      request<QuoteLineItem>(`/quotes/${quoteId}/lines`, { method: 'POST', body: JSON.stringify(data) }),
    updateLine: (quoteId: number, lineId: number, data: QuoteLineItemUpdate) =>
      request<QuoteLineItem>(`/quotes/${quoteId}/lines/${lineId}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteLine: (quoteId: number, lineId: number) =>
      request<{ message: string }>(`/quotes/${quoteId}/lines/${lineId}`, { method: 'DELETE' }),

    // Invoices
    getInvoices: (quoteId: number) =>
      request<Invoice[]>(`/quotes/${quoteId}/invoices`),
    createInvoice: (quoteId: number, data: InvoiceCreate) =>
      request<Invoice>(`/quotes/${quoteId}/invoices`, { method: 'POST', body: JSON.stringify(data) }),

    // Snapshots (Audit Trail)
    getSnapshots: (quoteId: number) =>
      request<QuoteSnapshot[]>(`/quotes/${quoteId}/snapshots`),
    getSnapshot: (quoteId: number, version: number) =>
      request<QuoteSnapshot>(`/quotes/${quoteId}/snapshots/${version}`),

    // Revert
    previewRevert: (quoteId: number, version: number) =>
      request<RevertPreview>(`/quotes/${quoteId}/revert/${version}/preview`),
    revert: (quoteId: number, version: number) =>
      request<Quote>(`/quotes/${quoteId}/revert/${version}`, { method: 'POST' }),

    // Markup Control
    toggleMarkupControl: (quoteId: number, data: MarkupControlToggleRequest) =>
      request<MarkupControlToggleResponse>(`/quotes/${quoteId}/markup-control`, { method: 'POST', body: JSON.stringify(data) }),

    // Clone
    clone: (quoteId: number) =>
      request<Quote>(`/quotes/${quoteId}/clone`, { method: 'POST' }),

    // Commit Edits (Edit Mode)
    commitEdits: (quoteId: number, data: CommitEditsRequest) =>
      request<CommitEditsResponse>(`/quotes/${quoteId}/commit`, { method: 'POST', body: JSON.stringify(data) }),
  },

  // ===== Invoices =====
  invoices: {
    get: (id: number) => request<Invoice>(`/invoices/${id}`),
    updateStatus: (id: number, data: InvoiceStatusUpdate) =>
      request<Invoice>(`/invoices/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  },

  // ===== Purchase Orders =====
  purchaseOrders: {
    // Core CRUD
    getAll: () => request<PurchaseOrder[]>('/purchase-orders/'),

    get: (id: number) => request<PurchaseOrder>(`/purchase-orders/${id}`),

    create: (data: PurchaseOrderCreate) =>
      request<PurchaseOrder>('/purchase-orders/', { method: 'POST', body: JSON.stringify(data) }),

    update: (id: number, data: PurchaseOrderUpdate) =>
      request<PurchaseOrder>(`/purchase-orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    delete: (id: number) =>
      request<{ message: string }>(`/purchase-orders/${id}`, { method: 'DELETE' }),

    // Line items
    getLines: (poId: number) =>
      request<POLineItem[]>(`/purchase-orders/${poId}/lines`),

    addLine: (poId: number, data: POLineItemCreate) =>
      request<POLineItem>(`/purchase-orders/${poId}/lines`, { method: 'POST', body: JSON.stringify(data) }),

    updateLine: (poId: number, lineId: number, data: POLineItemCreate) =>
      request<POLineItem>(`/purchase-orders/${poId}/lines/${lineId}`, { method: 'PUT', body: JSON.stringify(data) }),

    deleteLine: (poId: number, lineId: number) =>
      request<{ message: string }>(`/purchase-orders/${poId}/lines/${lineId}`, { method: 'DELETE' }),

    // Batch commit
    commitEdits: (poId: number, data: POCommitEditsRequest) =>
      request<POCommitEditsResponse>(`/purchase-orders/${poId}/commit`, { method: 'POST', body: JSON.stringify(data) }),

    // Receiving
    getReceivings: (poId: number) =>
      request<POReceiving[]>(`/purchase-orders/${poId}/receivings`),

    createReceiving: (poId: number, data: POReceivingCreate) =>
      request<POReceiving>(`/purchase-orders/${poId}/receivings`, { method: 'POST', body: JSON.stringify(data) }),

    // Snapshots
    getSnapshots: (poId: number) =>
      request<POSnapshot[]>(`/purchase-orders/${poId}/snapshots`),

    getSnapshot: (poId: number, version: number) =>
      request<POSnapshot>(`/purchase-orders/${poId}/snapshots/${version}`),

    // Revert
    previewRevert: (poId: number, version: number) =>
      request<PORevertPreview>(`/purchase-orders/${poId}/revert/${version}/preview`, { method: 'POST' }),

    revert: (poId: number, version: number) =>
      request<PurchaseOrder>(`/purchase-orders/${poId}/revert/${version}`, { method: 'POST' }),

    // Clone
    clone: (poId: number) =>
      request<PurchaseOrder>(`/purchase-orders/${poId}/clone`, { method: 'POST' }),
  },
};
