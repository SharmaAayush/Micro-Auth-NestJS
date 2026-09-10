import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { setupApiDocs } from './docs/setup-api-docs';
import cookieParser from 'cookie-parser';
import { join } from 'path';
import { HandlebarsAdapter } from '@nestjs/core/dist/adapters/handlebars-adapter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Configure Handlebars view engine
  app.setBaseViewsDir(join(__dirname, '..', 'src', 'views'));
  app.setViewEngine('hbs');
  app.useStaticAssets(join(__dirname, '..', 'src', 'views', 'assets'), {
    prefix: '/assets/',
  });

  const configService = app.get(ConfigService);
  setupApiDocs(app, configService);

  const port = configService.get<number>('app.port', 3000);
  await app.listen(port);
}

bootstrap().catch((err) => {
  console.error(err);
});
