import { Module } from "@nestjs/common";
import { CacheModule } from "../cache/cache.module";
import { ArtistsController } from "./artists.controller";
import { ArtistsService } from "./artists.service";
@Module({ imports: [CacheModule], controllers: [ArtistsController], providers: [ArtistsService] })
export class ArtistsModule {}
