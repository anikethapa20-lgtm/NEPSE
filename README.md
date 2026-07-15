# NEPSE Research Workspace

Private two-author workspace for:

**Detecting Abnormal Trading Behavior in the Nepal Stock Exchange (NEPSE)**

## Authentication model

This version has:

- No public signup
- No magic-link login
- No password reset page
- Email-and-password login only
- User accounts created manually by the project administrator in Supabase
- Project access controlled through `project_members`
- Row Level Security on all research data

## 1. Run the database schema

In Supabase:

1. Open **SQL Editor**
2. Create a new query
3. Run `supabase/schema.sql`

## 2. Disable public signups

In Supabase:

1. Open **Authentication**
2. Open **Providers**
3. Open **Email**
4. Turn off **Allow new users to sign up**
5. Keep email/password login enabled

## 3. Create the two user accounts manually

In Supabase:

1. Open **Authentication**
2. Open **Users**
3. Click **Add user**
4. Choose **Create new user**
5. Enter the author's email and a temporary password
6. Enable **Auto confirm user**
7. Repeat for the coauthor

Copy both user UUIDs.

## 4. Add both users to the project

Run this in the Supabase SQL Editor:

```sql
insert into public.project_members (project_id, user_id, role)
select id, 'YOUR_USER_UUID'::uuid, 'owner'
from public.projects
order by created_at desc
limit 1;
```

Then:

```sql
insert into public.project_members (project_id, user_id, role)
select id, 'COAUTHOR_USER_UUID'::uuid, 'coauthor'
from public.projects
order by created_at desc
limit 1;
```

## 5. Netlify environment variables

Add:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Then trigger a new deployment.

## 6. Build settings

```text
Build command: npm run build
Publish directory: dist
```

## 7. Replace the repository

Upload the contents of this folder to the root of your GitHub repository. Do not upload the outer folder itself as an extra nested directory.
