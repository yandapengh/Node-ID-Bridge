import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { serializeSelection } from "../src/shared/serialize-selection";
import type { NodeReference } from "../src/shared/types";

const nodes: NodeReference[] = [
  {
    id: "5309:30855",
    name: "Profile Details (资料 | 详情)",
    type: "SECTION",
    pageId: "0:1",
    pageName: "Flows"
  },
  {
    id: "5309:27495",
    name: "Set Notification",
    type: "SECTION",
    pageId: "0:1",
    pageName: "Flows"
  }
];

describe("serializeSelection", () => {
  it("serializes one Compact ID with its name", () => {
    assert.equal(
      serializeSelection(nodes.slice(0, 1), {
        format: "compact",
        includeNames: true
      }),
      "5309:30855 | Profile Details (资料 | 详情)"
    );
  });

  it("serializes multiple Compact IDs with names in selection order", () => {
    assert.equal(
      serializeSelection(nodes, { format: "compact", includeNames: true }),
      [
        "5309:30855 | Profile Details (资料 | 详情)",
        "5309:27495 | Set Notification"
      ].join("\n")
    );
  });

  it("serializes one Compact ID without a name", () => {
    assert.equal(
      serializeSelection(nodes.slice(0, 1), {
        format: "compact",
        includeNames: false
      }),
      "5309:30855"
    );
  });

  it("serializes multiple Compact IDs without names", () => {
    assert.equal(
      serializeSelection(nodes, { format: "compact", includeNames: false }),
      "5309:30855\n5309:27495"
    );
  });

  it("serializes one named node as a JSON object", () => {
    const output = serializeSelection(nodes.slice(0, 1), {
      format: "json",
      includeNames: true
    });
    assert.equal(
      output,
      '{"id":"5309:30855","name":"Profile Details (资料 | 详情)"}'
    );
    assert.deepEqual(JSON.parse(output), {
      id: "5309:30855",
      name: "Profile Details (资料 | 详情)"
    });
  });

  it("serializes multiple named nodes as compact parseable JSON", () => {
    const output = serializeSelection(nodes, {
      format: "json",
      includeNames: true
    });
    assert.equal(output.includes("\n"), false);
    assert.deepEqual(JSON.parse(output), [
      { id: "5309:30855", name: "Profile Details (资料 | 详情)" },
      { id: "5309:27495", name: "Set Notification" }
    ]);
  });

  it("serializes one unnamed node as a JSON string", () => {
    const output = serializeSelection(nodes.slice(0, 1), {
      format: "json",
      includeNames: false
    });
    assert.equal(output, '"5309:30855"');
    assert.equal(JSON.parse(output), "5309:30855");
  });

  it("serializes multiple unnamed nodes as a compact JSON array", () => {
    const output = serializeSelection(nodes, {
      format: "json",
      includeNames: false
    });
    assert.equal(output, '["5309:30855","5309:27495"]');
    assert.deepEqual(JSON.parse(output), ["5309:30855", "5309:27495"]);
  });

  it("does not produce clipboard content for an empty selection", () => {
    assert.equal(
      serializeSelection([], { format: "compact", includeNames: true }),
      ""
    );
  });
});
