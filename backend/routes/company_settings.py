from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import CompanySettings as CompanySettingsModel
from schemas import CompanySettings as CompanySettingsSchema, CompanySettingsUpdate

router = APIRouter(prefix="/company-settings", tags=["company-settings"])


@router.get("/", response_model=CompanySettingsSchema)
def get_company_settings(db: Session = Depends(get_db)):
    """Get company settings (singleton)."""
    settings = db.query(CompanySettingsModel).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Company settings not found")
    return settings


@router.put("/", response_model=CompanySettingsSchema)
def update_company_settings(
    data: CompanySettingsUpdate,
    db: Session = Depends(get_db)
):
    """Update company settings."""
    settings = db.query(CompanySettingsModel).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Company settings not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(settings, field, value)

    db.commit()
    db.refresh(settings)
    return settings
