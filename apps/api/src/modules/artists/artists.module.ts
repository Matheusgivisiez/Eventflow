import { Module } from "@nestjs/common";
import { CacheModule } from "../cache/cache.module";
import { EventsModule } from "../events/events.module";
import { ArtistsController } from "./artists.controller";
import { ArtistsService } from "./artists.service";
@Module({ imports: [CacheModule, EventsModule], controllers: [ArtistsController], providers: [ArtistsService] })
export class ArtistsModule {}
