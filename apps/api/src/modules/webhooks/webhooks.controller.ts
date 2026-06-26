import { Body, Controller, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { WebhooksService } from "./webhooks.service";

@ApiTags("Webhooks")
@Controller("webhooks")
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Post("mercado-pago")
  mercadoPago(@Body() body: Record<string, unknown>) {
    return this.webhooks.handle("mercado_pago", body);
  }

  @Post("stripe")
  stripe(@Body() body: Record<string, unknown>) {
    return this.webhooks.handle("stripe", body);
  }

  @Post("asaas")
  asaas(@Body() body: Record<string, unknown>) {
    return this.webhooks.handle("asaas", body);
  }
}
