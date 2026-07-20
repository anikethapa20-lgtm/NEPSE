# NEPSE V14 Research-Only Edition

## What changed
- Removed the public portal route and all unauthenticated public-page rendering.
- Root and workspace routes now resolve only to authentication and the private research workspace.
- Retained Supabase authentication and `project_members` approval checks.
- Rebuilt the application shell with research-only navigation.
- Replaced the V13 dashboard with the V14 Research Command Center.
- Added responsive mobile navigation and a unified V14 visual system.
- Preserved the existing investigation, market, evidence, paper, export, files, quality, and administration tools.

## Main navigation
1. Research command
2. Event laboratory
3. Evidence matching
4. Market database
5. Evidence library
6. Research outputs
7. System control

## Validation
Run:

```bash
npm install
npm run build
```

The production build was validated successfully before packaging.
