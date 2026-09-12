# Homepage with Handlebars Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a server-rendered marketing homepage using Handlebars templating to the NestJS authentication microservice.

**Architecture:** Use the `hbs` package for View Engine configuration, with views located at project root `/views`, organized into layouts, partials, and pages. The homepage controller renders the view with `@SkipEnvelope()` to prevent API response wrapping.

**Tech Stack:** NestJS 11, Handlebars (hbs), TypeScript

**Spec:** docs/superpowers/specs/2026-09-12-homepage-handlebars-views-design.md

## Global Constraints

- NestJS version: ^11.0.1
- Views directory: project root `/views`
- View engine: `hbs`
- Static assets served from `/public`
- Controller uses `@SkipEnvelope()` decorator
- No changes to existing build process

---
### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Interfaces:**
- Consumes: None
- Produces: Added `hbs` and `@types/hbs` dependencies

- [ ] **Step 1: Write the command to install dependencies**

```bash
npm install hbs
npm install -D @types/hbs
```

- [ ] **Step 2: Verify installation**

Run: `npm list hbs @types/hbs`
Expected: Shows installed versions without errors

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add hbs and @types/hbs dependencies for view rendering"
```

### Task 2: Configure View Engine and Static Assets

**Files:**
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: NestJS application instance
- Produces: Configured application with view engine and static assets

- [ ] **Step 1: Write the failing test (conceptual - we'll verify by running app)**

```typescript
// We'll verify by checking that app.setBaseViewsDir and app.setViewEngine are called
// and app.useStaticAssets is called with correct path
```

- [ ] **Step 2: Implement view engine configuration**

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
  
  // View engine setup - views at project root
  app.setBaseViewsDir(join(__dirname, '..', 'views'));
  app.setViewEngine('hbs');
  
  // Static assets
  app.useStaticAssets(join(__dirname, '..', 'public'));
  
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const configService = app.get(ConfigService);
  setupApiDocs(app, configService);

  const port = configService.get<number>('app.port', 3000);
  await app.listen(port);
}

bootstrap().catch((err) => {
  console.error(err);
});
```

- [ ] **Step 3: Verify implementation**

Run: `npm run start:dev` (briefly start and stop to check for compilation errors)
Expected: Application starts without errors related to view engine

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat: configure hbs view engine and static assets serving"
```

### Task 3: Create Views Directory Structure

**Files:**
- Create: `views/layouts/main.hbs`
- Create: `views/partials/header.hbs`
- Create: `views/partials/footer.hbs`
- Create: `views/partials/trust-strip.hbs`
- Create: `views/pages/home.hbs`

**Interfaces:**
- Consumes: None
- Produces: Complete Handlebars template structure for homepage

- [ ] **Step 1: Create views directory structure**

```bash
mkdir -p views/layouts views/partials views/pages
```

- [ ] **Step 2: Create layout file**

```handlebars
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{title || 'Warden'}}</title>
  <link rel="icon" href="/assets/warden-favicon.svg" type="image/svg+xml">
</head>
<body>
  {{> header }}
  <main>
    {{{body}}}
  </main>
  {{> footer }}
</body>
</html>
```

- [ ] **Step 3: Create header partial**

```handlebars
```handlebars
<header>
  <!-- Navigation could go here -->
</header>
```

- [ ] **Step 4: Create footer partial**

```handlebars
<footer>
  <div class="footer-cta">
    <h2>{{footerCtaHeadline}}</h2>
    <p>{{footerCtaText}}</p>
  </div>
</footer>
```

- [ ] **Step 5: Create trust strip partial**

```handlebars
<div class="trust-strip">
  <p>{{trustStripText}}</p>
</div>
```

- [ ] **Step 6: Create homepage content**

```handlebars
{{> partials/header }}

<section class="hero">
  <h1>{{headline}}</h1>
  <p class="subhead">{{subhead}}</p>
  <div class="cta-buttons">
    <a href="#" class="primary-cta">{{primaryCtaText}}</a>
    <a href="#" class="secondary-cta">{{secondaryCtaText}}</a>
  </div>
</section>

<section class="features">
  {{#each features}}
    <div class="feature">
      <h3>{{this.title}}</h3>
      <p>{{this.description}}</p>
    </div>
  {{/each}}
</section>

{{> partials/trust-strip }}

{{> partials/footer }}
```

- [ ] **Step 7: Commit**

```bash
git add views/
git commit -m "feat: create handlebars template structure for homepage"
```

### Task 4: Create Homepage Controller

**Files:**
- Create: `src/home/home.controller.ts`

**Interfaces:**
- Consumes: None
- Produces: Controller that renders homepage view with UX copy data

- [ ] **Step 1: Write the failing test (conceptual)**

```typescript
// Test that controller returns correct data for rendering
```

- [ ] **Step 2: Implement homepage controller**

```typescript
import { Controller, Get, Render, Res } from '@nestjs/common';
import { Response } from 'express';
import { SkipEnvelope } from '../common/transform/response/skip-envelope.decorator';

@SkipEnvelope() // Prevent API envelope wrapping
@Controller()
export class HomeController {
  @Get()
  @Render('pages/home')
  getHome() {
    return {
      // Data to pass to the template
      headline: 'Auth you run yourself.',
      subhead: 'Login, sessions, and OAuth for your other apps — one service, your servers, your data.',
      primaryCtaText: 'Get started → deploy/docs',
      secondaryCtaText: 'View on GitHub',
      features: [
        {
          title: 'Sign in once, everywhere.',
          description: 'Warden issues sessions your other services can trust, so people log in once and move between apps without doing it again.'
        },
        {
          title: 'See every place you\'re signed in.',
          description: 'Every session shows its device, location, and last activity. Nothing hides in the background.'
        },
        {
          title: 'End access instantly.',
          description: 'Sign out one device or all of them. Revoked sessions stop working immediately, not on their next refresh.'
        }
      ],
      trustStripText: 'Self-hosted. Open source. Your users\' credentials never leave your infrastructure.',
      footerCtaHeadline: 'Add sign-in to your app in an afternoon.',
      footerCtaText: 'Read the docs'
    };
  }
}
```

- [ ] **Step 3: Verify implementation**

Run: `npm run start:dev` (briefly start and stop to check for compilation errors)
Expected: Application starts without errors related to new controller

- [ ] **Step 4: Commit**

```bash
git add src/home/home.controller.ts
git commit -m "feat: create homepage controller with handlebars rendering"
```

### Task 5: Create Homepage Module

**Files:**
- Create: `src/home/home.module.ts`

**Interfaces:**
- Consumes: HomeController
- Produces: Module that declares the homepage controller

- [ ] **Step 1: Implement homepage module**

```typescript
import { Module } from '@nestjs/common';
import { HomeController } from './home.controller';

@Module({
  controllers: [HomeController],
})
export class HomeModule {}
```

- [ ] **Step 2: Verify implementation**

Run: `npm run start:dev` (briefly start and stop to check for compilation errors)
Expected: Application starts without errors related to new module

- [ ] **Step 3: Commit**

```bash
git add src/home/home.module.ts
git commit -m "feat: create homepage module"
```

### Task 6: Update App Module

**Files:**
- Modify: `src/app.module.ts`

**Interfaces:**
- Consumes: HomeModule
- Produces: AppModule that imports HomeModule

- [ ] **Step 1: Write the failing test (conceptual)**

```typescript
// Test that HomeModule is imported in AppModule
```

- [ ] **Step 2: Import HomeModule in AppModule**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import configuration from './config/configuration';
import dataSource from './db/typeorm.config';
import { EnvelopeModule } from './common/transform/response/envelope.module';
import { HomeModule } from './home/home.module'; // Add this import

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({}), // Empty factory
      dataSourceFactory: async () => {
        // Reuses the identical configuration instance
        return dataSource.initialize();
      },
    }),
    AuthModule,
    HealthModule,
    EnvelopeModule,
    HomeModule, // Add this to imports
  ],
})
export class AppModule {}
```

- [ ] **Step 3: Verify implementation**

Run: `npm run start:dev` (briefly start and stop to check for compilation errors)
Expected: Application starts without errors related to module imports

- [ ] **Step 4: Commit**

```bash
git add src/app.module.ts
git commit -m "feat: import homepage module in app module"
```

### Task 7: Verify End-to-End Functionality

**Files:**
- Test: Application running on http://localhost:3000

**Interfaces:**
- Consumes: Fully compiled and running application
- Produces: Verified homepage rendering and static asset loading

- [ ] **Step 1: Start development server**

Run: `npm run start:dev`
Expected: Application compiles and starts listening on port 3000

- [ ] **Step 2: Verify homepage loads**

Check: Visit http://localhost:3000 in browser
Expected: See rendered homepage with correct UX copy

- [ ] **Step 3: Verify static assets load**

Check: Browser dev tools Network tab
Expected: See requests for warden-*.svg files with 200 status

- [ ] **Step 4: Verify API routes still work**

Check: Visit http://localhost:3000/auth/validate (should return 401 Unauthorized as JSON)
Expected: JSON response, not HTML envelope

- [ ] **Step 5: Stop development server**

Press: Ctrl+C in terminal
Expected: Application stops gracefully

- [ ] **Step 6: Commit verification**

```bash
git add .
git commit -m "feat: verify end-to-end homepage functionality"
```

### Task 8: Test Production Build

**Files:**
- Test: Built application in dist/ directory

**Interfaces:**
- Consumes: Source code
- Produces: Verified production build with views and assets

- [ ] **Step 1: Run production build**

Run: `npm run build`
Expected: Successful compilation without errors

- [ ] **Step 2: Verify build output**

Check: `dist/` directory contains:
- `src/` compiled JavaScript files
- `views/` directory with all template files
- `public/` directory with all SVG assets

- [ ] **Step 3: Commit build verification**

```bash
git add .
git commit -m "feat: verify production build includes views and public assets"
```