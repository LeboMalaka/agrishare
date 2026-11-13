# AgriShare API Reference

This document describes the Express API implemented in `server/src`. Unless a
route is marked public, send a JSON Web Token in the request header:

```http
Authorization: Bearer <token>
```

The local API base URL is `http://localhost:4000`. JSON request bodies use
`Content-Type: application/json`. Successful responses are JSON except for
`DELETE /api/equipment/:id`, which returns `204 No Content`.

## Authentication and conventions

Registration and login return a user object and a seven-day bearer token:

```json
{
  "user": {
    "id": "user-id",
    "name": "Example Farmer",
    "email": "farmer@example.com",
    "role": "FARMER"
  },
  "token": "..."
}
```

Roles are `FARMER`, `EQUIPMENT_OWNER`, `OPERATOR`, and `ADMIN`. Public
registration only permits the first three. Dates used for bookings and
availability are calendar dates in `YYYY-MM-DD` form and are interpreted as UTC
dates.

Errors use a JSON object with an `error` message. Common status codes are:

| Status | Meaning |
|---|---|
| `400` | Invalid input or malformed JSON |
| `401` | Missing, invalid, or expired authentication |
| `403` | Authenticated role is not permitted |
| `404` | Resource not found or not visible to the caller |
| `409` | State conflict, such as a confirmed date conflict |
| `413` | JSON request body exceeds the 1 MB limit |
| `429` | Rate limit exceeded |
| `503` | Database or required server configuration unavailable |
| `500` | Unexpected server error |

## Health

| Method | Path | Access | Response |
|---|---|---|---|
| `GET` | `/` | Public | API status and timestamp |
| `GET` | `/api/health/database` | Public | Database connectivity status |

## Authentication

| Method | Path | Access | Request |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | `{ "name", "email", "password", "role" }` |
| `POST` | `/api/auth/login` | Public | `{ "email", "password" }` |
| `GET` | `/api/auth/me` | Any authenticated role | None |

Registration requires a 2-100 character name, valid email, password between
10 and 72 UTF-8 bytes, and role `FARMER`, `EQUIPMENT_OWNER`, or `OPERATOR`.
Emails are normalized to lowercase. Duplicate emails return `409`. Operator
registration also creates a pending operator profile. Login is limited to 10
attempts per IP per 15 minutes.

## Equipment marketplace

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/api/equipment` | Public | List and filter equipment |
| `GET` | `/api/equipment/search` | Public | Nearby equipment search |
| `GET` | `/api/equipment/mine` | Equipment owner | List the caller's listings |
| `GET` | `/api/equipment/:id` | Public | Read a listing and its ordered images |
| `POST` | `/api/equipment` | Equipment owner | Create a listing |
| `PUT` | `/api/equipment/:id` | Owning equipment owner | Update a listing |
| `DELETE` | `/api/equipment/:id` | Owning equipment owner | Delete a listing |
| `GET` | `/api/owners/:id` | Public | Read owner name and listing summaries |

`GET /api/equipment` accepts optional `search`, `category`, and `available`
query parameters. `category` must be one of:
`TRACTORS`, `PLANTERS`, `AGRICULTURAL_DRONES`, `COLD_STORAGE`,
`TRANSPORT_VEHICLES`, `HARVESTING_EQUIPMENT`, or `OTHER_MACHINERY`. `available`
must be `true` or `false`; `available=true` filters to listings whose general
status is `AVAILABLE`.

Nearby search accepts:

```text
GET /api/equipment/search?latitude=-26.2041&longitude=28.0473&radiusKm=20&category=TRACTORS&search=John
```

`latitude` and `longitude` are required and must be within geographic bounds.
`radiusKm` is a whole number from 1 to 500. `category` and `search` are
optional. Results are ordered nearest first and include `distanceKm` rounded
to two decimal places. Only listings with saved coordinates can match.

Create a listing with the following fields:

```json
{
  "name": "Farm tractor",
  "category": "TRACTORS",
  "description": "A suitable description.",
  "pricePerDay": 420,
  "location": "Nelspruit, Mpumalanga",
  "latitude": -25.47,
  "longitude": 30.97,
  "specifications": ["110 HP"],
  "imageUrls": []
}
```

The required name is 2-120 characters, description 10-2000 characters,
location 2-200 characters, and price is positive and at most 1,000,000.
Coordinates are optional but must be supplied together. Up to 20
specifications and up to 10 Cloudinary image URLs are accepted. Update requests
may include any non-empty subset of listing fields. A listing with booking
history cannot be deleted (`409`).

## Availability calendar

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/api/equipment/:id/availability?month=YYYY-MM` | Public | Get date windows and confirmed dates |
| `POST` | `/api/equipment/:id/availability` | Owning equipment owner | Set availability for dates |

The `month` query is optional and defaults to the current UTC month. The
response contains `windows` (date, availability flag, optional note) and
`bookedDates` (confirmed booking dates).

Set one or more dates with:

```json
{
  "dates": ["2026-12-01", "2026-12-02"],
  "isAvailable": false,
  "note": "Maintenance"
}
```

Provide 1-31 distinct, non-past dates. `note` is optional and limited to 200
characters. Dates with confirmed bookings cannot be modified. The update is
performed transactionally; a concurrent conflict returns `409`.

## Bookings

| Method | Path | Access | Purpose |
|---|---|---|---|
| `POST` | `/api/bookings` | Farmer | Submit a booking request |
| `GET` | `/api/bookings/my-bookings` | Farmer | List the caller's requests |
| `GET` | `/api/bookings/owner-requests` | Equipment owner | List requests for owned equipment |
| `GET` | `/api/bookings` | Farmer or equipment owner | Role-scoped booking list |
| `PATCH` | `/api/bookings/:id/approve` | Owning equipment owner | Confirm a pending request |
| `PATCH` | `/api/bookings/:id/reject` | Owning equipment owner | Reject a pending request |
| `PATCH` | `/api/bookings/:id/status` | Equipment owner | Compatibility decision endpoint |
| `PATCH` | `/api/bookings/:id/cancel` | Booking farmer or owner | Cancel a pending or confirmed booking |

Create a request with:

```json
{
  "equipmentId": "equipment-id",
  "requestedDate": "2026-12-01",
  "notes": "Optional message to the owner"
}
```

`requestedDate` cannot be in the past; notes are optional and limited to 1000
characters. New requests have status `PENDING`. Approval changes status to
`CONFIRMED`; rejection changes it to `REJECTED`; cancellation changes it to
`CANCELLED`. The client may display a past confirmed booking as completed;
`COMPLETED` is not a stored API status.

Creation, approval, rejection, and cancellation run within serializable
database transactions. The server verifies ownership and state transitions,
checks unavailable windows and confirmed bookings, and writes the associated
notification in the same transaction. A database uniqueness constraint also
prevents more than one confirmed booking for the same equipment/date. A
conflict returns `409`; a transaction timeout returns `503`.

## Notifications

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/api/notifications` | Any authenticated user | Read the caller's newest notifications |
| `PATCH` | `/api/notifications/:id/read` | Notification owner | Mark a notification read |

The inbox response is `{ "notifications": [...], "unreadCount": number }`.
At most 100 newest notifications are returned, while `unreadCount` counts all
unread notifications for that user. A read update returns the updated
notification and the new unread count. Notifications are generated for booking
requests, owner decisions, cancellations, and administrator certification
status changes.

## Operator profiles and certification

| Method | Path | Access | Purpose |
|---|---|---|---|
| `POST` | `/api/operators/profile` | Operator | Save profile and submit uploaded document IDs |
| `GET` | `/api/operators/profile` | Operator | Read own profile and document review metadata |
| `GET` | `/api/operators/:id` | Public | Read public operator profile |
| `GET` | `/api/operators` | Admin | List profiles, optionally filter by status |
| `GET` | `/api/operators/:id/documents` | Admin | List document metadata |
| `GET` | `/api/operators/profile/documents/:documentId/download` | Owning operator or admin | Get a short-lived private download URL |
| `PATCH` | `/api/operators/:id/verification` | Admin | Approve or reject certification |

Submit an operator profile:

```json
{
  "bio": "Experienced agricultural machinery operator.",
  "experienceYears": 5,
  "documents": [
    {
      "publicId": "agrishare/operators/operator-id/upload-id",
      "originalName": "license.pdf",
      "type": "LICENSE"
    }
  ]
}
```

`bio` is limited to 2000 characters, `experienceYears` is an integer from 0 to
60, and up to 10 document references are accepted. Document types are
`IDENTITY`, `LICENSE`, `CERTIFICATE`, or `OTHER`. Document IDs must refer to
private uploads under the authenticated operator's Cloudinary folder.

Administrator verification accepts:

```json
{
  "status": "CERTIFIED",
  "reviewNotes": "Optional review notes"
}
```

The status must be `CERTIFIED` or `REJECTED`. Review notes are optional and
limited to 1000 characters. Certification requires at least one uploaded
license or certificate. Public operator responses do not include document
identifiers, URLs, or review notes. Private download URLs expire after five
minutes.

For compatibility, the API also provides `GET /api/operator/profile` and
`PATCH /api/operator/profile` for an operator's experience years and
certification summary.

## Cloudinary upload signatures

| Method | Path | Access | Rate limit |
|---|---|---|---|
| `POST` | `/api/cloudinary/signature` | Equipment owner | 30 per 15 minutes |
| `POST` | `/api/cloudinary/operator-document-signature` | Operator | 10 per 15 minutes |

These endpoints return short-lived upload parameters; the client uploads the
file directly to Cloudinary. Equipment images are public image assets.
Operator documents use Cloudinary's `authenticated` delivery type and are
served only through the authorized download endpoint. The Cloudinary API
secret is never returned to the client.

## Related documentation

- [System documentation](./system.md)
- [Project tracker](./project-tracker.md)
- [Setup and environment configuration](../README.md)
