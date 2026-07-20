import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseNodeIds } from "../src/shared/parse-node-ids";

describe("parseNodeIds", () => {
  it("parses one colon ID", () => {
    assert.deepEqual(parseNodeIds("5309:30855"), ["5309:30855"]);
  });

  it("normalizes one hyphen ID", () => {
    assert.deepEqual(parseNodeIds("5309-30855"), ["5309:30855"]);
  });

  it("parses an id= prefix", () => {
    assert.deepEqual(parseNodeIds("id=5309-30855"), ["5309:30855"]);
  });

  it("parses Compact multiline input without using names", () => {
    const input = [
      "5309:30855 | Profile Details",
      "5309:27495 | 设置通知 (中文)",
      "5599:164527 | Name | with pipes"
    ].join("\n");

    assert.deepEqual(parseNodeIds(input), [
      "5309:30855",
      "5309:27495",
      "5599:164527"
    ]);
  });

  it("parses a JSON string array", () => {
    assert.deepEqual(parseNodeIds('["5309:30855","5309:27495"]'), [
      "5309:30855",
      "5309:27495"
    ]);
  });

  it("parses a JSON object array", () => {
    const input = JSON.stringify([
      { id: "5309:30855", name: "Profile Details" },
      { id: "5309:27495", name: "Set Notification" }
    ]);

    assert.deepEqual(parseNodeIds(input), ["5309:30855", "5309:27495"]);
  });

  it("parses a Figma URL", () => {
    const input =
      "https://www.figma.com/design/xxx/file?node-id=5309-30855";
    assert.deepEqual(parseNodeIds(input), ["5309:30855"]);
  });

  it("preserves a composite instance-context ID as one ID", () => {
    assert.deepEqual(
      parseNodeIds("I6003:47907;6003:40969 | Toast"),
      ["I6003:47907;6003:40969"]
    );
  });

  it("normalizes every segment of a hyphenated instance-context ID", () => {
    assert.deepEqual(
      parseNodeIds("node-id=I6003-47907;6003-40969"),
      ["I6003:47907;6003:40969"]
    );
  });

  it("preserves deeper instance-context paths", () => {
    assert.deepEqual(
      parseNodeIds("I6057:28440;6003:47907;6003:40969 | Toast"),
      ["I6057:28440;6003:47907;6003:40969"]
    );
  });

  it("parses composite and ordinary IDs without extracting composite fragments", () => {
    const input = [
      "I6501:145066;6501:145295 | Toast",
      "5309:30855 | Profile Details"
    ].join("\n");

    assert.deepEqual(parseNodeIds(input), [
      "I6501:145066;6501:145295",
      "5309:30855"
    ]);
  });

  it("parses mixed text and preserves first-seen order", () => {
    const input =
      "First 10-20, then id=30:40, URL node-id=50-60, finally 10:20.";
    assert.deepEqual(parseNodeIds(input), ["10:20", "30:40", "50:60"]);
  });

  it("deduplicates normalized IDs", () => {
    assert.deepEqual(parseNodeIds("5309-30855 5309:30855 1:2 1-2"), [
      "5309:30855",
      "1:2"
    ]);
  });

  it("returns an empty array for empty input", () => {
    assert.deepEqual(parseNodeIds(""), []);
  });

  it("returns an empty array for invalid input", () => {
    assert.deepEqual(parseNodeIds("No Figma node address here: abc-def."), []);
  });
});
