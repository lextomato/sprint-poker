import { HttpException, HttpStatus } from "@nestjs/common";
import { ApiErrorCode, type ApiErrorBody } from "@planning/shared";

export const ErrorCode = {
  ROOM_NOT_FOUND: ApiErrorCode.ROOM_NOT_FOUND,
  ROOM_CLOSED: ApiErrorCode.ROOM_CLOSED,
  INVALID_SESSION: ApiErrorCode.INVALID_SESSION,
  PARTICIPANT_NOT_FOUND: ApiErrorCode.PARTICIPANT_NOT_FOUND,
  FORBIDDEN_ACTION: ApiErrorCode.FORBIDDEN_ACTION,
  STORY_NOT_FOUND: ApiErrorCode.STORY_NOT_FOUND,
  NO_ACTIVE_STORY: ApiErrorCode.NO_ACTIVE_STORY,
  VOTING_NOT_ACTIVE: ApiErrorCode.VOTING_NOT_ACTIVE,
  ROUND_ALREADY_REVEALED: ApiErrorCode.ROUND_ALREADY_REVEALED,
  INVALID_VOTE: ApiErrorCode.INVALID_VOTE,
  INVALID_IMPORT: ApiErrorCode.INVALID_IMPORT,
  DUPLICATE_PARTICIPANT_NAME: ApiErrorCode.DUPLICATE_PARTICIPANT_NAME,
  USER_ALREADY_EXISTS: ApiErrorCode.USER_ALREADY_EXISTS,
  INVALID_CREDENTIALS: ApiErrorCode.INVALID_CREDENTIALS,
  AUTH_REQUIRED: ApiErrorCode.AUTH_REQUIRED
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

const statusByCode: Record<ErrorCode, HttpStatus> = {
  ROOM_NOT_FOUND: HttpStatus.NOT_FOUND,
  ROOM_CLOSED: HttpStatus.GONE,
  INVALID_SESSION: HttpStatus.UNAUTHORIZED,
  PARTICIPANT_NOT_FOUND: HttpStatus.NOT_FOUND,
  FORBIDDEN_ACTION: HttpStatus.FORBIDDEN,
  STORY_NOT_FOUND: HttpStatus.NOT_FOUND,
  NO_ACTIVE_STORY: HttpStatus.CONFLICT,
  VOTING_NOT_ACTIVE: HttpStatus.CONFLICT,
  ROUND_ALREADY_REVEALED: HttpStatus.CONFLICT,
  INVALID_VOTE: HttpStatus.BAD_REQUEST,
  INVALID_IMPORT: HttpStatus.BAD_REQUEST,
  DUPLICATE_PARTICIPANT_NAME: HttpStatus.CONFLICT,
  USER_ALREADY_EXISTS: HttpStatus.CONFLICT,
  INVALID_CREDENTIALS: HttpStatus.UNAUTHORIZED,
  AUTH_REQUIRED: HttpStatus.UNAUTHORIZED
};

export class AppError extends HttpException {
  constructor(code: ErrorCode, message: string, details: unknown = null) {
    const body: ApiErrorBody = { code, message, details, timestamp: new Date().toISOString() };
    super(body, statusByCode[code]);
  }
}

export function toErrorBody(error: unknown): ApiErrorBody {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    if (typeof response === "object" && response !== null && "code" in response) {
      return response as ApiErrorBody;
    }
    return {
      code: ApiErrorCode.HTTP_ERROR,
      message: error.message,
      details: response,
      timestamp: new Date().toISOString()
    };
  }

  return {
    code: ApiErrorCode.INTERNAL_ERROR,
    message: "Unexpected server error.",
    details: null,
    timestamp: new Date().toISOString()
  };
}
