from datetime import date
from decimal import Decimal
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, EmailStr, model_validator

class Strict(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)

class Login(Strict):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

class Setup(Login):
    name: str = Field(min_length=1, max_length=120)
    household_name: str = Field(min_length=1, max_length=120)
    language: Literal['en','cs'] = 'en'
    password: str = Field(min_length=12, max_length=128)

class UserCreate(Login):
    name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=12, max_length=128)
    role: Literal['ADMIN','MEMBER','VIEWER'] = 'MEMBER'

class UserAccess(Strict):
    role: Optional[Literal['ADMIN','MEMBER','VIEWER']] = None
    active: Optional[bool] = None

class Preferences(Strict):
    language: Literal['en','cs']
    distance: Literal['km','mi'] = 'km'
    temperature: Literal['C','F'] = 'C'
    pressure: Literal['bar','psi'] = 'bar'
    volume: Literal['L','gal'] = 'L'
    power: Literal['kW','hp'] = 'kW'
    currency: Literal['CZK'] = 'CZK'

class PasswordChange(Strict):
    current_password: str = Field(max_length=128)
    new_password: str = Field(min_length=12, max_length=128)

class LocationCreate(Strict):
    name: str = Field(min_length=1, max_length=160)
    type: Literal['ROOM','AREA','CABINET','SHELF','DRAWER','RACK','BOX','BIN','OTHER'] = 'ROOM'
    parent_id: Optional[str] = None
    description: str = Field(default='', max_length=10000)

class LocationMove(Strict):
    parent_id: Optional[str] = None

class VehicleInput(Strict):
    manufacturer: str = Field(default='', max_length=100)
    model: str = Field(default='', max_length=100)
    plate: str = Field(default='', max_length=32)
    vin: str = Field(default='', max_length=32)
    year: Optional[int] = Field(default=None, ge=1886, le=2100)
    mileage: int = Field(default=0, ge=0, le=9999999)
    engine: str = Field(default='', max_length=100)
    transmission: Literal['MANUAL','AUTOMATIC','DSG','ELECTRIC'] = 'MANUAL'
    drivetrain: Literal['FWD','RWD','AWD'] = 'FWD'
    differential: Literal['NONE','VAQ','HALDEX','OTHER'] = 'NONE'
    @model_validator(mode='after')
    def configuration(self):
        if self.differential == 'HALDEX' and self.drivetrain != 'AWD': raise ValueError('Haldex requires AWD')
        if self.differential == 'VAQ' and self.drivetrain != 'FWD': raise ValueError('VAQ requires FWD')
        return self

class AssetInput(Strict):
    manufacturer: str = Field(default='', max_length=100)
    model: str = Field(default='', max_length=100)
    serial_number: str = Field(default='', max_length=100)
    category: Literal['APPLIANCES','CLIMATE','WATER','CLEANING','ELECTRICAL','SMART_HOME','NETWORKING','BUILDING','OTHER'] = 'OTHER'
    purchase_date: Optional[date] = None
    warranty_end: Optional[date] = None

class InventoryInput(Strict):
    unit: str = Field(default='pcs', min_length=1, max_length=24)
    consumable: bool = False
    min_stock: Decimal = Field(default=0, ge=0, max_digits=14, decimal_places=3)
    sku: str = Field(default='', max_length=80)
    initial_quantity: Decimal = Field(default=0, ge=0, max_digits=14, decimal_places=3)

class EntityCreate(Strict):
    entity_type: Literal['VEHICLE','HOME_ASSET','INVENTORY']
    name: str = Field(min_length=1, max_length=180)
    description: str = Field(default='', max_length=10000)
    location_id: Optional[str] = None
    vehicle: Optional[VehicleInput] = None
    asset: Optional[AssetInput] = None
    inventory: Optional[InventoryInput] = None
    @model_validator(mode='after')
    def profile(self):
        expected = {'VEHICLE':'vehicle','HOME_ASSET':'asset','INVENTORY':'inventory'}[self.entity_type]
        for field in ['vehicle','asset','inventory']:
            if field != expected and getattr(self, field) is not None: raise ValueError('Incompatible profile')
        return self

class EntityUpdate(Strict):
    name: Optional[str] = Field(default=None, min_length=1, max_length=180)
    description: Optional[str] = Field(default=None, max_length=10000)
    location_id: Optional[str] = None
    status: Optional[Literal['ACTIVE','OPERATIONAL','STORED','IN_SERVICE','UNAVAILABLE','IN_REPAIR','REPLACED','DISPOSED']] = None

class Mileage(Strict):
    mileage: int = Field(ge=0, le=9999999)

class Sale(Strict):
    sale_date: date
    sale_mileage: int = Field(ge=0, le=9999999)
    sale_price: Optional[Decimal] = Field(default=None, ge=0, max_digits=14, decimal_places=2)
    sale_note: str = Field(default='', max_length=10000)

class ComponentCreate(Strict):
    name: str = Field(min_length=1, max_length=140)
    kind: Literal['ENGINE','TRANSMISSION','CLUTCH','DIFFERENTIAL','BRAKES','COOLING','SUSPENSION','WHEELS','OTHER'] = 'OTHER'
    installed_at: Optional[date] = None

class MaintenanceCreate(Strict):
    entity_id: str
    component_id: Optional[str] = None
    title: str = Field(min_length=1, max_length=180)
    strategy: Literal['TIME','DISTANCE','COMBINED','FIXED_DATE','CONDITION']
    interval_days: Optional[int] = Field(default=None, gt=0, le=36500)
    interval_km: Optional[int] = Field(default=None, gt=0, le=9999999)
    fixed_date: Optional[date] = None
    baseline_date: date
    baseline_mileage: int = Field(default=0, ge=0)
    warning_days: int = Field(default=30, ge=0, le=3650)
    warning_km: int = Field(default=1500, ge=0, le=100000)
    source: Literal['MANUFACTURER','SERVICE_MANUAL','DEALER','SPECIALIST','OWNER_DEFINED','PRESET'] = 'OWNER_DEFINED'
    source_reference: str = Field(default='', max_length=10000)
    @model_validator(mode='after')
    def thresholds(self):
        if self.strategy in ('TIME','COMBINED') and not self.interval_days: raise ValueError('Interval days required')
        if self.strategy in ('DISTANCE','COMBINED') and not self.interval_km: raise ValueError('Interval distance required')
        if self.strategy == 'FIXED_DATE' and not self.fixed_date: raise ValueError('Fixed date required')
        return self

class MaintenancePause(Strict):
    paused: bool

class Completion(Strict):
    date: date
    mileage: Optional[int] = Field(default=None, ge=0, le=9999999)
    notes: str = Field(default='', max_length=10000)

class Consumption(Strict):
    entity_id: str
    quantity: Decimal = Field(gt=0, max_digits=14, decimal_places=3)

class ServiceCreate(Completion):
    entity_id: str
    title: str = Field(min_length=1, max_length=180)
    workshop: str = Field(default='', max_length=160)
    maintenance_ids: list[str] = Field(default_factory=list, max_length=100)
    materials: list[Consumption] = Field(default_factory=list, max_length=100)
    cost: Decimal = Field(default=0, ge=0, max_digits=14, decimal_places=2)

class StockChange(Strict):
    delta: Decimal = Field(max_digits=14, decimal_places=3)
    reason: str = Field(min_length=1, max_length=240)

class TaskCreate(Strict):
    title: str = Field(min_length=1, max_length=180)
    description: str = Field(default='', max_length=10000)
    priority: Literal['LOW','NORMAL','HIGH','CRITICAL'] = 'NORMAL'
    due_date: Optional[date] = None
    entity_id: Optional[str] = None
    location_id: Optional[str] = None
    assigned_user_id: Optional[str] = None

class TaskUpdate(Strict):
    status: Literal['OPEN','IN_PROGRESS','BLOCKED','COMPLETED','CANCELLED']

class ExpenseCreate(Strict):
    entity_id: Optional[str] = None
    service_event_id: Optional[str] = None
    task_id: Optional[str] = None
    amount: Decimal = Field(ge=0, max_digits=14, decimal_places=2)
    currency: Literal['CZK'] = 'CZK'
    category: str = Field(min_length=1, max_length=80)
    date: date
    supplier: str = Field(default='', max_length=160)
    notes: str = Field(default='', max_length=10000)

class DocumentLinkInput(Strict):
    entity_id: Optional[str] = None
    location_id: Optional[str] = None
    service_event_id: Optional[str] = None
    task_id: Optional[str] = None
    expense_id: Optional[str] = None
    @model_validator(mode='after')
    def one_target(self):
        if sum(bool(v) for v in self.model_dump().values()) != 1: raise ValueError('Exactly one target required')
        return self