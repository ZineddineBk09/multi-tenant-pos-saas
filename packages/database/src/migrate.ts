import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { client, db } from "./client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log("Running Drizzle migrations...");
  await migrate(db, { migrationsFolder: join(__dirname, "../drizzle") });

  console.log("Applying RLS policies...");
  const rlsSql = readFileSync(
    join(__dirname, "../migrations/0001_rls_policies.sql"),
    "utf-8",
  );

  // Strip comment lines from each chunk. (Previously a chunk starting with "-- Section"
  // was dropped entirely, which silently skipped the first policy of every section,
  // e.g. products_select, so reads and INSERT ... RETURNING were blocked by RLS.)
  const statements = rlsSql
    .split(";")
    .map((chunk) =>
      chunk
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    try {
      await client.unsafe(statement);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("already exists")) {
        console.log(`Skipping (already exists): ${statement.slice(0, 60)}...`);
        continue;
      }
      throw error;
    }
  }

  console.log("Migrations complete.");
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
