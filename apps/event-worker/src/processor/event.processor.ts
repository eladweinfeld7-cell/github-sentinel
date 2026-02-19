import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { WebhookJobData } from '@github-sentinel/queue';
import { RuleEngineService } from '@github-sentinel/detection-engine';
import { EventRecordService, AlertRecordService } from '@github-sentinel/persistence';
import { Notifier, NOTIFIER } from '@github-sentinel/notifications';

@Processor('webhook-events')
export class EventProcessor extends WorkerHost {
  private readonly logger = new Logger(EventProcessor.name);

  constructor(
    private readonly ruleEngine: RuleEngineService,
    private readonly eventRecordService: EventRecordService,
    private readonly alertRecordService: AlertRecordService,
    @Inject(NOTIFIER) private readonly notifier: Notifier,
  ) {
    super();
  }

  async process(job: Job<WebhookJobData>): Promise<void> {
    const { deliveryId, event } = job.data;

    this.logger.log(`Processing ${event.type} event [${deliveryId}]`);

    // 1. Idempotency check
    const alreadyProcessed = await this.eventRecordService.exists(deliveryId);
    if (alreadyProcessed) {
      this.logger.warn(`Duplicate delivery [${deliveryId}], skipping`);
      return;
    }

    // 2. Persist event record (also serves as idempotency marker via unique index)
    try {
      await this.eventRecordService.create(deliveryId, event);
    } catch (err: unknown) {
      if (err instanceof Error && 'code' in err && (err as Record<string, unknown>).code === 11000) {
        this.logger.warn(`Duplicate delivery [${deliveryId}] caught by unique index, skipping`);
        return;
      }
      throw err;
    }

    // 3. Run all applicable rules
    const alerts = await this.ruleEngine.evaluate(event);

    // 4. For each alert: persist + notify
    for (const alert of alerts) {
      await this.alertRecordService.create(deliveryId, alert);
      await this.notifier.notify(alert);
    }

    if (alerts.length > 0) {
      this.logger.log(`Generated ${alerts.length} alert(s) for [${deliveryId}]`);
    }
  }
}
