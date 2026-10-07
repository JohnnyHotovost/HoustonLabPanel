"""One household, relational domain. All historical FKs restrict deletion.

Profiles extend a common entity. Quantities derive from an append-only ledger.
Business records are never cascade-deleted. JSON is limited to preferences and audit snapshots.
"""
from sqlalchemy import Column, String, Text, Boolean, Integer, Date, DateTime, Numeric, ForeignKey, CheckConstraint, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from database import Base, uid, now

def ID(): return Column(String(36), primary_key=True, default=uid)
def FK(table, nullable=True): return Column(String(36), ForeignKey(f'{table}.id', ondelete='RESTRICT'), nullable=nullable, index=True)
def TS(): return Column(DateTime(timezone=True), default=now, nullable=False)

class Household(Base):
    __tablename__ = 'households'
    id = Column(Integer, primary_key=True)
    name = Column(String(120), nullable=False)
    created_at = TS()
    __table_args__ = (CheckConstraint('id = 1', name='single_household'),)

class User(Base):
    __tablename__ = 'users'
    id = ID()
    email = Column(String(254), unique=True, nullable=False)
    name = Column(String(120), nullable=False)
    password_hash = Column(Text, nullable=False)
    role = Column(String(16), nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    language = Column(String(2), default='en', nullable=False)
    preferences = Column(JSONB, default=dict, nullable=False)
    created_at = TS()
    __table_args__ = (CheckConstraint("role IN ('OWNER','ADMIN','MEMBER','VIEWER')", name='user_role'), CheckConstraint("language IN ('en','cs')", name='user_language'))

class LoginSession(Base):
    __tablename__ = 'sessions'
    id = ID()
    user_id = FK('users', False)
    token_hash = Column(String(64), unique=True, nullable=False)
    csrf_hash = Column(String(64), nullable=False)
    created_at = TS()
    expires_at = Column(DateTime(timezone=True), nullable=False)
    last_seen = TS()
    user_agent = Column(String(250), nullable=False)

class AuthAttempt(Base):
    __tablename__ = 'auth_attempts'
    id = ID()
    key = Column(String(64), index=True, nullable=False)
    created_at = TS()

class Location(Base):
    __tablename__ = 'locations'
    id = ID()
    name = Column(String(160), nullable=False)
    type = Column(String(24), nullable=False)
    parent_id = FK('locations')
    description = Column(Text, default='', nullable=False)
    archived_at = Column(DateTime(timezone=True))
    created_at = TS()
    __table_args__ = (CheckConstraint('parent_id IS NULL OR parent_id != id', name='location_no_self_parent'),)

class Entity(Base):
    __tablename__ = 'entities'
    id = ID()
    entity_type = Column(String(20), nullable=False, index=True)
    name = Column(String(180), nullable=False)
    status = Column(String(24), nullable=False)
    description = Column(Text, default='', nullable=False)
    location_id = FK('locations')
    created_at = TS()
    updated_at = Column(DateTime(timezone=True), default=now, onupdate=now, nullable=False)
    archived_at = Column(DateTime(timezone=True))
    __table_args__ = (CheckConstraint("entity_type IN ('VEHICLE','HOME_ASSET','INVENTORY')", name='entity_type'),)

class VehicleProfile(Base):
    __tablename__ = 'vehicle_profiles'
    entity_id = Column(String(36), ForeignKey('entities.id', ondelete='RESTRICT'), primary_key=True)
    manufacturer = Column(String(100), default='')
    model = Column(String(100), default='')
    plate = Column(String(32), default='')
    vin = Column(String(32), default='')
    year = Column(Integer)
    mileage = Column(Integer, default=0, nullable=False)
    engine = Column(String(100), default='')
    transmission = Column(String(24), default='MANUAL', nullable=False)
    drivetrain = Column(String(8), default='FWD', nullable=False)
    differential = Column(String(24), default='NONE', nullable=False)
    sale_date = Column(Date)
    sale_mileage = Column(Integer)
    sale_price = Column(Numeric(14, 2))
    sale_note = Column(Text)
    __table_args__ = (CheckConstraint('mileage >= 0', name='vehicle_mileage_nonnegative'),)

class AssetProfile(Base):
    __tablename__ = 'asset_profiles'
    entity_id = Column(String(36), ForeignKey('entities.id', ondelete='RESTRICT'), primary_key=True)
    manufacturer = Column(String(100), default='')
    model = Column(String(100), default='')
    serial_number = Column(String(100), default='')
    category = Column(String(40), default='OTHER')
    purchase_date = Column(Date)
    warranty_end = Column(Date)

class InventoryProfile(Base):
    __tablename__ = 'inventory_profiles'
    entity_id = Column(String(36), ForeignKey('entities.id', ondelete='RESTRICT'), primary_key=True)
    unit = Column(String(24), default='pcs', nullable=False)
    consumable = Column(Boolean, default=False, nullable=False)
    min_stock = Column(Numeric(14, 3), default=0, nullable=False)
    sku = Column(String(80), default='')
    __table_args__ = (CheckConstraint('min_stock >= 0', name='minimum_stock_nonnegative'),)

class Component(Base):
    __tablename__ = 'components'
    id = ID()
    entity_id = FK('entities', False)
    name = Column(String(140), nullable=False)
    kind = Column(String(32), nullable=False)
    generated = Column(Boolean, default=False, server_default='false', nullable=False)
    status = Column(String(24), default='ACTIVE', nullable=False)
    installed_at = Column(Date)
    removed_at = Column(Date)
    created_at = TS()

class MileageRecord(Base):
    __tablename__ = 'mileage_records'
    id = ID()
    entity_id = FK('entities', False)
    mileage = Column(Integer, nullable=False)
    recorded_at = TS()
    recorded_by = FK('users', False)
    __table_args__ = (CheckConstraint('mileage >= 0', name='mileage_record_nonnegative'),)

class MaintenanceDefinition(Base):
    __tablename__ = 'maintenance_definitions'
    id = ID()
    entity_id = FK('entities', False)
    component_id = FK('components')
    title = Column(String(180), nullable=False)
    strategy = Column(String(24), nullable=False)
    interval_days = Column(Integer)
    interval_km = Column(Integer)
    fixed_date = Column(Date)
    baseline_date = Column(Date, nullable=False)
    baseline_mileage = Column(Integer, default=0, nullable=False)
    warning_days = Column(Integer, default=30, nullable=False)
    warning_km = Column(Integer, default=1500, nullable=False)
    source = Column(String(32), default='OWNER_DEFINED', nullable=False)
    source_reference = Column(Text, default='')
    paused = Column(Boolean, default=False, nullable=False)
    created_at = TS()
    __table_args__ = (CheckConstraint('interval_days IS NULL OR interval_days > 0', name='maintenance_positive_days'), CheckConstraint('interval_km IS NULL OR interval_km > 0', name='maintenance_positive_km'))

class ServiceEvent(Base):
    __tablename__ = 'service_events'
    id = ID()
    entity_id = FK('entities', False)
    title = Column(String(180), nullable=False)
    date = Column(Date, nullable=False)
    mileage = Column(Integer)
    workshop = Column(String(160), default='')
    notes = Column(Text, default='')
    created_at = TS()
    created_by = FK('users', False)

class MaintenanceRecord(Base):
    __tablename__ = 'maintenance_records'
    id = ID()
    definition_id = FK('maintenance_definitions', False)
    service_event_id = FK('service_events')
    date = Column(Date, nullable=False)
    mileage = Column(Integer)
    result = Column(String(24), default='COMPLETED', nullable=False)
    notes = Column(Text, default='')
    created_by = FK('users', False)
    created_at = TS()
    __table_args__ = (UniqueConstraint('definition_id', 'service_event_id', name='one_definition_per_service'),)

class StockMovement(Base):
    __tablename__ = 'stock_movements'
    id = ID()
    entity_id = FK('entities', False)
    delta = Column(Numeric(14, 3), nullable=False)
    reason = Column(String(240), nullable=False)
    service_event_id = FK('service_events')
    created_by = FK('users', False)
    created_at = TS()
    __table_args__ = (CheckConstraint('delta != 0', name='nonzero_movement'),)

class Task(Base):
    __tablename__ = 'tasks'
    id = ID()
    title = Column(String(180), nullable=False)
    description = Column(Text, default='', nullable=False)
    status = Column(String(24), default='OPEN', nullable=False)
    priority = Column(String(16), default='NORMAL', nullable=False)
    due_date = Column(Date)
    entity_id = FK('entities')
    location_id = FK('locations')
    assigned_user_id = FK('users')
    maintenance_id = FK('maintenance_definitions')
    created_by = FK('users', False)
    created_at = TS()
    updated_at = Column(DateTime(timezone=True), default=now, onupdate=now, nullable=False)
    __table_args__ = (CheckConstraint("status IN ('OPEN','IN_PROGRESS','BLOCKED','COMPLETED','CANCELLED')", name='task_status'),)

class Expense(Base):
    __tablename__ = 'expenses'
    id = ID()
    entity_id = FK('entities')
    service_event_id = FK('service_events')
    task_id = FK('tasks')
    amount = Column(Numeric(14, 2), nullable=False)
    currency = Column(String(3), default='CZK', nullable=False)
    category = Column(String(80), nullable=False)
    date = Column(Date, nullable=False)
    supplier = Column(String(160), default='')
    notes = Column(Text, default='')
    created_at = TS()
    __table_args__ = (CheckConstraint('amount >= 0', name='expense_nonnegative'),)

class FileBlob(Base):
    __tablename__ = 'file_blobs'
    id = ID()
    sha256 = Column(String(64), unique=True, nullable=False)
    size = Column(Integer, nullable=False)
    content_type = Column(String(80), nullable=False)
    storage_key = Column(String(80), unique=True, nullable=False)

class Document(Base):
    __tablename__ = 'documents'
    id = ID()
    blob_id = FK('file_blobs', False)
    title = Column(String(180), nullable=False)
    type = Column(String(32), nullable=False)
    status = Column(String(24), default='ACTIVE', nullable=False)
    original_filename = Column(String(250), nullable=False)
    created_by = FK('users', False)
    created_at = TS()

class DocumentLink(Base):
    __tablename__ = 'document_links'
    id = ID()
    document_id = FK('documents', False)
    entity_id = FK('entities')
    location_id = FK('locations')
    service_event_id = FK('service_events')
    task_id = FK('tasks')
    expense_id = FK('expenses')
    __table_args__ = (CheckConstraint('num_nonnulls(entity_id, location_id, service_event_id, task_id, expense_id) = 1', name='document_single_link_target'),)

class EntityRelationship(Base):
    __tablename__ = 'entity_relationships'
    id = ID()
    source_id = FK('entities', False)
    target_id = FK('entities', False)
    type = Column(String(32), nullable=False)
    created_at = TS()
    __table_args__ = (CheckConstraint('source_id != target_id', name='relationship_not_self'), UniqueConstraint('source_id','target_id','type',name='unique_relationship'))

class Activity(Base):
    __tablename__ = 'activity'
    id = ID()
    actor_id = FK('users', False)
    action = Column(String(64), nullable=False)
    object_type = Column(String(40), nullable=False)
    object_id = Column(String(36), nullable=False, index=True)
    object_name = Column(String(180), nullable=False)
    before = Column(JSONB)
    after = Column(JSONB)
    created_at = TS()