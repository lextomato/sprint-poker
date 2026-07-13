import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../database/prisma.service";
import { RedisService } from "../redis/redis.service";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService
  ) {}

  @Get()
  async getHealth() {
    await this.prisma.$queryRaw`SELECT 1`;
    const redis = await this.redis.instance.ping();
    return {
      status: "ok",
      postgres: "ok",
      redis: redis === "PONG" ? "ok" : "degraded",
      timestamp: new Date().toISOString()
    };
  }
}
