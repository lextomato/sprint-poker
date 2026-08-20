import { Injectable } from "@nestjs/common";
import type { AuthSessionView, UserView } from "@planning/shared";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { AppError, ErrorCode } from "../common/app-error";
import { sanitizeText } from "../common/sanitize";
import { PrismaService } from "../database/prisma.service";
import type { LoginDto, RegisterDto } from "./dto";

const scryptAsync = promisify(scrypt);
const sessionDays = 90;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterDto): Promise<AuthSessionView> {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new AppError(ErrorCode.USER_ALREADY_EXISTS, "Ya existe una cuenta con ese correo.");
    const user = await this.prisma.user.create({
      data: { email, displayName: sanitizeText(dto.displayName), passwordHash: await this.hashPassword(dto.password) }
    });
    return this.createSession(user);
  }

  async login(dto: LoginDto): Promise<AuthSessionView> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.trim().toLowerCase() } });
    if (!user || !(await this.verifyPassword(dto.password, user.passwordHash))) {
      throw new AppError(ErrorCode.INVALID_CREDENTIALS, "Correo o contrasena incorrectos.");
    }
    const updated = await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return this.createSession(updated);
  }

  async resolveToken(token?: string | null) {
    if (!token) return null;
    const session = await this.prisma.userSession.findUnique({ where: { tokenHash: this.hashToken(token) }, include: { user: true } });
    if (!session || session.expiresAt <= new Date()) return null;
    await this.prisma.userSession.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } });
    return session.user;
  }

  async requireUser(token?: string | null) {
    const user = await this.resolveToken(token);
    if (!user) throw new AppError(ErrorCode.AUTH_REQUIRED, "Inicia sesion para acceder a esta informacion.");
    return user;
  }

  async me(token?: string | null): Promise<UserView> {
    return this.toView(await this.requireUser(token));
  }

  async logout(token?: string | null) {
    if (token) await this.prisma.userSession.deleteMany({ where: { tokenHash: this.hashToken(token) } });
    return { loggedOut: true };
  }

  private async createSession(user: { id: string; email: string; displayName: string; createdAt: Date; lastLoginAt: Date | null }): Promise<AuthSessionView> {
    const token = randomBytes(48).toString("base64url");
    const expiresAt = new Date(Date.now() + sessionDays * 24 * 60 * 60 * 1000);
    await this.prisma.userSession.create({ data: { userId: user.id, tokenHash: this.hashToken(token), expiresAt } });
    return { token, user: this.toView(user) };
  }

  private toView(user: { id: string; email: string; displayName: string; createdAt: Date; lastLoginAt: Date | null }): UserView {
    return { id: user.id, email: user.email, displayName: user.displayName, createdAt: user.createdAt.toISOString(), lastLoginAt: user.lastLoginAt?.toISOString() ?? null };
  }

  private async hashPassword(password: string) {
    const salt = randomBytes(16).toString("hex");
    const hash = (await scryptAsync(password, salt, 64)) as Buffer;
    return `scrypt$${salt}$${hash.toString("hex")}`;
  }

  private async verifyPassword(password: string, stored: string) {
    const [algorithm, salt, encoded] = stored.split("$");
    if (algorithm !== "scrypt" || !salt || !encoded) return false;
    const expected = Buffer.from(encoded, "hex");
    const actual = (await scryptAsync(password, salt, expected.length)) as Buffer;
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  private hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }
}
