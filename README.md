# AgriShare

AgriShare is a React Native/Expo application with a TypeScript Express API and PostgreSQL database.

## Project documentation

- [API reference](docs/api.md)
- [System architecture and operations](docs/system.md)
- [Project tracker and verification status](docs/project-tracker.md)

## Workspace layout

```text
agrishare/
├── mobile/                   # Expo, React Native, Expo Router, NativeWind
│   ├── src/app/              # Expo Router screens
│   ├── babel.config.js
│   ├── metro.config.js
│   ├── tailwind.config.js
│   └── tsconfig.json
├── server/                   # Express and TypeScript API
│   ├── prisma/schema.prisma  # PostgreSQL data model
│   ├── src/server.ts
│   ├── src/lib/prisma.ts
│   ├── .env.example
│   └── tsconfig.json
├── package.json              # npm workspaces and root commands
└── tsconfig.json              # TypeScript project references
```

## Install and configure

Requires Node.js 20.19 or newer and npm.

```sh
npm install
```

In PowerShell, create the local environment file:

```powershell
Copy-Item server/.env.example server/.env
Copy-Item mobile/.env.example mobile/.env
```

Replace the example values in `server/.env` and `mobile/.env`:

| Variable | File | Required | Description |
|---|---|---:|---|
| `DATABASE_URL` | `server/.env` | Yes | PostgreSQL pooled connection string used by the API; use TLS (`sslmode=require`). |
| `DIRECT_URL` | `server/.env` | Yes | Direct (non-pooler) PostgreSQL connection string used for Prisma migrations. |
| `PORT` | `server/.env` | No | API port; defaults to `4000`. |
| `CORS_ORIGIN` | `server/.env` | No | Comma-separated additional browser origins. Local Expo origins are allowed by default. |
| `JWT_SECRET` | `server/.env` | Yes | Random secret of at least 32 characters. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. |
| `CLOUDINARY_CLOUD_NAME` | `server/.env` | For uploads | Cloudinary cloud name. |
| `CLOUDINARY_API_KEY` | `server/.env` | For uploads | Server-managed Cloudinary API key. |
| `CLOUDINARY_API_SECRET` | `server/.env` | For uploads | Server-only Cloudinary API secret; never add this to a mobile environment file. |
| `EXPO_PUBLIC_API_URL` | `mobile/.env` | No | API URL; defaults to `http://localhost:4000`. For a phone, use the computer's LAN IP and allow the API port through the firewall. |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | `mobile/.env` | For web maps/geocoding | Browser key for Maps JavaScript API and Geocoding API; restrict by allowed website origin. |
| `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY` | `mobile/.env` | For Android maps | Android key for Maps SDK for Android; restrict by package and signing SHA-1 fingerprint. |

Keep populated environment files private and out of source control. The checked-in `.env.example` files contain placeholders only. Google Maps keys are optional; without the web key, browser maps and address geocoding are unavailable, but manual location selection and the rest of the app remain accessible. iOS maps use Apple Maps and need no Google key. Android native maps need their own Android key. Native maps and native location permission configuration require an Expo development build; after changing native key or permission configuration, rebuild the app rather than relying on Expo Go.

### Google Maps key setup

1. In Google Cloud Console, select a project and enable billing.
2. For web, enable **Maps JavaScript API** and **Geocoding API**, then create a browser key restricted by HTTP referrer to development origins such as `http://localhost:8081/*` and the deployed HTTPS origin. Set it as `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` in `mobile/.env`.
3. For Android maps, enable **Maps SDK for Android** and create a separate Android-restricted key for package `com.agrishare.app`, adding the SHA-1 signing fingerprints for each development and production build. Set it as `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY`.
4. iOS uses Apple Maps through Expo Maps; no Google Maps key is needed for the native iOS map. iOS device location still requires the location permission shown by the app.
5. Restart Expo after editing `mobile/.env`; create a new development/production native build after changing Android key or native permission configuration. Use separate restricted development and production keys, keep quotas and API restrictions enabled, and never commit real key values. `EXPO_PUBLIC_` values are public client configuration, not secrets.

The web map/geocoder requires network access to Google and the APIs above; adding the key alone does not enable missing APIs, billing, or referrer restrictions. Browser device location also requires a secure context (`localhost` or HTTPS) and the user's browser-site permission. A browser-level denial must be changed in the browser's site settings; the app offers town/address search as a fallback.

Generate Prisma Client, then apply all schema migrations to the database:

```sh
npm run prisma:generate
npm run prisma:migrate:deploy
npm run db:seed
```

The Prisma schema includes users, equipment and images, dated availability windows, bookings, operator profiles and documents, and notifications. The seed command creates three demonstration listings and test accounts for each public role: farmer, equipment owner, and operator. It prints random one-time passwords only for accounts created by that run and never resets an existing account's password. Demo profiles and listings are test fixtures only.

To create an administrator, first apply migrations, then provision a user with role `ADMIN` through trusted database administration. The public registration endpoint intentionally refuses the `ADMIN` role.

## Authentication API

All routes use JSON. Registration accepts the roles `FARMER`, `EQUIPMENT_OWNER`, and `OPERATOR`; passwords must be 10-72 UTF-8 bytes. Operator registration creates a pending operator profile. Successful registration and login return `{ "user": { ... }, "token": "..." }`. Access tokens are JWTs with a seven-day expiry.

| Method | Path | Access |
|---|---|---|
| `POST` | `/api/auth/register` | Public |
| `POST` | `/api/auth/login` | Public; limited to 10 attempts per IP per 15 minutes |
| `GET` | `/api/auth/me` | Bearer token required |

Use curl to register, sign in, and fetch the authenticated user:

```sh
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Farmer","email":"farmer@example.com","password":"a-long-test-password","role":"FARMER"}'

curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"farmer@example.com","password":"a-long-test-password"}'

curl http://localhost:4000/api/auth/me \
  -H "Authorization: Bearer <token-from-login>"
```

In Postman, use the same methods, URLs, and JSON request bodies. Copy the token from the registration/login response and set `Authorization` to **Bearer Token** when calling `/api/auth/me`. An unauthenticated `/api/auth/me` request should return `401`; an authenticated request to an endpoint guarded for another role should return `403`. The 11th login request from the same IP in a 15-minute window should return `429`.

## Run locally

```sh
npm run dev
```

This starts the Expo app and Express API together. Alternatively start either workspace separately:

```powershell
npm run dev:server
npm run dev:mobile
```

The API listens on `http://localhost:4000`; health checks are available at `/health`, `/api/health`, and `/api/health/database`. Expo opens the project menu for web, Android, and iOS targets. You can start one target directly:

```powershell
npm --prefix mobile run web
npm --prefix mobile run android
npm --prefix mobile run ios
```

Use an Expo development build for native features such as maps and device location. For browser testing, open the Expo URL (usually `http://localhost:8081`). To create a static web export, run `npm --prefix mobile run export:web`.

## Role-based navigation

The Expo Router tree separates public auth routes from protected farmer, equipment-owner, and operator tabs:

```text
mobile/src/app/
├── (auth)/                 # Sign in/register and splash
├── (farmer)/               # Farmer-only tab layout and dashboard
├── (owner)/                # Equipment-owner-only tab layout and dashboard
├── (operator)/             # Operator-only tab layout and dashboard
├── equipment/              # Marketplace and listing details
└── booking/                # Booking details
```

Role layouts send unauthenticated users to `/auth` and users with a different role to their own dashboard. The operator workspace reads verification and document status from `/api/operators/profile`; profile details and certification submissions are saved through `POST /api/operators/profile`.

The app supports role-based registration and sign-in, equipment search and details, owner equipment listings, booking requests, and booking approval. Native sessions store tokens with Expo SecureStore; web sessions use browser local storage. Authentication and other database-backed routes require an available PostgreSQL database and the Prisma migration deployed.

## Notifications and operator certification

Booking requests, owner decisions, cancellations, and administrator certification decisions create notifications in the same database transaction as the underlying update. Farmer, equipment-owner, and operator workspaces include a Notifications tab with an unread badge.

| Method | Path | Access |
|---|---|---|
| `GET` | `/api/notifications` | Authenticated user; returns up to 100 newest items and the total unread count |
| `PATCH` | `/api/notifications/:id/read` | Notification owner |
| `POST` | `/api/operators/profile` | Operator; saves bio, experience, and newly uploaded private documents |
| `GET` | `/api/operators/profile` | Operator; own profile and document review metadata |
| `GET` | `/api/operators?status=PENDING` | Administrator; list profiles for verification review |
| `GET` | `/api/operators/:id/documents` | Administrator; document metadata for review |
| `GET` | `/api/operators/:id` | Public operator profile; excludes private document details |
| `PATCH` | `/api/operators/:id/verification` | Administrator |
| `POST` | `/api/cloudinary/operator-document-signature` | Operator; rate limited |
| `GET` | `/api/operators/profile/documents/:documentId/download` | Document-owning operator or administrator; signed download expires after five minutes |

Operator certification files are uploaded to Cloudinary with `type=authenticated` under an operator-specific folder. The app stores the Cloudinary public ID, not a public asset URL. Operator roles cannot read another operator's documents; public profiles never return document IDs or URLs. The migration adds an `ADMIN` role, which is deliberately excluded from public registration. Provision administrator accounts through trusted database administration after deploying migrations; do not make an admin account through the app registration form.

Run `npm run prisma:migrate:deploy` after pulling the migration before using the new admin verification endpoint.

## Equipment management and image uploads

Equipment owners can create, edit, and delete their own listings. The public equipment endpoints support filtered lists and detailed views; gallery URLs are stored in the `EquipmentImage` relation and the first image is mirrored to `imageUrl` for older clients. Deletion returns `409` when an equipment item has booking history. Coordinates are optional but must be provided as a valid latitude/longitude pair.

| Method | Path | Access |
|---|---|---|
| `GET` | `/api/equipment` | Public; optional `search`, `category`, and `available=true` filters |
| `GET` | `/api/equipment/:id` | Public; includes owner and ordered gallery |
| `GET` | `/api/equipment/mine` | Equipment owner |
| `POST` | `/api/equipment` | Equipment owner |
| `PUT` | `/api/equipment/:id` | Owning equipment owner |
| `DELETE` | `/api/equipment/:id` | Owning equipment owner |
| `POST` | `/api/cloudinary/signature` | Equipment owner; rate limited |
| `GET` | `/api/owners/:id` | Public owner profile |

The mobile form uses Expo Image Picker and uploads images directly to Cloudinary with a server-generated signature. Configure the three Cloudinary environment variables before using photo uploads; the API secret is never returned to the app. Uploaded gallery URLs are checked against the configured Cloudinary account before being saved.

## Booking management and availability

Farmers can request a specific available date from the equipment booking screen. Equipment owners can mark dates available or unavailable from a listing's availability calendar, and review booking requests from the owner Bookings tab. Availability windows are stored as half-open UTC date intervals; confirmed booking dates are shown as blocked. Booking statuses are `PENDING`, `CONFIRMED`, `REJECTED`, and `CANCELLED`; the frontend derives `COMPLETED` from a confirmed booking whose date has passed.

| Method | Path | Access |
|---|---|---|
| `GET` | `/api/equipment/:id/availability?month=YYYY-MM` | Public |
| `POST` | `/api/equipment/:id/availability` | Owning equipment owner |
| `POST` | `/api/bookings` | Farmer |
| `GET` | `/api/bookings/my-bookings` | Farmer |
| `GET` | `/api/bookings/owner-requests` | Equipment owner |
| `PATCH` | `/api/bookings/:id/approve` | Owning equipment owner |
| `PATCH` | `/api/bookings/:id/reject` | Owning equipment owner |
| `PATCH` | `/api/bookings/:id/cancel` | Booking farmer or equipment owner |

Availability updates accept `{ "dates": ["YYYY-MM-DD"], "isAvailable": false }`, with up to 31 distinct future dates per request. Booking creation and approval run in serializable database transactions and reject unavailable or already-confirmed dates. A PostgreSQL partial unique index on confirmed equipment/date pairs provides a final concurrency guard. Apply new migrations with `npm run prisma:migrate:deploy`.

## Location-based equipment discovery

The farmer equipment search can use the device's foreground location or geocode a town, suburb, or address entered by the farmer. Location permission is requested only after the farmer taps the location button; a denial is handled with a manual-search fallback, and denied permission is not repeatedly requested unless the farmer explicitly retries. On native apps, disabled device location and blocked permissions are reported with a shortcut to app settings where available. Location search returns selectable suggestions; the farmer confirms a suggestion before its coordinates are used for equipment discovery.

Nearby results are calculated using the Haversine formula in PostgreSQL and returned nearest-first with `distanceKm`. The radius selector offers 5, 10, 20, 50, 100, and 200 km plus a custom whole-number distance from 1 to 500 km. Each selection submits a new nearby search with the confirmed latitude, longitude, and radius; the results and map refresh for that query. Listing cards show the distance, and an empty result state offers larger preset radii.

`GET /api/equipment/search` accepts `latitude`, `longitude`, `radiusKm`, and optional `category` and `search` query parameters. For example:

```text
/api/equipment/search?latitude=-26.2041&longitude=28.0473&radiusKm=20&category=TRACTORS
```

Useful checks:

```sh
npm run typecheck
npm run lint
npm run build
npm run prisma:generate
npm --prefix mobile run export
```

### Location services verification (2026-11-06)

The manual web walkthrough's temporary Farmer/Owner accounts, nearby equipment fixtures, booking, and notifications were deleted after testing. Do not use real identity or certification documents. There is no automated browser-to-database E2E suite configured yet.

- **Web GPS passed in the shared browser:** the localhost site had browser geolocation permission `granted`; tapping **Use my current location** returned coordinates and displayed the selected current location in the app. A successful response proves the web app integration in that browser, not GPS hardware on a phone.
- **Permission/error branches exercised through the app UI with simulated browser responses:** permission-denied messaging and fallback manual search were shown; a second location click did not call geolocation again until explicit retry. A simulated unavailable-position response displayed the location-services fallback. Native device permission/settings behavior still requires device testing.
- **Web geocoding configuration:** `mobile/.env` was absent and the example key is blank. The app displayed setup guidance instead of silently failing. The suggestion-selection and confirmation UI was exercised using a mocked Google Geocoder response; a live Google geocoding request was not possible without a restricted key and enabled APIs.
- **Radius UI and API passed with nearby test fixtures:** 10 km returned 1 listing at 8 km; 20 km returned 2 at 8 and 15 km; 50 km returned 4 at 8, 15, 25, and 45 km. Changing the selector issued requests with the chosen coordinates and radius, refreshed the cards, and displayed each distance. Custom 30 km returned 3; invalid 501 km returned a UI validation message and invalid API distances returned `400`.
- **Booking regression passed:** a Farmer requested a future day for a test tractor, the Owner saw the request and notification badge and approved it, and the Farmer dashboard and Confirmed tab showed the booking.
- **Build checks passed:** `npm run typecheck`, `npm run lint`, `npm run build`, `npm --prefix mobile run export`, and Prisma schema validation.
- **Native mobile testing not performed:** no Android device/emulator (`adb`) or iOS device was available in this environment. Test permission prompts, disabled device location, native geocoding, and platform maps on real development builds before release.
- **Database migration note:** Prisma reports `20261106105000_add_admin_role` as pending; it was not applied as part of location verification.

Record external-service outages (database, Cloudinary, Maps/Geocoding) separately from application failures. Keep browser and Android keys restricted and separate for development and production.
