import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { AppController } from "./app.controller";
import { envSchema } from "./config/env.schema";
import { RequestLoggerMiddleware } from "./common/middleware/request-logger.middleware";
import { RateLimitMiddleware } from "./common/middleware/rate-limit.middleware";
import { CustomThrottlerGuard } from "./common/guards/custom-throttler.guard";
import { PrismaModule } from "./prisma/prisma.module";
import { AuditModule } from "./modules/audit/audit.module";
import { CacheService } from "./modules/cache/cache.service";
import { CacheModule } from "./modules/cache/cache.module";
import { BuyerModule } from "./modules/buyer/buyer.module";
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
import { PromotersModule } from "./modules/promoters/promoters.module";
import { UploadModule } from "./modules/upload/upload.module";
import { TransfersModule } from "./modules/transfers/transfers.module";
import { ObservabilityModule } from "./modules/observability/observability.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (env) => envSchema.parse(env)
    }),
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL,
        enableReadyCheck: false,
        skipVersionCheck: true
      }
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule, CacheModule],
      inject: [ConfigService, CacheService],
      useFactory: (config: ConfigService, cache: CacheService) => ({
        throttlers: [
          { name: "default", limit: config.get<number>("THROTTLE_LIMIT") ?? 120, ttl: config.get<number>("THROTTLE_TTL") ?? 60000 },
          { name: "auth", limit: 10, ttl: 60000 },
          { name: "checkout", limit: 30, ttl: 60000 },
          { name: "sensitive", limit: 20, ttl: 60000 }
        ],
        storage: {
          async increment(key: string, ttl: number) {
            const res = await cache.incrementThrottle(key, ttl);
            return {
              totalHits: res.totalHits,
              timeToExpire: res.timeToExpire,
              isBlocked: false,
              timeToBlockExpire: 0
            };
          }
        }
      })
    }),
    CacheModule,
    ObservabilityModule,
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
    OrdersModule,
    UploadModule,
    PromotersModule,
    TransfersModule
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: CustomThrottlerGuard }
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RateLimitMiddleware, RequestLoggerMiddleware).forRoutes("*");
  }
}
