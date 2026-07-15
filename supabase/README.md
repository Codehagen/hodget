# Supabase migrations

SQL applied to the Supabase project behind `NEXT_PUBLIC_SUPABASE_URL` (the
waitlist database — distinct from the engine Postgres in
`packages/db/migrations`). Apply with `supabase db push`, or paste into the
project's SQL editor. Every new Supabase table must ship its RLS policy here
in the same PR that introduces it.
