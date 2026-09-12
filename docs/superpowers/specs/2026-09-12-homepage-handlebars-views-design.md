# Homepage with Handlebars Views Design

## Overview
Add server-rendered view pages to the NestJS authentication microservice starting with a homepage/marketing page using Handlebars (hbs) as the template engine.

## Goals
- Provide a marketing homepage that communicates the value proposition of Warden
- Leverage existing static SVG assets (warden-*.svg)
- Use Handlebars for templating with layouts, partials, and reusable components
- Maintain separation between API routes and view routes
- Ensure build process continues to work without modification

## Architecture

### View Engine Setup
- Use `hbs` npm package as the Handlebars implementation
- Configure in `main.ts`:
  - Views directory: project root `/views` 
  - View engine: `hbs`
  - Static assets: served from `/public`

### Directory Structure
```
views/
├── layouts/
│   └── main.hbs              # Base HTML layout
├── partials/
│   ├── header.hbs            # Site header
│   ├── footer.hbs            # Site footer  
│   └── trust-strip.hbs       # Trust strip component
└── pages/
    └── home.hbs              # Homepage content
```

### Components
1. **HomeController** (`src/home/home.controller.ts`)
   - Route: `GET /`
   - Uses `@Render('pages/home')` decorator
   - Passes UX copy data to template
   - Decorated with `@SkipEnvelope()` to prevent API response wrapping

2. **HomeModule** (`src/home/home.module.ts`)
   - Declares HomeController
   - Imported into AppModule

### Templates
- **Layout** (`views/layouts/main.hbs`): Basic HTML5 structure with viewport meta and favicon
- **Partials**: Reusable components for header, footer, and trust strip
- **Homepage** (`views/pages/home.hbs`): 
  - Hero section with headline, subhead, and CTAs
  - Features section with three benefit statements
  - Trust strip with small print
  - Footer with CTA

### Data Flow
1. Request to `GET /` handled by HomeController
2. Controller returns data object with homepage content
3. NestJS renders `views/pages/home.hbs` using the layout and partials
4. Final HTML response sent to client

## Dependencies
- Runtime: `hbs`
- Development: `@types/hbs`

## Build Process
- No changes required
- NestJS CLI (`nest build`) automatically:
  - Compiles TypeScript to `dist/`
  - Copies `views/` directory to `dist/views/`
  - Copies `public/` directory to `dist/public/`

## Interface Specifications

### HomeController Interface
```typescript
@Controller()
export class HomeController {
  @Get()
  @Render('pages/home')
  getHome(): Record<string, any> {
    return {
      headline: string,
      subhead: string,
      primaryCtaText: string,
      secondaryCtaText: string,
      features: Array<{title: string, description: string}>,
      trustStripText: string,
      footerCtaHeadline: string,
      footerCtaText: string
    };
  }
}
```

### Template Data Context
All templates receive the data object returned from the controller handler.

## Error Handling
- View rendering errors will propagate through NestJS exception handling
- Missing template results in 500 error
- Static asset 404s handled by default Express static middleware

## Security Considerations
- `@SkipEnvelope()` prevents accidental API data leakage in views
- Static asset serving is limited to `public/` directory
- No user-generated content in initial implementation

## Testing
### Manual Verification
1. `npm run start:dev`
2. Visit `http://localhost:3000` - should see rendered homepage
3. Verify static assets load (check network tab for SVG files)
4. Confirm API routes (`/auth/*`) still return JSON
5. `npm run build` - verify `dist/` contains views and public assets

### Automated Testing (Future)
- Add unit tests for HomeController
- Add e2e tests for homepage rendering
- Consider visual regression testing for template changes

## Open Questions
1. Should we add basic CSS styling or keep unstyled for now?
2. Should the homepage links be functional or placeholders?
3. Should we add a separate directory for view-specific styles/assets?

## Decision Log
- [2026-09-12] Chose `hbs` package over `handlebars` for better NestJS integration
- [2026-09-12] Located views at project root `/views` rather than `/src/views` for build simplicity
- [2026-09-12] Used `@SkipEnvelope()` on controller to prevent API response wrapping
- [2026-09-12] Organized templates into layouts/partials/pages for maintainability

## Self-Review Notes
- [X] Placeholder scan: No TBD or incomplete sections found
- [X] Internal consistency: Architecture matches feature descriptions
- [X] Scope check: Focused on homepage only, login/register kept as future scope
- [X] Ambiguity check: Requirements are specific and unambiguous