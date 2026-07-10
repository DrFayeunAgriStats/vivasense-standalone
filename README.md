# VivaSense Standalone App — Milestone 1

Minimal standalone VivaSense app authenticating against the same Supabase project as the main fia-institute-portal app.

**Goal**: Test that VivaSense can run as a separate app while sharing auth & Pro-status with the main app.

## Setup

1. **Copy environment variables**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (use same values as main fia-institute-portal).

2. **Install dependencies** (if not done):
   ```bash
   npm install
   ```

3. **Run dev server**:
   ```bash
   npm run dev
   ```
   App runs on http://localhost:5173

## Features (Milestone 1)

- ✅ **Supabase Auth** — Login/register using same project as main app
- ✅ **Auth Guard** — Unauthenticated users redirected to /auth
- ✅ **Pro-Status Check** — Reads vivasense_pro_access table and displays Free/Pro badge
- ✅ **Session Coexistence** — Can run alongside main app without session conflicts

## Testing

See [PHASE_1_REPORT.md](PHASE_1_REPORT.md) for Phase 1-3 summary and testing instructions.

## Architecture

- **React Router** — Routing (/auth, /workspace)
- **TanStack Query** — API data fetching (set up for future use)
- **Tailwind CSS v4** — Styling
- **Supabase** — Auth & database (shared with main app)

## Build & Deploy

```bash
npm run build    # Creates dist/ folder
npm run preview  # Preview production build locally
```

## Out of Scope (Milestone 1)

- No analysis forms or results components
- No upload or statistics modules
- No Word export
- No legacy vivasense-genetics components

These come in later phases after core plumbing is verified.
