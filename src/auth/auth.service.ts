import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../../generated/prisma/client';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtPayload } from './strategies/jwt.strategy';

const PASSWORD_HASH_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
    });

    if (existing) {
      throw new ConflictException(
        existing.email === dto.email
          ? 'Email is already registered'
          : 'Username is already taken',
      );
    }

    const hashedPassword = await bcrypt.hash(
      dto.password,
      PASSWORD_HASH_ROUNDS,
    );

    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        email: dto.email,
        password: hashedPassword,
        role: Role.GENERAL_USER,
        isActive: false,
      },
    });

    return this.sanitizeUser(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new ForbiddenException(
        'Your account is pending activation by a Super Admin',
      );
    }

    const tokens = await this.issueTokens(
      user.id,
      user.email,
      user.username,
      user.role,
    );
    return { user: this.sanitizeUser(user), ...tokens };
  }

  async refresh(dto: RefreshTokenDto) {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(
        dto.refreshToken,
        {
          secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        },
      );
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const matched = await this.prisma.refreshToken.findFirst({
      where: {
        token: this.hashToken(dto.refreshToken),
        userId: payload.sub,
        revoked: false,
        expiresAt: { gt: new Date() },
      },
    });
    if (!matched) {
      throw new UnauthorizedException('Refresh token is no longer valid');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account is not active');
    }

    await this.prisma.refreshToken.update({
      where: { id: matched.id },
      data: { revoked: true },
    });

    const tokens = await this.issueTokens(
      user.id,
      user.email,
      user.username,
      user.role,
    );
    return { user: this.sanitizeUser(user), ...tokens };
  }

  async logout(dto: RefreshTokenDto) {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(
        dto.refreshToken,
        {
          secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        },
      );
    } catch {
      return { success: true };
    }

    const matched = await this.prisma.refreshToken.findFirst({
      where: {
        token: this.hashToken(dto.refreshToken),
        userId: payload.sub,
        revoked: false,
      },
    });

    if (matched) {
      await this.prisma.refreshToken.update({
        where: { id: matched.id },
        data: { revoked: true },
      });
    }

    return { success: true };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async issueTokens(
    userId: number,
    email: string,
    username: string,
    role: string,
  ) {
    const payload: JwtPayload = { sub: userId, email, username, role };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.getOrThrow<string>(
        'JWT_ACCESS_EXPIRES',
      ) as never,
    });

    const refreshExpiresIn = this.configService.getOrThrow<string>(
      'JWT_REFRESH_EXPIRES',
    );
    const refreshToken = await this.jwtService.signAsync(
      { ...payload, jti: randomUUID() },
      {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpiresIn as never,
      },
    );

    await this.prisma.refreshToken.create({
      data: {
        token: this.hashToken(refreshToken),
        userId,
        expiresAt: this.addDuration(new Date(), refreshExpiresIn),
      },
    });

    return { accessToken, refreshToken };
  }

  private addDuration(date: Date, duration: string): Date {
    const match = /^(\d+)([smhd])$/.exec(duration.trim());
    if (!match) {
      return new Date(date.getTime() + 7 * 24 * 60 * 60 * 1000);
    }

    const value = Number(match[1]);
    const unitMs: Record<string, number> = {
      s: 1000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };
    return new Date(date.getTime() + value * unitMs[match[2]]);
  }

  private sanitizeUser(user: { password: string; [key: string]: unknown }) {
    const { password, ...rest } = user;
    void password;
    return rest;
  }
}
