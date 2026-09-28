# Vercel deployment

This app is a Next.js application backed by PostgreSQL and Prisma 7. Vercel runs the app; a separate managed PostgreSQL service stores its data. The local Docker database and `frigocold-wms` database are not deployment targets.

## One-time project setup

1. Connect the `frigocold-wms-demo` Git repository to the Vercel project. If Vercel is connected to a parent repository, set **Root Directory** to `frigocold-demo`; otherwise use the repository root. Select the Next.js framework and leave its normal build command (`npm run build`). The checked-in `package-lock.json` uses npm. `postinstall` runs `prisma generate` during dependency installation.
2. In the Vercel project's **Storage** tab, add a PostgreSQL resource from the Marketplace (Neon is a straightforward choice). Choose a database region near the Vercel function region and users. The existing `@prisma/adapter-pg` works with a PostgreSQL connection string; no Neon driver or Liquibase dependency is required.
3. Connect the database resource to **Production**. Use a separate database or provider branch for **Preview**, and do not point Preview at the production database. If using provider branching, ensure a new preview branch receives the committed migrations before testing.
4. In **Settings → Environment Variables**, verify these server-only variables for each environment:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | Pooled PostgreSQL URL for app requests. The host will normally include `-pooler` for Neon. |
   | `DATABASE_URL_UNPOOLED` or `DIRECT_URL` | Direct/non-pooled URL for Prisma CLI migration commands. The Neon Vercel integration supplies `DATABASE_URL_UNPOOLED`; no duplicate `DIRECT_URL` is needed. |
   | `SESSION_SECRET` | A unique random secret of at least 32 characters. Keep it stable across deployments; changing it ends existing sessions. Use a different value for Preview. |

   The Neon Vercel integration creates `DATABASE_URL` and `DATABASE_URL_UNPOOLED` automatically. This app does not need the additional `PG*` or `POSTGRES_*` aliases it supplies. Inspect the variables' environment scopes. Never use a URL containing `localhost` in Vercel. Do not prefix secrets with `NEXT_PUBLIC_`. The `INITIAL_USER_*` variables are only needed by the one-time seed command, not by app requests.

If a database password was disclosed, reset it through **Vercel → Integrations → Neon → Open in Neon → Connect → Reset password**. Check that the integration's variables updated, then redeploy every connected Vercel environment. The old credential stops working immediately when reset. Do not put connection strings or passwords in Git, issues, or chat.

## Initialize a fresh database

Run the following from a trusted local checkout or a controlled CI job with the **target environment's** database variables loaded. Check the database name/host before applying migrations. Install the Vercel CLI if it is not present (`npm install -g vercel`). The Vercel CLI can inject a linked project's environment without writing the credentials to a file:

```powershell
vercel link
vercel env run -e production -- npm run db:status
vercel env run -e production -- npm run db:deploy
vercel env run -e production -- npm run db:status
```

`db:deploy` applies the committed migrations, including the `pg_trgm` search extension and indexes. It is safe to repeat. Use `db:migrate` only against a development database when authoring a new migration. Do not run migrations from the Vercel build command: preview builds and redeployments can run concurrently, and a build should not change the production database.

Create the first account and settings once. Set `INITIAL_USER_USERNAME` and `INITIAL_USER_PASSWORD` (at least 12 characters) in the shell or a temporary secret store used for this command, then run:

```powershell
vercel env run -e production -- npm run db:seed
```

The normal seed creates/retains the named account and default settings, without example business records. **Do not add `--demo` for Production.** The password is used only when that account is first created; re-running the seed does not change it. Remove the temporary `INITIAL_USER_*` values from your shell or secret store afterward. Avoid saving them as permanent Vercel runtime variables.

For Preview, use `-e preview` with its own database and initial account. Keep local development on the separate local database.

## Deploy changes

1. Commit the application code and `prisma/migrations` together, then push to the Git branch connected to Vercel. Local uncommitted files are not included in Git-based deployments.
2. Before promoting an app version that needs a schema change, back up the target database and run `db:deploy` against that target once. Prefer additive migrations so the currently deployed app continues to work during rollout.
3. Deploy or promote the Vercel build, sign in, and test a read and a write. Inspect function logs if a route fails. Changes to Vercel environment variables require a new deployment to reach running functions.

Prisma Migrate is the sole schema migration system for this repository. Keep its migration directories in Git. Do not use `prisma db push` or `prisma migrate dev` against Production. Set up managed database backups and confirm restore works before storing real operations data.
