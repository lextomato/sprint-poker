import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { json, urlencoded } from "express";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const corsOrigin = process.env.CORS_ORIGIN?.split(",") ?? ["http://localhost:3000"];

  app.use(helmet());
  app.use(json({ limit: "1mb" }));
  app.use(urlencoded({ extended: true, limit: "1mb" }));
  app.enableCors({ origin: corsOrigin, credentials: true });
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true
    })
  );

  const config = new DocumentBuilder()
    .setTitle("Planning Platform API")
    .setDescription("REST recovery endpoints for the realtime Planning Poker MVP.")
    .setVersion("0.1.0")
    .addTag("rooms")
    .addTag("health")
    .build();
  SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, config));

  await app.listen(Number(process.env.API_PORT ?? 4000), "0.0.0.0");
}

void bootstrap();
