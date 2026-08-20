import { ApiErrorCode, type ApiErrorBody } from "@planning/shared";

const knownCodes = new Set<string>(Object.values(ApiErrorCode));

const fallbackMessages: Record<ApiErrorCode, string> = {
  [ApiErrorCode.ROOM_NOT_FOUND]: "La sala solicitada no existe.",
  [ApiErrorCode.ROOM_CLOSED]: "La sala esta cerrada.",
  [ApiErrorCode.INVALID_SESSION]: "La sesion no es valida.",
  [ApiErrorCode.PARTICIPANT_NOT_FOUND]: "El participante no existe en la sala.",
  [ApiErrorCode.FORBIDDEN_ACTION]: "No tienes permisos para realizar esta accion.",
  [ApiErrorCode.STORY_NOT_FOUND]: "La historia no existe.",
  [ApiErrorCode.NO_ACTIVE_STORY]: "No hay historia activa.",
  [ApiErrorCode.VOTING_NOT_ACTIVE]: "La votacion no esta activa.",
  [ApiErrorCode.ROUND_ALREADY_REVEALED]: "La ronda ya fue revelada.",
  [ApiErrorCode.INVALID_VOTE]: "El voto no es valido.",
  [ApiErrorCode.INVALID_IMPORT]: "El archivo no se pudo importar.",
  [ApiErrorCode.DUPLICATE_PARTICIPANT_NAME]: "Ya existe un participante con ese nombre.",
  [ApiErrorCode.USER_ALREADY_EXISTS]: "Ya existe una cuenta con ese correo.",
  [ApiErrorCode.INVALID_CREDENTIALS]: "Correo o contrasena incorrectos.",
  [ApiErrorCode.AUTH_REQUIRED]: "Inicia sesion para continuar.",
  [ApiErrorCode.HTTP_ERROR]: "No se pudo completar la accion.",
  [ApiErrorCode.INTERNAL_ERROR]: "Ocurrio un error inesperado.",
  [ApiErrorCode.SOCKET_TIMEOUT]: "No se pudo conectar con la sala."
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractBody(error: unknown): unknown {
  if (!isRecord(error)) return null;
  if ("data" in error) return error.data;
  const response = error.response;
  if (isRecord(response) && "_data" in response) return response._data;
  return null;
}

function toMessage(value: unknown, fallback: string) {
  if (typeof value === "string" && value.trim()) return value;
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string").join(" ");
  return fallback;
}

function detailsDescription(details: unknown) {
  if (!details) return undefined;
  if (typeof details === "string") return details;
  if (Array.isArray(details)) return details.filter((item): item is string => typeof item === "string").join(" ") || undefined;
  if (isRecord(details) && "message" in details) return toMessage(details.message, "");
  return undefined;
}

export function normalizeApiError(error: unknown, fallbackMessage = fallbackMessages[ApiErrorCode.HTTP_ERROR]): ApiErrorBody {
  const body = extractBody(error);
  if (isRecord(body) && typeof body.code === "string" && knownCodes.has(body.code)) {
    const code = body.code as ApiErrorCode;
    return {
      code,
      message: toMessage(body.message, fallbackMessages[code]),
      details: "details" in body ? body.details : null,
      timestamp: typeof body.timestamp === "string" ? body.timestamp : new Date().toISOString()
    };
  }

  if (isRecord(error) && typeof error.message === "string" && error.message.trim()) {
    return {
      code: ApiErrorCode.HTTP_ERROR,
      message: error.message,
      details: null,
      timestamp: new Date().toISOString()
    };
  }

  return {
    code: ApiErrorCode.HTTP_ERROR,
    message: fallbackMessage,
    details: null,
    timestamp: new Date().toISOString()
  };
}

export function useApiErrors() {
  const toast = useToast();

  function showApiError(error: unknown, fallbackMessage?: string) {
    const body = normalizeApiError(error, fallbackMessage);
    const description = detailsDescription(body.details) ?? body.code;
    toast.add({ color: "red", title: body.message, description });
    return body;
  }

  return { normalizeApiError, showApiError };
}
