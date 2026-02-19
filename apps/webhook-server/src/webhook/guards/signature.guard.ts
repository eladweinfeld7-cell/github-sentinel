import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { Request } from 'express';

@Injectable()
export class SignatureGuard implements CanActivate {
  private readonly logger = new Logger(SignatureGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const secret = this.config.getOrThrow<string>('GITHUB_WEBHOOK_SECRET');
    const signature = req.headers['x-hub-signature-256'] as string | undefined;

    if (!signature) {
      this.logger.warn('Missing X-Hub-Signature-256 header');
      throw new UnauthorizedException('Missing signature');
    }

    const rawBody = (req as Request & { rawBody: Buffer }).rawBody;
    const expected = 'sha256=' + createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    const sig = Buffer.from(signature);
    const exp = Buffer.from(expected);

    if (sig.length !== exp.length || !timingSafeEqual(sig, exp)) {
      this.logger.warn('Invalid webhook signature');
      throw new UnauthorizedException('Invalid signature');
    }

    return true;
  }
}
