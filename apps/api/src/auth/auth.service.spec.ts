import type { PrismaService } from "../database/prisma.service";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  it("creates an optional persistent account and a hashed session", async () => {
    const now = new Date();
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "user-1", ...data, createdAt: now, lastLoginAt: null }))
      },
      userSession: { create: jest.fn().mockResolvedValue({}) }
    } as unknown as PrismaService;
    const auth = new AuthService(prisma);
    const session = await auth.register({ email: "Ada@Example.com", password: "correct-horse", displayName: "Ada" });

    expect(session.user.email).toBe("ada@example.com");
    expect(session.token.length).toBeGreaterThan(40);
    expect((prisma.user.create as jest.Mock).mock.calls[0][0].data.passwordHash).toMatch(/^scrypt\$/);
    expect((prisma.userSession.create as jest.Mock).mock.calls[0][0].data.tokenHash).toHaveLength(64);
  });
});
