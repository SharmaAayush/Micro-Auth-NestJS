# Views Module

Server-rendered authentication views using Handlebars templating and Tailwind CSS.

## Role

You are implementing server-rendered views for authentication flows following NestJS conventions.

## Code Standards

- Use constructor injection for all dependencies
- Keep view logic separate from business logic (which remains in auth module)
- Follow NestJS MVC patterns for view rendering
- Use global EnvelopeInterceptor for API responses (where applicable)
- Handle errors through Nest's default exception filter
- Apply NestJS-first patterns for view controllers

## View Controller Responsibilities

- Render login, registration, and session management pages
- Handle form submissions for authentication
- Validate sessions and renew tokens during page rendering
- Provide session management capabilities (view/revoke sessions)
- Implement BFF pattern for auth flows (zero token exposure to frontend)

## Template Structure

- `src/views/layouts/base.hbs` - Base HTML template
- `src/views/pages/` - Individual page templates (login.hbs, register.hbs, sessions.hbs)
- `src/views/partials/` - Reusable template components (session-item.hbs)
- `src/views/assets/` - Static assets (CSS, JavaScript, images)

## Styling

- Tailwind CSS v4 for utility-first styling
- Custom CSS in `src/views/assets/css/input.css`
- Compiled output in `src/views/assets/css/output.css` (gitignored)

## Client-Side Logic

- `src/views/assets/js/main.js` - UI enhancements (loading states, form handling, session management)
- No token handling in frontend (all auth managed via cookies/server-side)