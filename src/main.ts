import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { setupApiDocs } from './docs/setup-api-docs';
import cookieParser from 'cookie-parser';
import { join } from 'path';

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

  // Configure Handlebars view engine - TEMPORARILY DISABLED DUE TO NESTJS VERSION COMPATIBILITY
// const exphbs = create({
//   extname: '.hbs',
//   layoutsDir: join(__dirname, '..', 'src', 'views', 'layouts'),
//   partialsDir: join(__dirname, '..', 'src', 'views', 'partials'),
//   defaultLayout: 'base',
// });

// // Register the handlebars view engine
// app.engine('hbs', exphbs);
// app.setViewEngine('hbs');

// // Set views directory and serve static assets
// app.setBaseViewsDir(join(__dirname, '..', 'src', 'views'));
// app.useStaticAssets(join(__dirname, '..', 'src', 'views', 'assets'), {
//   prefix: '/assets/',
// });

  const configService = app.get(ConfigService);
  setupApiDocs(app, configService);

  const port = configService.get<number>('app.port', 3000);
  await app.listen(port);
}

bootstrap().catch((err) => {
  console.error(err);
});
