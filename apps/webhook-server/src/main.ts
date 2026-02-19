import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { ExpressAdapter as BullBoardAdapter } from '@bull-board/express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { getQueueToken } from '@nestjs/bullmq';
import { WEBHOOK_EVENTS_QUEUE } from '@github-sentinel/queue';
import { Queue } from 'bullmq';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  app.enableShutdownHooks();

  // Bull Board UI at /admin/queues
  const serverAdapter = new BullBoardAdapter();
  serverAdapter.setBasePath('/admin/queues');

  const queue = app.get<Queue>(getQueueToken(WEBHOOK_EVENTS_QUEUE));
  createBullBoard({
    queues: [new BullMQAdapter(queue)],
    serverAdapter,
  });

  app.use('/admin/queues', serverAdapter.getRouter());

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  Logger.log(`webhook-server listening on :${port}`, 'Bootstrap');
  Logger.log(
    `Bull Board UI: http://localhost:${port}/admin/queues`,
    'Bootstrap',
  );
}

void bootstrap();
