from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
import re

from database import get_db
from models import Project, Profile, ProfileType, PurchaseOrder, Quote
from schemas import ProjectCreate, ProjectUpdate, Project as ProjectSchema, ProjectFull

router = APIRouter(prefix="/projects", tags=["projects"])


def increment_letter_prefix(prefix: str) -> str:
    """
    Increment letter prefix: A→B, Z→AA, AZ→BA, ZZ→AAA
    """
    if not prefix:
        return "A"

    chars = list(prefix)
    i = len(chars) - 1

    while i >= 0:
        if chars[i] < 'Z':
            chars[i] = chr(ord(chars[i]) + 1)
            return ''.join(chars)
        else:
            chars[i] = 'A'
            i -= 1

    # All chars were Z, need to add a new letter
    return 'A' + ''.join(chars)


def generate_next_uca_number(db: Session) -> str:
    """
    Generate the next UCA project number.
    Format: Letter(s) + 4-digit number (e.g., A0001, B0001, AA0001)
    - Starts at A0001
    - A0001 → A9999 → B0001 → ... → Z9999 → AA0001 → AB0001 → ...
    """
    existing = db.query(Project.uca_project_number).all()
    existing_numbers = [row[0] for row in existing if row[0]]

    if not existing_numbers:
        return "A0001"

    def parse_uca(uca: str) -> tuple:
        """Parse UCA into (letter_prefix, number)"""
        match = re.match(r'^([A-Z]+)(\d{4})$', uca)
        if match:
            return (match.group(1), int(match.group(2)))
        return ("", 0)

    def uca_sort_key(uca: str) -> tuple:
        """Sort key: (prefix_length, prefix, number)"""
        prefix, num = parse_uca(uca)
        return (len(prefix), prefix, num)

    # Find the highest existing UCA number
    highest = max(existing_numbers, key=uca_sort_key)
    prefix, number = parse_uca(highest)

    # Increment
    if number < 9999:
        return f"{prefix}{number + 1:04d}"
    else:
        # Roll over to next letter prefix
        return f"{increment_letter_prefix(prefix)}0001"


@router.get("/", response_model=List[ProjectSchema])
def get_all_projects(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Get all projects with customer info."""
    projects = (
        db.query(Project)
        .options(joinedload(Project.customer))
        .offset(skip)
        .limit(limit)
        .all()
    )
    return projects


@router.get("/{project_id}", response_model=ProjectFull)
def get_project(project_id: int, db: Session = Depends(get_db)):
    """Get a single project with full nested structure (quotes, POs, line items)."""
    project = (
        db.query(Project)
        .options(
            joinedload(Project.customer),
            joinedload(Project.quotes).joinedload(Quote.line_items),
            joinedload(Project.purchase_orders).joinedload(PurchaseOrder.vendor),
            joinedload(Project.purchase_orders).joinedload(PurchaseOrder.line_items)
        )
        .filter(Project.id == project_id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.post("/", response_model=ProjectSchema)
def create_project(project_data: ProjectCreate, db: Session = Depends(get_db)):
    """Create a new project with auto-generated UCA number."""
    # Verify customer exists and is of type CUSTOMER
    customer = db.query(Profile).filter(Profile.id == project_data.customer_id).first()
    if not customer:
        raise HTTPException(status_code=400, detail="Customer not found")
    if customer.type != ProfileType.customer:
        raise HTTPException(status_code=400, detail="Profile must be of type 'customer'")

    # Generate next UCA number
    uca_number = generate_next_uca_number(db)

    db_project = Project(
        name=project_data.name,
        customer_id=project_data.customer_id,
        status=project_data.status,
        ucsh_project_number=project_data.ucsh_project_number,
        uca_project_number=uca_number,
        project_lead=project_data.project_lead,
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)

    # Reload with customer relationship
    db_project = (
        db.query(Project)
        .options(joinedload(Project.customer))
        .filter(Project.id == db_project.id)
        .first()
    )
    return db_project


@router.put("/{project_id}", response_model=ProjectSchema)
def update_project(project_id: int, project_data: ProjectUpdate, db: Session = Depends(get_db)):
    """Update an existing project. UCA number cannot be changed."""
    db_project = db.query(Project).filter(Project.id == project_id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")

    if project_data.name is not None:
        db_project.name = project_data.name
    if project_data.status is not None:
        db_project.status = project_data.status
    if project_data.ucsh_project_number is not None:
        db_project.ucsh_project_number = project_data.ucsh_project_number
    if project_data.project_lead is not None:
        db_project.project_lead = project_data.project_lead
    if project_data.customer_id is not None:
        # Verify new customer exists and is of type CUSTOMER
        customer = db.query(Profile).filter(Profile.id == project_data.customer_id).first()
        if not customer:
            raise HTTPException(status_code=400, detail="Customer not found")
        if customer.type != ProfileType.customer:
            raise HTTPException(status_code=400, detail="Profile must be of type 'customer'")
        db_project.customer_id = project_data.customer_id

    db.commit()
    db.refresh(db_project)

    # Reload with customer relationship
    db_project = (
        db.query(Project)
        .options(joinedload(Project.customer))
        .filter(Project.id == db_project.id)
        .first()
    )
    return db_project


@router.delete("/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    """Delete a project and all its quotes/POs (cascade)."""
    db_project = db.query(Project).filter(Project.id == project_id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")

    db.delete(db_project)
    db.commit()
    return {"message": "Project deleted successfully"}
