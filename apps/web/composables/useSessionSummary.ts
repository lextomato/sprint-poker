import type { SessionSummaryView } from "@planning/shared";

interface SummaryRow {
  roomCode: string;
  roomName: string;
  storyTitle: string;
  owner: string;
  workflowStatus: string;
  taskType: string;
  originalEstimate: string;
  finalEstimate: string;
  storyStatus: string;
  round: string;
  participant: string;
  vote: string;
  average: string;
  median: string;
  mode: string;
  min: string;
  max: string;
  consensus: string;
}

export function useSessionSummary(roomCode: string) {
  const config = useRuntimeConfig();
  const participantStore = useParticipantStore();
  const session = useParticipantSession(roomCode);
  const { showApiError } = useApiErrors();

  function token() {
    const value = participantStore.sessionToken ?? session.getToken();
    if (!value) {
      throw new Error("Missing session token");
    }
    return value;
  }

  function getSummary() {
    return $fetch<SessionSummaryView>(`/rooms/${roomCode}/summary`, {
      baseURL: config.public.apiBaseUrl,
      headers: { "x-session-token": token() }
    });
  }

  async function closeSession() {
    const response = await $fetch<{ closed: boolean; summary: SessionSummaryView }>(`/rooms/${roomCode}/close`, {
      baseURL: config.public.apiBaseUrl,
      method: "POST",
      headers: { "x-session-token": token() }
    });
    return response.summary;
  }

  function baseRow(summary: SessionSummaryView, story: SessionSummaryView["stories"][number]): Omit<SummaryRow, "round" | "participant" | "vote" | "average" | "median" | "mode" | "min" | "max" | "consensus"> {
    return {
      roomCode: summary.room.code,
      roomName: summary.room.name,
      storyTitle: story.title,
      owner: story.ownerName ?? "",
      workflowStatus: story.workflowStatus ?? "",
      taskType: story.taskType ?? "",
      originalEstimate: story.originalEstimate ?? "",
      finalEstimate: story.finalEstimate ?? "",
      storyStatus: story.status
    };
  }

  function summaryRows(summary: SessionSummaryView): SummaryRow[] {
    return summary.stories.flatMap((story) => {
      if (story.rounds.length === 0) {
        return [
          {
            ...baseRow(summary, story),
            round: "",
            participant: "",
            vote: "",
            average: "",
            median: "",
            mode: "",
            min: "",
            max: "",
            consensus: ""
          }
        ];
      }
      return story.rounds.flatMap((round) =>
        round.votes.length
          ? round.votes.map((vote) => ({
              ...baseRow(summary, story),
              round: String(round.round),
              participant: vote.participantName,
              vote: vote.value,
              average: String(round.statistics?.average ?? ""),
              median: String(round.statistics?.median ?? ""),
              mode: String(round.statistics?.mode ?? ""),
              min: String(round.statistics?.min ?? ""),
              max: String(round.statistics?.max ?? ""),
              consensus: String(round.statistics?.consensus ?? "")
            }))
          : [
              {
                ...baseRow(summary, story),
                round: String(round.round),
                participant: "",
                vote: "",
                average: String(round.statistics?.average ?? ""),
                median: String(round.statistics?.median ?? ""),
                mode: String(round.statistics?.mode ?? ""),
                min: String(round.statistics?.min ?? ""),
                max: String(round.statistics?.max ?? ""),
                consensus: String(round.statistics?.consensus ?? "")
              }
            ]
      );
    });
  }

  function downloadCsv(summary: SessionSummaryView) {
    return downloadExport(summary, "csv");
  }

  function downloadXlsx(summary: SessionSummaryView) {
    return downloadExport(summary, "xlsx");
  }

  async function downloadExport(summary: SessionSummaryView, format: "csv" | "xlsx") {
    try {
      const blob = await $fetch<Blob>(`/rooms/${roomCode}/summary/export`, {
        baseURL: config.public.apiBaseUrl,
        responseType: "blob",
        headers: { "x-session-token": token() },
        query: { format }
      });
      downloadBlob(blob, `planning-summary-${summary.room.code}.${format}`, format === "csv" ? "text/csv;charset=utf-8" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    } catch (error) {
      showApiError(error, "No se pudo descargar el resumen");
    }
  }

  return { getSummary, closeSession, downloadCsv, downloadXlsx };
}

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadBlob(content: BlobPart, fileName: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
