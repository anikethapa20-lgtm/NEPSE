# Repository Replacement Checklist

1. Extract this ZIP.
2. Open the extracted folder.
3. Upload everything inside it to the root of the GitHub repository.
4. Replace the old files when GitHub asks.
5. Confirm these exist at repository root:
   - `package.json`
   - `netlify.toml`
   - `vite.config.ts`
   - `src`
   - `supabase`
6. In Netlify, verify the two environment variables.
7. Trigger a new deployment.
8. In Supabase, disable public signup.
9. Create the two users manually.
10. Add their UUIDs to `project_members`.
11. Sign in using email and password.
