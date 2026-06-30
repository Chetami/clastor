# Organisation Support — Implementation Plan

**Branch:** `organisation`
**Milestone:** Foundation (CRUD + membership + join-code + switcher + org-scoped reads)
**Status:** Ready to build. Decisions are locked in [`memory/organisation-feature-spec.md`](../memory/organisation-feature-spec.md); this document is the execution plan.

> Scope guardrails: org-scoped **writes**, invoice numbering, and Stripe changes are explicitly **out of scope** for this milestone. Lessons and invoices keep their single-`tutorId` shape for now; only **students** gain the org fields. The `tutorIds[]` ripple into lessons/invoices is tracked as deferred work.

---

## 1. Spec Recap (locked)

| Decision | Choice |
|---|---|
| Membership | A tutor can join **many** orgs (`orgMembers` collection) |
| Visibility | `org_admin` sees all org data; `member` sees only their own |
| Role model | `org_admin` is a **per-membership** role; global `Role` enum unchanged (`{system_admin, tutor}`) |
| Active org | `users.currentOrgId`; switch → `PATCH /users/me` → **JWT re-issued** with `currentOrgId` |
| Student ownership | Students belong to the org (`organisationId`) + multi-tutor (`tutorIds[]`) |
| Creation | Self-serve by any tutor; creator becomes `org_admin` |
| Personal mode | No active org → scoped to self; legacy data lives here, **not migrated** |
| Join flow | Static regenerable `joinCode`; `POST /orgs/join {code}` → `member` |
| Org metadata | `name`, `logoUrl`, `joinCode`, `createdBy`, timestamps, `deletedAt` |
| Admin powers | All `org_admin`s equal: members+roles, remove members, edit org, regen code, soft-delete |
| Leave | Members **cannot** self-leave; only an org_admin removes (incl. self) |
| Delete | **Soft-delete** (`deletedAt`); restore is a system_admin action (out of scope) |

---

## 2. New Firestore Collections

### `organisations/{orgId}`
```ts
{
  name: string,
  logoUrl: string | null,
  joinCode: string,            // static, regenerable, unique
  createdBy: string,           // uid (audit only — no special powers)
  deletedAt: Timestamp | null, // soft-delete flag
  createdAt: Timestamp,
  updatedAt: Timestamp,
}
```
- **Indexes:** `joinCode` (unique — enforced in service layer + a composite query for lookup).
- **Read filter:** every org read filters `deletedAt == null` unless the caller is a system_admin restoring.

### `orgMembers/{memberId}`
```ts
{
  orgId: string,
  userId: string,              // = users doc id = Firebase uid
  role: 'org_admin' | 'member',
  joinedAt: Timestamp,
}
```
- **Indexes:** `orgId`+`role` (list members of an org), `userId` (list a user's orgs / switcher), `orgId`+`userId` (membership lookup, unique).

### Schema additions to existing collections
- **`students`** gains `organisationId: string | null` and `tutorIds: string[]` (replaces nothing yet — keep `tutorId` field present-but-deprecated during foundation to avoid breaking existing writes; the read layer uses `tutorIds` for org members and `tutorId` as a fallback for legacy data). ⚠️ See §8 deferred work.

---

## 3. Interfaces Package (`@examify-tms/interfaces`)

New directory `interfaces/src/schemas/organisations/`.

| File | Type | Notes |
|---|---|---|
| `Organisation.yaml` | `Organisation` | id, name, logoUrl, joinCode, createdBy, deletedAt, createdAt, updatedAt |
| `OrgMemberRole.yaml` | `OrgMemberRole` | enum `org_admin`, `member` |
| `OrganisationMember.yaml` | `OrganisationMember` | id, orgId, userId, role, joinedAt, plus embedded `user` summary (name, email, avatarUrl) for list UI |
| `req/CreateOrganisationRequest.yaml` | | `name`, `logoUrl?` |
| `req/UpdateOrganisationRequest.yaml` | | `name?`, `logoUrl?` |
| `req/JoinOrganisationRequest.yaml` | | `joinCode` |
| `req/UpdateMemberRoleRequest.yaml` | | `role` |
| `res/OrganisationResponse.yaml` | | full org (incl. `joinCode` only when caller is `org_admin` of it) |
| `res/OrganisationListResponse.yaml` | | array of orgs the caller belongs to |
| `res/OrganisationMemberListResponse.yaml` | | array of members |

**Existing schema edits:**
- `schemas/auth/JwtPayload.yaml`: add optional `currentOrgId?: string | null`.
- `schemas/auth/res/UserInfo.yaml`: add optional `currentOrgId?: string | null` (+ optionally `currentOrgRole?: OrgMemberRole | null` so the frontend can gate without an extra round-trip).
- `schemas/users/User.yaml`: add optional `currentOrgId?: string | null`.
- `schemas/students/Student.yaml`: add optional `organisationId?: string | null` and `tutorIds?: string[]`.
- `src/openapi.yaml`: add `$ref`s for every new schema under `components.schemas`.

**Build:** `npm run build:interfaces` from root → regenerates `dist/index.d.ts` + re-exports.

---

## 4. Backend (`backend/src/`)

### 4.1 New files
- `services/organisationService.ts` — Firestore CRUD + membership + join-code logic.
- `services/orgMemberService.ts` — membership helpers: `getMembership(userId, orgId)`, `requireOrgAdmin(...)`, `listMyOrgs(userId)`, `listMembers(orgId)`.
- `controllers/organisationController.ts` — Express handlers (thin wrappers over services).
- `routes/organisationRoutes.ts` — mounts at `/api/organisations`.
- `utils/joinCode.ts` — random code generator (e.g. 8 chars, unambiguous alphabet) + uniqueness retry.

### 4.2 Endpoint map
| Method | Path | Auth | Handler |
|---|---|---|---|
| `POST` | `/api/organisations` | authenticated (any) | create org → caller becomes `org_admin`; **also sets their `currentOrgId`** + returns re-issued JWT |
| `GET` | `/api/organisations` | authenticated | list orgs the caller belongs to (switcher source) |
| `GET` | `/api/organisations/:orgId` | member of org | get org (`joinCode` only if `org_admin`) |
| `PATCH` | `/api/organisations/:orgId` | `org_admin` | edit name/logoUrl |
| `DELETE` | `/api/organisations/:orgId` | `org_admin` | soft-delete (`deletedAt = now`) |
| `POST` | `/api/organisations/:orgId/regenerate-code` | `org_admin` | new `joinCode` |
| `GET` | `/api/organisations/:orgId/members` | member of org | list members (with user summary) |
| `PATCH` | `/api/organisations/:orgId/members/:userId` | `org_admin` | change role |
| `DELETE` | `/api/organisations/:orgId/members/:userId` | `org_admin` | remove member (incl. self) |
| `POST` | `/api/organisations/join` | authenticated | join by `joinCode` → `member` |
| `PATCH` | `/api/users/me` | authenticated | update `currentOrgId` → **re-issue JWT** (extend existing user route) |

### 4.3 Auth-layer changes
- `utils/jwt.ts` (`generateToken`/signing): include `currentOrgId` from the user doc when signing. On `PATCH /users/me {currentOrgId}`, after persisting, re-issue access **and** refresh tokens and return them (mirror existing login/token-rotation response shape).
- `middleware/auth.ts`: no change to `authenticateJWT`/`requireRole` (global roles unaffected). Org authorization is enforced inside controllers/services via `orgMemberService.requireOrgAdmin(req.user.uid, orgId)`.

### 4.4 Org-scoped read filtering (the core behavior change)
Centralize a resolver in `services/orgScope.ts`:
```ts
type OrgScope =
  | { mode: 'personal' }                         // currentOrgId null/missing
  | { mode: 'org-admin'; orgId: string }         // sees all org data
  | { mode: 'org-member'; orgId: string; userId: string }; // sees own only

async function resolveScope(user: { uid: string; currentOrgId?: string | null }): Promise<OrgScope>
```
Then update each read service to branch on `OrgScope` (mirrors today's `role === 'tutor'` / `'system_admin'` branch in `listStudentsFromFirestore`):
- **`services/studentService.ts`** — `listStudentsFromFirestore`:
  - `personal` → `where('tutorId','==',userId)` (legacy behavior, unchanged).
  - `org-admin` → `where('organisationId','==',orgId)`.
  - `org-member` → `where('organisationId','==',orgId)` AND (`tutorIds array-contains userId` OR legacy `tutorId == userId`).
- `system_admin` → unchanged (all data).

For this milestone, org-scoped filtering is wired into **students** (the only collection whose schema gains org fields). Lessons/invoices keep their current `tutorId` filter for now — they'll inherit org scope in the write phase (§8).

### 4.5 Validation / rules
- `joinCode` uniqueness: query-before-write with retry on collision.
- Joining: if already a member, return current membership idempotently (not an error).
- Removing last `org_admin`: **forbid** (must promote another first) — prevents lockout.
- Removing self: allowed only if another `org_admin` remains (same rule).
- Soft-delete: also blocks `/join` for that org (filtered out by `deletedAt`).

---

## 5. Frontend (`frontend/src/`)

### 5.1 New feature: `features/organisations/`
- `OrganisationListPage.tsx` — switcher landing (orgs I belong to + "Create" + "Join").
- `CreateOrganisationDialog.tsx`
- `JoinOrganisationDialog.tsx` (enter code)
- `OrganisationSettingsPage.tsx` — edit name/logo, regenerate code, manage members (table with role change / remove), soft-delete.
- `OrgMemberManager.tsx` — members table.

### 5.2 Org switcher
- `components/OrgSwitcher.tsx` — dropdown in the app shell (near the nav/user menu). Lists the user's orgs + a **"Personal"** entry (currentOrgId = null). Calls `PATCH /users/me {currentOrgId}` on select, stores re-issued tokens via the auth store, refreshes app state.
- Show current scope label in the nav (e.g. "Personal" vs org name) so the user always knows which scope they're viewing.

### 5.3 State / auth store
- `store/auth-store.ts` + `UserInfo`: surface `currentOrgId` and `currentOrgRole`.
- New `services/organisationService.ts` (frontend) — typed API calls using generated interfaces.
- On org create/switch: update store + persist new tokens.

### 5.4 Routing & guards (`App.tsx` / router config)
- `/organisations` — list (any authenticated user).
- `/organisations/:orgId/settings` — guarded to `org_admin` of that org (client check + backend enforces).
- Existing `TutorRoute`/`AdminRoute` guards unchanged (global roles unchanged).

### 5.5 Nav config (`config/nav.ts`)
- Add an **"Organisations"** entry visible to all authenticated users.

---

## 6. Tests (`backend/test/`)

Vitest, mirroring existing test layout. New `organisationService.test.ts` + `orgMemberService.test.ts` covering:
- Create → creator is `org_admin`, `currentOrgId` set, JWT re-issued.
- Join by code → `member` role; idempotent re-join; deleted org rejects join.
- Org-admin scope returns all org students; member scope returns only own.
- Personal scope returns only legacy `tutorId == userId` students.
- Role change / remove member; cannot remove last org_admin.
- Soft-delete hides org from lists; members lose access.
- `resolveScope` unit tests for all three branches.

Mock Firestore per the existing test harness conventions.

---

## 7. Build Order (phased, each phase independently committable)

1. **Interfaces** — new org schemas + JWT/UserInfo/User/Student edits → `build:types` → commit.
2. **Backend services + auth** — `organisationService`, `orgMemberService`, `orgScope`, JWT re-issue on `PATCH /users/me`. Unit tests. Commit.
3. **Backend routes/controller** — wire endpoints, mount `/api/organisations`, extend `/api/users/me`. Commit.
4. **Org-scoped student reads** — update `studentService.listStudentsFromFirestore` to use `resolveScope`. Tests. Commit.
5. **Frontend services + store** — typed API client, `currentOrgId` in store. Commit.
6. **Frontend UI** — list, create, join, settings, members, switcher, nav entry, route guards. Commit.
7. **Swagger / docs** — new endpoints appear at `/api/docs`. Commit.

Each phase ends green (`npm test` backend, `npm run lint`/`build` frontend) before the next begins.

---

## 8. Deferred Work (explicitly NOT this milestone)

- **Org-scoped writes**: creating students/lessons/invoices under an org; assignment of `organisationId` on create.
- **`tutorIds[]` ripple**: lessons and invoices currently assume a single `tutorId`. Moving students to multi-tutor requires reworking which tutor a lesson/invoice belongs to. Tracked separately.
- **Org-level invoice numbering** (`invoiceCounters` is per-tutor today) and **org-level Stripe Connect** (`stripeAccounts` per-tutor today).
- **Restore soft-deleted orgs** (system_admin UI + endpoint).
- **Migration tooling** for tutors who later want to fold legacy personal data into an org (today: legacy data stays in personal mode forever).
