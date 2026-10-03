import { ArgumentsHost, NotFoundException } from "@nestjs/common";
import { HttpExceptionFilter } from "./http-exception.filter";

describe("HttpExceptionFilter", () => {
  it("não expõe detalhes de uma exceção inesperada ao cliente", () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({ getResponse: () => ({ status }) })
    } as unknown as ArgumentsHost;

    const filter = new HttpExceptionFilter();
    filter.catch(new Error("database password leaked"), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 500,
      message: "Erro interno inesperado.",
      error: "Error"
    }));
    expect(json.mock.calls[0][0].message).not.toContain("password");
  });

  it("não devolve a URL (nem o token da query) no 404 de rota inexistente", () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({ getResponse: () => ({ status }) })
    } as unknown as ArgumentsHost;

    new HttpExceptionFilter().catch(
      new NotFoundException("Cannot GET /checkout/order/o1/tickets/t1/pdf?accessToken=secret-token"),
      host
    );

    expect(status).toHaveBeenCalledWith(404);
    expect(json.mock.calls[0][0].message).toBe("Rota não encontrada.");
    expect(JSON.stringify(json.mock.calls[0][0])).not.toContain("secret-token");
  });

  it("mantém a mensagem de um 404 de negócio", () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({ getResponse: () => ({ status }) })
    } as unknown as ArgumentsHost;

    new HttpExceptionFilter().catch(new NotFoundException("Pedido não encontrado."), host);

    expect(json.mock.calls[0][0].message).toBe("Pedido não encontrado.");
  });
});
