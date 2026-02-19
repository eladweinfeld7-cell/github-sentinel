import { WebhookEventType } from './enums';

export interface RepositoryWebhookEvent {
  type: WebhookEventType.REPOSITORY;
  action: 'created' | 'deleted' | 'archived' | 'unarchived' | 'edited'
        | 'renamed' | 'transferred' | 'publicized' | 'privatized';
  repository: {
    id: number;
    name: string;
    full_name: string;
    private: boolean;
    owner: { login: string; id: number };
    created_at: string;
  };
  organization: { login: string; id: number };
  sender: { login: string; id: number };
}
