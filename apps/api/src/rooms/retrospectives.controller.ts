import { Body, Controller, Post, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { CreateRetrospectiveDto } from "./dto";
import { RoomsService } from "./rooms.service";

@ApiTags("retrospectives")
@Controller("retrospectives")
export class RetrospectivesController {
  constructor(private readonly rooms: RoomsService) {}

  @Post()
  async create(@Body() dto: CreateRetrospectiveDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.rooms.createRetrospective(dto);
    response.cookie(`planning_session_${result.roomCode}`, result.sessionToken, {
      httpOnly: false,
      sameSite: "lax",
      secure: false,
      maxAge: 1000 * 60 * 60 * 24 * 30
    });
    return result;
  }
}
