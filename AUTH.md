# AURA Admin Authentication

Single-admin cookie session (JWT in HTTP-only cookie).

## Bootstrap the admin account

From `backend/`:

```bash
# Ensure .env contains:
#   MONGODB_URI, JWT_SECRET, JWT_EXPIRES_IN
#   ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD
#   CORS_ORIGIN=http://localhost:3000,http://localhost:3001

npm run create-admin
```

Safe to re-run: if an admin already exists, credentials are left unchanged.

## Auth routes

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/auth/login` | Public (rate limited) |
| GET | `/api/auth/me` | Cookie required |
| POST | `/api/auth/logout` | Cookie required |

## Protected surfaces

- `/api/admin/*`
- `/api/uploads/*`

## Public (no admin auth)

- `/api/health`
- `/api/public/*`
- `/api/auth/login`

## Environment

- `JWT_SECRET` — min 16 characters
- `JWT_EXPIRES_IN` — e.g. `7d`
- `AUTH_COOKIE_NAME` — default `aura_admin_token`
- `ADMIN_USERNAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` — bootstrap only
- `CORS_ORIGIN` — comma-separated allowlist (credentials enabled)
