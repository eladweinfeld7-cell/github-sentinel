import { WebhookEventType } from './enums';

export interface PushWebhookEvent {
  type: WebhookEventType.PUSH;
  ref: string;
  before: string;
  after: string;
  pusher: {
    name: string;
    email: string;
  };
  repository: {
    id: number;
    name: string;
    full_name: string;
    owner: { login: string };
  };
  head_commit: {
    id: string;
    message: string;
    timestamp: string;
    author: { name: string; email: string; username: string };
  } | null;
  commits: Array<{
    id: string;
    message: string;
    timestamp: string;
    author: { name: string; email: string; username: string };
  }>;
  forced: boolean;
  organization: { login: string; id: number };
  sender: { login: string; id: number };
}
