const runWhenServicesAreAvailable = process.env.E2E_BASE_URL ? describe : describe.skip;

interface CreateRoomResponse {
  roomCode: string;
  sessionToken: string;
  state: {
    stories: Array<{ id: string; title: string }>;
  };
}

async function postJson<T>(url: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(`Request failed ${response.status}: ${await response.text()}`);
  }
  return (await response.json()) as T;
}

runWhenServicesAreAvailable("main planning flow", () => {
  const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:4000/api/v1";

  it("creates a room and joins two participants", async () => {
    const created = await postJson<CreateRoomResponse>(`${baseUrl}/rooms`, {
      roomName: "E2E Planning",
      participantName: "Moderator",
      firstStoryTitle: "Estimate signup"
    });

    expect(created.roomCode).toHaveLength(8);
    expect(created.sessionToken).toHaveLength(43);
    expect(created.state.stories[0]?.title).toBe("Estimate signup");

    const voter = await postJson<{ participantId: string }>(`${baseUrl}/rooms/${created.roomCode}/join`, {
      participantName: "Voter One",
      role: "VOTER"
    });
    const observer = await postJson<{ participantId: string }>(`${baseUrl}/rooms/${created.roomCode}/join`, {
      participantName: "Observer One",
      role: "OBSERVER"
    });

    expect(voter.participantId).toBeTruthy();
    expect(observer.participantId).toBeTruthy();
  });
});
