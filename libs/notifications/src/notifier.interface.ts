import { AlertData } from '@github-sentinel/detection-engine';

export interface Notifier {
  notify(alert: AlertData): Promise<void>;
}

export const NOTIFIER = Symbol('NOTIFIER');
