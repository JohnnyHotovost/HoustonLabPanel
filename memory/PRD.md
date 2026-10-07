# HoustonLab Panel — Product Requirements & Progress

## Original problem statement

**HoustonLab Panel — Master Build Specification v1.0 (66 sections).**

> HoustonLab Panel is a self-hosted home operations platform designed to manage vehicles, household assets, rooms, inventory, maintenance, tasks, documents and historical records from one unified application. It is not a collection of unrelated dashboards.

Primary target: a private LAN on a Proxmox home server, with authenticated access, an internal relational database, persistent local file storage, and no required internet access. The complete master specification remains the source of truth. Core concepts must be shared: entities, recursive locations, components, maintenance definitions/state/records, service events, tasks, documents/attachments, expenses, users/permissions, and historical activity. Preserve historical data; archive instead of deleting. One document, task or expense may link across modules without duplication.

### Explicit follow-up decisions (verbatim)

> Please keep PostgreSQL mandatory. Do not switch the project to MongoDB. React + FastAPI is acceptable for the first implementation if that is the supported workspace stack, but the data layer must use PostgreSQL and preserve the relational/shared entity architecture described in the specification.

> The first launch should use an empty household with owner setup only. Do not add demo/sample data unless explicitly requested later.

> For v1, the app is LAN-only and must not require VPN, public internet exposure, Cloudflare, or external authentication providers.

> Prioritize correct architecture, data integrity, i18n (English + Czech), authentication, authorization, audit history, and maintainable schema over trying to implement every feature superficially in one pass. Do not simplify the shared entity/component/maintenance/document/history architecture into separate isolated modules.

## Personas

- **Owner:** household steward, creates the installation, manages all records and family access.
- **Admin:** maintains household data and Member/Viewer access, without granting owner-level authority.
- **Member:** contributes and completes household work; cannot administer users, archive important assets or mark vehicles sold.
- **Viewer:** reads records, documents and history without business mutation rights.

## Static requirements

1. PostgreSQL only for application records; real foreign keys and maintainable migrations.
2. Shared entity identity with specialized profiles, not isolated module tables or one giant asset table.
3. Recursively nested locations and movable containers; location type does not constrain hierarchy.
4. First local owner setup, Argon2id passwords, secure server sessions, server-side permissions, validated input, auth rate limiting, safe uploads, secrets outside Git.
5. EN/CZ translation keys throughout UI; persistent per-user language; never translate user content; units independent of language.
6. Calm premium technical dark design. Updated visual authority: the owner's HoustonLabOS repository, using neutral graphite, restrained emerald accents, Geist and JetBrains Mono, subtle surfaces/borders and reference-consistent density. No meaningless charts or demo statistics. The original Inter/blue proposal is superseded only for presentation by the explicit design-reference request below.
7. Meaningful overview: attention, upcoming, real inventory/asset/task counts, audit activity, quick add.
8. Vehicle lifecycle including sold distinct from archive; relevant configurable components, immutable mileage/history, maintenance and service integration.
9. Maintenance definitions + computed state + immutable completion records; single service session groups multiple records and may consume inventory.
10. Inventory quantities derive from stock movements; no silent overwrite or negative stock.
11. Globally linkable/searchable documents; store each binary once; PDFs visible in the app; expenses attached without duplication.
12. Audit before/after important mutations, excluding secrets. Preserve business history and support archival restoration where implemented.
13. Responsive desktop/tablet/mobile navigation. Search and quick creation are first-class.

Full v1 additionally requires repairs, verified service reference, fluid compatibility/current fill histories, modifications, wheel/tire data, appliance configuration templates, full QR workflows and operational backup/restore. No automatic VIN decoding, OCR, fuel platform, recurring tasks, monitoring, external notifications or AI in initial v1.

## Architecture decisions

- React 19 frontend (existing workspace build pipeline); FastAPI backend, SQLAlchemy 2 + psycopg, PostgreSQL 15, Alembic migrations. No MongoDB application dependency/import/query.
- One installation = one shared household. Central fail-closed role permissions, no unnecessary multitenancy framework.
- Persistent DB `/app/.data/postgres`, socket `/app/.data/run`, uploads `/app/.data/files`. Database uses Unix socket only; no TCP listener. Dedicated non-superuser application role.
- Opaque random cookie sessions with hashed server-side token/CSRF values, HttpOnly/SameSite Strict, trusted origin checks, revocation, per-request role lookup. DB-backed rate limiting and serialized first-owner creation.
- Versioned migration history, restrictive foreign keys, additive generated-label migration, no automatic schema recreation or destructive downgrade.
- Stock movement append-only ledger. Row locks in stable order serialize stock consumption and whole service transactions.
- Documents/file blobs/explicit foreign-key links are distinct relational concepts; PDF validation via pypdf; image validation via Pillow. Locally bundled PDF.js viewer with eval and annotation rendering disabled.
- Assets, fonts, PDF workers/CMaps/standard fonts are local. Public workspace URL is only the development preview access path, not a runtime architectural requirement.
- See `/app/ARCHITECTURE.md` for contracts, environment settings and limitations.

## Implemented — 2026-10-07

### Foundation milestone (not a declaration of full v1 completion)
- Empty first-owner setup, local login/logout, role-managed family users, disabled-user enforcement, password changes, active session revocation, language and unit preferences.
- Bilingual responsive shell preserving specified sidebar, dark palette and locally bundled Inter. Real overview, quick-add, Ctrl+K search, notifications derived from attention records.
- Shared entities and Vehicle/Home Asset/Inventory profiles. Recursive rooms/areas/cabinets/shelves/containers, location detail, moves with cycle prevention and preserved contents.
- Vehicle full-page creation/configuration, relevant generated components, manual component additions/retirement, mileage history, sale details with reminder suppression and retained history, archive/restore.
- Home assets with location/category/manufacturer/model/serial/purchase/warranty data; linked tasks/documents/service/costs.
- Inventory initial stock and subsequent movements, consumables/minimum stock/low-stock attention, movement history.
- Maintenance time-in-days, distance, fixed-date, combined whichever-first, condition-based strategies; thresholds/source/reference, computed due states, completion, pause/resume, retired-component/inactive-entity applicability.
- Multi-item service full-page creation, workshop/notes/date/mileage, multi-inventory consumption, associated expenses. Entire operation is transactional; insufficient inventory leaves all records unchanged.
- Tasks linked to both room and entity, assignment, priorities, due dates and status updates.
- Real local PDF/raster upload, validation, authenticated download, page-by-page PDF canvas preview, multi-link document references, physical blob deduplication, document archive.
- Expense entry; append-only audit events with before/after; global search across profiles, rooms, inventory, maintenance, tasks and documents.
- No demo household or default credentials are shipped. Temporary QA fixtures are removed before handover.

### Verification — 2026-10-07
- Initial testing: 17 passing backend regression cases, browser checks for setup/auth, permissions, room/asset/inventory/vehicle/task/maintenance/service flows, document links, search, sale, language persistence and responsive layouts.
- Fixed minor form `wide` prop forwarding warning.
- Main-agent visual verification caught an invalid original PDF test fixture and blank native preview. Replaced native preview with bundled PDF.js canvas viewer; added real parser validation and localized failure fallback.
- Focused regression: 4/4 passing checks; genuine two-page PDFs render with navigation and EN/CZ page labels; malformed legacy document falls back with download available; malformed new uploads rejected without database writes; custom component names are preserved; Home Asset mileage service misuse rejected.
- Production frontend build succeeds. Browser captures verify desktop layout, all sidebar destinations, mobile no overflow, PDF pages and first-owner language switching.
- Workspace restart occurred during verification; supervised services were restarted and PostgreSQL's persisted records survived.
- Reports: `/app/test_reports/iteration_1.json`, `/app/test_reports/iteration_2.json`. Regression source: `/app/backend/tests/test_foundation_slice.py`.
- Final handover verification: guarded fixture cleanup committed; users=0, entities=0, households=0; migrations retained at `acd8fba21018`; QA uploads and temporary login credentials removed. `/api/health` returns PostgreSQL operational and `/api/auth/status` returns `setup_required: true`.

## Prioritized backlog / next tasks

### Visual-reference update — 2026-10-07

User request:
> Use the existing HoustonLabOS repository as the primary visual reference for the new HoustonLab Panel. Reuse its visual language and design system where appropriate: overall dark theme; sidebar/navigation styling; typography hierarchy; surfaces and cards; buttons; forms; spacing; borders; interaction states; general density and visual character.
> Do NOT inherit the old application's backend architecture, data model, or business logic. The new HoustonLab must keep the architecture, PostgreSQL data model, maintenance engine, entity relationships, i18n, security requirements and workflows defined in the new Master Build Specification. Treat HoustonLabOS as a DESIGN REFERENCE, not as the technical foundation.

- Reference provided by owner: https://github.com/JohnnyHotovost/HoustonLabOS. Inspected its actual frontend styles, AppShell, Dashboard, Login, form and badge components, plus design guidelines; no legacy backend code is imported or executed.
- Added centralized presentation tokens and a responsive visual layer in `frontend/src/styles/houstonlab-tokens.css` and `houstonlab-visual.css`.
- Adopted neutral graphite surfaces, emerald accents/actions/focus, reference-inspired lightning wordmark, locally bundled Geist + JetBrains Mono (including Czech glyphs), monospaced technical labels, outlined active navigation, segmented tabs, refined cards/rows/forms/dialogs/badges/hover/disabled states.
- Retained new Panel navigation, route contracts, data-first overview and all workflows; 240px sidebar with existing tablet rail/mobile drawer behavior. No legacy jobs/clients/business metrics or default credentials adopted.
- Moved existing command-search control to the reference-style left-side topbar; original search handler, Ctrl+K, notifications, add/profile actions and role gates retained.
- Frontend production build passed. Testing report `iteration_3.json`: 5/5 focused API checks passed; desktop/tablet/mobile EN/CZ navigation, labels, forms and visual states verified across 360–1920px; viewer writes denied. Final manual screenshot confirms emerald input focus, dialog closing and command-search behavior.
- Backend implementation/migration hashes remain unchanged. No new migration, maintenance calculation, relation, security contract or API behavior was introduced. Existing unauthenticated `/auth/me` returns401 intentionally; do not suppress this security behavior for cosmetic console cleanliness.
- Temporary MEMBER/VIEWER QA accounts only; no household/business fixtures were added. Pre-change fingerprints captured for all20 persistent user/business tables (sessions/rate-limit bookkeeping excluded) for exact post-cleanup verification.
- Final cleanup removed only the two exact QA user IDs, their sessions and QA-authored preference audit events. No QA accounts remain. Backend/migration hashes are still byte-identical. Business fingerprints changed during the test window because the real OWNER independently changed preferences, created a vehicle and defined maintenance (verified by actor role and timestamps); those owner-created records and all existing data were preserved, never reverted to the earlier snapshot. The other13 persistent table fingerprints remained identical. No blanket cleanup/reset was run.
- See `memory/DESIGN_REFERENCE.md` for the ongoing visual contract and source mapping. All remaining v1 screens must follow this design language without adopting legacy architecture.

### P0 — integrity and full-v1 blockers
1. Verified backup/restore (database + files + configuration) and recovery procedures, then LAN/Proxmox installation packaging.
2. Separate repair records and component replacement relationships; preserve old components.
3. Service reference with source/verification provenance; separate compatible/preferred fluids from append-only actual fill records.
4. Modifications history and broader vehicle configuration editing without overwriting prior components.
5. Appliance configuration templates and editable generated profiles; room maintenance/history aggregation.
6. Document metadata/version/superseded/restore flows and complete cross-object linking UI (schema supports explicit targets already).

### UX clarity pass — 2026-10-07

Owner's latest direction (visual identity remains the baseline):
> Keep the current visual design direction. Do not redesign the app. Improve clarity and intuitiveness through better information hierarchy and readability: stronger text hierarchy, clearer distinction between primary and secondary information, more obvious clickable/actionable elements, better section recognition, improved scanability, and slightly stronger visual emphasis for important statuses and alerts. This is a UX clarity pass, not a redesign.

Selected scope: **Overview and shared UI elements, carried consistently across existing screens.**
> Preserve the current HoustonLab visual identity exactly as the baseline. Keep the dark premium aesthetic, current spacing philosophy, restrained use of accent colors, subtle borders and surfaces, compact technical feel, current sidebar and topbar structure. Do not make the UI brighter, more colorful, more rounded, more SaaS-like, or more visually busy.

Implemented without changing the design language:
- Section headings now use18px/600 on desktop and16px/600 on mobile. Card labels, supporting text, table headings and record titles have clearer primary/secondary emphasis using existing neutral color tokens.
- Needs Attention has conditional alert recognition, clearer title/context/status hierarchy, a discreet critical-row edge, existing due dates when available, and a non-redundant review label. Severity is still the backend's computed value.
- Quick Add uses explicit action-verb labels in EN/CZ, more visible plus affordances and restrained hover/focus cues. Viewer permissions and disabled behavior are retained.
- Active sidebar rows gain a2px inset emerald marker and stronger label/border weight. No sidebar or topbar structure/geometry changes.
- Activity rows distinguish action, object, actor and timestamp; compact rows include actual time, full localized tooltip and dateTime semantics. A quiet chevron signals the existing change-detail action.
- Empty states state what is missing directly, retain contextual Add actions, and distinguish a filtered empty view from an empty collection. Clear Filters restores the existing view without writing data. Upcoming empty state includes a link to existing tasks.
- Palette, fonts, cards, corner radii, background surfaces, grid, spacing scale, base layout, auth/security, APIs, maintenance calculations and PostgreSQL schema remain unchanged. No new dependencies or data migrations.

Verification:
- Production build passed; main-agent before/after1920x800 screenshots confirm the same layout with targeted hierarchy improvements.
- Testing report `/app/test_reports/iteration_4.json`: no UI/integration/design defects found; EN/CZ, MEMBER/VIEWER, clear-filter flows, disabled quick actions, attention/activity links and responsive widths360/390/768/1024/1366/1920 verified.
- Temporary QA accounts and only their own sessions/preference audit entries removed by exact IDs. All20 persistent user/business table row-hash maps match the pre-change baseline exactly after cleanup.
- All backend/migration files, palette tokens, Shell.jsx and base App.css hashes remain identical. No user records changed by this pass.
- No unrelated large-file refactor or permanent testing credentials were introduced; both are outside this scoped UX request.

### P1 — operational breadth
- Runtime counter maintenance and calendar month/year intervals.
- QR identifiers in labels/scanning/printing and context-aware add/move experiences (UUID-backed identities already stable).
- Tires/wheel sets/individual tire histories.
- Relationships UI; component replacement via modifications; checklist and richer notes workflows.
- Broader record editing with auditable changes, pagination for growing lists, richer category/settings management.
- Full preferred-unit conversion in specialist measurements. Current canonical distance inputs explicitly use km; vehicle summaries respect km/mi.
- Login history and tested owner-recovery procedure.

### P2 — later only
- 2FA, monitoring, Home Assistant, networking, energy, AI, remote access, email/Telegram integrations: no implementation without further request.
- Avoid recurring Tasks; maintenance remains the single recurring work model.

## Continuity rules

Do not redesign unrelated modules or rewrite schema contracts during feature work. Never drop business data to simplify a migration. Use real source references for technical specs; never fabricate vehicle capacities or torque values. Keep UI labels translatable and user-entered content unchanged. Any future initial-data import must be explicitly requested; the user's expected first screen is owner setup with an empty household.
