# Claude Code Prompt 02 — Task 1: Build and Test Stabilisation

Mike wants the codebase stabilised before any new feature work.

## Scope

Fix build/test reliability only.

Known blockers:
1. Missing generated Prisma client.
2. Prisma import path: `../generated/prisma/client`.
3. Prisma generation may require `DATABASE_URL`.
4. Google Fonts may break builds in restricted/offline environments.
5. Some tests fail due Prisma import even when they do not need DB.

## Tasks

1. Run:
   ```bash
   npm test
   npm run build
   npx tsc --noEmit
   ```
   If any command is unavailable, record that.

2. Inspect:
   - `lib/prisma.ts`
   - `prisma/schema.prisma`
   - `prisma.config.ts`
   - `package.json`
   - Next font imports
   - app layout files

3. Fix Prisma strategy.

Preferred outcome:
- `prisma generate` runs before build where needed.
- Generated client output path matches import path.
- Non-DB tests do not fail because Prisma client is missing.
- DB-only modules import Prisma lazily or behind a repository boundary.
- Seed/static routes can run without live DB.

Acceptable fixes:
- Add `prebuild` / `pretest` if appropriate.
- Add generated client output config if missing.
- Move Prisma import behind DB-only function.
- Add safe fallback repository for seed mode.
- Ensure `DATABASE_URL` requirements are documented.

4. Fix Google Font build fragility.

Preferred outcome:
- Remove `next/font/google` dependency.
- Use local fonts or system font stack.
- Build does not depend on fetching Google Fonts.

5. Re-run:
   ```bash
   npm test
   npm run build
   npx tsc --noEmit
   ```

6. Write or update:
   ```text
   AUDIT_REPORT_BUILD_STABILITY.md
   ```

Include:
- commands run
- failures before fix
- changes made
- remaining issues
- exact pass/fail status

## Acceptance criteria

- `npm test` passes, or any remaining failures are unrelated and documented.
- `npm run build` passes.
- TypeScript passes if configured.
- No missing Prisma generated client import error.
- No Google Font fetch dependency blocks the build.
- No new product features added.

## Important

Do not fabricate DB state.
Do not add fake data.
Do not touch investment or dashboard UI unless required for build stability.
