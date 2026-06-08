import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Read directly from process.env rather than prisma/config's `env()` helper,
    // which THROWS when the var is unset. `prisma generate` doesn't connect to
    // the DB, so it must succeed even without DATABASE_URL (e.g. a Vercel build
    // step before the runtime env is applied). Migrate/deploy still read the
    // real URL from process.env when it's present.
    url: process.env.DATABASE_URL ?? "",
  },
});
