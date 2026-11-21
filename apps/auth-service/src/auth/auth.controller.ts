import { Controller, ForbiddenException, Logger, UnauthorizedException } from '@nestjs/common';
import {
  CurrentSession,
  CurrentUser,
  Public,
  type SessionRecord,
  SessionService,
} from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SkipThrottle, Throttle, hours, minutes } from '@nestjs/throttler';
import type { AuthTcpResponseDto, LogoutResponseDto, UserResponseDto } from '@semcache/shared-dtos';
import { SERVICE_TCP_PATTERNS } from '@semcache/shared-types';
import { CredentialsService } from './credentials.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UserPolicy } from './policies/user.policy';
import { RpcRequestContext, type RpcRequestContextData } from './session-auth.provider';

@Controller()
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly credentialsService: CredentialsService,
    private readonly sessionService: SessionService,
  ) {}

  @Public()
  @SkipThrottle({ account: true })
  @Throttle({ default: { limit: 10, ttl: hours(1) } })
  @MessagePattern(SERVICE_TCP_PATTERNS.AUTH_REGISTER)
  async register(
    @Payload('body') body: RegisterDto,
    @RpcRequestContext() reqContext: RpcRequestContextData,
  ): Promise<AuthTcpResponseDto<UserResponseDto>> {
    this.assertAllowedOrigin(reqContext);
    const user = await this.credentialsService.register(body.email, body.password);
    const issued = await this.sessionService.create(user.id, {
      metadata: this.sessionService.metadataFor(reqContext),
      replacing: this.sessionService.tokenFrom(reqContext),
    });
    return {
      data: user,
      setCookie: issued.cookie,
    };
  }

  @Public()
  @Throttle({
    default: { limit: 30, ttl: minutes(15) },
    account: { limit: 5, ttl: minutes(15) },
  })
  @MessagePattern(SERVICE_TCP_PATTERNS.AUTH_LOGIN)
  async login(
    @Payload('body') body: LoginDto,
    @RpcRequestContext() reqContext: RpcRequestContextData,
  ): Promise<AuthTcpResponseDto<UserResponseDto>> {
    this.assertAllowedOrigin(reqContext);
    const user = await this.credentialsService.verify(body.email, body.password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const issued = await this.sessionService.create(user.id, {
      metadata: this.sessionService.metadataFor(reqContext),
      replacing: this.sessionService.tokenFrom(reqContext),
    });
    return {
      data: user,
      setCookie: issued.cookie,
    };
  }

  @Can(UserPolicy, 'readSelf')
  @MessagePattern(SERVICE_TCP_PATTERNS.AUTH_LOGOUT)
  async logout(
    @CurrentSession() session: SessionRecord,
    @RpcRequestContext() reqContext: RpcRequestContextData,
  ): Promise<AuthTcpResponseDto<LogoutResponseDto>> {
    this.assertAllowedOrigin(reqContext);
    await this.sessionService.discard(session.id);

    this.logger.log(JSON.stringify({ event: 'auth.logout.success' }));
    return {
      data: { success: true },
      setCookie: this.sessionService.clearCookie(),
    };
  }

  @Can(UserPolicy, 'readSelf')
  @MessagePattern(SERVICE_TCP_PATTERNS.AUTH_ME)
  me(@CurrentUser() user: UserResponseDto): UserResponseDto {
    return user;
  }

  private assertAllowedOrigin(reqContext: RpcRequestContextData): void {
    if (this.sessionService.isCrossOriginWrite(reqContext)) {
      throw new ForbiddenException('Cross-origin request refused');
    }
  }
}
