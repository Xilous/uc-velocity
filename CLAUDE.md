# UC Velocity ERP System

## Project Overview

A desktop-focused ERP application for Windows that manages Customers, Vendors, Inventory (Parts/Labor), and Project Financials (Quotes/POs). Uses a "Local Server" architecture pattern.

### Technology Stack

- **Backend:** Python 3.10+ (FastAPI, SQLAlchemy, PostgreSQL, Pydantic, Alembic)
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
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   ├── script.py.mako
│   │   └── versions/        # Migration files
│   └── routes/
│       ├── __init__.py
│       ├── parts.py
│       ├── labor.py
│       ├── profiles.py
│       ├── projects.py
│       ├── quotes.py
│       └── purchase_orders.py
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── index.css
│   │   ├── lib/utils.ts
│   │   ├── api/client.ts
│   │   ├── types/index.ts
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   └── forms/
│   │   └── pages/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
└── CLAUDE.md
```

---

## API Endpoints

```
GET    /                    # Health check
GET    /health              # Health check

# Parts
GET    /parts/
POST   /parts/
GET    /parts/{id}
PUT    /parts/{id}
DELETE /parts/{id}

# Labor
GET    /labor/
POST   /labor/
GET    /labor/{id}
PUT    /labor/{id}
DELETE /labor/{id}

# Profiles
GET    /profiles/
POST   /profiles/
GET    /profiles/{id}
PUT    /profiles/{id}
DELETE /profiles/{id}

# Projects
GET    /projects/
POST   /projects/
GET    /projects/{id}
PUT    /projects/{id}
DELETE /projects/{id}

# Quotes
GET    /quotes/
POST   /quotes/
GET    /quotes/{id}
PUT    /quotes/{id}
DELETE /quotes/{id}
POST   /quotes/{id}/lines
PUT    /quotes/{id}/lines/{line_id}
DELETE /quotes/{id}/lines/{line_id}

# Purchase Orders
GET    /purchase-orders/
POST   /purchase-orders/
GET    /purchase-orders/{id}
PUT    /purchase-orders/{id}
DELETE /purchase-orders/{id}
POST   /purchase-orders/{id}/lines
PUT    /purchase-orders/{id}/lines/{line_id}
DELETE /purchase-orders/{id}/lines/{line_id}
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

---

## Database Migrations (Alembic)

This project uses **Alembic** for database schema migrations. Migrations run automatically on Railway deploy via the `releaseCommand` in `railway.toml`.

**Note:** There is no local PostgreSQL - all development and testing uses Railway's live PostgreSQL database.

### Creating a New Migration

When you modify `backend/models.py`, generate a migration against Railway's database:

```bash
cd backend
# Set DATABASE_URL to Railway's PostgreSQL (get from Railway dashboard or variables)
set DATABASE_URL=postgresql://...your-railway-url...
alembic revision --autogenerate -m "description_of_change"
```

Or use the `.env` file with the Railway DATABASE_URL temporarily.

Review the generated file in `backend/alembic/versions/` before committing.

### Useful Commands

```bash
# These require DATABASE_URL to be set to Railway's PostgreSQL
alembic current       # Show current revision
alembic history       # Show migration history
alembic upgrade head  # Apply pending migrations (also runs on deploy)
alembic downgrade -1  # Rollback one migration
```

### Production (Railway)

Migrations run automatically on deploy via Railway's `releaseCommand`. The workflow:

1. Push code to GitHub
2. Railway auto-deploys
3. `alembic upgrade head` runs before the app starts
4. PostgreSQL schema is updated automatically

### Workflow After Model Changes

1. Modify `backend/models.py`
2. Set `DATABASE_URL` to Railway's PostgreSQL connection string
3. Generate migration: `alembic revision --autogenerate -m "description"`
4. Review the generated migration file
5. Commit and push to GitHub
6. Railway auto-deploys and runs the migration automatically

---

## Deployment Workflow

**IMPORTANT:** After any changes or implementations to the codebase, always follow this deployment workflow:

1. **Push to GitHub:**
   - Commit all changes with a descriptive commit message
   - Push to the remote repository on GitHub

2. **Redeploy on Railway:**
   - Use the Railway MCP server tools to redeploy the application
   - Use `mcp__Railway__deploy` to trigger a new deployment

3. **Database Migrations (Backend Changes):**
   - If backend changes include modifications to SQLAlchemy models (`backend/models.py`), ensure the Railway PostgreSQL database schema is updated
   - The production database on Railway uses PostgreSQL (not SQLite like local development)
   - After model changes, verify the database tables are properly migrated/updated on Railway

**Railway MCP Tools Available:**
- `mcp__Railway__check-railway-status` - Verify CLI status and login
- `mcp__Railway__deploy` - Deploy changes to Railway
- `mcp__Railway__get-logs` - Check deployment/build logs
- `mcp__Railway__list-services` - List services in the project
- `mcp__Railway__list-variables` - View environment variables
- `mcp__Railway__set-variables` - Set environment variables

---

## UI Guidelines

### Searchable Dropdowns

Any field that references other objects (customers, parts, labor items, contacts, etc.) must be implemented as a **searchable dropdown** using the `SearchableSelect` or `SearchableMultiSelect` components:

- The dropdown filters results as the user types
- A "Create New [Type]" button always appears at the bottom of the dropdown list
- Clicking "Create New" opens a Dialog with the full creation form for that object type
- After creation, the new item is auto-selected

**Components:**
- `SearchableSelect` - Single selection with search and create (`frontend/src/components/ui/searchable-select.tsx`)
- `SearchableMultiSelect` - Multi selection with search and create (`frontend/src/components/ui/searchable-multi-select.tsx`)

**Exception:** Fields with fixed enum values (status, type, phone type) remain standard `Select` dropdowns without search or create functionality.

**Example Usage:**
```tsx
<SearchableSelect<Customer>
  options={customers.map(c => ({ value: c.id.toString(), label: c.name }))}
  value={selectedId}
  onChange={setSelectedId}
  placeholder="Select a customer"
  searchPlaceholder="Search customers..."
  allowCreate={true}
  createLabel="Create New Customer"
  createDialogTitle="Create New Customer"
  createForm={<ProfileForm defaultType="customer" />}
  onCreateSuccess={(newCustomer) => {
    setCustomers([...customers, newCustomer])
    setSelectedId(newCustomer.id.toString())
  }}
/>
```
