import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AppController } from "./app.controller";
import { MailService } from "./common/services/mail.service";
import { BusinessMetricsService } from "./modules/observability/business-metrics.service";

describe("AppController", () => {
  let app: INestApplication | undefined;
  let mailService: { getCachedTransportHealth: jest.Mock; refreshTransportHealth: jest.Mock };

  afterEach(async () => {
    await app?.close();
    jest.clearAllMocks();
  });

  it("keeps /api/health healthy when SMTP is unreachable and never exposes SMTP secrets", async () => {
    mailService = {
      getCachedTransportHealth: jest.fn().mockReturnValue({
        configured: true,
        reachable: false,
        error: "Auth failed for [redacted] with [redacted] at smtp.unreachable.host"
      }),
      refreshTransportHealth: jest.fn().mockReturnValue(new Promise(() => undefined))
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        { provide: MailService, useValue: mailService },
        {
          provide: BusinessMetricsService,
          useValue: { renderPrometheus: jest.fn() }
        }
      ]
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    await app.listen(0);

    const response = await fetch(`${await app.getUrl()}/api/health`);
    const body = await response.json() as any;
    const serializedBody = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: "ok",
      service: "eventflow-api",
      mail: {
        configured: true,
        reachable: false,
        error: "Auth failed for [redacted] with [redacted] at smtp.unreachable.host"
      }
    });
    expect(body.mail.error.length).toBeLessThanOrEqual(200);
    expect(serializedBody).not.toContain("smtp-user");
    expect(serializedBody).not.toContain("smtp-pass-secret");
    expect(mailService.refreshTransportHealth).toHaveBeenCalledTimes(1);
  });

  it("returns /api/health without waiting for a fresh mail check", async () => {
    mailService = {
      getCachedTransportHealth: jest.fn().mockReturnValue({
        configured: true,
        reachable: "unknown"
      }),
      refreshTransportHealth: jest.fn().mockReturnValue(new Promise(() => undefined))
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        { provide: MailService, useValue: mailService },
        {
          provide: BusinessMetricsService,
          useValue: { renderPrometheus: jest.fn() }
        }
      ]
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    await app.listen(0);

    const response = await Promise.race([
      fetch(`${await app.getUrl()}/api/health`),
      new Promise<"timed-out">((resolve) => setTimeout(() => resolve("timed-out"), 100))
    ]);

    expect(response).not.toBe("timed-out");
    expect((response as Response).status).toBe(200);
    await expect((response as Response).json()).resolves.toEqual({
      status: "ok",
      service: "eventflow-api",
      mail: {
        configured: true,
        reachable: "unknown"
      }
    });
  });
});
