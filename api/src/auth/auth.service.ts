import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  login(username: string, password: string) {
    const u = this.config.get<string>('adminUsername');
    const p = this.config.get<string>('adminPassword');
    if (username !== u || password !== p) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return {
      access_token: this.jwt.sign({ sub: 'admin', role: 'admin' }),
    };
  }
}
