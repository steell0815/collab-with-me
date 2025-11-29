You are maintaining the public GitHub repository `steell0815/collab-with-me`.

Context:
- It is a TypeScript project.
- Development is spec-driven with BDD-style acceptance tests in the `tests` folder.
- The project is built and tested via GitHub Actions CI and trunk-based development (no long-lived branches).
- The repository root contains `package.json`, `tsconfig.json`, `src/`, `public/`, `tests/` and `.github/workflows/`.

Goal:
Implement an automatic versioning scheme so that:

1. On every commit to the main trunk (e.g. `main` branch), the *system version* is increased.
2. All build artifacts produced by the CI pipeline carry that version in their metadata or filenames.
3. No manual version bump is required from developers; the CI/build system derives it automatically.

Versioning rules:
- Use semantic-looking versions of the form `MAJOR.MINOR.BUILD`.
- `MAJOR.MINOR` comes from `package.json` (for example `"version": "0.1.0"` → base `"0.1"`).
- `BUILD` is an automatically increasing number tied to commits or CI runs:
  - Prefer using the Git commit count on the current branch:
    - `BUILD = git rev-list --count HEAD`
  - If Git is not available (e.g. shallow checkout limitations), fall back to the GitHub Actions run number:
    - `BUILD = ${{ github.run_number }}` in the workflow.
- The calculated version (e.g. `0.1.37`) MUST NOT be committed back to the repository; it should only exist as part of the CI run environment and build artifacts.

Implementation tasks:

1. **Create a small versioning script**

   Create a script at `scripts/compute-version.sh` with the following behavior:

   - Read `package.json`, extract the `"version"` field, and strip the patch component to get `MAJOR.MINOR`.
   - Compute `BUILD` as:
     - Primary: `git rev-list --count HEAD`
     - Fallback: use an environment variable `CI_BUILD_NUMBER` if provided by the CI.
   - Compose `APP_VERSION="${MAJOR_MINOR}.${BUILD}"`.
   - Export this version for CI by appending a line to `$GITHUB_ENV` (the standard way to set env vars for later steps in a GitHub Actions job):
     - `echo "APP_VERSION=$APP_VERSION" >> "$GITHUB_ENV"`
   - Print the version to stdout for logging.

   The script should:
   - Be POSIX shell compatible.
   - Fail with a non-zero exit code if anything goes wrong (missing `package.json`, Git not available *and* no `CI_BUILD_NUMBER`, etc.).

2. **Add helpful npm scripts**

   In `package.json`, add scripts like:

   - `"compute:version": "bash ./scripts/compute-version.sh"`
   - `"build:ci": "npm run build"` (or your existing build command) — the CI will run `compute:version` first so that `APP_VERSION` is available to the build.

   Do not change existing build or test behavior beyond what is necessary to use the version value.

3. **Update / create GitHub Actions workflow**

   In `.github/workflows/ci.yml` (or the existing CI file):

   - Trigger on `push` to the main trunk branch(es), e.g.:

     ```yaml
     on:
       push:
         branches:
           - main
     ```

   - Add a job that:

     1. Checks out the code.
     2. Installs Node dependencies.
     3. Runs the version script to populate `APP_VERSION` into the environment:

        ```yaml
        - name: Compute version
          run: |
            export CI_BUILD_NUMBER=${{ github.run_number }}
            bash ./scripts/compute-version.sh
        ```

     4. Runs tests (unit + BDD acceptance tests).
     5. Builds the application, making sure `APP_VERSION` is visible inside the build (for example by using an environment variable):

        ```yaml
        - name: Build
          env:
            APP_VERSION: ${{ env.APP_VERSION }}
          run: npm run build:ci
        ```

     6. Publishes artifacts whose filenames contain the version, for example:

        ```yaml
        - name: Archive production build
          uses: actions/upload-artifact@v4
          with:
            name: collab-with-me-${{ env.APP_VERSION }}
            path: dist/
        ```

   - Ensure `APP_VERSION` is exported using `$GITHUB_ENV` so later steps can read it via `${{ env.APP_VERSION }}`.

4. **Plumb the version into the app build**

   - Make the version available to the TypeScript app at build time, e.g. by:
     - Using a `.env` file generated in CI that contains `VITE_APP_VERSION` or `REACT_APP_VERSION` (depending on the build tooling).
     - Or injecting it via a small `version.ts` module that reads from `process.env.APP_VERSION` when bundling.
   - The application should be able to display the current version somewhere in the UI (for example in a footer or “About” dialog), but this is lower priority than correct artifact tagging.

5. **Safety and cleanliness**

   - Do not commit any generated files or versions back to the repository.
   - Keep all changes backward compatible: local `npm test` / `npm run build` should still work even if `APP_VERSION` is not set (use a sensible default like `"0.0.0-local"`).
   - Add minimal documentation:
     - Update `README.md` with a short section explaining that:
       - `APP_VERSION` is derived from `package.json` + commit count (or CI run number).
       - CI artifacts are named `collab-with-me-<version>`.

Deliverables:
- `scripts/compute-version.sh` implemented.
- `package.json` updated with the new scripts.
- `.github/workflows/ci.yml` updated so that:
  - Every push to `main` computes a new version.
  - All uploaded artifacts carry that version in their name.
- Optional: code changes so the running app can display the current version, using the `APP_VERSION` provided by CI.


# chats response
Implemented automated versioning and surfaced the version in builds/UI.

Added scripts/compute-version.sh to derive APP_VERSION as MAJOR.MINOR.BUILD (base from package.json, build from git count or CI_BUILD_NUMBER), exporting to $GITHUB_ENV.
Updated package.json scripts: compute:version, build:ci (runs build + version injection).
CI workflow (.github/workflows/ci.yml) now computes the version on push to main/master, passes APP_VERSION into the build, and uploads artifacts named collab-with-me-<version>.
Added src/version.ts and scripts/inject-version.js; UI footer shows the current version (falls back to 0.0.0-local) from env/injected file.
Documented versioning flow in README.md.
Tests not re-run locally after changes; existing test commands remain unchanged.

9 files changed
+90
-3

Undo

View all changes
ci.yml
+19
-2

README.md
+6
-0

package.json
+3
-1

index.html
+3
-0

main.js
+6
-0

styles.css
+6
-0

compute-version.sh
+34
-0

inject-version.js
+8
-0

version.ts
+5
-0
