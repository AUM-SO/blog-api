import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';

class HealthEntity {
  @ApiProperty({ example: 'ok' })
  status: string;

  @ApiProperty({ example: 'blog-api' })
  service: string;

  @ApiProperty({ example: 'ok', description: 'Result of a SELECT 1 round trip.' })
  database: string;
}

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness check, including database reachability' })
  @ApiOkResponse({ type: HealthEntity })
  getHealth() {
    return this.appService.getHealth();
  }
}
