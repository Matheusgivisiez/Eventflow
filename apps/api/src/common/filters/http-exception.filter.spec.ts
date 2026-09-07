import { ArgumentsHost } from "@nestjs/common";
import { HttpExceptionFilter } from "./http-exception.filter";

describe("HttpExceptionFilter", () => {
  it("nao expoe detalhes de uma excecao inesperada ao cliente", () => {
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
});
