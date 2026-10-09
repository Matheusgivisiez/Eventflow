import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { safeCheckoutReturnPath, withCheckoutReturn } from "./checkout-return";

describe("safeCheckoutReturnPath", () => {
  it("aceita o checkout com itens, promoter e convite", () => {
    for (const path of [
      "/checkout/hallowparty-vi6WC3",
      "/checkout/hallowparty-vi6WC3?items=abc:1,def:2",
      "/checkout/evento?p=CODE&invite=tok_en-1",
    ]) {
      assert.equal(safeCheckoutReturnPath(path), path);
    }
  });

  it("recusa endereços externos e rotas fora do checkout", () => {
    for (const path of [
      undefined,
      null,
      "",
      "https://evil.example/checkout/x",
      "//evil.example/checkout/x",
      "/checkout/../admin",
      "/dashboard",
      "/checkout/x?a=<script>",
      `/checkout/x?items=${"a".repeat(600)}`,
    ]) {
      assert.equal(safeCheckoutReturnPath(path), undefined, String(path));
    }
  });
});

describe("withCheckoutReturn", () => {
  it("leva o checkout junto, codificado", () => {
    assert.equal(
      withCheckoutReturn("/login", "/checkout/festa?items=a:1&p=X"),
      "/login?next=%2Fcheckout%2Ffesta%3Fitems%3Da%3A1%26p%3DX",
    );
    assert.equal(
      withCheckoutReturn("/verificar-email?sent=1", "/checkout/festa"),
      "/verificar-email?sent=1&next=%2Fcheckout%2Ffesta",
    );
  });

  it("não acrescenta nada quando o retorno é inválido", () => {
    assert.equal(withCheckoutReturn("/login", "https://evil.example"), "/login");
    assert.equal(withCheckoutReturn("/login", undefined), "/login");
  });
});
