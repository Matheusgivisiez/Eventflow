import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import Redis from "ioredis";
import { AppController } from "./app.controller";
import { envSchema } from "./config/env.schema";
import { RequestLoggerMiddleware } from "./common/middleware/request-logger.middleware";
import { RateLimitMiddleware } from "./common/middleware/rate-limit.middleware";
import { PrismaModule } from "./prisma/prisma.module";
import { AuditModule } from "./modules/audit/audit.module";
import { BuyerModule } from "./modules/buyer/buyer.module";
import { CacheModule } from "./modules/cache/cache.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { EventsModule } from "./modules/events/events.module";
import { TicketsModule } from "./modules/tickets/tickets.module";
import { CheckoutModule } from "./modules/checkout/checkout.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { CheckInModule } from "./modules/checkin/checkin.module";
import { FinanceModule } from "./modules/finance/finance.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { ProfileModule } from "./modules/profile/profile.module";
import { AdminModule } from "./modules/admin/admin.module";
import { CouponsModule } from "./modules/coupons/coupons.module";
import { TeamModule } from "./modules/team/team.module";
import { ParticipantsModule } from "./modules/participants/participants.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { WebhooksModule } from "./modules/webhooks/webhooks.module";
import { EnterpriseModule } from "./modules/enterprise/enterprise.module";
import { LgpdModule } from "./modules/lgpd/lgpd.module";
import { OrdersModule } from "./modules/orders/orders.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (env) => envSchema.parse(env)
    }),
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL
      }
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [{ limit: 120, ttl: 60000 }],
        storage: {
          async increment(key: string, ttl: number) {
            const redis = new Redis(config.get<string>("REDIS_URL") ?? "redis://localhost:6379", { lazyConnect: true, maxRetriesPerRequest: 1 });
            try {
              await redis.connect();
              const value = await redis.incr(key);
              if (value === 1) await redis.pexpire(key, ttl);
              return { totalHits: value, timeToExpire: ttl, isBlocked: false, timeToBlockExpire: 0 };
            } finally {
              await redis.quit().catch(() => undefined);
            }
          }
        }
      })
    }),
    CacheModule,
    AuditModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    EventsModule,
    TicketsModule,
    CheckoutModule,
    PaymentsModule,
    CheckInModule,
    FinanceModule,
    DashboardModule,
    ProfileModule,
    AdminModule,
    CouponsModule,
    TeamModule,
    ParticipantsModule,
    ReportsModule,
    BuyerModule,
    NotificationsModule,
    WebhooksModule,
    EnterpriseModule,
    LgpdModule,
    OrdersModule
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard }
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RateLimitMiddleware, RequestLoggerMiddleware).forRoutes("*");
  }
}
