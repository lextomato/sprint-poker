import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { AppError, ErrorCode } from "../common/app-error";
import { CreateRoomDto, CreateStoryDto, FinalizeStoryDto, JoinRoomDto, ReconnectDto, SessionDto, UpdateParticipantRoleDto, UpdateStoryDto } from "./dto";
import { RoomsService } from "./rooms.service";

@ApiTags("rooms")
@Controller("rooms")
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Post()
  async createRoom(@Body() dto: CreateRoomDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.rooms.createRoom(dto);
    this.setSessionCookie(response, result.roomCode, result.sessionToken);
    return result;
  }

  @Get(":roomCode")
  getRoom(@Param("roomCode") roomCode: string) {
    return this.rooms.getPublicRoom(roomCode);
  }

  @Post(":roomCode/join")
  async joinRoom(@Param("roomCode") roomCode: string, @Body() dto: JoinRoomDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.rooms.joinRoom(roomCode, dto);
    this.setSessionCookie(response, result.roomCode, result.sessionToken);
    return result;
  }

  @Post(":roomCode/reconnect")
  async reconnect(@Param("roomCode") roomCode: string, @Body() dto: ReconnectDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.rooms.reconnect(roomCode, dto.sessionToken);
    this.setSessionCookie(response, result.roomCode, result.sessionToken);
    return result;
  }

  @Get(":roomCode/stories")
  getStories(@Param("roomCode") roomCode: string) {
    return this.rooms.getStories(roomCode);
  }

  @Patch(":roomCode/participants/:participantId")
  updateParticipantRole(
    @Param("roomCode") roomCode: string,
    @Param("participantId") participantId: string,
    @Body() dto: UpdateParticipantRoleDto,
    @Headers("x-session-token") token?: string
  ) {
    return this.rooms.updateParticipantRole(roomCode, participantId, dto.sessionToken || this.requireToken(token), dto.role);
  }

  @Delete(":roomCode/participants/:participantId")
  removeParticipant(@Param("roomCode") roomCode: string, @Param("participantId") participantId: string, @Headers("x-session-token") token?: string) {
    return this.rooms.removeParticipant(roomCode, participantId, this.requireToken(token));
  }

  @Post(":roomCode/stories")
  createStory(@Param("roomCode") roomCode: string, @Body() dto: CreateStoryDto, @Headers("x-session-token") token?: string) {
    return this.rooms.createStory(roomCode, this.requireToken(token), dto);
  }

  @Post(":roomCode/stories/import")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 2_000_000 } }))
  importStories(@Param("roomCode") roomCode: string, @UploadedFile() file: { originalname: string; buffer: Buffer } | undefined, @Headers("x-session-token") token?: string) {
    if (!file) {
      throw new AppError(ErrorCode.INVALID_IMPORT, "No se recibio ningun archivo para importar.");
    }
    return this.rooms.importStories(roomCode, this.requireToken(token), file.originalname, file.buffer);
  }

  @Patch(":roomCode/stories/:storyId")
  updateStory(@Param("roomCode") roomCode: string, @Param("storyId") storyId: string, @Body() dto: UpdateStoryDto, @Headers("x-session-token") token?: string) {
    return this.rooms.updateStory(roomCode, storyId, this.requireToken(token), dto);
  }

  @Delete(":roomCode/stories/:storyId")
  deleteStory(@Param("roomCode") roomCode: string, @Param("storyId") storyId: string, @Headers("x-session-token") token?: string) {
    return this.rooms.deleteStory(roomCode, storyId, this.requireToken(token));
  }

  @Post(":roomCode/stories/:storyId/activate")
  activateStory(@Param("roomCode") roomCode: string, @Param("storyId") storyId: string, @Body() dto: SessionDto, @Headers("x-session-token") token?: string) {
    return this.rooms.activateStory(roomCode, storyId, dto.sessionToken || this.requireToken(token));
  }

  @Post(":roomCode/stories/:storyId/finalize")
  finalizeStory(@Param("roomCode") roomCode: string, @Param("storyId") storyId: string, @Body() dto: FinalizeStoryDto, @Headers("x-session-token") token?: string) {
    return this.rooms.finalizeStory(roomCode, storyId, dto.sessionToken || this.requireToken(token), dto.finalEstimate);
  }

  @Get(":roomCode/history")
  getHistory(@Param("roomCode") roomCode: string) {
    return this.rooms.getHistory(roomCode);
  }

  @Get(":roomCode/summary")
  getSummary(@Param("roomCode") roomCode: string, @Headers("x-session-token") token?: string) {
    return this.rooms.getSessionSummary(roomCode, this.requireToken(token));
  }

  @Get(":roomCode/summary/export")
  async exportSummary(@Param("roomCode") roomCode: string, @Query("format") format: "csv" | "xlsx" = "csv", @Headers("x-session-token") token: string | undefined, @Res() response: Response) {
    const exportResult = await this.rooms.exportSessionSummary(roomCode, this.requireToken(token), format === "xlsx" ? "xlsx" : "csv");
    response.setHeader("content-type", exportResult.contentType);
    response.setHeader("content-disposition", `attachment; filename="${exportResult.fileName}"`);
    response.send(exportResult.body);
  }

  @Post(":roomCode/close")
  closeRoom(@Param("roomCode") roomCode: string, @Headers("x-session-token") token?: string) {
    return this.rooms.closeRoom(roomCode, this.requireToken(token));
  }

  @Post(":roomCode/reopen")
  reopenRoom(@Param("roomCode") roomCode: string, @Headers("x-session-token") token?: string) {
    return this.rooms.reopenRoom(roomCode, this.requireToken(token));
  }

  private requireToken(token?: string): string {
    if (!token) {
      throw new AppError(ErrorCode.INVALID_SESSION, "Falta el token de sesion.");
    }
    return token;
  }

  private setSessionCookie(response: Response, roomCode: string, sessionToken: string) {
    response.cookie(`planning_session_${roomCode}`, sessionToken, {
      httpOnly: false,
      sameSite: "lax",
      secure: false,
      maxAge: 1000 * 60 * 60 * 24 * 30
    });
  }
}
