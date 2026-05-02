import "dotenv/config"
import fs from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"
import { Pool } from "pg"

const ensureDatabaseUrl = () => {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error("DATABASE_URL is required")
  }
  return url
}

const getSchemaPath = () => {
  const currentFile = fileURLToPath(import.meta.url)
  return path.resolve(path.dirname(currentFile), "..", "db", "schema.sql")
}

const run = async () => {
  const databaseUrl = ensureDatabaseUrl()
  const schemaPath = getSchemaPath()
  const sql = await fs.readFile(schemaPath, "utf-8")

  const pool = new Pool({ connectionString: databaseUrl })

  try {
    await pool.query(sql)
    console.log("Database schema applied.")
  } finally {
    await pool.end()
  }
}

run().catch((error) => {
  console.error("Migration failed:", error)
  process.exitCode = 1
})
