import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dateTime } from "./utils";

describe("dateTime", () => {
  it("formata eventos no fuso operacional sem depender do fuso do servidor", () => {
    assert.equal(dateTime("2026-09-05T00:00:00.000Z"), "4 de set. de 2026, 21:00");
  });
});
