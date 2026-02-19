import { PushWebhookEvent } from './push-event.interface';
import { TeamWebhookEvent } from './team-event.interface';
import { RepositoryWebhookEvent } from './repository-event.interface';
import { WebhookEventType } from './enums';

export type WebhookEvent =
  | PushWebhookEvent
  | TeamWebhookEvent
  | RepositoryWebhookEvent;

export type WebhookEventMap = {
  [WebhookEventType.PUSH]: PushWebhookEvent;
  [WebhookEventType.TEAM]: TeamWebhookEvent;
  [WebhookEventType.REPOSITORY]: RepositoryWebhookEvent;
};
