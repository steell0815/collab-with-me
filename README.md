# collab-with-me
Collab-with-me is a very easy board sharing tool

## Versioning
- Versions are derived automatically during CI as `MAJOR.MINOR.BUILD`.
- `MAJOR.MINOR` comes from `package.json`, `BUILD` is the commit count (falls back to the GitHub Actions run number).
- CI sets `APP_VERSION` via `scripts/compute-version.sh`; build artifacts are named `collab-with-me-<version>`.
- Locally, if `APP_VERSION` is unset, a default `0.0.0-local` is used.
