import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { config } from './config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  if (config.trustProxy > 0) app.set('trust proxy', config.trustProxy);
  app.use(helmet());
  app.enableCors({ origin: config.corsOrigins });
  app.enableShutdownHooks();
  await app.listen(config.port);
  console.log(`API listening on http://localhost:${config.port}`);
}

bootstrap();
