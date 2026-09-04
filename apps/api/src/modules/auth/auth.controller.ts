import { Body, Controller, Get, Post, Req, Res, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Request, Response } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RequestUser } from "../../common/types/request-user";
import { AuthService } from "./auth.service";
import { BecomeOrganizerDto } from "./dto/become-organizer.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { RegisterDto } from "./dto/register.dto";
import { RegisterOrganizerDto } from "./dto/register-organizer.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";

@ApiTags("Autenticacao")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) response: Response) {
    return this.withRefreshCookie(response, await this.auth.register(dto));
  }

  @Post("register-organizer")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async registerOrganizer(@Body() dto: RegisterOrganizerDto, @Res({ passthrough: true }) response: Response) {
    return this.withRefreshCookie(response, await this.auth.registerOrganizer(dto));
  }

  @Post("login")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    return this.withRefreshCookie(response, await this.auth.login(dto));
  }

  @Post("refresh")
  @Throttle({ auth: { limit: 15, ttl: 60000 } })
  async refresh(
    @Body() dto: Partial<RefreshTokenDto>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const refreshToken = dto.refreshToken ?? this.readCookie(request, "eventflow_refresh");
    if (!refreshToken) {
      throw new UnauthorizedException("Refresh token invalido.");
    }
    return this.withRefreshCookie(response, await this.auth.refresh({ refreshToken }));
  }

  @Post("logout")
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const refreshToken = this.readCookie(request, "eventflow_refresh");
    this.clearRefreshCookie(response);
    return this.auth.logout(refreshToken);
  }

  @Post("forgot-password")
  @Throttle({ auth: { limit: 3, ttl: 60000 } })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Post("reset-password")
  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @Get("me")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: RequestUser) {
    return this.auth.me(user.id);
  }

  @Post("become-organizer")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async becomeOrganizer(
    @CurrentUser() user: RequestUser,
    @Body() dto: BecomeOrganizerDto,
    @Res({ passthrough: true }) response: Response
  ) {
    return this.withRefreshCookie(response, await this.auth.becomeOrganizer(user.id, dto));
  }

  private withRefreshCookie(
    response: Response,
    session: { accessToken: string; refreshToken: string; user: unknown }
  ) {
    this.setRefreshCookie(response, session.refreshToken);
    return {
      accessToken: session.accessToken,
      user: session.user
    };
  }

  private setRefreshCookie(response: Response, refreshToken: string) {
    response.cookie("eventflow_refresh", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      // The web app reaches the API through /api/backend in production.
      // A narrower /api/auth path would prevent the browser from sending
      // this cookie to the refresh endpoint behind that proxy.
      path: "/",
      maxAge: 1000 * 60 * 60 * 24 * 7
    });
  }

  private clearRefreshCookie(response: Response) {
    response.clearCookie("eventflow_refresh", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/"
    });
  }

  private readCookie(request: Request, name: string) {
    const cookieHeader = request.headers.cookie;
    if (!cookieHeader) return undefined;

    const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
    const cookie = cookies.find((value) => value.startsWith(`${name}=`));
    if (!cookie) return undefined;

    return decodeURIComponent(cookie.slice(name.length + 1));
  }
}
