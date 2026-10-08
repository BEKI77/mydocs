import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { config } from './config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.enableCors({ origin: config.corsOrigins });
  app.enableShutdownHooks();
  await app.listen(config.port);
  console.log(`API listening on http://localhost:${config.port}`);
}

bootstrap();
