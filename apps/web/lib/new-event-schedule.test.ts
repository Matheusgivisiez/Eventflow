import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatScheduleValue, joinScheduleValue, splitScheduleValue } from "./new-event-schedule";

describe("new event schedule helpers", () => {
  it("separa data e horário para edição independente", () => {
    assert.deepEqual(splitScheduleValue("2026-10-24T19:30"), { date: "2026-10-24", time: "19:30" });
  });

  it("mantém o formato aceito pelo formulário e API", () => {
    assert.equal(joinScheduleValue({ date: "2026-10-24", time: "19:30" }), "2026-10-24T19:30");
    assert.equal(joinScheduleValue({ date: "2026-10-24", time: "" }), "2026-10-24T00:00");
    assert.equal(joinScheduleValue({ date: "", time: "" }), "");
  });

  it("formata o resumo em português e trata valores vazios", () => {
    assert.equal(formatScheduleValue(), "Não informado");
    assert.equal(formatScheduleValue("invalid"), "Não informado");
    assert.match(formatScheduleValue("2026-10-24T19:30"), /24 de outubro de 2026/);
  });
});
