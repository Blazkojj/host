import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { env } from "./config/env.js";

const pool = new Pool({
  connectionString: env.databaseUrl
});

export const query = (text, params = []) => pool.query(text, params);

export const migrate = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
      can_hosting BOOLEAN NOT NULL DEFAULT true,
      hosting_expires_at TIMESTAMPTZ,
      max_bots INTEGER NOT NULL DEFAULT 1,
      max_servers INTEGER NOT NULL DEFAULT 1,
      max_ram_mb INTEGER NOT NULL DEFAULT 1024,
      max_cpu NUMERIC(10,2) NOT NULL DEFAULT 1,
      max_storage_mb INTEGER NOT NULL DEFAULT 2048,
      blocked BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS workloads (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('bot', 'server')),
      template_key TEXT,
      runtime TEXT,
      image TEXT NOT NULL,
      container_name TEXT NOT NULL UNIQUE,
      container_id TEXT,
      upload_name TEXT,
      source_path TEXT,
      data_path TEXT,
      startup_command TEXT,
      env JSONB NOT NULL DEFAULT '{}'::jsonb,
      port_bindings JSONB NOT NULL DEFAULT '[]'::jsonb,
      status TEXT NOT NULL DEFAULT 'created',
      auto_restart BOOLEAN NOT NULL DEFAULT true,
      memory_mb INTEGER NOT NULL,
      cpu_limit NUMERIC(10,2) NOT NULL,
      storage_mb INTEGER NOT NULL,
      last_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_workloads_user_id ON workloads(user_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_workloads_container_id ON workloads(container_id);`);
};

export const seedAdmin = async () => {
  const passwordHash = await bcrypt.hash(env.adminPassword, 12);

  await query(
    `
      INSERT INTO users (
        id,
        email,
        password_hash,
        role,
        can_hosting,
        hosting_expires_at,
        max_bots,
        max_servers,
        max_ram_mb,
        max_cpu,
        max_storage_mb,
        blocked
      )
      VALUES (
        '50e5016c-5e2f-4f4f-b784-937dfe7e8032',
        $1,
        $2,
        'admin',
        true,
        NOW() + INTERVAL '100 years',
        50,
        50,
        65536,
        64,
        512000,
        false
      )
      ON CONFLICT (email)
      DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        role = 'admin',
        can_hosting = true,
        blocked = false,
        updated_at = NOW();
    `,
    [env.adminEmail, passwordHash]
  );
};

export const pingDatabase = async () => {
  await query("SELECT 1");
};

export const closeDatabase = async () => {
  await pool.end();
};
