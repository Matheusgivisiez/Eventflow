import { UnauthorizedException } from "@nestjs/common";
import { AuthController } from "./auth.controller";

function createResponse() {
  return {
    cookie: jest.fn(),
    clearCookie: jest.fn()
  };
}

function createRequest(cookie?: string) {
  return {
    headers: {
      ...(cookie ? { cookie } : {})
    }
  };
}

function createSession(overrides: Record<string, unknown> = {}) {
  return {
    accessToken: "access-token",
    refreshToken: "refresh-token",
    user: { id: "user-1", email: "user@example.com", role: "CUSTOMER" },
    ...overrides
  };
}

function createController() {
  const auth = {
    register: jest.fn(),
    registerOrganizer: jest.fn(),
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    me: jest.fn(),
    becomeOrganizer: jest.fn()
  };
  const controller = new AuthController(auth as any);
  return { controller, auth };
}

describe("AuthController refresh cookie security", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sets an HttpOnly refresh cookie and does not return refreshToken on login", async () => {
    const { controller, auth } = createController();
    const response = createResponse();
    auth.login.mockResolvedValue(createSession());

    const result = await controller.login({ email: "user@example.com", password: "password123" }, response as any);

    expect(response.cookie).toHaveBeenCalledWith("eventflow_refresh", "refresh-token", expect.objectContaining({
      httpOnly: true,
      sameSite: "lax",
      path: "/"
    }));
    expect(result).toEqual({
      accessToken: "access-token",
      user: { id: "user-1", email: "user@example.com", role: "CUSTOMER" }
    });
    expect(result).not.toHaveProperty("refreshToken");
  });

  it("refreshes from the HttpOnly cookie when request body has no refresh token", async () => {
    const { controller, auth } = createController();
    const response = createResponse();
    auth.refresh.mockResolvedValue(createSession({ accessToken: "new-access-token", refreshToken: "new-refresh-token" }));

    const result = await controller.refresh({}, createRequest("eventflow_refresh=refresh-token") as any, response as any);

    expect(auth.refresh).toHaveBeenCalledWith({ refreshToken: "refresh-token" });
    expect(response.cookie).toHaveBeenCalledWith("eventflow_refresh", "new-refresh-token", expect.objectContaining({
      httpOnly: true
    }));
    expect(result).toEqual({
      accessToken: "new-access-token",
      user: { id: "user-1", email: "user@example.com", role: "CUSTOMER" }
    });
    expect(result).not.toHaveProperty("refreshToken");
  });

  it("rejects refresh without body token or cookie token", async () => {
    const { controller, auth } = createController();

    await expect(controller.refresh({}, createRequest() as any, createResponse() as any)).rejects.toThrow(UnauthorizedException);
    expect(auth.refresh).not.toHaveBeenCalled();
  });

  it("clears refresh cookie and revokes the cookie token on logout", async () => {
    const { controller, auth } = createController();
    const response = createResponse();
    auth.logout.mockResolvedValue({ message: "Sessao encerrada com sucesso." });

    await controller.logout(createRequest("eventflow_refresh=refresh-token") as any, response as any);

    expect(response.clearCookie).toHaveBeenCalledWith("eventflow_refresh", expect.objectContaining({
      httpOnly: true,
      sameSite: "lax",
      path: "/"
    }));
    expect(auth.logout).toHaveBeenCalledWith("refresh-token");
  });
});
