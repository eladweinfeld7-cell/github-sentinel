import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  Logger.log(`webhook-server listening on :${port}`, 'Bootstrap');
}

bootstrap();
