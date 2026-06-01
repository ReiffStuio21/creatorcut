# Supabase setup (optional — for auth + saved projects)

CreatorCut runs fully without Supabase (mock transcription, no accounts). Add it
when you want accounts and saved projects.

## 1. Create a project
At [supabase.com](https://supabase.com), create a project. Copy the **Project URL**
and the **anon public** key.

## 2. Apply the schema
Open the **SQL Editor** and run [`migrations/0001_init.sql`](migrations/0001_init.sql).
It creates `profiles` + `projects` (RLS on, owner-only), a profile-on-signup
trigger, and a private `videos` storage bucket with owner-only policies.

## 3. Add env vars
In `.env.local` (local) and your Vercel project settings:

```
NEXT_PUBLIC_SUPABASE_URL=...        # Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # anon public key
```

Setting these activates the auth proxy automatically: `/dashboard` requires
login, while `/` and `/editor` stay public.

## 4. (Optional) regenerate types
The committed `src/lib/supabase/types.gen.ts` is hand-written to match the
migration. To regenerate from your project:

```sh
npx supabase gen types typescript --project-id <id> > src/lib/supabase/types.gen.ts
```

## What's persisted (v1)
The source video (to the `videos` bucket) + the full edit as the EDL JSON
(segments, captions, aspect ratio, look). Music/image overlays are a follow-on.
