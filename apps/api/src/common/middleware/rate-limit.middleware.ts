import { HttpException, HttpStatus, Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import { CacheService } from "../../modules/cache/cache.service";

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  constructor(private readonly cache: CacheService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const key = `rate:${ip}:${Math.floor(Date.now() / 60000)}`;
    const count = await this.cache.increment(key, 70);
    if (count > 180) {
      throw new HttpException("Muitas requisicoes. Tente novamente em instantes.", HttpStatus.TOO_MANY_REQUESTS);
    }
    next();
  }
}
