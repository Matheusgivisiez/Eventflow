import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";

@Injectable()
export class LgpdService {
  private readonly logger = new Logger(LgpdService.name);

  constructor(
    @InjectQueue("lgpd") private readonly lgpdQueue: Queue
  ) {}

  async scheduleAnonymization(userId: string, delayMs = 0) {
    await this.lgpdQueue.add("anonymize", { userId }, { delay: delayMs });
    this.logger.log(`Anonimizacao agendada para usuario ${userId}`);
  }
}
