import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CacheService } from "../cache/cache.service";
import { CreateArtistDto } from "./dto/create-artist.dto";
import { UpdateArtistDto } from "./dto/update-artist.dto";

const artistSelect = { id: true, stageName: true, imageUrl: true, instagramUrl: true, spotifyUrl: true, bio: true, genre: true } as const;

@Injectable()
export class ArtistsService {
  constructor(private readonly prisma: PrismaService, private readonly cache: CacheService) {}

  list(search?: string) {
    const term = search?.trim();
    return this.prisma.artist.findMany({ where: term ? { stageName: { contains: term, mode: "insensitive" } } : undefined, select: artistSelect, orderBy: { stageName: "asc" }, take: 20 });
  }

  create(userId: string, dto: CreateArtistDto) {
    const stageName = dto.stageName.trim();
    if (!stageName) throw new BadRequestException("Informe o nome artístico.");
    return this.prisma.artist.create({ data: { ...dto, stageName, createdById: userId }, select: artistSelect });
  }

  async update(id: string, userId: string, dto: UpdateArtistDto) {
    const artist = await this.prisma.artist.findUnique({ where: { id } });
    if (!artist) throw new NotFoundException("Artista não encontrado.");
    if (artist.createdById && artist.createdById !== userId) throw new ForbiddenException("Você não pode editar este artista.");
    if (dto.stageName !== undefined && !dto.stageName.trim()) throw new BadRequestException("Informe o nome artístico.");
    const updated = await this.prisma.artist.update({ where: { id }, data: { ...dto, stageName: dto.stageName?.trim() }, select: artistSelect });
    await this.invalidatePublicCache();
    return updated;
  }

  async link(eventId: string, artistId: string, tenantId: string) {
    await this.assertEventAccess(eventId, tenantId);
    if (!await this.prisma.artist.findUnique({ where: { id: artistId }, select: { id: true } })) throw new NotFoundException("Artista não encontrado.");
    const max = await this.prisma.eventArtist.aggregate({ where: { eventId }, _max: { position: true } });
    try {
      const linked = await this.prisma.eventArtist.create({ data: { eventId, artistId, position: (max._max.position ?? -1) + 1 }, include: { artist: { select: artistSelect } } });
      await this.invalidatePublicCache();
      return linked;
    } catch (error: any) {
      if (error?.code === "P2002") throw new BadRequestException("Este artista já está vinculado ao evento.");
      throw error;
    }
  }

  async unlink(eventId: string, artistId: string, tenantId: string) {
    await this.assertEventAccess(eventId, tenantId);
    if (!(await this.prisma.eventArtist.deleteMany({ where: { eventId, artistId } })).count) throw new NotFoundException("Vínculo de artista não encontrado.");
    await this.invalidatePublicCache();
    return { success: true };
  }

  async reorder(eventId: string, artistIds: string[], tenantId: string) {
    await this.assertEventAccess(eventId, tenantId);
    if (new Set(artistIds).size !== artistIds.length) throw new BadRequestException("A ordem contém artistas repetidos.");
    const linked = await this.prisma.eventArtist.findMany({ where: { eventId }, select: { artistId: true } });
    if (linked.length !== artistIds.length || linked.some(({ artistId }) => !artistIds.includes(artistId))) throw new BadRequestException("A ordem deve conter exatamente os artistas vinculados ao evento.");
    await this.prisma.$transaction(artistIds.map((artistId, position) => this.prisma.eventArtist.update({ where: { eventId_artistId: { eventId, artistId } }, data: { position } })));
    await this.invalidatePublicCache();
    return this.eventArtists(eventId, tenantId);
  }

  async eventArtists(eventId: string, tenantId: string) {
    await this.assertEventAccess(eventId, tenantId);
    return this.prisma.eventArtist.findMany({ where: { eventId }, include: { artist: { select: artistSelect } }, orderBy: { position: "asc" } });
  }

  private async assertEventAccess(eventId: string, tenantId: string) {
    if (!await this.prisma.event.findFirst({ where: { id: eventId, tenantId }, select: { id: true } })) throw new NotFoundException("Evento não encontrado.");
  }
  private async invalidatePublicCache() { await this.cache.delByPattern("events:public:*"); }
}
