import { Body, Controller, Get, Headers, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto } from "./dto";

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

  @Post("forgot-password")
  @Throttle({ default: { limit: 3, ttl: 15 * 60 * 1000 } })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.requestPasswordReset(dto.email);
  }

  @Post("reset-password")
  @Throttle({ default: { limit: 5, ttl: 15 * 60 * 1000 } })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.password);
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
