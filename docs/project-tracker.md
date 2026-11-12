# AgriShare Project Tracker

This tracker reflects the repository configuration and verification evidence
available on 2026-11-10. It separates implemented features from work that still
needs an explicit test or release decision; a feature is not marked device-
verified merely because its code exists.

## Status key

- **Implemented** — implementation and related source/configuration are present.
- **Verify** — requires repeatable automated, device, deployment, or release
  evidence before being considered complete for that environment.
- **Planned** — not evidenced in the current repository.

## Product and engineering work

| Area | Status | Current implementation / evidence | Next action |
|---|---|---|---|
| Expo mobile app and role navigation | Implemented | Expo Router screens for auth, farmer, equipment owner, operator, equipment, and bookings | Continue device and responsive regression checks |
| Account registration and login | Implemented | Public roles, bcrypt passwords, JWT auth, role guards, login rate limit | Add automated auth route coverage |
| Equipment marketplace | Implemented | Public listings, filtering, owner CRUD, image galleries, ownership checks | Verify production database and image uploads |
| Location and nearby discovery | Implemented | Permission/manual search paths, selectable geocoded locations, adjustable 1-500 km API radius and result distance | Re-run web and native GPS flows against release configuration |
| Availability calendar | Implemented | Public month calendar; owner date updates with conflict checks | Add API tests for calendar edge dates and concurrent updates |
| Booking workflow | Implemented | Farmer requests, owner approve/reject, participant cancellation, serializable transactions and uniqueness migration | Add concurrent booking integration tests |
| Notifications | Implemented | Persistent per-user inbox, unread count, transactional booking and verification triggers | Add notification lifecycle tests |
| Operator profiles and certification | Implemented | Operator profile, private document uploads, admin review, restricted downloads | Test the full operator/admin flow with production-like Cloudinary |
| Cloudinary account configuration | Implemented | Server-side signed uploads; startup authenticated ping; private certification asset support | Verify a real app-originated upload after credentials/config changes |
| API/system documentation | Implemented | `docs/api.md` and `docs/system.md` describe implemented routes, architecture, config, and workflows | Keep docs in sync when routes or schemas change |
| Project tracker | Implemented | This file records known implementation and verification follow-ups | Update with dated test/build results and owner for each release task |
| EAS Android APK profile | Verify | `mobile/eas.json` contains an internal preview profile with Android `buildType: apk` | Resolve dependency-install failure and complete a successful EAS APK build |
| Physical Android location/map flow | Verify | Native Expo location/map implementations and permission configuration exist | Test permission grant/denial, location disabled, map, and API search on a device |
| iOS location/map flow | Verify | iOS uses native map/location paths | Test with an iOS device or simulator and record results |
| Booking golden journey on deployed services | Verify | UI and backend workflow are implemented; local checks exist in prior development work | Re-test farmer request through owner approval and both dashboards against the intended deployment |
| Automated API/integration tests | Planned | No test script or route test suite is declared in the workspace manifests | Add test runner and deterministic database-backed coverage |
| Continuous integration | Planned | No CI workflow is documented here | Add CI for install, typecheck, lint, build, Prisma validation, and web export |
| Production deployment/runbook | Planned | Local setup and environment requirements are in the README/system guide | Document hosting, secrets, migrations, backup/restore, and health monitoring |

## Current release blockers and risks

1. **EAS APK build** — the reported build failed during the “Install
   dependencies” phase. The available build output did not identify a root
   cause, so the APK release remains unverified. Inspect the EAS phase logs,
   confirm the uploaded lockfile/workspace root and package manager, then rerun
   the preview build.
2. **Native device testing** — web checks do not prove Android/iOS device GPS,
   native maps, permission prompts, or LAN API connectivity. Record actual
   device and build results separately.
3. **Automated regression coverage** — the workspace has typecheck, lint,
   backend build, and Expo web export commands, but no configured test runner
   script was found. Add tests for auth, role access, booking concurrency,
   availability, and notification side effects.
4. **Production readiness** — use production-specific restricted Maps keys,
   private server credentials, a TLS database, deployed migrations, correct
   CORS origins, and a documented backup/monitoring setup before release.

## Recommended next sequence

1. Diagnose the EAS dependency installation failure from that build's
   **Install dependencies** logs; reproduce installation from a clean checkout
   using the committed lockfile.
2. Build and install the preview APK, then test sign-in, location permissions,
   nearby radius changes, image upload, booking request, owner approval, and
   notifications on an Android device.
3. Add deterministic API integration tests, especially simultaneous booking
   approval for the same equipment/date.
4. Re-run `npm run typecheck`, `npm run lint`, `npm run build`, Prisma schema
   validation, and `npm --prefix mobile run export` on the release commit.
5. Record release build IDs, device/OS versions, test account roles (never
   passwords or tokens), and any remaining blockers in this tracker.

## Verification log

Append an entry after meaningful verification:

| Date | Commit/build | Scope | Result | Follow-up |
|---|---|---|---|---|
| 2026-11-10 | EAS build `6082e9df-242f-4dae-9385-2dbdcdf0d147` | Android preview APK dependency installation | Failed; root cause not available from the reported summary | Inspect dependency-install phase logs and rebuild |

Do not record credentials, tokens, private document URLs, or personal account
data in this file.

## Related documentation

- [API reference](./api.md)
- [System documentation](./system.md)
- [Setup instructions](../README.md)
