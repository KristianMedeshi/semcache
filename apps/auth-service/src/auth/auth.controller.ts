import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { CurrentUser, Public, SignInService } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import { SkipThrottle, Throttle, hours, minutes } from '@nestjs/throttler';
import type { LogoutResponseDto, UserResponseDto } from '@semcache/shared-dtos';
import { CredentialsService } from './credentials.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UserPolicy } from './policies/user.policy';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly credentialsService: CredentialsService,
    private readonly signInService: SignInService,
  ) {}

  @Public()
  @SkipThrottle({ account: true })
  @Throttle({ default: { limit: 10, ttl: hours(1) } })
  @Post('register')
  async register(@Body() body: RegisterDto): Promise<UserResponseDto> {
    const user = await this.credentialsService.register(body.email, body.password);
    await this.signInService.signIn(user.id, { method: 'password' });
    return user;
  }

  @Public()
  @Throttle({
    default: { limit: 30, ttl: minutes(15) },
    account: { limit: 5, ttl: minutes(15) },
  })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: LoginDto): Promise<UserResponseDto> {
    const user = await this.credentialsService.verify(body.email, body.password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    await this.signInService.signIn(user.id, { method: 'password' });
    return user;
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(): Promise<LogoutResponseDto> {
    if (!(await this.signInService.signOut())) {
      throw new UnauthorizedException('Authentication required');
    }
    this.logger.log(JSON.stringify({ event: 'auth.logout.success' }));
    return { success: true };
  }

  @Can(UserPolicy, 'readSelf')
  @Get('me')
  me(@CurrentUser() user: UserResponseDto): UserResponseDto {
    return user;
  }
}
