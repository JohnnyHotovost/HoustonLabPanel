import hashlib
import io
import os
import tempfile
from pathlib import Path
from PIL import Image, UnidentifiedImageError
from pypdf import PdfReader
from fastapi import APIRouter, Depends, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy import select, text
from sqlalchemy.orm import Session
from database import get_db, uid
from models import Document, FileBlob, DocumentLink, Entity, Location, ServiceEvent, Task, Expense
from schemas import DocumentLinkInput
from common import row, get, fail, audit, reference
from auth import require

router=APIRouter(prefix='/api')
STORAGE=Path(os.environ['FILE_STORAGE_PATH']);STORAGE.mkdir(parents=True,exist_ok=True)
MAX_SIZE=20*1024*1024
TARGETS={'entity_id':Entity,'location_id':Location,'service_event_id':ServiceEvent,'task_id':Task,'expense_id':Expense}
TYPES={'INVOICE','SERVICE_REPORT','MANUAL','WARRANTY','INSURANCE','CONTRACT','RECEIPT','TECHNICAL','OTHER'}

def document_data(db,item):
    blob=get(db,FileBlob,item.blob_id)
    links=db.scalars(select(DocumentLink).where(DocumentLink.document_id==item.id)).all()
    return {**row(item),'content_type':blob.content_type,'size':blob.size,'links':[row(l) for l in links]}

@router.get('/documents')
def documents(entity_id:str|None=None,service_event_id:str|None=None,location_id:str|None=None,user=Depends(require('read')),db:Session=Depends(get_db)):
    query=select(Document).order_by(Document.created_at.desc())
    if entity_id or service_event_id or location_id:
        query=query.join(DocumentLink,DocumentLink.document_id==Document.id)
        if entity_id:query=query.where(DocumentLink.entity_id==entity_id)
        if service_event_id:query=query.where(DocumentLink.service_event_id==service_event_id)
        if location_id:query=query.where(DocumentLink.location_id==location_id)
        query=query.distinct()
    return [document_data(db,d) for d in db.scalars(query).all()]

@router.post('/documents',status_code=201)
def upload(title:str=Form(...,min_length=1,max_length=180),type:str=Form('OTHER'),entity_id:str|None=Form(None),service_event_id:str|None=Form(None),location_id:str|None=Form(None),file:UploadFile=File(...),user=Depends(require('write')),db:Session=Depends(get_db)):
    if type not in TYPES or not title.strip():fail('validation',422)
    for field,id in [('entity_id',entity_id),('service_event_id',service_event_id),('location_id',location_id)]:reference(db,TARGETS[field],id)
    data=file.file.read(MAX_SIZE+1)
    if len(data)>MAX_SIZE:fail('file_too_large',413)
    if not data:fail('invalid_file',422)
    if data.startswith(b'%PDF-'):
        try:
            pdf=PdfReader(io.BytesIO(data), strict=False)
            if pdf.is_encrypted or not 1 <= len(pdf.pages) <= 1000:
                fail('invalid_file',422)
            # Reject header-only/malformed files, not just unrecognized extensions.
            if float(pdf.pages[0].mediabox.width)<=0 or float(pdf.pages[0].mediabox.height)<=0:
                fail('invalid_file',422)
            mime='application/pdf'
        except Exception:
            fail('invalid_file',422)
    else:
        try:
            img=Image.open(io.BytesIO(data))
            if img.format not in ('JPEG','PNG','WEBP') or img.width*img.height>40_000_000:fail('invalid_file',422)
            mime={'JPEG':'image/jpeg','PNG':'image/png','WEBP':'image/webp'}[img.format];img.verify()
        except (UnidentifiedImageError,ValueError,OSError,Image.DecompressionBombError):fail('invalid_file',422)
    hash=hashlib.sha256(data).hexdigest()
    db.execute(text('SELECT pg_advisory_xact_lock(hashtext(:hash))'),{'hash':hash})
    blob=db.scalar(select(FileBlob).where(FileBlob.sha256==hash))
    if not blob:
        key=uid()
        try:
            with tempfile.NamedTemporaryFile(dir=STORAGE,delete=False) as temp:
                temp.write(data);temp.flush();os.fsync(temp.fileno());tempname=temp.name
            os.replace(tempname,STORAGE/key)
        except OSError:fail('upload_failed',503)
        blob=FileBlob(sha256=hash,size=len(data),content_type=mime,storage_key=key);db.add(blob);db.flush()
    item=Document(blob_id=blob.id,title=title.strip(),type=type,original_filename=Path(file.filename or 'document').name[:250],created_by=user.id)
    db.add(item);db.flush()
    for field,id in [('entity_id',entity_id),('service_event_id',service_event_id),('location_id',location_id)]:
        if id:db.add(DocumentLink(document_id=item.id,**{field:id}))
    audit(db,user,'DOCUMENT_UPLOADED',item,after={'title':item.title,'type':item.type,'size':len(data)})
    db.commit();return document_data(db,item)

@router.get('/documents/{id}/file')
def document_file(id:str,download:bool=False,user=Depends(require('read')),db:Session=Depends(get_db)):
    item=get(db,Document,id);blob=get(db,FileBlob,item.blob_id);path=STORAGE/blob.storage_key
    if not path.is_file():fail('not_found',404)
    return FileResponse(path,media_type=blob.content_type,filename=item.original_filename,content_disposition_type='attachment' if download else 'inline',headers={'X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'; style-src 'unsafe-inline';" ,'Cache-Control':'private, no-store'})

@router.post('/documents/{id}/links',status_code=201)
def link_document(id:str,data:DocumentLinkInput,user=Depends(require('write')),db:Session=Depends(get_db)):
    item=get(db,Document,id);values=data.model_dump(exclude_none=True)
    for field,target in values.items():reference(db,TARGETS[field],target)
    field,target=next(iter(values.items()))
    existing=db.scalar(select(DocumentLink).where(DocumentLink.document_id==id,getattr(DocumentLink,field)==target))
    if existing:return row(existing)
    link=DocumentLink(document_id=id,**values);db.add(link)
    audit(db,user,'DOCUMENT_LINKED',item,after=values);db.commit();return row(link)

@router.post('/documents/{id}/archive')
def archive_document(id:str,user=Depends(require('archive')),db:Session=Depends(get_db)):
    item=get(db,Document,id);before={'status':item.status};item.status='ARCHIVED'
    audit(db,user,'DOCUMENT_ARCHIVED',item,before,{'status':item.status});db.commit();return document_data(db,item)