# HoustonLab Panel — foundation milestone

This is an initial, working vertical slice of the Master Build Specification v1.0, not a claim that the full v1 backlog is complete.

## Decisions confirmed by the owner

- PostgreSQL is mandatory. No application data is stored in MongoDB.
- React + FastAPI is accepted for this implementation. SQLAlchemy 2 provides the relational data mapper; Alembic provides additive versioned migrations instead of Prisma.
- One shared household per installation; local Owner/Admin/Member/Viewer roles. No invented tenancy abstraction.
- First launch is empty and requires creation of the first owner. No default credentials or demo seed.
- Application runtime needs no external authentication, AI, email, CDN fonts, internet service, VPN, or public gateway. Fonts and the decorative setup image are bundled locally.

## Runtime boundaries

Browser → same-origin web application → FastAPI → PostgreSQL + persistent files.

The workspace PostgreSQL process uses `/app/.data/postgres` and a Unix socket under `/app/.data/run`. `listen_addresses=''` disables TCP completely. The `houstonlab` database role is not a superuser, cannot create databases, and cannot create roles. The database and file storage are never served as public directories.

Application/API URLs are configured through environment files. `REACT_APP_BACKEND_URL` is the browser API origin. `APP_ORIGIN` is the explicit trusted browser origin; the local workspace also recognizes the protected frontend configuration's current alias. `SESSION_COOKIE_SECURE` must match the transport: `true` for HTTPS. A private HTTP LAN installation must explicitly use `false`; HTTPS on the LAN is preferable when available. SameSite Strict, HttpOnly session cookies and CSRF validation remain required independently.

PostgreSQL data, application uploads and environment files must be included in the household's persistence and recovery plan. The bootstrap helper only provisions this workspace; Proxmox packaging and verified backup/restore are separate backlog work. Do not assume supervisor configuration under `/etc` is durable: `/app/scripts/bootstrap_postgres.py` reconstructs it from the persistent data directory when PostgreSQL binaries are installed.

## Relational domain

- `entities` is the common identity/lifecycle/location envelope. Vehicle, Home Asset and Inventory profiles use one-to-one foreign keys. No giant all-asset table.
- `locations.parent_id` supports arbitrary hierarchy. A movable box is a Location of type BOX; moving it does not rewrite its contents. Hierarchy mutations serialize with a transaction-level lock and reject cycles.
- `components` belong to an entity, with retained retirement dates. Generated labels are explicitly distinguished from user content to avoid translating user-created names.
- `maintenance_definitions` express thresholds/source. State is computed on read from mileage, date, latest immutable completion, entity lifecycle, and component lifecycle. `maintenance_records` record actual work. A `service_event` groups multiple records.
- `stock_movements` is the quantity ledger. No quantity column is overwritten. Service consumption locks inventory entities in stable order, validates all balances, and commits service, maintenance, inventory, expense and audit records atomically.
- `documents` are metadata, `file_blobs` are content-addressed storage identities, and `document_links` carry explicit foreign keys to entities/locations/service events/tasks/expenses. One source file can be linked repeatedly without physical duplication.
- `expenses` are independent records with links rather than duplicated module costs.
- `activity` contains allowlisted before/after business state and the acting user. Passwords/session values never enter activity snapshots. There is no activity delete/edit API.
- Foreign keys restrict destructive deletion. Business APIs archive/restore assets and archive documents; sold vehicles remain distinct from archived ones.

## Security contract

Passwords: Argon2id. Sessions: random opaque tokens, only SHA-256 digests stored, fixed 24-hour expiry, server-side revocation, role and enabled state re-read on every request. Mutations validate CSRF and trusted Origin. Setup is protected with a database advisory lock and singleton household constraint. Login rate limiting is database-backed (per IP + account, plus a broader per-IP limit).

All business endpoints declare a server permission dependency. Owner: all actions. Admin: business management and creation/access management of Members/Viewers only. Member: business read/write, no user management/archive/sale. Viewer: business read only. Preferences/password/sessions are always scoped to the signed-in user. Assignment lists omit sensitive user data for non-admin roles.

Uploads: 20 MB maximum, parsed and validated PDF structure (unencrypted, 1–1000 pages) or decoded raster image format, image pixel ceiling, random server paths, SHA-256 deduplication, authenticated streaming/download, no HTML/SVG uploads, nosniff and sandbox response policy. PDF preview uses locally bundled PDF.js, with eval and annotation rendering disabled. Malware scanning is not implemented; uploads are intended for trusted household users.

## Schema lifecycle

Run `alembic upgrade head` from `backend` against the configured PostgreSQL database. Startup does not call `create_all` or reset data. Migration downgrades are intentionally disabled where destructive; use a verified backup/recovery workflow instead. Initial migration plus generated-component-label migration are checked into source control.

New migrations must preserve historical rows, use explicit data backfills for new non-null fields, and be verified on a backup before use on real household records.

## Localization and units

English and Czech dictionaries have key parity. UI enum values remain neutral (e.g. SOLD/OVERDUE). User notes, task titles, custom names and descriptions are never translated. Language and measurement preferences are stored independently per user. Distances are canonical kilometres in the database; odometer summaries honor the distance preference, and maintenance/service inputs explicitly use the canonical unit. Other unit preferences are retained for the corresponding future specialist views.

## Scope still to implement

P0 before declaring full v1: verified backup/restore and installation packaging; repair records; service reference with verified source attribution; compatible/preferred fluids vs append-only current fills; modifications/component replacements; complete document metadata/version/restore flows; room-level maintenance/activity aggregation; configuration editing and appliance templates.

P1: runtime maintenance counters, calendar-month/year intervals, tire/wheel sets, QR label/scan flows, richer notes/checklists, relationship management UI, full measurement conversion in specialist forms, expanded record editing and pagination, login history and owner recovery procedures.

P2 / explicitly later: 2FA, monitoring, Home Assistant, integrations and AI. No recurring tasks or background scheduler were introduced; maintenance states are computed on demand.

## Verification

Initial agent-run regression: 17 passing API cases plus browser coverage of setup, EN/CZ, shared records, tasks, service consumption, documents, lifecycle, permissions and responsive layouts. A subsequent visual PDF check caught an invalid fixture and led to a bundled PDF.js viewer and real parser validation. Four focused regression checks then passed, including multi-page rendering, malformed upload rejection and localized error fallback. See `/app/test_reports/iteration_1.json`, `/app/test_reports/iteration_2.json` and `/app/backend/tests/test_foundation_slice.py`. QA fixtures are temporary and removed before handing over the empty owner-setup screen. Test credentials are never production defaults.