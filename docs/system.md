# AgriShare System Documentation

## Overview

AgriShare is a mobile-first equipment-sharing application. Farmers discover
equipment by text, category, or distance; submit date-specific booking
requests; and receive booking updates. Equipment owners manage listings,
availability, and requests. Operators maintain profiles and private
certification documents. Administrators review operator certification.

## Architecture

```text
Expo / React Native client
  ├── Expo Router screens and role-specific layouts
  ├── NativeWind styling and platform-specific map components
  ├── API client with bearer-token authentication
  ├── Expo location and image/document pickers
  └── Google Maps web geocoding / native platform maps
             │ HTTPS/JSON
             ▼
Express / TypeScript API
  ├── Authentication and role middleware
  ├── Equipment, availability, bookings, notifications, operators
  ├── Prisma ORM and PostgreSQL transactions
  └── Cloudinary signature and private-download services
        │                         │
        ▼                         ▼
   PostgreSQL                 Cloudinary
```

The repository is an npm workspace with `mobile` and `server` packages. Root
scripts provide common development, typecheck, lint, build, and Prisma
commands. The mobile app uses Expo Router and the API uses Express 5 with
Prisma/PostgreSQL.

## Main components

### Mobile client

- `mobile/src/app/` contains Expo Router screens and role-specific route
  groups for farmers, equipment owners, and operators.
- `mobile/src/components/` contains reusable booking, availability, location,
  radius-selection, notification, and dashboard UI.
- `mobile/src/lib/api.ts` is the typed API client. It adds JSON headers and a
  bearer token to API requests and translates network/API failures into
  `ApiError`.
- `mobile/src/lib/tokenStorage.ts` uses Expo SecureStore on native and browser
  local storage on web.
- `mobile/src/lib/geocoding.ts` uses Expo's geocoder on native and the Google
  Maps JavaScript Geocoder on web.
- `mobile/src/components/equipment-map.native.tsx` and platform-specific web
  map components keep map implementations appropriate to each platform.

### API server

- `server/src/server.ts` loads `server/.env`, configures CORS and JSON parsing,
  mounts routes, exposes health checks, and installs the shared error handler.
- `server/src/middleware/auth.ts` issues and verifies seven-day JWTs and
  enforces roles.
- `server/src/routes/` implements auth, equipment, bookings, availability,
  notifications, operators, and owner profiles.
- `server/src/lib/` contains Prisma setup, date-only and geospatial helpers,
  shared HTTP errors, and transactional notification creation.
- `server/src/services/cloudinary.ts` creates signed upload parameters and
  verifies server Cloudinary configuration at startup.
- `server/prisma/schema.prisma` and `server/prisma/migrations/` define and
  evolve the PostgreSQL data model.

## Data model

| Entity | Purpose and relationships |
|---|---|
| `User` | Identity, email, password hash, and role; owns equipment and related bookings, profile, and notifications |
| `Equipment` | Listing fields, optional coordinates, price, owner, and general availability |
| `EquipmentImage` | Ordered Cloudinary image URLs for a listing |
| `EquipmentAvailability` | Date windows indicating whether a listing is available |
| `Booking` | One farmer's date-specific request for one item, owned by its equipment owner |
| `OperatorProfile` | Operator biography, experience, and certification state |
| `OperatorDocument` | Private document public ID, type, status, and administrator review metadata |
| `Notification` | User-specific booking or certification event and read state |

Role enums are `FARMER`, `EQUIPMENT_OWNER`, `OPERATOR`, and `ADMIN`. Booking
statuses stored by the API are `PENDING`, `CONFIRMED`, `REJECTED`, and
`CANCELLED`; the mobile client may derive a completed display state from a past
confirmed booking. Dates are persisted as UTC date values. A database
constraint prevents duplicate confirmed equipment/date pairs.

## Core workflows

### Authentication

1. A user registers with a public role or signs in.
2. The API hashes passwords with bcrypt and returns a seven-day JWT.
3. The app persists the token using the platform-appropriate storage adapter.
4. Protected requests include the bearer token; route middleware checks the
   token and role.

### Equipment search and location

1. A farmer grants foreground device-location permission or enters a town,
   suburb, or address.
2. The farmer selects and confirms a location suggestion before it is used.
3. The app sends `latitude`, `longitude`, and the selected `radiusKm` to
   `/api/equipment/search`.
4. The API computes Haversine distance in PostgreSQL and returns matches
   nearest-first with `distanceKm`.
5. Radius choices include 5, 10, 20, 50, 100, 200 km, and a custom whole
   number from 1-500 km.

On web, address lookup uses Google Maps JavaScript and Geocoding APIs. Native
geocoding uses Expo Location; Android native maps need a Maps SDK for Android
key, while iOS maps use Apple Maps. Device GPS behavior requires testing on a
real device or suitable emulator; a browser location simulation does not
establish native-device behavior.

### Availability and booking

1. A listing's public availability endpoint returns the selected month's
   availability windows and confirmed booked dates.
2. The equipment owner may mark future dates available or unavailable.
3. A farmer submits one calendar date as a booking request.
4. In a serializable PostgreSQL transaction, the API checks the listing,
   unavailable windows, and confirmed booking conflicts; it creates the
   pending booking and owner notification atomically.
5. The owner approves or rejects the pending request. Approval rechecks date
   conflicts; the status transition and farmer notification are transactional.
6. Either party may cancel an upcoming pending or confirmed booking; the
   other party receives a notification.

### Operator certification

1. An operator requests a signed Cloudinary upload for a private document.
2. The client uploads it as an authenticated raw asset in the operator-specific
   folder.
3. The operator submits the asset public ID and profile metadata to the API.
4. An administrator reviews metadata and may retrieve a five-minute signed
   download URL.
5. An administrator approves or rejects the profile; document review state
   and operator notification are updated transactionally.
6. Public operator profiles exclude private document fields.

## Runtime configuration

Copy the example files and provide environment-specific values:

```powershell
Copy-Item server/.env.example server/.env
Copy-Item mobile/.env.example mobile/.env
```

### Server variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | TLS PostgreSQL pooled connection used by the API |
| `DIRECT_URL` | Direct PostgreSQL connection for migrations |
| `PORT` | API listening port; defaults to `4000` |
| `CORS_ORIGIN` | Additional comma-separated allowed browser origins |
| `JWT_SECRET` | Private random signing secret, at least 32 characters |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Server-managed Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Server-only Cloudinary API secret |

### Mobile variables

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_API_URL` | API base URL; use the development computer's LAN IP on a physical phone |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Public, referrer-restricted web Maps JavaScript and Geocoding key |
| `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY` | Public Android Maps SDK key, restricted by package and signing certificate |

`EXPO_PUBLIC_` values are shipped to the app and are not secrets. Never put
server credentials in the mobile environment. Keep real `.env` files out of
version control; only placeholder examples belong in the repository.

## Local development and database

Install dependencies and configure environment files as described in the
[README](../README.md), then run:

```sh
npm install
npm run prisma:generate
npm run prisma:migrate:deploy
npm run dev
```

The root `dev` script starts Expo and the API. The API defaults to
`http://localhost:4000`; Expo web commonly uses `http://localhost:8081`.
Separate commands are `npm run dev:mobile` and `npm run dev:server`.

The repository currently provides migrations and a demonstration seed script.
The seed creates demo roles and listings with random one-time passwords only
for newly created users; it does not reset existing passwords. Treat seeded
data as development fixtures.

## Security and operational notes

- Passwords are bcrypt-hashed; JWT configuration is required for auth.
- Authenticated routes return `401` for missing/invalid tokens and `403` for a
  role mismatch. Resource ownership is checked separately from role.
- The API accepts JSON request bodies up to 1 MB and returns sanitized error
  messages for unexpected server errors.
- Booking and availability changes use database transactions; booking
  conflicts have both application checks and a database uniqueness guard.
- Cloudinary uploads are signed server-side. The API secret never reaches the
  mobile client. Operator documents use authenticated delivery and
  authorization-checked, expiring download URLs.
- Web map/geocoding keys must be restricted by referrer and allowed APIs.
  Android map keys should be restricted to the app package and signing
  fingerprint.
- Health endpoints are `/health`, `/api/health`, and
  `/api/health/database`.

## Build and verification

Root validation commands:

```sh
npm run typecheck
npm run lint
npm run build
npm --prefix mobile run export
```

Validate schema changes with Prisma, apply committed migrations with
`npm run prisma:migrate:deploy`, and use an Expo development build for native
features. For Android APK distribution, use the EAS profile configured in
`mobile/eas.json`; a configured profile alone does not mean a cloud build has
passed.

## Related documentation

- [API reference](./api.md)
- [Project tracker](./project-tracker.md)
