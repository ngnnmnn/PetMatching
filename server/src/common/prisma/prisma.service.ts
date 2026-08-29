import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  // Override $transaction to set safe default timeout (20s) for remote Supabase connections
  override $transaction: PrismaClient['$transaction'] = ((
    arg: any,
    options?: any,
  ) => {
    if (typeof arg === 'function') {
      return (super.$transaction as any)(arg, {
        maxWait: 10000,
        timeout: 20000,
        ...options,
      });
    }
    return (super.$transaction as any)(arg, options);
  }) as unknown as PrismaClient['$transaction'];
}



