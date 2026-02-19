import { WebhookEventType } from './enums';

export interface TeamWebhookEvent {
  type: WebhookEventType.TEAM;
  action:
    | 'created'
    | 'deleted'
    | 'edited'
    | 'added_to_repository'
    | 'removed_from_repository';
  team: {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    privacy: 'closed' | 'secret';
    permission: string;
  };
  organization: { login: string; id: number };
  sender: { login: string; id: number };
}
