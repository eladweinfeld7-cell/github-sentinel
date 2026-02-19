import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  liveness(): { status: string } {
    return { status: 'ok' };
  }

  @Get('ready')
  async readiness(): Promise<{ status: string; mongodb: string }> {
    const mongoState =
      this.connection.readyState === 1 ? 'connected' : 'disconnected';
    return {
      status: mongoState === 'connected' ? 'ok' : 'degraded',
      mongodb: mongoState,
    };
  }
}
