"""Initial baseline - creates all tables as they existed before migrations

This migration creates the full schema that was already present in the database
when the migration system was introduced. It replaces the original no-op baseline
so that `alembic upgrade head` works from scratch on an empty database.

Tables created:
- categories, profiles, contacts, contact_phones
- parts, labor, part_labor_link, miscellaneous
- discount_codes, projects
- quotes, quote_line_items
- purchase_orders, po_line_items
- invoices, invoice_line_items
- quote_snapshots, quote_line_item_snapshots
- company_settings

Revision ID: 001_baseline
Revises:
Create Date: 2026-01-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM as PG_ENUM


# revision identifiers, used by Alembic.
revision: str = '001_baseline'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create all baseline tables."""

    # ── Enum types ──
    # Use postgresql.ENUM with create_type=False to prevent SQLAlchemy from
    # auto-creating the type when it processes the table's before_create event.
    # We create the enums first via raw SQL with duplicate guards.
    conn = op.get_bind()
    conn.execute(sa.text(
        "DO $$ BEGIN CREATE TYPE profiletype AS ENUM ('customer', 'vendor'); "
        "EXCEPTION WHEN duplicate_object THEN NULL; END $$"
    ))
    conn.execute(sa.text(
        "DO $$ BEGIN CREATE TYPE phonetype AS ENUM ('work', 'mobile'); "
        "EXCEPTION WHEN duplicate_object THEN NULL; END $$"
    ))
    profiletype = PG_ENUM('customer', 'vendor', name='profiletype', create_type=False)
    phonetype = PG_ENUM('work', 'mobile', name='phonetype', create_type=False)

    # ── categories ──
    op.create_table(
        'categories',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('type', sa.String(), nullable=False),
    )
    op.create_index('ix_categories_id', 'categories', ['id'])

    # ── profiles ──
    op.create_table(
        'profiles',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('type', profiletype, nullable=False),
        sa.Column('pst', sa.String(), nullable=False),
        sa.Column('address', sa.String(), nullable=False),
        sa.Column('postal_code', sa.String(), nullable=False),
        sa.Column('website', sa.String(), nullable=True),
    )
    op.create_index('ix_profiles_id', 'profiles', ['id'])

    # ── contacts ──
    op.create_table(
        'contacts',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('profile_id', sa.Integer(), sa.ForeignKey('profiles.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('job_title', sa.String(), nullable=True),
        sa.Column('email', sa.String(), nullable=True),
    )
    op.create_index('ix_contacts_id', 'contacts', ['id'])

    # ── contact_phones ──
    op.create_table(
        'contact_phones',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('contact_id', sa.Integer(), sa.ForeignKey('contacts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('type', phonetype, nullable=False),
        sa.Column('number', sa.String(), nullable=False),
    )
    op.create_index('ix_contact_phones_id', 'contact_phones', ['id'])

    # ── parts ──
    op.create_table(
        'parts',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('part_number', sa.String(), unique=True, nullable=False),
        sa.Column('description', sa.String(), nullable=False),
        sa.Column('cost', sa.Float(), nullable=False),
        sa.Column('markup_percent', sa.Float(), default=0.0),
        sa.Column('category_id', sa.Integer(), sa.ForeignKey('categories.id')),
    )
    op.create_index('ix_parts_id', 'parts', ['id'])

    # ── labor ──
    op.create_table(
        'labor',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('description', sa.String(), nullable=False),
        sa.Column('hours', sa.Float(), nullable=False, server_default='1'),
        sa.Column('rate', sa.Float(), nullable=False),
        sa.Column('markup_percent', sa.Float(), default=0.0),
        sa.Column('category_id', sa.Integer(), sa.ForeignKey('categories.id')),
    )
    op.create_index('ix_labor_id', 'labor', ['id'])

    # ── part_labor_link ──
    op.create_table(
        'part_labor_link',
        sa.Column('part_id', sa.Integer(), sa.ForeignKey('parts.id'), primary_key=True),
        sa.Column('labor_id', sa.Integer(), sa.ForeignKey('labor.id'), primary_key=True),
    )

    # ── miscellaneous ──
    op.create_table(
        'miscellaneous',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('description', sa.String(), nullable=False),
        sa.Column('unit_price', sa.Float(), nullable=False),
        sa.Column('markup_percent', sa.Float(), default=0.0),
        sa.Column('category_id', sa.Integer(), sa.ForeignKey('categories.id')),
        sa.Column('is_system_item', sa.Boolean(), default=False),
    )
    op.create_index('ix_miscellaneous_id', 'miscellaneous', ['id'])

    # ── discount_codes ──
    op.create_table(
        'discount_codes',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('code', sa.String(10), unique=True, nullable=False),
        sa.Column('discount_percent', sa.Float(), nullable=False),
        sa.Column('is_archived', sa.Boolean(), default=False),
    )
    op.create_index('ix_discount_codes_id', 'discount_codes', ['id'])

    # ── projects ──
    op.create_table(
        'projects',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('customer_id', sa.Integer(), sa.ForeignKey('profiles.id'), nullable=False),
        sa.Column('created_on', sa.DateTime()),
        sa.Column('status', sa.String(), server_default='active'),
        sa.Column('ucsh_project_number', sa.String(), nullable=True),
        sa.Column('uca_project_number', sa.String(), unique=True, nullable=False),
        sa.Column('project_lead', sa.String(), nullable=True),
    )
    op.create_index('ix_projects_id', 'projects', ['id'])

    # ── quotes ──
    # Note: quote_sequence is added in migration 002
    op.create_table(
        'quotes',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('created_at', sa.DateTime()),
        sa.Column('status', sa.String(), server_default='Draft'),
        sa.Column('current_version', sa.Integer(), server_default='0'),
        sa.Column('client_po_number', sa.String(), nullable=True),
        sa.Column('work_description', sa.String(), nullable=True),
        sa.Column('markup_control_enabled', sa.Boolean(), server_default='false'),
        sa.Column('global_markup_percent', sa.Float(), nullable=True),
    )
    op.create_index('ix_quotes_id', 'quotes', ['id'])

    # ── quote_line_items ──
    # Note: quantity columns are Float here; migration 003 converts to Integer
    op.create_table(
        'quote_line_items',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('quote_id', sa.Integer(), sa.ForeignKey('quotes.id'), nullable=False),
        sa.Column('item_type', sa.String(), nullable=False),
        sa.Column('labor_id', sa.Integer(), sa.ForeignKey('labor.id'), nullable=True),
        sa.Column('part_id', sa.Integer(), sa.ForeignKey('parts.id'), nullable=True),
        sa.Column('misc_id', sa.Integer(), sa.ForeignKey('miscellaneous.id'), nullable=True),
        sa.Column('discount_code_id', sa.Integer(), sa.ForeignKey('discount_codes.id'), nullable=True),
        sa.Column('description', sa.String()),
        sa.Column('quantity', sa.Float(), server_default='1'),
        sa.Column('unit_price', sa.Float()),
        sa.Column('qty_pending', sa.Float(), server_default='0'),
        sa.Column('qty_fulfilled', sa.Float(), server_default='0'),
        sa.Column('is_pms', sa.Boolean(), server_default='false'),
        sa.Column('pms_percent', sa.Float(), nullable=True),
        sa.Column('original_markup_percent', sa.Float(), nullable=True),
        sa.Column('base_cost', sa.Float(), nullable=True),
    )
    op.create_index('ix_quote_line_items_id', 'quote_line_items', ['id'])

    # ── purchase_orders ──
    # Note: PO versioning columns (po_sequence, current_version, etc.) are added in migration 004
    op.create_table(
        'purchase_orders',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('vendor_id', sa.Integer(), sa.ForeignKey('profiles.id'), nullable=False),
        sa.Column('created_at', sa.DateTime()),
        sa.Column('status', sa.String(), server_default='draft'),
    )
    op.create_index('ix_purchase_orders_id', 'purchase_orders', ['id'])

    # ── po_line_items ──
    # Note: qty_pending, qty_received, actual_unit_price are added in migration 004
    op.create_table(
        'po_line_items',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('purchase_order_id', sa.Integer(), sa.ForeignKey('purchase_orders.id'), nullable=False),
        sa.Column('item_type', sa.String(), nullable=False),
        sa.Column('part_id', sa.Integer(), sa.ForeignKey('parts.id'), nullable=True),
        sa.Column('description', sa.String()),
        sa.Column('quantity', sa.Float(), server_default='1'),
        sa.Column('unit_price', sa.Float()),
    )
    op.create_index('ix_po_line_items_id', 'po_line_items', ['id'])

    # ── invoices ──
    op.create_table(
        'invoices',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('quote_id', sa.Integer(), sa.ForeignKey('quotes.id'), nullable=False),
        sa.Column('created_at', sa.DateTime()),
        sa.Column('status', sa.String(), server_default='Sent'),
        sa.Column('notes', sa.String()),
        sa.Column('voided_at', sa.DateTime()),
        sa.Column('voided_by_snapshot_id', sa.Integer()),
    )
    op.create_index('ix_invoices_id', 'invoices', ['id'])

    # ── invoice_line_items ──
    # Note: quantity columns are Float here; migration 003 converts to Integer
    op.create_table(
        'invoice_line_items',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('invoice_id', sa.Integer(), sa.ForeignKey('invoices.id'), nullable=False),
        sa.Column('quote_line_item_id', sa.Integer()),
        sa.Column('item_type', sa.String(), nullable=False),
        sa.Column('description', sa.String()),
        sa.Column('unit_price', sa.Float()),
        sa.Column('qty_ordered', sa.Float()),
        sa.Column('qty_fulfilled_this_invoice', sa.Float()),
        sa.Column('qty_fulfilled_total', sa.Float()),
        sa.Column('qty_pending_after', sa.Float()),
        sa.Column('labor_id', sa.Integer()),
        sa.Column('part_id', sa.Integer()),
        sa.Column('misc_id', sa.Integer()),
        sa.Column('discount_code_id', sa.Integer()),
    )
    op.create_index('ix_invoice_line_items_id', 'invoice_line_items', ['id'])

    # ── quote_snapshots ──
    op.create_table(
        'quote_snapshots',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('quote_id', sa.Integer(), sa.ForeignKey('quotes.id'), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('action_type', sa.String(), nullable=False),
        sa.Column('action_description', sa.String()),
        sa.Column('created_at', sa.DateTime()),
        sa.Column('invoice_id', sa.Integer()),
    )
    op.create_index('ix_quote_snapshots_id', 'quote_snapshots', ['id'])

    # ── quote_line_item_snapshots ──
    # Note: quantity columns are Float here; migration 003 converts to Integer
    op.create_table(
        'quote_line_item_snapshots',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('snapshot_id', sa.Integer(), sa.ForeignKey('quote_snapshots.id'), nullable=False),
        sa.Column('original_line_item_id', sa.Integer()),
        sa.Column('item_type', sa.String(), nullable=False),
        sa.Column('labor_id', sa.Integer()),
        sa.Column('part_id', sa.Integer()),
        sa.Column('misc_id', sa.Integer()),
        sa.Column('discount_code_id', sa.Integer()),
        sa.Column('description', sa.String()),
        sa.Column('quantity', sa.Float()),
        sa.Column('unit_price', sa.Float()),
        sa.Column('qty_pending', sa.Float()),
        sa.Column('qty_fulfilled', sa.Float()),
        sa.Column('is_deleted', sa.Boolean(), server_default='false'),
        sa.Column('is_pms', sa.Boolean(), server_default='false'),
        sa.Column('pms_percent', sa.Float(), nullable=True),
        sa.Column('original_markup_percent', sa.Float(), nullable=True),
        sa.Column('base_cost', sa.Float(), nullable=True),
    )
    op.create_index('ix_quote_line_item_snapshots_id', 'quote_line_item_snapshots', ['id'])

    # ── company_settings ──
    # Note: hst_rate is added in migration 007
    op.create_table(
        'company_settings',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('address', sa.String()),
        sa.Column('phone', sa.String()),
        sa.Column('fax', sa.String()),
        sa.Column('gst_number', sa.String()),
    )
    op.create_index('ix_company_settings_id', 'company_settings', ['id'])


def downgrade() -> None:
    """Drop all baseline tables in reverse dependency order."""
    op.drop_table('quote_line_item_snapshots')
    op.drop_table('quote_snapshots')
    op.drop_table('invoice_line_items')
    op.drop_table('invoices')
    op.drop_table('po_line_items')
    op.drop_table('purchase_orders')
    op.drop_table('quote_line_items')
    op.drop_table('quotes')
    op.drop_table('projects')
    op.drop_table('company_settings')
    op.drop_table('discount_codes')
    op.drop_table('miscellaneous')
    op.drop_table('part_labor_link')
    op.drop_table('labor')
    op.drop_table('parts')
    op.drop_table('contact_phones')
    op.drop_table('contacts')
    op.drop_table('profiles')
    op.drop_table('categories')

    # Drop enum types
    sa.Enum(name='phonetype').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='profiletype').drop(op.get_bind(), checkfirst=True)
