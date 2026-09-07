import { Logger } from "@nestjs/common";
import { RequestLoggerMiddleware } from "./request-logger.middleware";

describe("RequestLoggerMiddleware", () => {
  it("registra apenas o caminho, sem parametros sensiveis da URL", () => {
    const log = jest.spyOn(Logger.prototype, "log").mockImplementation();
    let onFinish: (() => void) | undefined;
    const response = {
      statusCode: 200,
      on: jest.fn((event: string, listener: () => void) => {
        if (event === "finish") onFinish = listener;
      })
    } as any;
    const next = jest.fn();

    new RequestLoggerMiddleware().use({
      method: "POST",
      path: "/api/webhooks/abacatepay",
      originalUrl: "/api/webhooks/abacatepay?webhookSecret=should-not-be-logged"
    } as any, response, next);
    onFinish?.();

    expect(next).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("/api/webhooks/abacatepay"));
    expect(log.mock.calls.flat().join(" ")).not.toContain("should-not-be-logged");
    log.mockRestore();
  });
});
