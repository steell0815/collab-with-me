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
