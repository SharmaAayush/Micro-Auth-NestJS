# Auth Views Design: EJS + React Islands + Tailwind v4

**Date**: 2026-09-08
**Status**: Approved for implementation

---

## Overview

Add server-rendered view pages for authentication (login, register, sessions, profile) using:
- **EJS** for server-side template rendering via NestJS view engine
- **React Islands** for client-side interactivity (forms, session management)
- **Tailwind CSS v4** for styling (CSS-first configuration)
- **Vite** for building React components and processing Tailwind

All served from the **same NestJS application** — single deployment.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      NestJS App                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ EJS View     │  │ Auth API     │  │ Static Assets    │  │
│  │ Engine       │  │ (existing)   │  │ (dist/public)    │  │
│  └──────┬───────┘  └──────────────┘  └────────┬─────────┘  │
│         │                                     │             │
│         ▼                                     ▼             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   Express                            │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         ▲                    ▲
         │ Dev: Vite HMR      │ Prod: Static files
         ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                      Vite Dev Server                         │
│  - React island entry points                                │
│  - Tailwind v4 processing                                   │
│  - HMR for React components                                 │
└─────────────────────────────────────────────────────────────┘
```

### Development Mode
- Vite middleware injected into NestJS Express app
- HMR for React components
- EJS templates rendered by NestJS (with Vite client injected)

### Production Mode
- `npm run build` → `nest build` then `vite build`
- Vite outputs to `dist/public/` (CSS, JS islands, assets)
- NestJS serves static files from `dist/public/`
- EJS templates reference built assets via `<link>` / `<script>`

---

## Pages & Routes

| Route | Template | React Islands | Description |
|-------|----------|---------------|-------------|
| `GET /login` | `views/auth/login.ejs` | `<LoginForm />` | Email/password form with validation, loading state, error display |
| `GET /register` | `views/auth/register.ejs` | `<RegisterForm />` | Name, email, password, confirm; password strength meter |
| `GET /sessions` | `views/auth/sessions.ejs` | `<SessionList />` | List active sessions with revoke buttons, auto-refresh |
| `GET /profile` | `views/auth/profile.ejs` | `<ProfileForm />` | Edit name/email, change password, danger zone (delete account) |

All pages use a shared **base layout** (`views/layout.ejs`) with:
- HTML structure, `<head>` with meta tags
- Tailwind CSS link (built by Vite)
- Common header/navigation
- Mount points for React islands via `data-island` attributes

---

## React Islands

Small, focused React components mounted into specific DOM nodes in EJS templates.

### Island Entry Points (Vite)

```
src/client/
├── islands/
│   ├── LoginForm.tsx        → login-form.js
│   ├── RegisterForm.tsx     → register-form.js
│   ├── SessionList.tsx      → session-list.js
│   └── ProfileForm.tsx      → profile-form.js
├── styles/
│   └── global.css           → global.css (Tailwind v4 import)
├── main.tsx                 → Vite entry (optional, for HMR)
└── vite-env.d.ts
```

### Island Mounting Pattern

In EJS template:
```ejs
<div id="login-form" data-island="login-form" data-props='<%= JSON.stringify({ csrfToken }) %>'></div>
<script type="module" src="/assets/login-form.js"></script>
```

In React island:
```tsx
// LoginForm.tsx
export function LoginForm({ csrfToken }: { csrfToken: string }) {
  // Component logic
}

// Auto-mount on DOMContentLoaded
if (import.meta.env.PROD) {
  const root = document.getElementById('login-form');
  if (root) {
    const props = JSON.parse(root.dataset.props || '{}');
    createRoot(root).render(<LoginForm {...props} />);
  }
}
```

---

## Tailwind CSS v4 Configuration

**CSS-first approach** — no `tailwind.config.js` needed.

`src/client/styles/global.css`:
```css
@import "tailwindcss";

@theme {
  --color-primary: #3b82f6;
  --color-primary-hover: #2563eb;
  /* Custom theme tokens */
}

@layer base {
  * { @apply border-gray-200; }
  body { @apply bg-gray-50 text-gray-900 antialiased; }
}

@layer components {
  .btn { @apply px-4 py-2 rounded-lg font-medium transition-colors; }
  .btn-primary { @apply btn bg-primary text-white hover:bg-primary-hover; }
  .input { @apply w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary; }
}
```

Vite plugin: `@tailwindcss/vite` (Tailwind v4's native Vite plugin).

---

## File Structure Changes

### New Files

```
src/
├── main.ts                    ← Modified: Vite middleware, static assets, EJS engine
├── views/
│   ├── layout.ejs             ← Base layout with head, nav, island mount points
│   └── auth/
│       ├── login.ejs
│       ├── register.ejs
│       ├── sessions.ejs
│       └── profile.ejs
├── client/
│   ├── vite.config.ts         ← Vite config: multi-entry, Tailwind v4, React
│   ├── islands/
│   │   ├── LoginForm.tsx
│   │   ├── RegisterForm.tsx
│   │   ├── SessionList.tsx
│   │   └── ProfileForm.tsx
│   ├── styles/
│   │   └── global.css         ← Tailwind v4 import + custom styles
│   ├── main.tsx               ← Dev-only HMR entry
│   └── vite-env.d.ts
```

### Modified Files

- `package.json` — new dependencies, scripts (`dev`, `build`, `start:prod`)
- `tsconfig.json` — add `src/client` to include (or separate tsconfig for client)

---

## Dependencies

### Production
| Package | Version | Purpose |
|---------|---------|---------|
| `ejs` | ^3.1.10 | Template engine |
| `tailwindcss` | ^4.0.0 | CSS framework (v4) |

### Development
| Package | Version | Purpose |
|---------|---------|---------|
| `vite` | ^6.0.0 | Build tool + dev server |
| `@vitejs/plugin-react` | ^4.3.0 | React plugin for Vite |
| `@tailwindcss/vite` | ^4.0.0 | Tailwind v4 Vite plugin |
| `@types/ejs` | ^3.1.5 | TypeScript types for EJS |
| `concurrently` | ^9.0.0 | Run NestJS + Vite together in dev |

---

## Scripts (package.json)

```json
{
  "scripts": {
    "dev": "concurrently \"npm run start:dev\" \"npm run vite:dev\"",
    "vite:dev": "vite",
    "vite:build": "vite build",
    "build": "npm run build:nest && npm run vite:build",
    "build:nest": "nest build",
    "start:prod": "node dist/main.js"
  }
}
```

---

## API Integration

React islands call existing NestJS auth endpoints:

| Island | Endpoints |
|--------|-----------|
| `LoginForm` | `POST /auth/login` |
| `RegisterForm` | `POST /auth/register` |
| `SessionList` | `GET /auth/sessions`, `DELETE /auth/sessions/:id`, `DELETE /auth/sessions` |
| `ProfileForm` | `GET /auth/validate` (check auth), `PATCH /users/me` (new), `DELETE /users/me` (new) |

**Note**: Profile endpoints (`PATCH /users/me`, `DELETE /users/me`) need to be added to the auth controller.

---

## Error Handling

- **EJS render errors** → NestJS default exception filter (500 page)
- **React island errors** → Error boundary per island, fallback to server-rendered form
- **API errors** → Displayed inline in React components via envelope `meta` or error response
- **Unauthenticated access** → Redirect to `/login` with `?redirect=` param

---

## Security

- **CSRF**: Double-submit cookie pattern (existing cookie-parser + custom middleware)
- **XSS**: EJS auto-escapes `<%= %>`, React escapes by default
- **CSP**: Configure helmet or manual headers for script/style sources
- **Cookies**: Refresh token remains HTTP-only, Secure, SameSite (existing)

---

## Testing Strategy

| Layer | Tool | Coverage |
|-------|------|----------|
| React islands | Vitest + React Testing Library | Unit: form validation, API calls, rendering |
| EJS templates | Supertest + Cheerio | Integration: page renders, correct mount points |
| E2E | Playwright | Critical flows: login→sessions→logout, register→profile |

---

## Implementation Phases

1. **Setup**: Install deps, Vite config, Tailwind v4 global CSS
2. **NestJS Integration**: View engine, static assets, Vite middleware (dev)
3. **Base Layout**: `layout.ejs` with navigation, asset links, island mount helper
4. **Auth Pages**: Four EJS templates with island mount points
5. **React Islands**: Four island components with TypeScript, API integration
6. **Profile API**: Add `PATCH /users/me`, `DELETE /users/me` endpoints
7. **Scripts & Build**: Update package.json, verify prod build
8. **Testing**: Unit + integration tests for new code

---

## Out of Scope (Future Work)

- Email verification flow
- Password reset flow
- Two-factor authentication UI
- Admin dashboard
- Internationalization (i18n)
- Dark mode toggle (Tailwind supports, but not implemented)

---

## Acceptance Criteria

- [ ] `npm run dev` starts NestJS + Vite with HMR working
- [ ] `npm run build` produces `dist/` (NestJS) + `dist/public/` (Vite assets)
- [ ] `npm run start:prod` serves all pages correctly
- [ ] `/login` renders, form submits to API, shows errors/success
- [ ] `/register` renders, creates user, redirects to `/sessions`
- [ ] `/sessions` lists sessions, revoke works, auto-refreshes
- [ ] `/profile` shows user info, edit works, change password works
- [ ] Tailwind styles applied consistently across pages
- [ ] Unit tests pass for React islands
- [ ] E2E tests pass for critical auth flows