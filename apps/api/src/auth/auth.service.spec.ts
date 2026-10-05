import type { PrismaService } from "../database/prisma.service";
import { createHash } from "node:crypto";
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
    const auth = new AuthService(prisma, {} as never);
    const session = await auth.register({ email: "Ada@Example.com", password: "correct-horse", displayName: "Ada" });

    expect(session.user.email).toBe("ada@example.com");
    expect(session.token.length).toBeGreaterThan(40);
    expect((prisma.user.create as jest.Mock).mock.calls[0][0].data.passwordHash).toMatch(/^scrypt\$/);
    expect((prisma.userSession.create as jest.Mock).mock.calls[0][0].data.tokenHash).toHaveLength(64);
  });

  it("returns the same recovery response when the email is not registered", async () => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(null) } } as unknown as PrismaService;
    const mail = { sendPasswordReset: jest.fn() };
    const auth = new AuthService(prisma, mail as never);

    const result = await auth.requestPasswordReset("unknown@example.com");

    expect(result.message).toContain("Si existe una cuenta");
    expect(mail.sendPasswordReset).not.toHaveBeenCalled();
  });

  it("stores only a hashed, expiring reset token and sends the raw token by email", async () => {
    const user = { id: "user-1", email: "ada@example.com", displayName: "Ada" };
    const passwordResetToken = {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockResolvedValue({})
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(user) },
      passwordResetToken,
      $transaction: jest.fn((callback) => callback({ passwordResetToken }))
    } as unknown as PrismaService;
    const mail = { sendPasswordReset: jest.fn().mockResolvedValue(undefined) };
    const auth = new AuthService(prisma, mail as never);

    await auth.requestPasswordReset(" Ada@Example.com ");

    const [{ data }] = passwordResetToken.create.mock.calls[0] as [{ data: { tokenHash: string; expiresAt: Date } }];
    const [{ token }] = mail.sendPasswordReset.mock.calls[0] as [{ token: string }];
    expect(data.tokenHash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(data.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 60 * 1000);
    expect(data.expiresAt.getTime()).toBeLessThan(Date.now() + 31 * 60 * 1000);
  });

  it("consumes a reset token once and revokes all existing sessions", async () => {
    const reset = { id: "reset-1", userId: "user-1", expiresAt: new Date(Date.now() + 60_000) };
    const passwordResetToken = {
      findUnique: jest.fn().mockResolvedValue(reset),
      deleteMany: jest.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 })
    };
    const user = { update: jest.fn().mockResolvedValue({}) };
    const userSession = { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) };
    const transaction = { passwordResetToken, user, userSession };
    const prisma = {
      passwordResetToken,
      $transaction: jest.fn((callback) => callback(transaction))
    } as unknown as PrismaService;
    const auth = new AuthService(prisma, {} as never);
    const token = "one-time-reset-token";

    await expect(auth.resetPassword(token, "new-password-123")).resolves.toMatchObject({ message: expect.stringContaining("actualizada") });

    expect(passwordResetToken.findUnique).toHaveBeenCalledWith({ where: { tokenHash: createHash("sha256").update(token).digest("hex") } });
    expect(user.update.mock.calls[0][0].data.passwordHash).toMatch(/^scrypt\$/);
    expect(userSession.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    expect(passwordResetToken.deleteMany).toHaveBeenNthCalledWith(1, { where: { id: "reset-1", expiresAt: { gt: expect.any(Date) } } });
  });
});
