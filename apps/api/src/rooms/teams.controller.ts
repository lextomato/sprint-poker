import { Body, Controller, Get, Headers, Param, Post, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { AuthService } from "../auth/auth.service";
import { CreateTeamDto } from "./dto";
import { RoomsService } from "./rooms.service";

@ApiTags("teams")
@Controller("teams")
export class TeamsController {
  constructor(
    private readonly rooms: RoomsService,
    private readonly auth: AuthService
  ) {}

  @Post()
  async create(@Body() dto: CreateTeamDto, @Headers("x-auth-token") authToken: string | undefined, @Res({ passthrough: true }) response: Response) {
    const user = await this.auth.resolveToken(authToken);
    const result = await this.rooms.createTeam(dto, user?.id);
    this.setRoomCookie(response, result.roomCode, result.sessionToken);
    return result;
  }

  @Get("mine")
  async mine(@Headers("x-auth-token") authToken?: string) {
    const user = await this.auth.requireUser(authToken);
    return this.rooms.getUserTeams(user.id);
  }

  @Post(":roomCode/access")
  async access(@Param("roomCode") roomCode: string, @Headers("x-auth-token") authToken: string | undefined, @Res({ passthrough: true }) response: Response) {
    const user = await this.auth.requireUser(authToken);
    const result = await this.rooms.accessTeam(roomCode, user.id);
    this.setRoomCookie(response, result.roomCode, result.sessionToken);
    return result;
  }

  private setRoomCookie(response: Response, roomCode: string, token: string) {
    response.cookie(`planning_session_${roomCode}`, token, { httpOnly: false, sameSite: "lax", secure: false, maxAge: 1000 * 60 * 60 * 24 * 30 });
  }
}
