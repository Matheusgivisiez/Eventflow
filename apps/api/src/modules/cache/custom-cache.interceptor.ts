import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable, of } from "rxjs";
import { tap } from "rxjs/operators";
import { CacheService } from "./cache.service";
import { Request } from "express";

@Injectable()
export class CustomCacheInterceptor implements NestInterceptor {
  constructor(private readonly cache: CacheService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.method !== "GET") {
      return next.handle();
    }

    const cacheKey = `http_cache:${request.url}`;
    const cachedResponse = await this.cache.get(cacheKey);

    if (cachedResponse) {
      return of(cachedResponse);
    }

    return next.handle().pipe(
      tap(async (response) => {
        // Cache response for 30 seconds
        await this.cache.set(cacheKey, response, 30);
      })
    );
  }
}
