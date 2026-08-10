import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  // The check touches the database on purpose: an instance whose connection has
  // dropped can still serve this route, and a platform that only asks "is the
  // process up" would keep routing traffic to it.
  async getHealth() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        service: 'blog-api',
        database: 'unreachable',
      });
    }

    return { status: 'ok', service: 'blog-api', database: 'ok' };
  }
}
