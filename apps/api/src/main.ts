import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { NestExpressApplication } from "@nestjs/platform-express";
import * as compression from "compression";
import helmet from "helmet";
import { join } from "path";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { initTelemetry } from "./opentelemetry";

async function bootstrap() {
  if (process.env.OTEL_ENABLED === "true") {
    await initTelemetry();
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const config = app.get(ConfigService);

  app.use(compression());
  app.setGlobalPrefix("api");
  app.useStaticAssets(join(process.cwd(), "uploads"), { prefix: "/uploads" });
  app.enableCors({
    origin: [config.get<string>("APP_URL") ?? "http://localhost:3000"],
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-Webhook-Signature"],
    maxAge: 86400
  });
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:", `${config.get<string>("API_URL") ?? "http://localhost:3001"}`],
        connectSrc: ["'self'", config.get<string>("API_URL") ?? "http://localhost:3001"]
      }
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    frameguard: { action: "deny" },
    noSniff: true
  }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true
    })
  );

  const swagger = new DocumentBuilder()
    .setTitle("Event Flow API")
    .setDescription("API do MVP SaaS de venda de ingressos online.")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, swagger));

  await app.listen(config.get<number>("PORT") ?? 3001);
}

void bootstrap();
