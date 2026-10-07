import hashlib
import os
import secrets
from datetime import timedelta
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError
from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select, func, text, delete
from sqlalchemy.orm import Session
from database import get_db, now
from models import User, Household, LoginSession, AuthAttempt
from schemas import Setup, Login, UserCreate, UserAccess, Preferences, PasswordChange
from common import fail, get, audit

router = APIRouter(prefix='/api')
hasher = PasswordHasher()
dummy_hash = hasher.hash(secrets.token_urlsafe(32))
COOKIE = 'houston_session'
PERMISSIONS = {'OWNER': {'read','write','archive','users'}, 'ADMIN': {'read','write','archive','users'}, 'MEMBER': {'read','write'}, 'VIEWER': {'read'}}

def digest(value): return hashlib.sha256(value.encode()).hexdigest()

def safe_user(user):
    return {k: getattr(user,k) for k in ('id','name','email','role','active','language','preferences')}

def authorize(user, action):
    if action not in PERMISSIONS.get(user.role, set()): fail('forbidden', 403)

def current_user(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get(COOKIE)
    if not token: fail('unauthorized', 401)
    session = db.scalar(select(LoginSession).where(LoginSession.token_hash == digest(token), LoginSession.expires_at > now()))
    if not session: fail('unauthorized', 401)
    user = db.get(User, session.user_id)
    if not user or not user.active: fail('unauthorized', 401)
    if request.method not in ('GET','HEAD','OPTIONS'):
        if not secrets.compare_digest(session.csrf_hash, digest(request.headers.get('X-CSRF-Token',''))): fail('csrf', 403)
    request.state.session = session
    return user

def require(action):
    def dependency(user=Depends(current_user)):
        authorize(user, action)
        return user
    return dependency

def rate_limit(db, request, email):
    cutoff = now() - timedelta(minutes=15)
    ip = request.client.host if request.client else 'unknown'
    keys = [(digest('ip:'+ip), 60), (digest(ip + ':' + str(email).lower()), 10)]
    for key, limit in keys:
        # DB locking makes the limiter consistent across concurrent requests/workers.
        db.execute(text('SELECT pg_advisory_xact_lock(hashtext(:key))'), {'key':key})
        count = db.scalar(select(func.count()).select_from(AuthAttempt).where(AuthAttempt.key == key, AuthAttempt.created_at > cutoff))
        if count >= limit: fail('rate_limited', 429)
        db.add(AuthAttempt(key=key))
    db.execute(delete(AuthAttempt).where(AuthAttempt.created_at < cutoff))
    db.commit()

def issue_session(db, user, request, response):
    token, csrf = secrets.token_urlsafe(48), secrets.token_urlsafe(32)
    old = request.cookies.get(COOKIE)
    if old: db.execute(delete(LoginSession).where(LoginSession.token_hash == digest(old)))
    db.add(LoginSession(user_id=user.id, token_hash=digest(token), csrf_hash=digest(csrf), expires_at=now()+timedelta(days=1), user_agent=request.headers.get('user-agent','')[:250]))
    secure = os.environ['SESSION_COOKIE_SECURE'].lower() == 'true'
    response.set_cookie(COOKIE, token, httponly=True, secure=secure, samesite='strict', max_age=86400, path='/')
    response.set_cookie('houston_csrf', csrf, httponly=False, secure=secure, samesite='strict', max_age=86400, path='/')

@router.get('/auth/status')
def auth_status(db: Session = Depends(get_db)):
    return {'setup_required': db.get(Household, 1) is None}

@router.post('/auth/setup', status_code=201)
def setup(data: Setup, request: Request, response: Response, db: Session = Depends(get_db)):
    rate_limit(db, request, data.email)
    db.execute(text('SELECT pg_advisory_xact_lock(73482019)'))
    if db.get(Household,1): fail('setup_complete', 409)
    user = User(email=str(data.email).lower(), name=data.name, password_hash=hasher.hash(data.password), role='OWNER', language=data.language)
    db.add(user)
    db.add(Household(id=1, name=data.household_name))
    db.flush()
    audit(db,user,'OWNER_CREATED',user,after={'household':data.household_name})
    issue_session(db,user,request,response)
    db.commit()
    return safe_user(user)

@router.post('/auth/login')
def login(data: Login, request: Request, response: Response, db: Session = Depends(get_db)):
    rate_limit(db,request,data.email)
    user = db.scalar(select(User).where(User.email == str(data.email).lower()))
    try: hasher.verify(user.password_hash if user else dummy_hash, data.password)
    except (VerifyMismatchError,VerificationError): fail('invalid_credentials',401)
    if not user or not user.active: fail('invalid_credentials',401)
    if hasher.check_needs_rehash(user.password_hash): user.password_hash = hasher.hash(data.password)
    issue_session(db,user,request,response)
    db.commit()
    return safe_user(user)

@router.get('/auth/me')
def me(user=Depends(require('read')), db: Session=Depends(get_db)):
    return {**safe_user(user), 'household':db.get(Household,1).name}

@router.post('/auth/logout')
def logout(request: Request, response: Response, user=Depends(current_user), db: Session=Depends(get_db)):
    db.delete(request.state.session)
    db.commit()
    response.delete_cookie(COOKIE, path='/')
    response.delete_cookie('houston_csrf', path='/')
    return {'ok':True}

@router.patch('/preferences')
def preferences(data: Preferences, user=Depends(current_user), db: Session=Depends(get_db)):
    before = {'language':user.language, **user.preferences}
    user.language = data.language
    user.preferences = data.model_dump(exclude={'language'})
    audit(db,user,'PREFERENCES_UPDATED',user,before,data.model_dump())
    db.commit()
    return safe_user(user)

@router.get('/users')
def users(user=Depends(require('read')), db: Session=Depends(get_db)):
    # Members need names for assignment, not email or security details.
    records = db.scalars(select(User).order_by(User.created_at)).all()
    if user.role in ('OWNER','ADMIN'): return [safe_user(u) for u in records]
    return [{'id':u.id,'name':u.name,'active':u.active} for u in records if u.active]

@router.post('/users', status_code=201)
def add_user(data: UserCreate, user=Depends(require('users')), db: Session=Depends(get_db)):
    if data.role == 'ADMIN' and user.role != 'OWNER': fail('forbidden',403)
    if db.scalar(select(User).where(User.email == str(data.email).lower())): fail('conflict',409)
    item = User(name=data.name,email=str(data.email).lower(),role=data.role,password_hash=hasher.hash(data.password))
    db.add(item)
    audit(db,user,'USER_CREATED',item,after={'name':item.name,'role':item.role})
    db.commit()
    return safe_user(item)

@router.patch('/users/{id}')
def user_access(id: str, data: UserAccess, user=Depends(require('users')), db: Session=Depends(get_db)):
    item = get(db,User,id)
    if item.role == 'OWNER': fail('last_owner',403)
    if user.role != 'OWNER' and (item.role == 'ADMIN' or data.role == 'ADMIN'): fail('forbidden',403)
    before = {'role':item.role, 'active':item.active}
    for k,v in data.model_dump(exclude_none=True).items(): setattr(item,k,v)
    if not item.active: db.execute(delete(LoginSession).where(LoginSession.user_id==item.id))
    audit(db,user,'USER_UPDATED',item,before,{'role':item.role,'active':item.active})
    db.commit()
    return safe_user(item)

@router.post('/security/password')
def change_password(data: PasswordChange, request: Request, user=Depends(current_user), db: Session=Depends(get_db)):
    rate_limit(db,request,user.email)
    try: hasher.verify(user.password_hash,data.current_password)
    except (VerifyMismatchError,VerificationError): fail('invalid_credentials',400)
    user.password_hash = hasher.hash(data.new_password)
    db.execute(delete(LoginSession).where(LoginSession.user_id==user.id, LoginSession.id != request.state.session.id))
    audit(db,user,'PASSWORD_CHANGED',user)
    db.commit()
    return {'ok':True}

@router.get('/security/sessions')
def sessions(request: Request, user=Depends(current_user), db: Session=Depends(get_db)):
    return [{'id':s.id,'created_at':s.created_at.isoformat(),'expires_at':s.expires_at.isoformat(),'user_agent':s.user_agent,'current':s.id==request.state.session.id} for s in db.scalars(select(LoginSession).where(LoginSession.user_id==user.id, LoginSession.expires_at>now())).all()]

@router.delete('/security/sessions/{id}')
def revoke(id: str, user=Depends(current_user), db: Session=Depends(get_db)):
    session=get(db,LoginSession,id)
    if session.user_id != user.id: fail('not_found',404)
    db.delete(session)
    audit(db,user,'SESSION_REVOKED',user)
    db.commit()
    return {'ok':True}