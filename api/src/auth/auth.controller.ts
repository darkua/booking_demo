import { Body, Controller, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @ApiOkResponse({ schema: { properties: { access_token: { type: 'string' } } } })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.username, dto.password);
  }
}
