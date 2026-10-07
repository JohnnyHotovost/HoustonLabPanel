import logging
import os
from pathlib import Path
from dotenv import dotenv_values
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import IntegrityError
from sqlalchemy import text
from starlette.middleware.cors import CORSMiddleware
from database import engine
from auth import router as auth_router
from entities import router as entity_router
from maintenance import router as maintenance_router
from records import router as records_router
from documents import router as document_router

app=FastAPI(title='HoustonLab Panel',version='0.1.0',docs_url=None,redoc_url=None,openapi_url=None)
origins=[o.strip().rstrip('/') for o in os.environ['APP_ORIGIN'].split(',')]
# The workspace may assign a friendly preview alias after initial provisioning.
# Trust only the explicit, protected frontend configuration, never request headers.
frontend_env=Path(__file__).parent.parent / 'frontend' / '.env'
if frontend_env.is_file():
    configured_origin=dotenv_values(frontend_env).get('REACT_APP_BACKEND_URL')
    if configured_origin and configured_origin.rstrip('/') not in origins:
        origins.append(configured_origin.rstrip('/'))
app.add_middleware(CORSMiddleware,allow_origins=origins,allow_credentials=True,allow_methods=['GET','POST','PATCH','DELETE','OPTIONS'],allow_headers=['Content-Type','X-CSRF-Token'])

@app.middleware('http')
async def boundaries(request:Request,call_next):
    if request.method not in ('GET','HEAD','OPTIONS'):
        origin=request.headers.get('origin')
        if origin and origin.rstrip('/') not in origins:return JSONResponse({'detail':'csrf'},status_code=403)
        length=request.headers.get('content-length')
        if length and (not length.isdigit() or int(length)>21*1024*1024):return JSONResponse({'detail':'file_too_large'},status_code=413)
    response=await call_next(request)
    response.headers['X-Content-Type-Options']='nosniff'
    response.headers['Referrer-Policy']='same-origin'
    response.headers['X-Frame-Options']='SAMEORIGIN'
    response.headers['Cache-Control']='no-store'
    return response

@app.exception_handler(RequestValidationError)
async def validation_error(request,exc):return JSONResponse({'detail':'validation'},status_code=422)

@app.exception_handler(IntegrityError)
async def integrity_error(request,exc):return JSONResponse({'detail':'conflict'},status_code=409)

@app.exception_handler(Exception)
async def unexpected_error(request,exc):
    logging.exception('Request failed: %s %s',request.method,request.url.path)
    return JSONResponse({'detail':'generic'},status_code=500)

@app.get('/api/health')
def health():
    with engine.connect() as conn:conn.execute(text('SELECT 1'))
    return {'status':'operational','database':'postgresql','version':'0.1.0'}

for router in [auth_router,entity_router,maintenance_router,records_router,document_router]:app.include_router(router)