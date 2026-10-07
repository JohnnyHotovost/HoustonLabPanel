from datetime import timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session
from database import get_db, now
from models import Entity, Location, Task, User, Expense, ServiceEvent, Activity, MaintenanceDefinition, VehicleProfile, AssetProfile, InventoryProfile, Document
from schemas import TaskCreate, TaskUpdate, ExpenseCreate
from auth import require
from common import row, get, audit, reference, fail
from entities import entity_data, location_path, INACTIVE
from maintenance import maintenance_state

router=APIRouter(prefix='/api')

def task_data(db,task):
    return {**row(task),'entity_name':get(db,Entity,task.entity_id).name if task.entity_id else None,
            'location_name':location_path(db,task.location_id),'assigned_name':get(db,User,task.assigned_user_id).name if task.assigned_user_id else None}

@router.get('/tasks')
def task_list(entity_id:str|None=None,location_id:str|None=None,user=Depends(require('read')),db:Session=Depends(get_db)):
    q=select(Task).order_by(Task.created_at.desc())
    if entity_id: q=q.where(Task.entity_id==entity_id)
    if location_id: q=q.where(Task.location_id==location_id)
    return [task_data(db,t) for t in db.scalars(q).all()]

@router.post('/tasks',status_code=201)
def task_create(data:TaskCreate,user=Depends(require('write')),db:Session=Depends(get_db)):
    for model,id in [(Entity,data.entity_id),(Location,data.location_id),(User,data.assigned_user_id)]: reference(db,model,id)
    item=Task(**data.model_dump(),created_by=user.id);db.add(item)
    audit(db,user,'TASK_CREATED',item,after=data.model_dump());db.commit();return task_data(db,item)

@router.patch('/tasks/{id}')
def task_update(id:str,data:TaskUpdate,user=Depends(require('write')),db:Session=Depends(get_db)):
    item=get(db,Task,id);before={'status':item.status};item.status=data.status
    audit(db,user,'TASK_COMPLETED' if data.status=='COMPLETED' else 'TASK_UPDATED',item,before,data.model_dump());db.commit();return task_data(db,item)

@router.get('/expenses')
def expense_list(entity_id:str|None=None,user=Depends(require('read')),db:Session=Depends(get_db)):
    q=select(Expense).order_by(Expense.date.desc())
    if entity_id:q=q.where(Expense.entity_id==entity_id)
    return [row(e) for e in db.scalars(q).all()]

@router.post('/expenses',status_code=201)
def expense_create(data:ExpenseCreate,user=Depends(require('write')),db:Session=Depends(get_db)):
    for model,id in [(Entity,data.entity_id),(ServiceEvent,data.service_event_id),(Task,data.task_id)]:reference(db,model,id)
    values=data.model_dump()
    if data.service_event_id:
        event=get(db,ServiceEvent,data.service_event_id)
        if data.entity_id and data.entity_id!=event.entity_id:fail('invalid_link',422)
        values['entity_id']=event.entity_id
    item=Expense(**values);db.add(item);audit(db,user,'EXPENSE_CREATED',item,after=values);db.commit();return row(item)

def activity_data(db,event):
    return {**row(event),'actor_name':get(db,User,event.actor_id).name}

@router.get('/activity')
def activities(object_id:str|None=None,page:int=Query(1,ge=1),user=Depends(require('read')),db:Session=Depends(get_db)):
    q=select(Activity)
    if object_id:q=q.where(Activity.object_id==object_id)
    count=db.scalar(select(func.count()).select_from(q.subquery()))
    records=db.scalars(q.order_by(Activity.created_at.desc()).offset((page-1)*50).limit(50)).all()
    return {'items':[activity_data(db,e) for e in records],'total':count,'page':page}

@router.get('/search')
def search(q:str=Query('',max_length=200),user=Depends(require('read')),db:Session=Depends(get_db)):
    if not q.strip():return []
    term='%'+q.strip().replace('\\','\\\\').replace('%','\\%').replace('_','\\_')+'%'
    results=[]
    entities=db.scalars(select(Entity).outerjoin(VehicleProfile,VehicleProfile.entity_id==Entity.id).outerjoin(AssetProfile,AssetProfile.entity_id==Entity.id).outerjoin(InventoryProfile,InventoryProfile.entity_id==Entity.id).where(or_(Entity.name.ilike(term),Entity.description.ilike(term),VehicleProfile.plate.ilike(term),VehicleProfile.vin.ilike(term),VehicleProfile.engine.ilike(term),VehicleProfile.manufacturer.ilike(term),AssetProfile.manufacturer.ilike(term),AssetProfile.serial_number.ilike(term),InventoryProfile.sku.ilike(term))).limit(30)).all()
    for e in entities:results.append({'id':e.id,'name':e.name,'type':e.entity_type,'context':location_path(db,e.location_id),'path':f'/entities/{e.id}'})
    for model,kind,col,path in [(Location,'LOCATION',Location.name,'/locations/'),(Task,'TASK',Task.title,'/tasks'),(Document,'DOCUMENT',Document.title,'/documents'),(MaintenanceDefinition,'MAINTENANCE',MaintenanceDefinition.title,'/maintenance')]:
        for item in db.scalars(select(model).where(col.ilike(term)).limit(15)).all():
            results.append({'id':item.id,'name':getattr(item,'name',getattr(item,'title','')),'type':kind,'context':'','path':path+item.id if kind=='LOCATION' else path+'?record='+item.id})
    return results[:60]

@router.get('/overview')
def overview(user=Depends(require('read')),db:Session=Depends(get_db)):
    entities=db.scalars(select(Entity).where(Entity.archived_at.is_(None))).all()
    active=[e for e in entities if e.status not in INACTIVE]
    tasks=db.scalars(select(Task).where(Task.status.notin_(['COMPLETED','CANCELLED']))).all()
    counts={'vehicles':sum(e.entity_type=='VEHICLE' for e in active),'assets':sum(e.entity_type=='HOME_ASSET' for e in active),
            'inventory':sum(e.entity_type=='INVENTORY' for e in active),'tasks':len(tasks),
            'locations':db.scalar(select(func.count()).select_from(Location).where(Location.archived_at.is_(None))),
            'rooms':db.scalar(select(func.count()).select_from(Location).where(Location.type=='ROOM',Location.archived_at.is_(None)))}
    attention=[];upcoming=[];today=now().date();end=today+timedelta(days=30)
    for m in db.scalars(select(MaintenanceDefinition)).all():
        state=maintenance_state(db,m)
        item={'id':m.id,'title':m.title,'context':state['entity_name'],'status':state['status'],'date':state['next_date'],'path':'/maintenance?record='+m.id}
        if state['status'] in ('OVERDUE','DUE'):attention.append(item)
        elif state['status']=='DUE_SOON' or (state['status']=='OK' and state['next_date'] and today<=__import__('datetime').date.fromisoformat(state['next_date'])<=end):upcoming.append(item)
    for t in tasks:
        item={'id':t.id,'title':t.title,'context':get(db,Entity,t.entity_id).name if t.entity_id else location_path(db,t.location_id),'date':t.due_date.isoformat() if t.due_date else None,'path':'/tasks?record='+t.id,'status':'OVERDUE' if t.due_date and t.due_date<today else t.priority}
        if (t.due_date and t.due_date<=today) or t.priority in ('HIGH','CRITICAL'):attention.append(item)
        elif t.due_date and t.due_date<=end:upcoming.append(item)
    for e in active:
        if e.entity_type=='INVENTORY' and entity_data(db,e)['profile']['low_stock']:attention.append({'id':e.id,'title':e.name,'context':location_path(db,e.location_id),'status':'LOW_STOCK','date':None,'path':'/entities/'+e.id})
    events=db.scalars(select(Activity).order_by(Activity.created_at.desc()).limit(5)).all()
    return {'counts':counts,'attention':attention,'upcoming':sorted(upcoming,key=lambda x:x['date'] or '9999'),'activity':[activity_data(db,a) for a in events]}