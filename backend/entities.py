from decimal import Decimal
from fastapi import APIRouter, Depends
from sqlalchemy import select, func, text
from sqlalchemy.orm import Session
from database import get_db, now
from models import Entity, VehicleProfile, AssetProfile, InventoryProfile, Location, Component, MileageRecord, StockMovement, Task, Activity, Expense
from schemas import EntityCreate, EntityUpdate, VehicleInput, AssetInput, InventoryInput, LocationCreate, LocationMove, Mileage, Sale, ComponentCreate, StockChange
from common import row, get, fail, audit, reference
from auth import require

router = APIRouter(prefix='/api')
PROFILE = {'VEHICLE':VehicleProfile,'HOME_ASSET':AssetProfile,'INVENTORY':InventoryProfile}
INACTIVE = {'SOLD','WRITTEN_OFF','REPLACED','DISPOSED','ARCHIVED'}

def stock(db,id):
    return db.scalar(select(func.coalesce(func.sum(StockMovement.delta),0)).where(StockMovement.entity_id==id))

def location_path(db,id):
    names, seen = [], set()
    while id and id not in seen:
        seen.add(id)
        loc=db.get(Location,id)
        if not loc: break
        names.append(loc.name); id=loc.parent_id
    return ' / '.join(reversed(names))

def entity_data(db,entity):
    data=row(entity)
    profile=db.get(PROFILE[entity.entity_type],entity.id)
    data['profile']=row(profile) if profile else {}
    if entity.entity_type=='INVENTORY':
        data['profile']['quantity']=float(stock(db,entity.id))
        data['profile']['low_stock']=bool(profile.consumable and stock(db,entity.id)<profile.min_stock)
    data['location_path']=location_path(db,entity.location_id)
    if entity.archived_at: data['status']='ARCHIVED'
    return data

def ensure_active(entity):
    if entity.archived_at or entity.status in INACTIVE: fail('archived',409)

def set_mileage(db,entity,mileage,user):
    profile=db.get(VehicleProfile,entity.id)
    if not profile: fail('invalid_link',422)
    if mileage<profile.mileage: fail('mileage_decrease',422)
    old=profile.mileage
    if mileage==old: return
    profile.mileage=mileage
    db.add(MileageRecord(entity_id=entity.id,mileage=mileage,recorded_by=user.id))
    audit(db,user,'MILEAGE_UPDATED',entity,{'mileage':old},{'mileage':mileage})

@router.get('/locations')
def locations(user=Depends(require('read')),db: Session=Depends(get_db)):
    items=db.scalars(select(Location).where(Location.archived_at.is_(None)).order_by(Location.created_at)).all()
    return [{**row(l),'path':location_path(db,l.id),'entity_count':db.scalar(select(func.count()).select_from(Entity).where(Entity.location_id==l.id,Entity.archived_at.is_(None)))} for l in items]

@router.post('/locations',status_code=201)
def create_location(data:LocationCreate,user=Depends(require('write')),db:Session=Depends(get_db)):
    if data.parent_id:
        parent=get(db,Location,data.parent_id)
        if parent.archived_at: fail('archived',409)
    item=Location(**data.model_dump()); db.add(item)
    audit(db,user,'LOCATION_CREATED',item,after=data.model_dump()); db.commit()
    return row(item)

@router.get('/locations/{id}')
def location_detail(id:str,user=Depends(require('read')),db:Session=Depends(get_db)):
    item=get(db,Location,id)
    children=db.scalars(select(Location).where(Location.parent_id==id,Location.archived_at.is_(None))).all()
    ids={id}; pending=[l.id for l in children]
    while pending:
        current=pending.pop()
        if current in ids: continue
        ids.add(current)
        pending.extend(db.scalars(select(Location.id).where(Location.parent_id==current,Location.archived_at.is_(None))).all())
    return {**row(item),'path':location_path(db,id),'children':[row(l) for l in children],
            'entities':[entity_data(db,e) for e in db.scalars(select(Entity).where(Entity.location_id.in_(ids))).all()],
            'tasks':[row(t) for t in db.scalars(select(Task).where(Task.location_id.in_(ids))).all()]}

@router.patch('/locations/{id}/move')
def move_location(id:str,data:LocationMove,user=Depends(require('write')),db:Session=Depends(get_db)):
    db.execute(text('SELECT pg_advisory_xact_lock(73482020)'))
    item=get(db,Location,id)
    current=data.parent_id; visited=set()
    while current:
        if current==id or current in visited: fail('location_cycle',422)
        visited.add(current)
        parent=get(db,Location,current)
        if parent.archived_at: fail('archived',409)
        current=parent.parent_id
    before={'parent_id':item.parent_id,'path':location_path(db,id)}
    item.parent_id=data.parent_id; db.flush()
    audit(db,user,'LOCATION_MOVED',item,before,{'parent_id':item.parent_id,'path':location_path(db,id)})
    db.commit(); return row(item)

@router.get('/entities')
def list_entities(entity_type:str|None=None,archived:bool=False,user=Depends(require('read')),db:Session=Depends(get_db)):
    query=select(Entity).order_by(Entity.created_at.desc())
    if entity_type: query=query.where(Entity.entity_type==entity_type)
    if not archived: query=query.where(Entity.archived_at.is_(None))
    return [entity_data(db,e) for e in db.scalars(query).all()]

@router.post('/entities',status_code=201)
def create_entity(data:EntityCreate,user=Depends(require('write')),db:Session=Depends(get_db)):
    if data.location_id:
        loc=get(db,Location,data.location_id)
        if loc.archived_at: fail('archived',409)
    entity=Entity(name=data.name,entity_type=data.entity_type,description=data.description,location_id=data.location_id,status='OPERATIONAL' if data.entity_type=='VEHICLE' else 'ACTIVE')
    db.add(entity); db.flush()
    if data.entity_type=='VEHICLE':
        values=(data.vehicle or VehicleInput()).model_dump()
        db.add(VehicleProfile(entity_id=entity.id,**values))
        db.add(MileageRecord(entity_id=entity.id,mileage=values['mileage'],recorded_by=user.id))
        components=[('TRACTION_MOTOR' if values['transmission']=='ELECTRIC' else 'ENGINE','ENGINE'),('TRANSMISSION','TRANSMISSION'),('BRAKES','BRAKES'),('COOLING','COOLING'),('SUSPENSION','SUSPENSION'),('WHEELS','WHEELS')]
        if values['transmission']=='MANUAL': components.append(('CLUTCH','CLUTCH'))
        if values['differential']!='NONE': components.append((values['differential'],'DIFFERENTIAL'))
        if values['drivetrain'] in ('RWD','AWD'): components.append(('REAR_DIFFERENTIAL','DIFFERENTIAL'))
        for name,kind in components: db.add(Component(entity_id=entity.id,name=name,kind=kind,generated=True))
    elif data.entity_type=='HOME_ASSET': db.add(AssetProfile(entity_id=entity.id,**(data.asset or AssetInput()).model_dump()))
    else:
        values=(data.inventory or InventoryInput()).model_dump()
        quantity=values.pop('initial_quantity')
        db.add(InventoryProfile(entity_id=entity.id,**values))
        if quantity: db.add(StockMovement(entity_id=entity.id,delta=quantity,reason='INITIAL_STOCK',created_by=user.id))
    audit(db,user,'ENTITY_CREATED',entity,after={'name':entity.name,'entity_type':entity.entity_type})
    db.commit(); return entity_data(db,entity)

@router.get('/entities/{id}')
def entity_detail(id:str,user=Depends(require('read')),db:Session=Depends(get_db)):
    entity=get(db,Entity,id)
    return {**entity_data(db,entity),'components':[row(c) for c in db.scalars(select(Component).where(Component.entity_id==id).order_by(Component.created_at)).all()],
            'mileage_history':[row(m) for m in db.scalars(select(MileageRecord).where(MileageRecord.entity_id==id).order_by(MileageRecord.recorded_at.desc())).all()],
            'expenses':[row(e) for e in db.scalars(select(Expense).where(Expense.entity_id==id).order_by(Expense.date.desc())).all()]}

@router.patch('/entities/{id}')
def update_entity(id:str,data:EntityUpdate,user=Depends(require('write')),db:Session=Depends(get_db)):
    entity=db.scalar(select(Entity).where(Entity.id==id).with_for_update())
    if not entity: fail('not_found',404)
    ensure_active(entity)
    values=data.model_dump(exclude_unset=True)
    if values.get('status'):
        allowed={'VEHICLE':{'OPERATIONAL','STORED','IN_SERVICE','UNAVAILABLE'},'HOME_ASSET':{'ACTIVE','STORED','IN_REPAIR','REPLACED','DISPOSED'},'INVENTORY':{'ACTIVE','STORED','DISPOSED'}}
        if values['status'] not in allowed[entity.entity_type]: fail('validation',422)
    if values.get('name') is None and 'name' in values: fail('validation',422)
    if values.get('description') is None and 'description' in values: fail('validation',422)
    if values.get('status') is None and 'status' in values: fail('validation',422)
    if values.get('location_id'): reference(db,Location,values['location_id'])
    before={k:getattr(entity,k) for k in values}
    for k,v in values.items(): setattr(entity,k,v)
    audit(db,user,'ENTITY_UPDATED',entity,before,values); db.commit(); return entity_data(db,entity)

@router.post('/entities/{id}/archive')
def archive_entity(id:str,user=Depends(require('archive')),db:Session=Depends(get_db)):
    entity=get(db,Entity,id); before={'archived_at':entity.archived_at}
    entity.archived_at=now()
    audit(db,user,'ENTITY_ARCHIVED',entity,before,{'archived_at':entity.archived_at}); db.commit(); return entity_data(db,entity)

@router.post('/entities/{id}/restore')
def restore_entity(id:str,user=Depends(require('archive')),db:Session=Depends(get_db)):
    entity=get(db,Entity,id); before={'archived_at':entity.archived_at}; entity.archived_at=None
    audit(db,user,'ENTITY_RESTORED',entity,before,{'archived_at':None}); db.commit(); return entity_data(db,entity)

@router.post('/entities/{id}/mileage')
def mileage(id:str,data:Mileage,user=Depends(require('write')),db:Session=Depends(get_db)):
    entity=db.scalar(select(Entity).where(Entity.id==id).with_for_update())
    if not entity: fail('not_found',404)
    ensure_active(entity); set_mileage(db,entity,data.mileage,user); db.commit(); return entity_data(db,entity)

@router.post('/entities/{id}/sell')
def sell(id:str,data:Sale,user=Depends(require('archive')),db:Session=Depends(get_db)):
    entity=db.scalar(select(Entity).where(Entity.id==id).with_for_update())
    if not entity: fail('not_found',404)
    ensure_active(entity)
    if entity.entity_type!='VEHICLE' or data.sale_date>now().date(): fail('validation',422)
    set_mileage(db,entity,data.sale_mileage,user)
    profile=get(db,VehicleProfile,id)
    for k,v in data.model_dump().items(): setattr(profile,k,v)
    before={'status':entity.status}; entity.status='SOLD'
    audit(db,user,'VEHICLE_SOLD',entity,before,{'status':'SOLD',**data.model_dump()}); db.commit(); return entity_data(db,entity)

@router.post('/entities/{id}/components',status_code=201)
def component(id:str,data:ComponentCreate,user=Depends(require('write')),db:Session=Depends(get_db)):
    entity=get(db,Entity,id); ensure_active(entity)
    if entity.entity_type=='INVENTORY': fail('invalid_link',422)
    item=Component(entity_id=id,**data.model_dump()); db.add(item)
    audit(db,user,'COMPONENT_CREATED',item,after=data.model_dump()); db.commit(); return row(item)

@router.post('/components/{id}/retire')
def retire_component(id:str,user=Depends(require('write')),db:Session=Depends(get_db)):
    item=get(db,Component,id); ensure_active(get(db,Entity,item.entity_id))
    item.status='RETIRED'; item.removed_at=now().date()
    audit(db,user,'COMPONENT_RETIRED',item,{'status':'ACTIVE'},{'status':'RETIRED','removed_at':item.removed_at}); db.commit(); return row(item)

@router.post('/entities/{id}/stock',status_code=201)
def change_stock(id:str,data:StockChange,user=Depends(require('write')),db:Session=Depends(get_db)):
    entity=db.scalar(select(Entity).where(Entity.id==id).with_for_update())
    if not entity: fail('not_found',404)
    ensure_active(entity)
    if entity.entity_type!='INVENTORY' or data.delta==0: fail('validation',422)
    before=stock(db,id)
    if before+data.delta<0: fail('insufficient_stock',409)
    item=StockMovement(entity_id=id,delta=data.delta,reason=data.reason,created_by=user.id); db.add(item)
    audit(db,user,'STOCK_CHANGED',entity,{'quantity':before},{'quantity':before+data.delta,'delta':data.delta,'reason':data.reason})
    db.commit(); return row(item)

@router.get('/stock-movements')
def movements(entity_id:str|None=None,user=Depends(require('read')),db:Session=Depends(get_db)):
    query=select(StockMovement).order_by(StockMovement.created_at.desc())
    if entity_id: query=query.where(StockMovement.entity_id==entity_id)
    return [{**row(m),'entity_name':get(db,Entity,m.entity_id).name,'unit':get(db,InventoryProfile,m.entity_id).unit} for m in db.scalars(query.limit(200)).all()]