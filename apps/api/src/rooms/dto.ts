import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min, ValidateIf } from "class-validator";
import { DailyMode, ParticipantRole } from "@planning/shared";

export class CreateRoomDto {
  @ApiProperty()
  @IsString()
  @Length(3, 80)
  roomName!: string;

  @ApiProperty()
  @IsString()
  @Length(2, 40)
  participantName!: string;

  @ApiPropertyOptional()
  @ValidateIf((_, value) => value !== undefined && value !== "")
  @IsString()
  @Length(3, 200)
  firstStoryTitle?: string;
}

export class CreateRetrospectiveDto {
  @ApiProperty()
  @IsString()
  @Length(3, 80)
  roomName!: string;

  @ApiProperty()
  @IsString()
  @Length(2, 40)
  participantName!: string;
}

export class CreateTeamDto {
  @ApiProperty()
  @IsString()
  @Length(3, 80)
  roomName!: string;

  @ApiProperty()
  @IsString()
  @Length(2, 40)
  participantName!: string;

  @ApiProperty({ enum: DailyMode })
  @IsEnum(DailyMode)
  dailyMode!: DailyMode;

  @ApiProperty()
  @IsInt()
  @Min(30)
  @Max(900)
  turnDurationSeconds!: number;
}

export class JoinRoomDto {
  @ApiProperty()
  @IsString()
  @Length(2, 40)
  participantName!: string;

  @ApiPropertyOptional({ enum: ParticipantRole })
  @IsOptional()
  @IsEnum(ParticipantRole)
  role?: ParticipantRole;
}

export class ReconnectDto {
  @ApiProperty()
  @IsString()
  @Length(24, 256)
  sessionToken!: string;
}

export class CreateStoryDto {
  @ApiProperty()
  @IsString()
  @Length(3, 200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  acceptanceCriteria?: string | null;
}

export class UpdateStoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(3, 200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  acceptanceCriteria?: string | null;
}

export class ReorderStoriesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID("4", { each: true })
  storyIds!: string[];
}

export class SessionDto {
  @ApiProperty()
  @IsString()
  @Length(24, 256)
  sessionToken!: string;
}

export class FinalizeStoryDto extends SessionDto {
  @ApiProperty()
  @IsString()
  @Length(1, 16)
  finalEstimate!: string;
}

export class UpdateParticipantRoleDto extends SessionDto {
  @ApiProperty({ enum: [ParticipantRole.VOTER, ParticipantRole.OBSERVER] })
  @IsEnum(ParticipantRole)
  role!: "VOTER" | "OBSERVER";
}
