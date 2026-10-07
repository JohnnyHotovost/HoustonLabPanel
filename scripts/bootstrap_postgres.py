"""Workspace bootstrap. Database data lives in the persistent /app tree.

Run as root after installing PostgreSQL. Never prints or commits credentials.
The application role is NOT a PostgreSQL superuser. TCP is disabled.
"""
import os
import pwd
import secrets
import subprocess
from pathlib import Path
from dotenv import dotenv_values, set_key

root = Path('/app')
data = root / '.data'
cluster = data / 'postgres'
socket = data / 'run'
data.mkdir(exist_ok=True)
socket.mkdir(exist_ok=True)
pg = pwd.getpwnam('postgres')
os.chown(socket, pg.pw_uid, pg.pw_gid)
binpath = sorted(Path('/usr/lib/postgresql').glob('*/bin/initdb'))[-1].parent

def pg_run(args, **kw):
    return subprocess.run(['runuser', '-u', 'postgres', '--', *map(str, args)], check=True, **kw)

if not cluster.exists():
    cluster.mkdir()
    os.chown(cluster, pg.pw_uid, pg.pw_gid)
    pg_run([binpath / 'initdb', '-D', cluster, '--auth-local=peer', '--auth-host=scram-sha-256'])
    with (cluster / 'postgresql.conf').open('a') as f:
        f.write(f"\nlisten_addresses = ''\nunix_socket_directories = '{socket}'\n")
    (cluster / 'pg_hba.conf').write_text('local all postgres peer\nlocal all all scram-sha-256\n')
    os.chown(cluster / 'pg_hba.conf', pg.pw_uid, pg.pw_gid)

config = Path('/etc/supervisor/conf.d/houston-postgres.conf')
config.write_text(f'[program:houston-postgres]\ncommand={binpath}/postgres -D {cluster}\nuser=postgres\nautostart=true\nautorestart=true\npriority=10\nstdout_logfile={data}/postgres.log\nstderr_logfile={data}/postgres.err.log\n')
subprocess.run(['supervisorctl', 'reread'], check=True)
subprocess.run(['supervisorctl', 'update'], check=True)
import time
time.sleep(2)
env = root / 'backend/.env'
values = dotenv_values(env)
if not values.get('DATABASE_URL'):
    password = secrets.token_urlsafe(36)
    pg_run([binpath / 'psql', '-h', socket, '-c', f"CREATE ROLE houstonlab LOGIN PASSWORD '{password}' NOSUPERUSER NOCREATEDB NOCREATEROLE"])
    pg_run([binpath / 'createdb', '-h', socket, '-O', 'houstonlab', 'houstonlab'])
    set_key(env, 'DATABASE_URL', f'postgresql+psycopg://houstonlab:{password}@/houstonlab?host={socket}')
    set_key(env, 'APP_ORIGIN', dotenv_values(root / 'frontend/.env')['REACT_APP_BACKEND_URL'])
    set_key(env, 'SESSION_COOKIE_SECURE', 'true')
    set_key(env, 'FILE_STORAGE_PATH', str(data / 'files'))
os.chmod(env, 0o600)
print('PostgreSQL is running internally. Credentials saved to ignored environment file.')