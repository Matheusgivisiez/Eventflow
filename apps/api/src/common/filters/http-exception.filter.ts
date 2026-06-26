import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { Response } from "express";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = exception instanceof HttpException ? exception.getResponse() : "Erro interno inesperado.";

    response.status(status).json({
      statusCode: status,
      message: typeof payload === "string" ? payload : (payload as { message?: string | string[] }).message,
      error: exception instanceof Error ? exception.name : "Error",
      timestamp: new Date().toISOString()
    });
  }
}
