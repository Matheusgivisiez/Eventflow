import { PartialType } from "@nestjs/swagger";
import { CreateTicketTypeDto } from "./create-ticket-type.dto";

export class UpdateTicketTypeDto extends PartialType(CreateTicketTypeDto) {}
