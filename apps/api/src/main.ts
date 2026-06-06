import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { env } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );
  app.enableCors({
    origin: [env.frontends.board, env.frontends.intel],
    credentials: true,
  });

  await app.listen(env.apiPort);
  new Logger('Bootstrap').log(`API listening on http://localhost:${env.apiPort}`);
}

void bootstrap();
