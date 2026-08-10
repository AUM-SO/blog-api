import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import { buildPgConnection } from './pg-connection';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  private readonly tlsVerified: boolean;

  constructor(configService: ConfigService) {
    // buildPgConnection reports a copied-but-unedited connection string with a
    // usable message, and guarantees the connection is encrypted — see the notes
    // there on why sslmode in the URL is not enough.
    const { config, verified } = buildPgConnection(
      configService.getOrThrow<string>('DATABASE_URL'),
    );

    super({ adapter: new PrismaPg(config) });
    this.tlsVerified = verified;
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to the database');
    if (!this.tlsVerified) {
      this.logger.warn(
        'Database connection is encrypted but the server certificate is NOT verified. ' +
          'Download the Supabase CA certificate to certs/supabase-ca.crt (or set ' +
          'PG_SSL_ROOT_CERT) to protect against man-in-the-middle attacks.',
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
