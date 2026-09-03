import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { closingRuleFromOptions, closingRuleOptions } from "./ticket-lot-rules";

describe("ticket lot closing rules", () => {
  it("converte os checkboxes em regra compatível com a API", () => {
    assert.equal(closingRuleFromOptions(true, false), "DATE");
    assert.equal(closingRuleFromOptions(false, true), "SOLD");
    assert.equal(closingRuleFromOptions(true, true), "BOTH");
    assert.equal(closingRuleFromOptions(false, false), "DATE");
  });

  it("reconstitui os checkboxes a partir da regra salva", () => {
    assert.deepEqual(closingRuleOptions("DATE"), { byDate: true, bySold: false });
    assert.deepEqual(closingRuleOptions("SOLD"), { byDate: false, bySold: true });
    assert.deepEqual(closingRuleOptions("BOTH"), { byDate: true, bySold: true });
  });
});
