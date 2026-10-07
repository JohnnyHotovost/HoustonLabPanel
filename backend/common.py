from datetime import date, datetime
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy import inspect
from models import Activity

def fail(code, status=400):
    raise HTTPException(status, detail=code)

def serial(value):
    if isinstance(value, (datetime, date)): return value.isoformat()
    if isinstance(value, Decimal): return float(value)
    if isinstance(value, dict): return {k: serial(v) for k, v in value.items()}
    if isinstance(value, list): return [serial(v) for v in value]
    return value

def row(obj):
    return {c.key: serial(getattr(obj, c.key)) for c in inspect(obj).mapper.column_attrs}

def get(db, model, id):
    obj = db.get(model, id)
    if not obj: fail('not_found', 404)
    return obj

def audit(db, user, action, obj, before=None, after=None):
    db.flush()
    # Only explicitly supplied business snapshots; never serialize users or sessions.
    db.add(Activity(actor_id=user.id, action=action, object_type=obj.__tablename__, object_id=obj.id,
                    object_name=getattr(obj, 'name', getattr(obj, 'title', '')), before=serial(before), after=serial(after)))

def reference(db, model, id):
    if id and not db.get(model, id): fail('invalid_link', 422)