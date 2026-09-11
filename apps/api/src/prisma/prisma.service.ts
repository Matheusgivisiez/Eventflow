import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { isPerfDiagnosticsEnabled, perfCollector } from "../common/diagnostics/perf-diagnostics";

type QueryEventEmitter = { $on(event: "query", callback: (event: Prisma.QueryEvent) => void): void };

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super(PrismaService.clientOptions());
    if (isPerfDiagnosticsEnabled()) {
      // Query events are only emitted when the client is built with log: [{ emit: "event", level: "query" }].
      (this as unknown as QueryEventEmitter).$on("query", (event) => perfCollector.recordQuery(event.duration));
      perfCollector.start();
    }
  }

  private static clientOptions(): Prisma.PrismaClientOptions | undefined {
    return isPerfDiagnosticsEnabled() ? { log: [{ emit: "event", level: "query" }] } : undefined;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
