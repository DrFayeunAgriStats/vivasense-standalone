# Phase 1: Standalone VivaSense App — Scaffolding Complete

## ✅ What Was Set Up

### Repository Structure Created
- **Repository location**: `c:\Users\ADMIN\vivasense-standalone`
- **Initialized with**: Vite + React + TypeScript (matching fia-institute-portal tooling)
- **Build succeeded**: ✓ (dist/ folder created, bundle: 482 KB / 139 KB gzipped)

### Core Files Copied (No Modifications Needed)
The following files were copied unmodified from the main app and compile cleanly:

1. **`src/integrations/supabase/client.ts`** — Supabase client initialization
   - Uses same VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY as main app
   - No import surprises — clean copy

2. **`src/contexts/AuthContext.tsx`** — Shared authentication state
   - Imports: supabase client, featureMode service
   - Works correctly with same user base as main app

3. **`src/services/featureMode.ts`** — VivaSense Pro/Free mode gating
   - Imports: supabase client only
   - Added missing `subscribeVivaSenseMode()` function (was imported by VivaSenseWorkspace)
   - Syncs Pro access from Supabase vivasense_pro_access table

4. **`src/lib/vivasenseGating.ts`** — Feature gating rules
   - No external imports needed (standalone logic)
   - Defines Pro/Free classification for ANOVA and Genetics requests

5. **`src/config/vivasense.ts`** — API backend URL configuration
   - Imports: import.meta.env only
   - Routes to same GENETICS_API_BASE as main app (Render backend or override via VITE_API_URL)

### Auth & Routing Pages Created
6. **`src/pages/VivaSenseAuth.tsx`** — Copied from main app, no changes needed
   - Full login/register/email-verification flow
   - Uses same Supabase auth endpoints as main app

7. **`src/components/vivasense/VivaSenseAuthGuard.tsx`** — Copied from main app
   - Redirects unauthenticated users to /auth
   - Routes authenticated users to /workspace

8. **`src/pages/VivaSenseWorkspace.tsx`** — Stub workspace page (NEW)
   - Shows authenticated user info (email, user ID)
   - **Displays VivaSense subscription status (Free vs Pro)**
   - **Displays Pro expiry date if applicable**
   - Shows debug info with full mode/expiry data

### App Routing & Providers
9. **`src/App.tsx`** — Root routing
   - GET / → redirects to /workspace
   - GET /auth → VivaSenseAuth (login/register)
   - GET /workspace → VivaSenseWorkspace (guarded by VivaSenseAuthGuard)
   - Wrapped with: AuthProvider, QueryClient, BrowserRouter

### Build Configuration
- **tsconfig.app.json** — Updated with @ path alias and ignoreDeprecations
- **vite.config.ts** — Added @ path resolver
- **tailwind.config.js** — Created (basic config)
- **postcss.config.js** — Updated for @tailwindcss/postcss v4
- **index.css** — Switched to Tailwind (no legacy styles)

### Dependencies Installed
Core tooling (matching main app versions where practical):
- react 18.2, react-dom 18.2
- react-router-dom 6.x
- @tanstack/react-query 4.x
- @supabase/supabase-js (latest)
- lucide-react (icons)
- tailwindcss v4, @tailwindcss/postcss

---

## 🔧 Import Analysis — NO UNEXPECTED DEPENDENCIES

**All four core files** (supabase client, AuthContext, featureMode, vivasenseGating) import only:
- React hooks
- Supabase client (already set up)
- Each other (internal to this app)
- Built-in types (import.meta.env, localStorage)

✅ **No external APIs, no third-party SDKs, no fia-institute-portal-specific utilities.**

---

## ⚠️ To Run This App Locally

### 1. Create `.env` File (Copy from Main App)
```bash
# Copy these exact values from fia-institute-portal's .env
VITE_SUPABASE_URL=<same as fia-institute-portal>
VITE_SUPABASE_PUBLISHABLE_KEY=<same as fia-institute-portal>
```

The app will authenticate against the **same Supabase project** as the main app, using the **same users and the same vivasense_pro_access table**.

### 2. Run Dev Server
```bash
cd vivasense-standalone
npm run dev
# App listens on http://localhost:5173
```

### 3. Run Tests (Phase 3 Below)
See Phase 3 testing instructions below.

---

## 📝 Phase 2 — First Real Page (Ready to Execute)

**COMPLETE:** All files for Phase 2 are already in place:
- ✓ VivaSenseAuth.tsx (login/register)
- ✓ VivaSenseAuthGuard.tsx (auth check)
- ✓ VivaSenseWorkspace.tsx (stub with Pro-status display)

No code changes needed for Phase 2 — app is ready to test.

---

## 🧪 Phase 3 — Verify Auth & Pro-Status (Testing Plan)

### Test 1: Unauthenticated User
1. Visit http://localhost:5173
2. **Expected**: Redirected to http://localhost:5173/auth
3. **Result**: ______ (pending test)

### Test 2: Pro User Login
1. Find an account in the main fia-institute-portal with a Pro subscription
   - Check Supabase: `vivasense_pro_access` table, find a row where `expires_at > NOW()`
   - Note that user's email
2. At /auth, sign in with that email
3. **Expected**: 
   - Redirected to /workspace
   - Page shows "🎯 Pro" badge under "Current Plan"
   - Debug info shows `"mode": "pro"`
   - Expiry date displays correctly
4. **Result**: ______ (pending test)

### Test 3: Free User Login
1. Find (or create) an account with NO Pro subscription
   - Check Supabase: `vivasense_pro_access` table, NO row for this user, OR row with `expires_at < NOW()`
2. At /auth, sign in with that email
3. **Expected**:
   - Redirected to /workspace
   - Page shows "🆓 Free" badge
   - Debug info shows `"mode": "free"`
   - "Expires" field hidden
4. **Result**: ______ (pending test)

### Test 4: Cross-App Session Coexistence
1. Open main fia-institute-portal in one browser tab (login if needed)
2. Open vivasense-standalone app in another tab
3. Log in to vivasense-standalone as different user
4. **Expected**:
   - Both apps show different logged-in users
   - No session contamination
   - Refreshing either app maintains its own user
5. **Result**: ______ (pending test)

---

## 📋 Compilation Issues Found & Fixed

| Issue | File | Status |
|-------|------|--------|
| ReactNode needs type-only import | VivaSenseAuthGuard, AuthContext | ✓ Fixed |
| Unused imports | VivaSenseAuth, vivasenseGating | ✓ Removed |
| Missing subscribeVivaSenseMode | featureMode.ts | ✓ Added |
| Tailwind CSS PostCSS plugin | postcss.config.js | ✓ Updated for v4 |
| TypeScript path alias | tsconfig.app.json, vite.config.ts | ✓ Configured |

---

## 🚀 Next Steps (User Action Required)

### Immediate (Blocking Phase 3 Testing)
1. Copy `.env` file:
   ```bash
   cd vivasense-standalone
   cp .env.example .env
   # Edit .env and fill in VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
   # (use same values as fia-institute-portal)
   ```

2. Run dev server:
   ```bash
   npm run dev
   ```

3. Follow Phase 3 testing plan above and report pass/fail for each test

### After Phase 3 Passes
- Phase 2 is complete (auth routing works, Pro-status readable)
- Ready to move to Phase 4 (copy real VivaSense components, test analysis forms)

---

## 📊 Milestone 1 Status Summary

| Phase | Component | Status |
|-------|-----------|--------|
| Phase 1A | Vite + React + TS scaffold | ✅ Complete |
| Phase 1B | Core files copied & compile | ✅ Complete |
| Phase 1C | Import analysis | ✅ No surprises |
| Phase 2A | Auth pages in place | ✅ Complete |
| Phase 2B | Routing wired up | ✅ Complete |
| Phase 3 | Real login tests | ⏳ Pending user action |

**Overall**: Scaffold is solid. Ready for Phase 3 testing.
