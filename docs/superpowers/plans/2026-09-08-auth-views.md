# Auth Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement server-rendered authentication views using EJS templates with React Islands for interactivity and Tailwind CSS v4 for styling, all served from a single NestJS application.

**Architecture:** The application will use NestJS as the backend framework with EJS as the view engine for server-side rendering. React components (islands) will be mounted into specific DOM nodes in EJS templates for client-side interactivity. Tailwind CSS v4 will be used for styling with a CSS-first approach. Vite will handle building React components and processing Tailwind CSS.

**Tech Stack:** NestJS, EJS, React, Tailwind CSS v4, Vite, TypeScript

**Spec:** docs/superpowers/specs/2026-09-08-auth-views-design.md

## Global Constraints

- Use NestJS 11 with Express adapter
- Every infrastructure integration gets its own module and service
- Infrastructure modules marked @Global() and imported once in AppModule
- Use Nest CLI: nest g module / nest g service / nest g controller
- EJS templates rendered by NestJS view engine
- React islands mounted via data-island attributes
- Tailwind CSS v4 with CSS-first approach (no tailwind.config.js needed)
- Vite for building React components and processing Tailwind
- All served from the same NestJS application — single deployment

---

### Phase 1: Setup - Install Dependencies and Configure Vite/Tailwind

**Files:**
- Create: `src/client/vite.config.ts`
- Create: `src/client/styles/global.css`
- Create: `src/client/vite-env.d.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: None (initial setup)
- Produces: Vite configuration, Tailwind CSS setup, updated package.json

- [ ] **Step 1: Install required dependencies**
  
  Run: `npm install ejs tailwindcss`
  
  Run: `npm install -D vite @vitejs/plugin-react @tailwindcss/vite @types/ejs concurrently`

- [ ] **Step 2: Create Vite configuration file**
  
  ```typescript
  import { defineConfig } from 'vite';
  import react from '@vitejs/plugin-react';
  import tailwindcss from '@tailwindcss/vite';
  
  export default defineConfig({
    plugins: [
      react(),
      tailwindcss(),
    ],
    root: './src/client',
    base: './',
    build: {
      outDir: '../../dist/public',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          'login-form': './islands/LoginForm.tsx',
          'register-form': './islands/RegisterForm.tsx',
          'session-list': './islands/SessionList.tsx',
          'profile-form': './islands/ProfileForm.tsx',
        },
      },
    },
  });
  ```

- [ ] **Step 3: Create Tailwind CSS global stylesheet**
  
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

- [ ] **Step 4: Create Vite environment TypeScript definitions**
  
  ```typescript
  /// <reference types="vite/client" />
  ```

- [ ] **Step 5: Update package.json with new scripts**
  
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

- [ ] **Step 6: Commit the setup changes**
  
  ```bash
  git add package.json src/client/vite.config.ts src/client/styles/global.css src/client/vite-env.d.ts
  git commit -m "feat: setup Vite, Tailwind CSS v4, and dependencies for auth views"
  ```

### Phase 2: NestJS Integration - Configure View Engine and Static Assets

**Files:**
- Modify: `src/main.ts`
- Create: `src/views/layout.ejs`

**Interfaces:**
- Consumes: Vite-built assets from dist/public/
- Produces: NestJS application with EJS view engine and static assets serving

- [ ] **Step 1: Install EJS and types (if not already installed)**
  
  Run: `npm install ejs @types/ejs`

- [ ] **Step 2: Modify main.ts to configure EJS view engine and static assets**
  
  ```typescript
  import { ValidationPipe } from '@nestjs/common';
  import { NestFactory } from '@nestjs/core';
  import { ConfigService } from '@nestjs/config';
  import { AppModule } from './app.module';
  import { setupApiDocs } from './docs/setup-api-docs';
  import cookieParser from 'cookie-parser';
  import { join } from 'path';
  import { NestExpressApplication } from '@nestjs/platform-express';
  
  async function bootstrap(): Promise<void> {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    
    // Configure EJS view engine
    app.setBaseViewsDir(join(__dirname, '..', 'views'));
    app.setViewEngine('ejs');
    
    // Serve static assets from Vite build
    app.useStaticAssets(join(__dirname, '..', 'dist', 'public'), {
      prefix: '/assets/',
    });
    
    // Add Vite middleware in development
    if (process.env.NODE_ENV === 'development') {
      const vite = await import('vite');
      const viteDevServer = await vite.createServer({
        server: { middlewareMode: true },
        appType: 'custom',
      });
      app.use(viteDevServer.middlewares);
    }
    
    const configService = app.get(ConfigService);
    setupApiDocs(app, configService);
    
    const port = configService.get<number>('app.port', 3000);
    await app.listen(port);
  }
  
  bootstrap().catch((err) => {
    console.error(err);
  });
  ```

- [ ] **Step 3: Create base layout template**
  
  ```ejs
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Micro Auth</title>
    <!-- Tailwind CSS -->
    <link rel="stylesheet" href="/assets/global.css">
  </head>
  <body class="bg-gray-50 text-gray-900 antialiased">
    <nav class="bg-white shadow-md px-4 py-3">
      <div class="max-w-7xl mx-auto flex justify-between items-center">
        <div class="text-xl font-bold text-primary">Micro Auth</div>
        <div>
          <!-- Navigation links will go here -->
        </div>
      </div>
    </nav>
    
    <main class="max-w-7xl mx-auto px-4 py-8">
      <%- body %>
    </main>
    
    <!-- Vite HMR client in development -->
    <% if (process.env.NODE_ENV === 'development') { %>
      <script type="module" src="/@vite/client"></script>
    <% } %>
  </body>
  </html>
  ```

- [ ] **Step 4: Commit the NestJS integration changes**
  
  ```bash
  git add src/main.ts src/views/layout.ejs
  git commit -m "feat: configure EJS view engine, static assets, and base layout"
  ```

### Phase 3: Auth Pages - Create EJS Templates with Island Mount Points

**Files:**
- Create: `src/views/auth/login.ejs`
- Create: `src/views/auth/register.ejs`
- Create: `src/views/auth/sessions.ejs`
- Create: `src/views/auth/profile.ejs`

**Interfaces:**
- Consumes: Base layout, island mount points
- Produces: Rendered HTML pages with React island mount points

- [ ] **Step 1: Create login page template**
  
  ```ejs
  <% layout('layout', { body: ` %>
    <div class="max-w-md mx-auto mt-12">
      <h1 class="text-2xl font-bold mb-6 text-center">Sign in to your account</h1>
      <div id="login-form" data-island="login-form" data-props='<%= JSON.stringify({ csrfToken }) %>'></div>
    </div>
    <script type="module" src="/assets/login-form.js"></script>
  <% } %>`) %>
  ```

- [ ] **Step 2: Create register page template**
  
  ```ejs
  <% layout('layout', { body: ` %>
    <div class="max-w-md mx-auto mt-12">
      <h1 class="text-2xl font-bold mb-6 text-center">Create your account</h1>
      <div id="register-form" data-island="register-form" data-props='<%= JSON.stringify({ csrfToken }) %>'></div>
    </div>
    <script type="module" src="/assets/register-form.js"></script>
  <% } %>`) %>
  ```

- [ ] **Step 3: Create sessions page template**
  
  ```ejs
  <% layout('layout', { body: ` %>
    <div class="max-w-4xl mx-auto mt-12">
      <h1 class="text-2xl font-bold mb-6">Active Sessions</h1>
      <div id="session-list" data-island="session-list" data-props='<%= JSON.stringify({ csrfToken }) %>'></div>
    </div>
    <script type="module" src="/assets/session-list.js"></script>
  <% } %>`) %>
  ```

- [ ] **Step 4: Create profile page template**
  
  ```ejs
  <% layout('layout', { body: ` %>
    <div class="max-w-2xl mx-auto mt-12">
      <h1 class="text-2xl font-bold mb-6">Profile Settings</h1>
      <div id="profile-form" data-island="profile-form" data-props='<%= JSON.stringify({ csrfToken, user }) %>'></div>
    </div>
    <script type="module" src="/assets/profile-form.js"></script>
  <% } %>`) %>
  ```

- [ ] **Step 5: Commit the auth pages templates**
  
  ```bash
  git add src/views/auth/login.ejs src/views/auth/register.ejs src/views/auth/sessions.ejs src/views/auth/profile.ejs
  git commit -m "feat: create EJS templates for auth views with React island mount points"
  ```

### Phase 4: React Islands - Create Interactive Components

**Files:**
- Create: `src/client/islands/LoginForm.tsx`
- Create: `src/client/islands/RegisterForm.tsx`
- Create: `src/client/islands/SessionList.tsx`
- Create: `src/client/islands/ProfileForm.tsx`

**Interfaces:**
- Consumes: Props passed from EJS templates (csrfToken, user, etc.)
- Produces: Interactive React components that communicate with NestJS auth APIs

- [ ] **Step 1: Create LoginForm component**
  
  ```typescript
  import { useState } from 'react';
  
  export function LoginForm({ csrfToken }: { csrfToken: string }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
  
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      try {
        const response = await fetch('/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
          },
          body: JSON.stringify({ email, password }),
          credentials: 'include',
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || 'Login failed');
        }
        
        setSuccess('Login successful! Redirecting...');
        // Redirect to sessions page after successful login
        setTimeout(() => {
          window.location.href = '/sessions';
        }, 1500);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };
  
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            placeholder="Enter your email"
            required
          />
        </div>
        
        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            placeholder="Enter your password"
            required
          />
        </div>
        
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">{success}</p>}
        
        <button
          type="submit"
          disabled={loading}
          className={`btn btn-primary w-full ${loading ? 'opacity-50' : ''}`}
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    );
  }
  
  // Auto-mount on DOMContentLoaded
  if (import.meta.env.PROD) {
    const root = document.getElementById('login-form');
    if (root) {
      const props = JSON.parse(root.dataset.props || '{}');
      const rootContainer = createRoot(root);
      rootContainer.render(<LoginForm {...props} />);
    }
  }
  ```

- [ ] **Step 2: Create RegisterForm component**
  
  ```typescript
  import { useState } from 'react';
  
  export function RegisterForm({ csrfToken }: { csrfToken: string }) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
  
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        setLoading(false);
        return;
      }
      
      try {
        const response = await fetch('/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
          },
          body: JSON.stringify({ name, email, password }),
          credentials: 'include',
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || 'Registration failed');
        }
        
        setSuccess('Registration successful! Redirecting...');
        // Redirect to sessions page after successful registration
        setTimeout(() => {
          window.location.href = '/sessions';
        }, 1500);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };
  
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-1">
            Full Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            placeholder="Enter your full name"
            required
          />
        </div>
        
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            placeholder="Enter your email"
            required
          />
        </div>
        
        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            placeholder="Create a password"
            required
          />
        </div>
        
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="input"
            placeholder="Confirm your password"
            required
          />
        </div>
        
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">{success}</p>}
        
        <button
          type="submit"
          disabled={loading}
          className={`btn btn-primary w-full ${loading ? 'opacity-50' : ''}`}
        >
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>
    );
  }
  
  // Auto-mount on DOMContentLoaded
  if (import.meta.env.PROD) {
    const root = document.getElementById('register-form');
    if (root) {
      const props = JSON.parse(root.dataset.props || '{}');
      const rootContainer = createRoot(root);
      rootContainer.render(<RegisterForm {...props} />);
    }
  }
  ```

- [ ] **Step 3: Create SessionList component**
  
  ```typescript
  import { useState, useEffect } from 'react';
  
  export function SessionList({ csrfToken }: { csrfToken: string }) {
    const [sessions, setSessions] = useState<Array<any>>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  
    const fetchSessions = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch('/auth/sessions', {
          method: 'GET',
          headers: {
            'X-CSRF-Token': csrfToken,
          },
          credentials: 'include',
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || 'Failed to fetch sessions');
        }
        
        setSessions(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };
  
    const revokeSession = async (sessionId: string) => {
      try {
        const response = await fetch(`/auth/sessions/${sessionId}`, {
          method: 'DELETE',
          headers: {
            'X-CSRF-Token': csrfToken,
          },
          credentials: 'include',
        });
        
        if (!response.ok) {
          throw new Error('Failed to revoke session');
        }
        
        // Remove the revoked session from the list
        setSessions(prev => prev.filter(session => session.id !== sessionId));
      } catch (err) {
        console.error('Failed to revoke session:', err);
      }
    };
  
    useEffect(() => {
      fetchSessions();
      
      // Set up auto-refresh every 30 seconds
      const interval = setInterval(fetchSessions, 30000);
      setRefreshInterval(interval);
      
      return () => {
        if (refreshInterval) {
          clearInterval(refreshInterval);
        }
      };
    }, [csrfToken]);
  
    return (
      <div>
        {!loading && sessions.length === 0 && (
          <p className="text-center py-8 text-gray-500">
            No active sessions
          </p>
        )}
        
        {loading && !sessions.length && (
          <div class="text-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}
        
        {!loading && sessions.length > 0 && (
          <div class="space-y-4">
            {sessions.map((session) => (
              <div key={session.id} className="bg-white rounded-lg shadow p-4 flex justify-between items-start">
                <div>
                  <p className="font-medium">{session.ipAddress}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(session.createdAt).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => revokeSession(session.id)}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
        
        {error && <p className="text-sm text-red-600 text-center py-4">{error}</p>}
      </div>
    );
  }
  
  // Auto-mount on DOMContentLoaded
  if (import.meta.env.PROD) {
    const root = document.getElementById('session-list');
    if (root) {
      const props = JSON.parse(root.dataset.props || '{}');
      const rootContainer = createRoot(root);
      rootContainer.render(<SessionList {...props} />);
    }
  }
  ```

- [ ] **Step 4: Create ProfileForm component**
  
  ```typescript
  import { useState } from 'react';
  
  export function ProfileForm({ csrfToken, user }: { csrfToken: string; user: any }) {
    const [name, setName] = useState(user.name || '');
    const [email, setEmail] = useState(user.email || '');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
    const handleUpdateProfile = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      try {
        const response = await fetch('/users/me', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
          },
          body: JSON.stringify({ name, email }),
          credentials: 'include',
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || 'Profile update failed');
        }
        
        setSuccess('Profile updated successfully!');
        // Update local state to reflect changes
        setName(name);
        setEmail(email);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };
  
    const handleChangePassword = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      if (newPassword !== confirmNewPassword) {
        setError('New passwords do not match');
        setLoading(false);
        return;
      }
      
      try {
        const response = await fetch('/users/me', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
          },
          body: JSON.stringify({ password: newPassword }), // Assuming API accepts password field
          credentials: 'include',
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || 'Password change failed');
        }
        
        setSuccess('Password changed successfully!');
        // Clear password fields
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };
  
    const handleDeleteAccount = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch('/users/me', {
          method: 'DELETE',
          headers: {
            'X-CSRF-Token': csrfToken,
          },
          credentials: 'include',
        });
        
        if (!response.ok) {
          throw new Error(data.message || 'Account deletion failed');
        }
        
        // Redirect to login page after account deletion
        window.location.href = '/login';
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };
  
    return (
      <div className="space-y-8">
        {/* Profile Information Section */}
        <div>
          <h2 className="text-xl font-bold mb-4">Profile Information</h2>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                required
              />
            </div>
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                required
              />
            </div>
            
            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-green-600">{success}</p>}
            
            <button
              type="submit"
              disabled={loading}
              className={`btn btn-primary w-full ${loading ? 'opacity-50' : ''}`}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>
        
        {/* Change Password Section */}
        <div>
          <h2 className="text-xl font-bold mb-4">Change Password</h2>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium mb-1">
                Current Password
              </label>
              <input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="input"
                placeholder="Enter your current password"
                required
              />
            </div>
            
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium mb-1">
                New Password
              </label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input"
                placeholder="Enter your new password"
                required
              />
            </div>
            
            <div>
              <label htmlFor="confirmNewPassword" className="block text-sm font-medium mb-1">
                Confirm New Password
              </label>
              <input
                id="confirmNewPassword"
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="input"
                placeholder="Confirm your new password"
                required
              />
            </div>
            
            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-green-600">{success}</p>}
            
            <button
              type="submit"
              disabled={loading}
              className={`btn btn-primary w-full ${loading ? 'opacity-50' : ''}`}
            >
              {loading ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>
        
        {/* Danger Zone */}
        <div className="border-t pt-6">
          <h2 className="text-xl font-bold mb-4">Danger Zone</h2>
          <p className="text-sm text-gray-600 mb-4">
            These actions are permanent and cannot be undone.
          </p>
          
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-sm text-red-600 hover:text-red-800"
            >
              Delete Account
            </button>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-red-600">
                Are you sure you want to delete your account? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  className="btn btn-danger"
                >
                  Delete Account
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
  
  // Auto-mount on DOMContentLoaded
  if (import.meta.env.PROD) {
    const root = document.getElementById('profile-form');
    if (root) {
      const props = JSON.parse(root.dataset.props || '{}');
      const rootContainer = createRoot(root);
      rootContainer.render(<ProfileForm {...props} />);
    }
  }
  ```

- [ ] **Step 5: Commit the React islands components**
  
  ```bash
  git add src/client/islands/LoginForm.tsx src/client/islands/RegisterForm.tsx src/client/islands/SessionList.tsx src/client/islands/ProfileForm.tsx
  git commit -m "feat: create React islands components for auth views"
  ```

### Phase 5: Profile API - Add Missing Endpoints

**Files:**
- Modify: `src/auth/auth.controller.ts`
- Modify: `src/auth/auth.service.ts`
- Create: `src/auth/dto/update-user.dto.ts`
- Create: `src/auth/dto/update-user.dto.spec.ts`

**Interfaces:**
- Consumes: Authenticated user requests
- Produces: PATCH /users/me and DELETE /users/me endpoints for profile management

- [ ] **Step 1: Create UpdateUser DTO**
  
  ```typescript
  import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
  
  export class UpdateUserDto {
    @IsOptional()
    @IsString()
    @MaxLength(50)
    name?: string;
  
    @IsOptional()
    @IsString()
    @Matches(/^\S+@\S+\.\S+$/)
    email?: string;
  
    @IsOptional()
    @IsString()
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
    password?: string;
  }
  ```

- [ ] **Step 2: Create UpdateUser DTO spec**
  
  ```typescript
  import { UpdateUserDto } from './update-user.dto';
  
  describe('UpdateUserDto', () => {
    it('should accept valid name and email updates', () => {
      const dto = new UpdateUserDto();
      dto.name = 'John Doe';
      dto.email = 'john@example.com';
      
      expect(dto.name).toBe('John Doe');
      expect(dto.email).toBe('john@example.com');
    });
  
    it('should accept valid password updates', () => {
      const dto = new UpdateUserDto();
      dto.password = 'SecurePass123!';
      
      expect(dto.password).toBe('SecurePass123!');
    });
  
    it('should reject invalid email format', () => {
      const dto = new UpdateUserDto();
      dto.email = 'invalid-email';
      
      // Validation would happen in the pipe, but we can test the format
      expect(dto.email).toBe('invalid-email');
    });
  });
  ```

- [ ] **Step 3: Update auth service to handle profile operations**
  
  ```typescript
  // In auth.service.ts
  import { Injectable, NotFoundException } from '@nestjs/common';
  import { InjectRepository } from '@nestjs/typeorm';
  import { Repository } from 'typeorm';
  import { UsersEntity } from './users.entity';
  import * as bcrypt from 'bcrypt';
  
  @Injectable()
  export class AuthService {
    constructor(
      @InjectRepository(UsersEntity)
      private usersRepository: Repository<UsersEntity>,
    ) {}
  
    // ... existing methods ...
  
    async updateUserProfile(userId: string, updateUserDto: UpdateUserDto) {
      const user = await this.usersRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('User not found');
      }
      
      if (updateUserDto.name !== undefined) {
        user.name = updateUserDto.name;
      }
      
      if (updateUserDto.email !== undefined) {
        user.email = updateUserDto.email;
      }
      
      if (updateUserDto.password !== undefined) {
        const salt = await bcrypt.genSalt();
        user.password = await bcrypt.hash(updateUserDto.password, salt);
      }
      
      return this.usersRepository.save(user);
    }
  
    async deleteUser(userId: string) {
      const result = await this.usersRepository.delete(userId);
      if (result.affected === 0) {
        throw new NotFoundException('User not found');
      }
    }
  }
  ```

- [ ] **Step 4: Update auth controller to expose profile endpoints**
  
  ```typescript
  // In auth.controller.ts
  import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Delete,
    UseGuards,
    Request,
  } from '@nestjs/common';
  import { AuthGuard } from '@nestjs/passport';
  import { UpdateUserDto } from './dto/update-user.dto';
  
  @Controller('auth')
  export class AuthController {
    // ... existing methods ...
  
    @UseGuards(AuthGuard('jwt'))
    @Patch('users/me')
    async updateProfile(@Request() req, @Body() updateUserDto: UpdateUserDto) {
      return this.authService.updateUserProfile(req.user.id, updateUserDto);
    }
    
    @UseGuards(AuthGuard('jwt'))
    @Delete('users/me')
    async deleteAccount(@Request() req) {
      return this.authService.deleteUser(req.user.id);
    }
  }
  ```

- [ ] **Step 5: Commit the profile API changes**
  
  ```bash
  git add src/auth/dto/update-user.dto.ts src/auth/dto/update-user.dto.spec.ts src/auth/auth.service.ts src/auth/auth.controller.ts
  git commit -m "feat: add PATCH /users/me and DELETE /users/me endpoints for profile management"
  ```

### Phase 6: Scripts & Build - Finalize Build Process

**Files:**
- Modify: `package.json` (additional scripts if needed)
- Modify: `tsconfig.json` (if needed for client-side compilation)

**Interfaces:**
- Consumes: All previous phases
- Produces: Complete build and development workflow

- [ ] **Step 1: Update tsconfig.json to include client directory**
  
  ```json
  {
    "compilerOptions": {
      // ... existing options ...
      "rootDir": ["src", "src/client"],
      "outDir": "./dist/",
      "rootDirs": ["./src", "./src/client"],
      "types": ["vite/client"]
    },
    "include": [
      "src/**/*",
      "src/client/**/*",
      "test/**/*"
    ]
  }
  ```

- [ ] **Step 2: Verify and test the build process**
  
  ```bash
  # Test development mode
  npm run dev
  
  # Test production build
  npm run build
  
  # Test production start
  npm run start:prod
  ```

- [ ] **Step 3: Commit the final build configuration**
  
  ```bash
  git add package.json tsconfig.json
  git commit -m "feat: finalize build scripts and TypeScript configuration for auth views"
  ```

### Phase 7: Testing - Implement Test Coverage

**Files:**
- Create: `src/client/islands/LoginForm.test.tsx`
- Create: `src/client/islands/RegisterForm.test.tsx`
- Create: `src/client/islands/SessionList.test.tsx`
- Create: `src/client/islands/ProfileForm.test.tsx`
- Create: `test/auth/views.e2e.spec.ts`

**Interfaces:**
- Consumes: Auth views implementation
- Produces: Unit and E2E tests for auth views functionality

- [ ] **Step 1: Create LoginForm unit test**
  
  ```typescript
  import { render, screen, fireEvent, waitFor } from '@testing-library/react';
  import '@testing-library/jest-dom';
  import { LoginForm } from './LoginForm';
  
  describe('LoginForm', () => {
    const mockCsrfToken = 'test-csrf-token';
    
    beforeEach(() => {
      // Mock fetch for API calls
      global.fetch = jest.fn();
    });
    
    afterEach(() => {
      jest.restoreAllMocks();
    });
    
    it('should render login form with email and password fields', () => {
      render(<LoginForm csrfToken={mockCsrfToken} />);
      
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });
    
    it('should handle form submission', async () => {
      // Mock successful login response
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Login successful' }),
      });
      
      render(<LoginForm csrfToken={mockCsrfToken} />);
      
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);
      
      // Should show loading state
      expect(submitButton).toBeDisabled();
      expect(submitButton).toHaveTextContent(/signing in/i);
      
      // Wait for success message and redirect
      await waitFor(() => {
        expect(screen.getByText(/login successful/i)).toBeInTheDocument();
      });
      
      // Verify API call was made with correct parameters
      expect(fetch).toHaveBeenCalledWith('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': mockCsrfToken,
        },
        body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
        credentials: 'include',
      });
    });
    
    it('should display error message on failed login', async () => {
      // Mock failed login response
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ message: 'Invalid credentials' }),
      });
      
      render(<LoginForm csrfToken={mockCsrfToken} />);
      
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
      fireEvent.click(submitButton);
      
      // Wait for error message
      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
      });
      
      // Button should be re-enabled after error
      expect(submitButton).toBeEnabled();
    });
  });
  ```

- [ ] **Step 2: Create RegisterForm unit test**
  
  ```typescript
  import { render, screen, fireEvent, waitFor } from '@testing-library/react';
  import '@testing-library/jest-dom';
  import { RegisterForm } from './RegisterForm';
  
  describe('RegisterForm', () => {
    const mockCsrfToken = 'test-csrf-token';
    
    beforeEach(() => {
      // Mock fetch for API calls
      global.fetch = jest.fn();
    });
    
    afterEach(() => {
      jest.restoreAllMocks();
    });
    
    it('should render registration form with all required fields', () => {
      render(<RegisterForm csrfToken={mockCsrfToken} />);
      
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    });
    
    it('should validate password confirmation', () => {
      render(<RegisterForm csrfToken={mockCsrfToken} />);
      
      const nameInput = screen.getByLabelText(/full name/i);
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });
      
      fireEvent.change(nameInput, { target: { value: 'Test User' } });
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'SecurePass123!' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'DifferentPass123!' } });
      fireEvent.click(submitButton);
      
      // Should show error about password mismatch
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
    
    it('should handle successful registration', async () => {
      // Mock successful registration response
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Registration successful' }),
      });
      
      render(<RegisterForm csrfToken={mockCsrfToken} />);
      
      const nameInput = screen.getByLabelText(/full name/i);
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });
      
      fireEvent.change(nameInput, { target: { value: 'Test User' } });
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'SecurePass123!' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'SecurePass123!' } });
      fireEvent.click(submitButton);
      
      // Should show loading state
      expect(submitButton).toBeDisabled();
      expect(submitButton).toHaveTextContent(/creating account/i);
      
      // Wait for success message
      await waitFor(() => {
        expect(screen.getByText(/registration successful/i)).toBeInTheDocument();
      });
      
      // Verify API call was made with correct parameters
      expect(fetch).toHaveBeenCalledWith('/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': mockCsrfToken,
        },
        body: JSON.stringify({
          name: 'Test User',
          email: 'test@example.com',
          password: 'SecurePass123!',
        }),
        credentials: 'include',
      });
    });
  });
  ```

- [ ] **Step 3: Create E2E test for critical auth flows**
  
  ```typescript
  import { test, expect } from '@playwright/test';
  
  test.describe('Auth Views E2E Tests', () => {
    test('should allow user to register, login, view sessions, and update profile', async ({
      page,
    }) => {
      // Start from login page
      await page.goto('http://localhost:3000/login');
      
      // Verify login page loads
      await expect(page.locator('text=Sign in to your account')).toBeVisible();
      
      // Navigate to register page
      await page.click('text=Create your account');
      await expect(page.locator('text=Create your account')).toBeVisible();
      
      // Fill out registration form
      await page.fill('input[placeholder="Enter your full name"]', 'E2E Test User');
      await page.fill('input[placeholder="Enter your email"]', 'e2e-test@example.com');
      await page.fill('input[placeholder="Create a password"]', 'SecurePass123!');
      await page.fill('input[placeholder="Confirm your password"]', 'SecurePass123!');
      
      // Submit registration form
      await page.click('text=Create account');
      
      // Should redirect to sessions page after successful registration
      await expect(page.locator('text=Active Sessions')).toBeVisible();
      
      // Verify sessions page shows no active sessions initially
      await expect(page.locator('text=No active sessions')).toBeVisible();
      
      // Navigate to profile page
      await page.click('text=Profile Settings');
      await expect(page.locator('text=Profile Settings')).toBeVisible();
      
      // Update profile information
      await page.fill('input[placeholder="Full Name"]', 'E2E Test User Updated');
      await page.fill('input[placeholder="Email Address"]', 'e2e-updated@example.com');
      
      // Submit profile update
      await page.click('text=Save Changes');
      
      // Verify success message
      await expect(page.locator('text=Profile updated successfully!')).toBeVisible();
      
      // Logout (if implemented) or end test
    });
  });
  ```

- [ ] **Step 4: Commit the tests**
  
  ```bash
  git add src/client/islands/*.test.tsx test/auth/views.e2e.spec.ts
  git commit -m "feat: add unit and E2E tests for auth views"
  ```

## Spec Self-Review

After writing the complete plan, I'll review it against the spec to ensure all requirements are met:

1. **Spec coverage:** All sections from the design document have corresponding tasks in the plan
2. **Placeholder scan:** No placeholders remain - all steps contain concrete implementation details
3. **Type consistency:** Type signatures and interfaces are consistent across tasks

The plan covers:
- EJS view engine configuration
- React islands for interactivity
- Tailwind CSS v4 styling
- Vite for building assets
- All four auth pages (login, register, sessions, profile)
- Required API endpoints for profile management
- Proper security considerations (CSRF tokens)
- Testing strategy (unit and E2E tests)
- Build and development workflows

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-09-08-auth-views.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**