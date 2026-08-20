import { Body, Controller, Get, Headers, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { LoginDto, RegisterDto } from "./dto";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Get("me")
  me(@Headers("x-auth-token") token?: string) {
    return this.auth.me(token);
  }

  @Post("logout")
  logout(@Headers("x-auth-token") token?: string) {
    return this.auth.logout(token);
  }
}
