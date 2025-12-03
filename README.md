# collab-with-me
Collab-with-me is a very easy board sharing tool

## Versioning
- Versions are derived automatically during CI as `MAJOR.MINOR.BUILD`.
- `MAJOR.MINOR` comes from `package.json`, `BUILD` is the commit count (falls back to the GitHub Actions run number).
- CI sets `APP_VERSION` via `scripts/compute-version.sh`; build artifacts are named `collab-with-me-<version>`.
- Locally, if `APP_VERSION` is unset, a default `0.0.0-local` is used.

## Docker
- Build multi-arch image (requires a buildx builder with multi-platform support, e.g. `docker buildx create --name multi --driver docker-container --use`): `docker buildx build --platform linux/amd64,linux/arm64 -t collab-with-me:latest .`
- If your local Docker driver does not support multi-platform, use `docker build -t collab-with-me:latest .` or `docker buildx build --load -t collab-with-me:latest .` (single platform).
- Run locally: `docker compose up --build`
- Exposes port `5173`, serves static assets from `/app/dist`, and persists board data in `/data` (named volume in compose). Override `BOARD_DATA_FILE` if you want a different path.
- A local Keycloak is included in `docker-compose.yml` for testing auth; it runs HTTPS on `https://localhost:8443` using a mounted cert from `./certs` (generate a self-signed `cert.pem` and `key.pem`). OIDC envs are pre-set for realm `collab`, client `collab-client`, secret `collab-secret`, redirect `http://localhost:5173/oidc/callback`. For local self-signed dev, the app sets `NODE_TLS_REJECT_UNAUTHORIZED=0` to talk to Keycloak.
  - Generate certs manually if needed (no helper container): `mkdir -p certs && openssl req -x509 -newkey rsa:2048 -keyout certs/key.pem -out certs/cert.pem -days 365 -nodes -subj "/CN=localhost"`.
- Version in Docker: run `npm run compute:version` locally (creates `dist/version.txt`), then `docker compose up --build`. The compose file mounts `dist/version.txt` and passes `APP_VERSION` (defaults to 0.0.0-local, override via env) into the container; `dist/version.txt`/`dist/version.json` are now included in the Docker build context so the baked image also picks up your computed version.
- Data format: `board.json` now contains an object with `{ cards: Card[], swimlanes: { [column]: string[] } }`. Older array-only files are normalized on load, and `swimlanes` captures per-column card order (priority from top to bottom).
