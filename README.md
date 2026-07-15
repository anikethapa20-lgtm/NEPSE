# NEPSE Research Workspace

A private two-author workspace for developing the full paper:

**Detecting Abnormal Trading Behavior in the Nepal Stock Exchange (NEPSE)**

## Included

- Passwordless email login
- Membership-only project access
- Full manuscript outline
- Section-by-section writing
- Section status tracking
- Research analysis notes
- Methodology and literature notes
- Research decision log
- Supabase Row Level Security
- Netlify deployment configuration
- Responsive desktop/mobile interface

## 1. Create Supabase project

1. Create a new Supabase project.
2. Open **SQL Editor**.
3. Run `supabase/schema.sql`.
4. In **Authentication > URL Configuration**, add:
   - `http://localhost:5173`
   - Your final Netlify URL
5. Copy the Project URL and anon/publishable key.

## 2. Configure locally

Copy `.env.example` to `.env`:

```bash
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Then run:

```bash
npm install
npm run dev
```

## 3. Approve the two authors

Both authors should request a magic login link once. Their accounts will then appear in:

**Supabase > Authentication > Users**

Copy each user UUID. In the SQL Editor, run the two membership inserts shown at the bottom of `supabase/schema.sql`.

This membership step is what prevents anyone else from accessing the workspace, even if they know the website address.

## 4. Deploy to Netlify

1. Upload this project to a new GitHub repository.
2. In Netlify, select **Add new project > Import an existing project**.
3. Choose the GitHub repository.
4. Build command: `npm run build`
5. Publish directory: `dist`
6. Add both environment variables in Netlify:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
7. Deploy.
8. Add the Netlify production URL to Supabase Authentication redirect URLs.

## Recommended next upgrades

- Automatic version snapshots on every save
- Comments attached to selected paper sections
- File storage for datasets, charts, tables, and PDFs
- Citation/reference manager
- Export complete manuscript to DOCX and PDF
- Statistical result library
- Activity history showing who changed what
- Side-by-side coauthor review and approval
