// Seed (or promote) a local-dev admin account.
//
// Not run automatically by `supabase db reset` -- seed.sql is pure SQL and
// creating an auth.users row by hand there is fragile (GoTrue's schema has
// many required columns that change across versions; a hand-rolled INSERT
// is exactly the kind of thing that silently breaks login). This script
// uses the Admin API instead, which handles password hashing correctly.
//
// Usage: node scripts/seed_admin.mjs
// Requires (in .env.local, NOT VITE_-prefixed -- must never reach the
// client bundle): SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD.
// Also needs the local Supabase service role key -- read from
// VITE_SUPABASE_URL (already in .env.local) + the fixed local service key
// (safe to hardcode: it's the well-known Supabase CLI local dev key, not a
// secret -- same value already hardcoded in scripts/export_dictionary_full.py).

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

function loadEnvLocal() {
  const envPath = path.join(ROOT, '.env.local')
  const env = {}
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim()
  }
  return env
}

const env = { ...loadEnvLocal(), ...process.env }

const SUPABASE_URL = env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const ADMIN_EMAIL = env.SEED_ADMIN_EMAIL
const ADMIN_PASSWORD = env.SEED_ADMIN_PASSWORD

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Missing SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function run() {
  // Reuse the account if it already exists (e.g. re-running after a db
  // reset wiped auth.users but the row somehow survived) instead of erroring.
  const { data: existingPage, error: listErr } = await supabase.auth.admin.listUsers()
  if (listErr) throw listErr
  let userId = existingPage.users.find((u) => u.email === ADMIN_EMAIL)?.id

  if (!userId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
    })
    if (error) throw error
    userId = data.user.id
    console.log(`Created auth user ${ADMIN_EMAIL} (${userId})`)
  } else {
    console.log(`Reusing existing auth user ${ADMIN_EMAIL} (${userId})`)
  }

  // The on_auth_user_created trigger (20260820000001_profiles.sql) already
  // inserted a default 'student' profiles row -- promote it to admin.
  const { error: roleErr } = await supabase.from('profiles').update({ role: 'admin' }).eq('id', userId)
  if (roleErr) throw roleErr

  console.log(`profiles.role='admin' set for ${ADMIN_EMAIL}`)
}

run().catch((err) => {
  console.error('Seeding admin account failed:', err.message || err)
  process.exit(1)
})
