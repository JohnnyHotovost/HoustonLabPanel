from datetime import timedelta
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from database import get_db, now
from models import Entity, Component, MaintenanceDefinition, MaintenanceRecord, VehicleProfile, ServiceEvent, StockMovement, Expense
from schemas import MaintenanceCreate, MaintenancePause, Completion, ServiceCreate
from common import get, row, fail, audit
from auth import require
from entities import ensure_active, stock, set_mileage, INACTIVE

router=APIRouter(prefix='/api')

def maintenance_state(db,item):
    entity=get(db,Entity,item.entity_id)
    component=db.get(Component,item.component_id) if item.component_id else None
    records=db.scalars(select(MaintenanceRecord).where(MaintenanceRecord.definition_id==item.id).order_by(MaintenanceRecord.date.desc(),MaintenanceRecord.created_at.desc())).all()
    latest=records[0] if records else None
    baseline_date=max(item.baseline_date,latest.date) if latest else item.baseline_date
    baseline_km=latest.mileage if latest and latest.date>=item.baseline_date and latest.mileage is not None else item.baseline_mileage
    vehicle=db.get(VehicleProfile,entity.id)
    next_date=None; next_km=None; remaining_days=None; remaining_km=None
    if item.strategy in ('TIME','COMBINED'): next_date=baseline_date+timedelta(days=item.interval_days)
    if item.strategy=='FIXED_DATE' and not latest: next_date=item.fixed_date
    if item.strategy in ('DISTANCE','COMBINED') and vehicle: next_km=baseline_km+item.interval_km
    if next_date: remaining_days=(next_date-now().date()).days
    if next_km is not None: remaining_km=next_km-vehicle.mileage
    checks=[x for x in [remaining_days,remaining_km] if x is not None]
    status='OK'
    if any(x<0 for x in checks): status='OVERDUE'
    elif any(x==0 for x in checks): status='DUE'
    elif (remaining_days is not None and remaining_days<=item.warning_days) or (remaining_km is not None and remaining_km<=item.warning_km): status='DUE_SOON'
    if item.paused: status='PAUSED'
    if entity.archived_at or entity.status in INACTIVE or (component and component.status!='ACTIVE'): status='NOT_APPLICABLE'
    return {**row(item),'entity_name':entity.name,'entity_type':entity.entity_type,'component_name':component.name if component else None,'component_generated':component.generated if component else False,
            'status':status,'next_date':next_date.isoformat() if next_date else None,'next_mileage':next_km,'remaining_days':remaining_days,'remaining_km':remaining_km,
            'records':[row(r) for r in records]}

def validate_completion(db,definition,data,entity):
    if data.date>now().date(): fail('validation',422)
    if definition.strategy in ('DISTANCE','COMBINED') and data.mileage is None: fail('validation',422)
    if data.mileage is not None and entity.entity_type!='VEHICLE': fail('validation',422)
    # A later dated reading must not undercut earlier service mileage.
    if data.mileage is not None:
        prev=db.scalar(select(func.max(MaintenanceRecord.mileage)).where(MaintenanceRecord.definition_id==definition.id,MaintenanceRecord.date<=data.date))
        if (prev is not None and data.mileage<prev) or (data.date>=definition.baseline_date and data.mileage<definition.baseline_mileage): fail('mileage_decrease',422)

@router.get('/maintenance')
def maintenance_list(entity_id:str|None=None,user=Depends(require('read')),db:Session=Depends(get_db)):
    q=select(MaintenanceDefinition).order_by(MaintenanceDefinition.created_at.desc())
    if entity_id: q=q.where(MaintenanceDefinition.entity_id==entity_id)
    return [maintenance_state(db,m) for m in db.scalars(q).all()]

@router.post('/maintenance',status_code=201)
def maintenance_create(data:MaintenanceCreate,user=Depends(require('write')),db:Session=Depends(get_db)):
    entity=get(db,Entity,data.entity_id); ensure_active(entity)
    if entity.entity_type=='INVENTORY': fail('invalid_link',422)
    if data.strategy in ('DISTANCE','COMBINED') and entity.entity_type!='VEHICLE': fail('validation',422)
    if data.component_id:
        component=get(db,Component,data.component_id)
        if component.entity_id!=entity.id or component.status!='ACTIVE': fail('invalid_link',422)
    item=MaintenanceDefinition(**data.model_dump()); db.add(item)
    audit(db,user,'MAINTENANCE_CREATED',item,after=data.model_dump()); db.commit(); return maintenance_state(db,item)

@router.patch('/maintenance/{id}')
def maintenance_pause(id:str,data:MaintenancePause,user=Depends(require('write')),db:Session=Depends(get_db)):
    item=get(db,MaintenanceDefinition,id); before={'paused':item.paused}; item.paused=data.paused
    audit(db,user,'MAINTENANCE_UPDATED',item,before,data.model_dump()); db.commit(); return maintenance_state(db,item)

@router.post('/maintenance/{id}/complete',status_code=201)
def maintenance_complete(id:str,data:Completion,user=Depends(require('write')),db:Session=Depends(get_db)):
    item=get(db,MaintenanceDefinition,id)
    entity=db.scalar(select(Entity).where(Entity.id==item.entity_id).with_for_update()); ensure_active(entity)
    validate_completion(db,item,data,entity)
    if item.component_id and get(db,Component,item.component_id).status!='ACTIVE': fail('archived',409)
    record=MaintenanceRecord(definition_id=id,created_by=user.id,**data.model_dump()); db.add(record)
    if entity.entity_type=='VEHICLE' and data.mileage is not None and data.mileage>get(db,VehicleProfile,entity.id).mileage: set_mileage(db,entity,data.mileage,user)
    audit(db,user,'MAINTENANCE_COMPLETED',item,after=data.model_dump()); db.commit(); return maintenance_state(db,item)

@router.get('/service')
def service_list(entity_id:str|None=None,user=Depends(require('read')),db:Session=Depends(get_db)):
    query=select(ServiceEvent).order_by(ServiceEvent.date.desc(),ServiceEvent.created_at.desc())
    if entity_id: query=query.where(ServiceEvent.entity_id==entity_id)
    return [service_data(db,item) for item in db.scalars(query).all()]

def service_data(db,item):
    records=db.scalars(select(MaintenanceRecord).where(MaintenanceRecord.service_event_id==item.id)).all()
    materials=db.scalars(select(StockMovement).where(StockMovement.service_event_id==item.id)).all()
    return {**row(item),'entity_name':get(db,Entity,item.entity_id).name,
            'records':[{**row(r),'title':get(db,MaintenanceDefinition,r.definition_id).title} for r in records],
            'materials':[{**row(m),'name':get(db,Entity,m.entity_id).name} for m in materials],
            'cost':float(db.scalar(select(func.coalesce(func.sum(Expense.amount),0)).where(Expense.service_event_id==item.id)))}

@router.get('/service/{id}')
def service_detail(id:str,user=Depends(require('read')),db:Session=Depends(get_db)):
    return service_data(db,get(db,ServiceEvent,id))

@router.post('/service',status_code=201)
def service_create(data:ServiceCreate,user=Depends(require('write')),db:Session=Depends(get_db)):
    # Stable lock order: service and stock changes remain atomic under concurrency.
    lock_ids=sorted(set([data.entity_id]+[m.entity_id for m in data.materials]))
    locked={e.id:e for e in db.scalars(select(Entity).where(Entity.id.in_(lock_ids)).order_by(Entity.id).with_for_update()).all()}
    if len(locked)!=len(lock_ids): fail('invalid_link',422)
    entity=locked[data.entity_id]; ensure_active(entity)
    if entity.entity_type=='INVENTORY' or data.date>now().date(): fail('validation',422)
    if entity.entity_type!='VEHICLE' and data.mileage is not None: fail('validation',422)
    if len(set(data.maintenance_ids))!=len(data.maintenance_ids): fail('validation',422)
    definitions=[]
    for id in data.maintenance_ids:
        definition=get(db,MaintenanceDefinition,id)
        if definition.entity_id!=entity.id: fail('invalid_link',422)
        if definition.component_id and get(db,Component,definition.component_id).status!='ACTIVE': fail('archived',409)
        validate_completion(db,definition,data,entity); definitions.append(definition)
    totals={}
    for material in data.materials: totals[material.entity_id]=totals.get(material.entity_id,0)+material.quantity
    for id,qty in totals.items():
        ensure_active(locked[id])
        if locked[id].entity_type!='INVENTORY': fail('invalid_link',422)
        if stock(db,id)<qty: fail('insufficient_stock',409)
    event=ServiceEvent(entity_id=data.entity_id,title=data.title,date=data.date,mileage=data.mileage,workshop=data.workshop,notes=data.notes,created_by=user.id)
    db.add(event); db.flush()
    for definition in definitions:
        db.add(MaintenanceRecord(definition_id=definition.id,service_event_id=event.id,date=data.date,mileage=data.mileage,notes=data.notes,created_by=user.id))
        audit(db,user,'MAINTENANCE_COMPLETED',definition,after={'service_event_id':event.id,'date':data.date,'mileage':data.mileage})
    for id,qty in totals.items():
        before=stock(db,id)
        db.add(StockMovement(entity_id=id,delta=-qty,reason=data.title,service_event_id=event.id,created_by=user.id))
        audit(db,user,'STOCK_CHANGED',locked[id],{'quantity':before},{'quantity':before-qty,'service_event_id':event.id})
    if data.cost:
        expense=Expense(entity_id=entity.id,service_event_id=event.id,amount=data.cost,currency='CZK',category='SERVICE',date=data.date,supplier=data.workshop)
        db.add(expense); audit(db,user,'EXPENSE_CREATED',expense,after={'amount':data.cost,'currency':'CZK'})
    if entity.entity_type=='VEHICLE' and data.mileage is not None and data.mileage>get(db,VehicleProfile,entity.id).mileage: set_mileage(db,entity,data.mileage,user)
    audit(db,user,'SERVICE_CREATED',event,after={'entity_id':entity.id,'date':data.date,'maintenance_items':len(definitions),'cost':data.cost})
    db.commit(); return service_data(db,event)