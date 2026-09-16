import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { AuditService } from "./audit.service";

@ApiTags("Auditoria")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("audit")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  // AuditLog has no tenantId column, so it cannot be scoped to one
  // organization. Registration for ORGANIZER is open to anyone, so admitting
  // that role here would let any signup read every tenant's audit trail.
  @Get()
  @Roles(UserRole.ADMIN)
  list(@Query() query: { userId?: string; entity?: string; page?: string; perPage?: string }) {
    return this.audit.list(query);
  }
}
