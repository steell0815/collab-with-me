# Hosting with Docker Compose (Recipe)

This is a concise checklist to run the app on a dedicated machine using Docker Compose, with a real version baked in and an external OIDC provider.

## Prerequisites
- Docker + Docker Compose installed.
- Node.js available to run the pre-build version script (only needed on the machine where you prepare the build context).
- An OIDC provider (e.g., Keycloak, Auth0, Azure AD) with:
  - A confidential client (client_id/client_secret)
  - Redirect URI pointing back to your app (e.g., `http://your-host:5173/oidc/callback`)

## 1) Prepare the repository
```bash
git clone https://github.com/steell0815/collab-with-me.git
cd collab-with-me
npm ci
```

## 2) Compute a real version (once per build)
Generates `dist/version.txt` and `dist/version.json`, used by Docker to avoid `0.0.0-local`.
```bash
npm run compute:version
cat dist/version.txt   # e.g. 0.1.32-27fd85
```

## 3) Configure OIDC
Decide your OIDC settings (examples below):
- `OIDC_ISSUER` (issuer URL, e.g., `https://login.example.com/realms/collab`)
- `OIDC_CLIENT_ID`
- `OIDC_CLIENT_SECRET`
- `OIDC_REDIRECT_URI` (e.g., `http://your-host:5173/oidc/callback`)
- `SESSION_SECRET` (any strong random string)

You can set these as environment variables when invoking Compose or in an `.env` file alongside `docker-compose.yml`. Example `.env`:
```
APP_VERSION=$(cat dist/version.txt)
OIDC_ISSUER=https://login.example.com/realms/collab
OIDC_CLIENT_ID=collab-client
OIDC_CLIENT_SECRET=replace-me
OIDC_REDIRECT_URI=http://your-host:5173/oidc/callback
SESSION_SECRET=use-a-long-random-secret
```

## 4) Build and run with Docker Compose
The compose file mounts `dist/version.txt` and passes `APP_VERSION`; your precomputed version will be used.
```bash
docker compose up --build -d
```

## 5) Verify
- Browse to `http://your-host:5173/` and confirm the footer/header shows the expected version.
- Trigger “Login” and ensure you are redirected to your OIDC provider, then back to the app.

## Notes
- The `app-data` volume persists board data at `/data/board.json` inside the container.
- If your OIDC issuer uses a custom CA, make sure the container trusts it (mount CA certs or set `NODE_TLS_REJECT_UNAUTHORIZED=0` only for non-production testing).
- Re-run `npm run compute:version` before each build to bump the version baked into the image.***
