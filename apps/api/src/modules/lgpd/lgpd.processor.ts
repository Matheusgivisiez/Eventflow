import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger, OnModuleInit } from "@nestjs/common";
import { Job } from "bullmq";
import { PrismaService } from "../../prisma/prisma.service";

@Processor("lgpd")
export class LgpdProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(LgpdProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  onModuleInit() {
    this.worker?.on("error", (err) => {
      this.logger.warn(`LgpdProcessor worker warning: ${err.message}`);
    });
  }

  async process(job: Job<{ userId: string }>) {
    const { userId } = job.data;
    this.logger.log(`Iniciando anonimizacao do usuario ${userId}`);

    const anonymized = `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          name: "Usuario Anonimo",
          email: `${anonymized}@anon.eventflow.app`,
          phone: null,
          avatarUrl: null,
          passwordHash: anonymized
        }
      });

      await tx.order.updateMany({
        where: { userId },
        data: {
          buyerName: "Usuario Anonimo",
          buyerEmail: `${anonymized}@anon.eventflow.app`,
          buyerDocument: null,
          buyerPhone: null
        }
      });
    });

    this.logger.log(`Anonimizacao concluida para usuario ${userId}`);
  }
}
