# UC Velocity ERP System

## Project Overview

A desktop-focused ERP application for Windows that manages Customers, Vendors, Inventory (Parts/Labor), and Project Financials (Quotes/POs). Uses a "Local Server" architecture pattern.

### Technology Stack

- **Backend:** Python 3.10+ (FastAPI, SQLAlchemy, SQLite, Pydantic)
- **Frontend:** React (Vite, TypeScript, Tailwind CSS, shadcn/ui)
- **Distribution:** Electron (future - wrapping the local web server)

---

## Domain Logic & Relationships

### Resources (Inventory)

- **Parts:** Physical items with Category, Cost, Part Number
- **Labor:** Service items with Category, Time, Hourly Rate, Markup Rate
- **Labor-Parts Link:** Many-to-many relationship where specific Parts are associated with a Labor task. When selecting a Labor task (e.g., "Install HVAC"), the system tracks which Parts are required to calculate total cost.

### Project Hierarchy

- **Project:** Root container with Customer, Status, and lists of documents
- **Quotes:** Customer-facing documents containing:
  - Labor Items (with linked parts cost implicit or explicit)
  - Parts (standalone)
  - Misc items
- **Purchase Orders (POs):** Vendor-facing documents containing:
  - Parts (to be ordered)
  - Misc items
  - **Note: POs strictly EXCLUDE Labor**

### Profiles

- **Types:** Customer, Vendor
- **Fields:** name, email, phone

---

## Project Structure

```
UC Velocity/
├── backend/
│   ├── __init__.py
│   ├── main.py              # FastAPI app entry point
│   ├── database.py          # SQLite connection and session management
│   ├── models.py            # SQLAlchemy ORM models
│   ├── schemas.py           # Pydantic validation schemas
│   ├── requirements.txt     # Python dependencies
│   └── routes/
│       ├── __init__.py
│       ├── parts.py         # Parts CRUD endpoints
│       ├── labor.py         # Labor CRUD with part linking
│       ├── profiles.py      # Profiles CRUD (customers/vendors)
│       ├── projects.py      # [NOT IMPLEMENTED] Projects CRUD
│       ├── quotes.py        # [NOT IMPLEMENTED] Quotes + line items
│       └── purchase_orders.py # [NOT IMPLEMENTED] POs + line items
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx          # Main app with inventory dashboard
│   │   ├── index.css        # Tailwind CSS imports
│   │   ├── lib/utils.ts     # cn() utility for shadcn
│   │   ├── api/client.ts    # Typed API client
│   │   ├── types/index.ts   # TypeScript interfaces
│   │   ├── components/
│   │   │   ├── ui/          # shadcn/ui components
│   │   │   └── forms/
│   │   │       ├── PartForm.tsx
│   │   │       └── LaborForm.tsx
│   │   └── pages/           # [NOT IMPLEMENTED]
│   │       ├── ProjectList.tsx
│   │       ├── ProjectDetails.tsx
│   │       └── DocumentEditor.tsx
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
└── CLAUDE.md                # This file
```

---

## Implementation Status

### Completed

| Component | Status | Notes |
|-----------|--------|-------|
| Database connection (SQLite) | ✅ Done | `backend/database.py` |
| SQLAlchemy models | ✅ Done | All models defined in `backend/models.py` |
| Pydantic schemas | ✅ Done | All schemas defined in `backend/schemas.py` |
| Parts API routes | ✅ Done | Full CRUD at `/parts/` |
| Labor API routes | ✅ Done | Full CRUD at `/labor/` with atomic part linking |
| Frontend setup (Vite/React/TS) | ✅ Done | |
| Tailwind CSS + shadcn/ui | ✅ Done | Button, Input, Label, Dialog, Tabs, Popover, Command, Badge |
| Multi-select component | ✅ Done | For linking parts to labor |
| Inventory Dashboard | ✅ Done | Parts and Labor tabs with CRUD |
| PartForm component | ✅ Done | Create new parts |
| LaborForm component | ✅ Done | Create labor with linked parts |

### Not Implemented (Remaining Work)

#### Backend Routes Needed

| Route | Endpoints | Priority |
|-------|-----------|----------|
| Profiles | `GET/POST/PUT/DELETE /profiles/` | ✅ Done |
| Projects | `GET/POST/PUT/DELETE /projects/`, `GET /projects/{id}` (full nested) | ✅ Done |
| Quotes | `GET/POST/PUT/DELETE /quotes/`, line item management | ✅ Done |
| Purchase Orders | `GET/POST/PUT/DELETE /purchase-orders/`, line item management | ✅ Done |
| Categories | `GET/POST /categories/` | Low |

#### Frontend Pages Needed

| Page | Description | Priority |
|------|-------------|----------|
| Profile Management | List, create, edit customers/vendors | ✅ Done |
| Project List | View all projects with status | ✅ Done |
| Project Details | Header with customer, sidebar with Quotes/POs list | ✅ Done |
| Document Editor (Quote) | Editable table for Labor, Parts, Misc line items | ✅ Done |
| Document Editor (PO) | Editable table for Parts, Misc only (NO Labor button) | ✅ Done |

#### Key Implementation Notes

1. **Quote Line Items:** Can be Labor (with implicit parts cost), standalone Parts, or Misc
2. **PO Line Items:** Can ONLY be Parts or Misc - Labor must be disabled/hidden
3. **Project Details View:**
   - Header: Customer info
   - Left Sidebar: List of Quotes and POs
   - Main Content: Selected document rendered as editable table
4. **Cost Calculations:**
   - Labor cost: `hours * rate * (1 + markup_percent/100)`
   - Total with parts: Labor cost + sum of linked parts costs

---

## API Endpoints

### Implemented

```
GET    /                    # Health check
GET    /health              # Health check
GET    /parts/              # List all parts
POST   /parts/              # Create part
GET    /parts/{id}          # Get part by ID
PUT    /parts/{id}          # Update part
DELETE /parts/{id}          # Delete part
GET    /labor/              # List all labor (with nested parts)
POST   /labor/              # Create labor with linked_part_ids
GET    /labor/{id}          # Get labor by ID
PUT    /labor/{id}          # Update labor and part links
DELETE /labor/{id}          # Delete labor
```

### Implemented (continued)

```
# Profiles
GET    /profiles/           # List all profiles
POST   /profiles/           # Create profile
GET    /profiles/{id}       # Get profile by ID
PUT    /profiles/{id}       # Update profile
DELETE /profiles/{id}       # Delete profile

# Projects
GET    /projects/           # List all projects
POST   /projects/           # Create project
GET    /projects/{id}       # Get project with nested quotes/POs
PUT    /projects/{id}       # Update project
DELETE /projects/{id}       # Delete project

# Quotes
GET    /quotes/             # List all quotes
POST   /quotes/             # Create quote
GET    /quotes/{id}         # Get quote with line items
PUT    /quotes/{id}         # Update quote
DELETE /quotes/{id}         # Delete quote
POST   /quotes/{id}/lines   # Add line item
PUT    /quotes/{id}/lines/{line_id}    # Update line item
DELETE /quotes/{id}/lines/{line_id}    # Delete line item

# Purchase Orders
GET    /purchase-orders/    # List all POs
POST   /purchase-orders/    # Create PO
GET    /purchase-orders/{id}           # Get PO with line items
PUT    /purchase-orders/{id}           # Update PO
DELETE /purchase-orders/{id}           # Delete PO
POST   /purchase-orders/{id}/lines     # Add line item
PUT    /purchase-orders/{id}/lines/{line_id}    # Update line item
DELETE /purchase-orders/{id}/lines/{line_id}    # Delete line item
```

---

## Running the Application

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API docs available at: http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App available at: http://localhost:5173

---

## Development Guidelines

1. **Backend patterns:**
   - Use dependency injection with `Depends(get_db)` for database sessions
   - Validate foreign keys exist before creating relationships
   - Use single `db.commit()` for atomic transactions
   - Return detailed error messages with appropriate HTTP status codes

2. **Frontend patterns:**
   - Use shadcn/ui components for consistent styling
   - TypeScript interfaces should mirror backend Pydantic schemas
   - Use the `api` client from `src/api/client.ts` for all API calls
   - Handle loading and error states in all data-fetching components

3. **Critical business rules:**
   - Labor-Parts linking must be atomic (all or nothing)
   - PurchaseOrders must NEVER include Labor line items
   - Quotes can include Labor, Parts, and Misc items
