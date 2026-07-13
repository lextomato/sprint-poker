import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client!: Redis;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.client = new Redis({
      host: this.config.get<string>("REDIS_HOST", "localhost"),
      port: Number(this.config.get<string>("REDIS_PORT", "6379")),
      password: this.config.get<string>("REDIS_PASSWORD") || undefined,
      lazyConnect: true,
      maxRetriesPerRequest: 2
    });
    void this.client.connect();
  }

  get instance(): Redis {
    return this.client;
  }

  async setSocketParticipant(socketId: string, participantId: string) {
    await this.client.set(`socket:${socketId}:participant`, participantId, "EX", 60 * 60 * 12);
  }

  async getSocketParticipant(socketId: string): Promise<string | null> {
    return this.client.get(`socket:${socketId}:participant`);
  }

  async clearSocket(socketId: string) {
    await this.client.del(`socket:${socketId}:participant`);
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
