# HoustonLabOS → HoustonLab Panel: visual reference contract

## Owner request

> Use the existing HoustonLabOS repository as the primary visual reference for the new HoustonLab Panel. Reuse its visual language and design system where appropriate: overall dark theme; sidebar/navigation styling; typography hierarchy; surfaces and cards; buttons; forms; spacing; borders; interaction states; general density and visual character.

> Do NOT inherit the old application's backend architecture, data model, or business logic. The new HoustonLab must keep the architecture, PostgreSQL data model, maintenance engine, entity relationships, i18n, security requirements and workflows defined in the new Master Build Specification. Treat HoustonLabOS as a DESIGN REFERENCE, not as the technical foundation.

Repository: https://github.com/JohnnyHotovost/HoustonLabOS

## Reference files inspected (read-only)

- `frontend/src/index.css`: actual dark tokens, Geist/JetBrains Mono, card surfaces, borders, input focus, motion.
- `frontend/src/App.css`: active sidebar rows, KPI hierarchy, technical labels.
- `frontend/src/components/houston/AppShell.jsx`: graphite navigation, emerald lightning brand mark, command-search topbar, active-icon styling, user avatar.
- `frontend/src/pages/Dashboard.jsx`: density, metric tiles, typography and spacing; NOT its metrics, charts, requests or business concepts.
- `frontend/src/pages/Login.jsx`: labels, typography, emerald primary actions and restrained technical texture; NOT authentication implementation, default credentials or remote images.
- `frontend/src/pages/JobNewEdit.jsx`: field/control styling and vertical rhythm; NOT template/domain logic.
- `frontend/src/components/houston/Badges.jsx`: pill silhouette and mono labels; NOT its enum vocabulary.
- `design_guidelines.json`: supporting visual intent, subordinate to actual implemented reference styles and new Master Specification.

The downloaded source is isolated under ignored `.data/design-reference/`. No legacy source is imported or executed by the Panel.

## Adopted visual language

| Element | Reference → Panel interpretation |
| --- | --- |
| Background | Neutral graphite `#0a0a0c`, not blue-tinted dark |
| Sidebar | `#0e0e11`; dark elevated active row, subtle outline, emerald icon |
| Surfaces | `#121215` cards, `#17171a` hover, `#1a1a1e` elevated |
| Borders | `#27272a`, subtle `#1f1f22`, hover `#3f3f46` |
| Text | `#fafafa`, secondary `#d4d4d8`, muted `#a1a1aa`; dim labels raised slightly for legibility |
| Accent | Restrained emerald `#34d399`; primary actions `#10b981`, occasional subdued cyan |
| Fonts | Locally bundled Geist 400/500/600, JetBrains Mono 400/500; Latin + Latin Extended support Czech |
| Hierarchy | 30–32px main titles, 14px body, 12–13px controls, mono 9–11px technical labels |
| Brand | Reference-inspired emerald lightning emblem, HoustonLab wordmark, PANEL sub-label |
| Buttons/forms | 38px buttons, 42px inputs, 8px corners, neutral surfaces, emerald focus ring, disabled/error/loading states |
| Cards | 12px corners and actual thin borders; no decorative shadows, no hover displacement |
| Tabs | Compact neutral segmented surface, outlined filled active state |
| Badges | Mono uppercase UI labels with semantic pill treatments; Panel enum values remain unchanged |
| Motion | Restrained enter and color transitions, reduced-motion support |
| Spacing | 20–28px content gaps, 24px metric-card padding, 32px page vertical rhythm |

## Explicit boundaries

- The Master Specification's Overview/Home/Inventory/Maintenance/Tasks/Vehicles/Service/Documents/Activity/Search/Settings structure stays intact. No jobs, clients, repair-shop finance dashboards, or legacy role names are added.
- Sidebar remains 240px, preserving the new app's tablet rail and mobile drawer rather than adopting the old app's missing mobile navigation.
- Data-first household overview stays intact. No old revenue charts, fabricated metrics or demo data.
- Existing local owner setup, sessions, authentication, role checks, API calls, source-of-truth calculations, document storage/viewer, transactions, history and migrations are unchanged.
- EN/CZ translation dictionaries remain authoritative; only the wordmark casing changes. User-generated content is not restyled into translated values.
- Existing local household architecture image is retained on auth screens; fonts and visuals remain bundled and work without external font/image services.

## Implementation structure

- `frontend/src/styles/houstonlab-tokens.css`: named reference tokens, bridge to existing Panel primitives.
- `frontend/src/styles/houstonlab-visual.css`: presentation layer, component states and responsive visual adaptation.
- Existing `App.css` retains layout behavior. No backend or database migration is needed for a visual update.
- Baseline backend source hashes are saved under ignored `.data/design-reference/backend-before.json` for post-change integrity verification.

## Verification scope

Build, screenshot comparison, neutral background/emerald active states, font loading without internet/CDN requests, desktop/tablet/mobile navigation, modal focus and scroll, input focus/disabled/error states, EN/CZ label fitting, settings, tasks/maintenance/document views. Test records must never replace or delete the owner's existing household data.

## Verification result — 2026-10-07

- Production build passed. Focused role/auth checks:5/5 passed; responsive EN/CZ UI verified at360,390,768,1024,1366 and1920px. Main-agent screenshot verified emerald focus after transition, correct Geist font, desktop navigation, and unchanged command-search/modal behavior.
- Backend and migrations are byte-identical to the pre-change baseline. Temporary MEMBER/VIEWER accounts and only their test-authored preference/session records were removed by exact IDs.
- A comparison flagged concurrent real-owner activity: preference edits, vehicle creation and a maintenance definition. Audit timestamps and OWNER actor roles identify these as legitimate household additions, not QA records. They are preserved. Never overwrite current data to make a test snapshot match.
- Existing unauthenticated401 responses remain intentional; no authentication/security behavior changed to hide normal browser console entries.

## Clarity-only refinement contract — 2026-10-07

The owner explicitly approved the current HoustonLab identity and requested **a clarity/hierarchy pass, not another redesign**. The current palette, backgrounds, cards, borders, corner radii, fonts, spacing philosophy, technical density, sidebar and topbar structure remain the baseline.

Permitted refinements implemented:
- Stronger section-title weight and modest scale (18px desktop /16px mobile).
- Existing secondary text tokens used for readable metadata; clearer title/value/description distinction, not globally brighter surfaces.
- Conditional attention icon, readable semantic badges, discreet severity marker; no pulsing/glows or new accent colors.
- Explicit Quick Add action verbs and a visible plus glyph; improved enabled hover/focus while retaining viewer-disabled controls.
- Active navigation identified with a thin inset marker, without moving or enlarging rows.
- Activity action/object separation, readable actor and exact time, quiet detail chevron.
- Direct, useful empty-state wording, contextual actions and Clear Filters for views with no matches.

Changes live in a documented clarity section of the existing visual stylesheet and minimal shared/Overview presentation markup. No additional theme layer or replacement design system was added. New EN/CZ copy uses translation keys; all user-entered titles/names/notes are preserved.

Build and responsive EN/CZ tests passed (`iteration_4.json`). Exact post-cleanup fingerprints confirm all original household records unchanged; backend, migrations, palette, shell and base layout remain byte-identical. Continue this restraint in future work unless the owner explicitly requests a new design direction.