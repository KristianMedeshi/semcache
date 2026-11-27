import { Controller, Get, Headers } from '@nestjs/common';
import { Can } from '@nestjs/authorization';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { DialogStatsResponseDto } from '@semcache/shared-dtos';
import { SERVICE_TCP_PATTERNS } from '@semcache/shared-types';
import { GatewayAccessPolicy } from '../auth/policies/gateway-access.policy';
import { ApiStandardErrors } from '../common/swagger/api-responses.decorator';
import { SWAGGER_COOKIE_AUTH_NAME } from '../swagger';
import { DialogProxyService } from './dialog-proxy.service';
import { DialogStatsResponseSwaggerDto } from './dto/gateway-dialogs.dto';

@ApiTags('Admin Dialogs')
@ApiCookieAuth(SWAGGER_COOKIE_AUTH_NAME)
@Can(GatewayAccessPolicy, 'viewDialogStats')
@Controller('admin/dialogs')
export class GatewayAdminDialogsController {
  constructor(private readonly dialogProxyService: DialogProxyService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get aggregate dialog, latency, and token statistics (admin only)' })
  @ApiOkResponse({
    description: 'Aggregate dialog statistics',
    type: DialogStatsResponseSwaggerDto,
  })
  @ApiStandardErrors({ auth: true, forbidden: true })
  async getStats(@Headers('cookie') cookie?: string): Promise<DialogStatsResponseDto> {
    const result = await this.dialogProxyService.forwardDialogRequest<DialogStatsResponseDto>(
      cookie,
      SERVICE_TCP_PATTERNS.DIALOGS_STATS_GET,
    );
    return result.data;
  }
}
