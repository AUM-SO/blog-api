import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Public } from '../common/decorators/public.decorator';
import { AuthSessionEntity } from './entities/auth.entity';
import { UserEntity } from '../users/entities/user.entity';
import {
  ErrorResponseEntity,
  SuccessResponseEntity,
} from '../common/entities/api-response.entity';

@ApiTags('auth')
@ApiTooManyRequestsResponse({
  description: 'Too many attempts from this IP. Wait a minute and retry.',
  type: ErrorResponseEntity,
})
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Only the two credential routes are tightened. Refresh and logout keep the
  // app-wide budget: clients refresh on their own schedule, and several users
  // can share one IP behind NAT, so a 5/minute cap there would log them out.
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('register')
  @ApiOperation({
    summary: 'Register a new account',
    description:
      'Creates a GENERAL_USER with `isActive: false`. The account cannot log in until a ' +
      'Super Admin activates it via `PATCH /users/{id}/activate`.',
  })
  @ApiCreatedResponse({
    description: 'Account created, pending activation.',
    type: UserEntity,
  })
  @ApiConflictResponse({
    description: 'Email or username already taken.',
    type: ErrorResponseEntity,
  })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({
    summary: 'Log in with email and password',
    description: 'Returns the account plus an access/refresh token pair.',
  })
  @ApiOkResponse({ type: AuthSessionEntity })
  @ApiUnauthorizedResponse({
    description: 'Wrong email or password.',
    type: ErrorResponseEntity,
  })
  @ApiForbiddenResponse({
    description: 'Account exists but is still awaiting Super Admin activation.',
    type: ErrorResponseEntity,
  })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  @ApiOperation({
    summary: 'Exchange a refresh token for a new token pair',
    description:
      'Refresh tokens rotate: the token sent in is revoked and a new pair is issued. ' +
      'Replaying a revoked token is rejected.',
  })
  @ApiOkResponse({ type: AuthSessionEntity })
  @ApiUnauthorizedResponse({
    description:
      'Token is invalid, expired, already used, or the account is inactive.',
    type: ErrorResponseEntity,
  })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  @ApiOperation({
    summary: 'Revoke a refresh token',
    description:
      'Idempotent — an unknown or already revoked token still returns success, so clients ' +
      'can log out without first checking token state.',
  })
  @ApiOkResponse({ type: SuccessResponseEntity })
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto);
  }
}
