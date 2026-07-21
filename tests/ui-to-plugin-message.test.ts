import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isUiToPluginMessage } from "../src/shared/types";

describe("isUiToPluginMessage", () => {
  it("accepts the existing read and parse requests", () => {
    assert.equal(isUiToPluginMessage({ type: "read-selection" }), true);
    assert.equal(
      isUiToPluginMessage({ type: "select-nodes", input: "10:20" }),
      true
    );
  });

  it("accepts a non-empty focus-node ID", () => {
    assert.equal(
      isUiToPluginMessage({ type: "focus-node", id: "10:20" }),
      true
    );
    assert.equal(
      isUiToPluginMessage({
        type: "focus-node",
        id: "I6003:47907;6003:40969"
      }),
      true
    );
  });

  it("rejects malformed focus-node requests", () => {
    for (const value of [
      { type: "focus-node" },
      { type: "focus-node", id: null },
      { type: "focus-node", id: 123 },
      { type: "focus-node", id: "" },
      { type: "focus-node", id: "   " },
      { type: "focus-node", id: "not-a-node-id" }
    ]) {
      assert.equal(isUiToPluginMessage(value), false);
    }
  });

  it("accepts apply-selection requests containing string IDs", () => {
    assert.equal(
      isUiToPluginMessage({
        type: "apply-selection",
        ids: ["10:20", "I6003:47907;6003:40969"]
      }),
      true
    );
    assert.equal(
      isUiToPluginMessage({ type: "apply-selection", ids: [] }),
      true
    );
  });

  it("rejects malformed apply-selection arrays", () => {
    for (const value of [
      { type: "apply-selection" },
      { type: "apply-selection", ids: "10:20" },
      { type: "apply-selection", ids: ["10:20", 30] },
      { type: "apply-selection", ids: [""] },
      { type: "apply-selection", ids: ["   "] },
      { type: "apply-selection", ids: ["not-a-node-id"] }
    ]) {
      assert.equal(isUiToPluginMessage(value), false);
    }
  });

  it("rejects non-object and unknown requests", () => {
    for (const value of [
      null,
      undefined,
      "focus-node",
      { type: "unknown", id: "10:20" }
    ]) {
      assert.equal(isUiToPluginMessage(value), false);
    }
  });
});
