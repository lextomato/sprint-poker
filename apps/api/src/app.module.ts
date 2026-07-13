import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { AllExceptionsFilter } from "./common/all-exceptions.filter";
import { DatabaseModule } from "./database/database.module";
import { HealthModule } from "./health/health.module";
import { ParticipantsModule } from "./participants/participants.module";
import { RealtimeModule } from "./realtime/realtime.module";
import { RedisModule } from "./redis/redis.module";
import { RoomsModule } from "./rooms/rooms.module";
import { StoriesModule } from "./stories/stories.module";
import { VotingModule } from "./voting/voting.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    DatabaseModule,
    RedisModule,
    HealthModule,
    RoomsModule,
    ParticipantsModule,
    StoriesModule,
    VotingModule,
    RealtimeModule
  ],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }]
})
export class AppModule {}
