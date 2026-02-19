import { Injectable, Logger } from '@nestjs/common';
import { Notifier } from './notifier.interface';
import { AlertData, Severity } from '@github-sentinel/detection-engine';

@Injectable()
export class ConsoleNotifierService implements Notifier {
  private readonly logger = new Logger('ALERT');

  async notify(alert: AlertData): Promise<void> {
    const severityColors: Record<Severity, string> = {
      [Severity.LOW]: '\x1b[34m',
      [Severity.MEDIUM]: '\x1b[33m',
      [Severity.HIGH]: '\x1b[31m',
      [Severity.CRITICAL]: '\x1b[35m',
    };
    const reset = '\x1b[0m';
    const color = severityColors[alert.severity] ?? reset;

    console.log(
      `\n${color}[${alert.severity.toUpperCase()}]${reset} ${alert.ruleName}\n` +
        `  ${alert.message}\n` +
        `  ${JSON.stringify(alert.metadata, null, 2)}\n`,
    );
  }
}
