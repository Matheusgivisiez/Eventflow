import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { RequestUser } from "../../common/types/request-user";
import { ArtistsService } from "./artists.service";
import { CreateArtistDto } from "./dto/create-artist.dto";
import { ReorderEventArtistsDto } from "./dto/reorder-event-artists.dto";
import { UpdateArtistDto } from "./dto/update-artist.dto";

@ApiTags("Artistas") @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.ORGANIZER, UserRole.TEAM) @Controller()
export class ArtistsController {
  constructor(private readonly artists: ArtistsService) {}
  @Get("artists") list(@Query("search") search?: string) { return this.artists.list(search); }
  @Post("artists") create(@CurrentUser() user: RequestUser, @Body() dto: CreateArtistDto) { return this.artists.create(user.id, dto); }
  @Patch("artists/:id") update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateArtistDto) { return this.artists.update(id, user.id, dto); }
  @Get("events/:eventId/artists") eventArtists(@CurrentUser() user: RequestUser, @Param("eventId") eventId: string) { return this.artists.eventArtists(eventId, user.tenantId!); }
  @Post("events/:eventId/artists/:artistId") link(@CurrentUser() user: RequestUser, @Param("eventId") eventId: string, @Param("artistId") artistId: string) { return this.artists.link(eventId, artistId, user.tenantId!); }
  @Delete("events/:eventId/artists/:artistId") unlink(@CurrentUser() user: RequestUser, @Param("eventId") eventId: string, @Param("artistId") artistId: string) { return this.artists.unlink(eventId, artistId, user.tenantId!); }
  @Patch("events/:eventId/artists/order") reorder(@CurrentUser() user: RequestUser, @Param("eventId") eventId: string, @Body() dto: ReorderEventArtistsDto) { return this.artists.reorder(eventId, dto.artistIds, user.tenantId!); }
}
