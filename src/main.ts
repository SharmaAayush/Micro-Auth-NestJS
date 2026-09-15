import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { setupApiDocs } from './docs/setup-api-docs';
import cookieParser from 'cookie-parser';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import hbs from 'hbs';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.use(cookieParser());

  // View engine setup - views at project root
  app.setBaseViewsDir(join(__dirname, '..', 'views'));
  app.setViewEngine('hbs');
  // Partials setup
  hbs.registerPartials(join(__dirname, '..', 'views'));

  // Configure default layout and partials options
  app.set('view options', { layout: 'layouts/main' });

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
