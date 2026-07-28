import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyBulkExportValue,
  buildImageExportRequest,
  confirmResolvedRows,
  createEmptyExportDraft,
  createEmptyResolvedRowsState,
  getHeaderCheckboxState,
  getNextNameSort,
  invalidateResolvedRows,
  setAllRowsChecked,
  sortNodesByName,
  switchResolvedView,
  type ExportDraft
} from "../src/shared/ui-state";
import type { NodeReference } from "../src/shared/types";

const nodes: NodeReference[] = [
  {
    id: "1:2",
    name: "Zulu",
    type: "FRAME",
    pageId: "0:1",
    pageName: "One"
  },
  {
    id: "3:4",
    name: "Alpha",
    type: "COMPONENT",
    pageId: "0:2",
    pageName: "Two"
  },
  {
    id: "5:6",
    name: "Bravo",
    type: "INSTANCE",
    pageId: "0:1",
    pageName: "One"
  }
];

describe("resolved view state", () => {
  it("keeps selection resolution in Input until the user switches views", () => {
    const resolved = confirmResolvedRows("1:2\n3:4", nodes, false);
    assert.equal(resolved.view, "input");
    assert.equal(switchResolvedView(resolved, "resolved").view, "resolved");
    assert.equal(
      switchResolvedView(createEmptyResolvedRowsState(), "resolved").view,
      "input"
    );
  });

  it("invalidates stale rows, checks, and resolved view after input changes", () => {
    const resolved = confirmResolvedRows("1:2", nodes, true);
    const invalidated = invalidateResolvedRows(resolved);
    assert.equal(invalidated.view, "input");
    assert.equal(invalidated.resolvedInput, null);
    assert.deepEqual(invalidated.nodes, []);
    assert.equal(invalidated.checkedNodeIds.size, 0);
  });

  it("reports checked, unchecked, and indeterminate header states", () => {
    assert.deepEqual(getHeaderCheckboxState(nodes, new Set(["1:2"])), {
      checked: false,
      indeterminate: true,
      selectedCount: 1
    });
    assert.equal(
      getHeaderCheckboxState(nodes, setAllRowsChecked(nodes, true)).checked,
      true
    );
    assert.equal(
      getHeaderCheckboxState(nodes, setAllRowsChecked(nodes, false))
        .selectedCount,
      0
    );
  });
});

describe("image export table state", () => {
  it("applies a bulk value only to checked rows and preserves other drafts", () => {
    const drafts = new Map<string, ExportDraft>([
      [
        "3:4",
        { ...createEmptyExportDraft(), category: "Keep me" }
      ]
    ]);
    const updated = applyBulkExportValue(
      drafts,
      nodes,
      new Set(["1:2", "5:6"]),
      "category",
      "Payments"
    );
    assert.equal(updated.get("1:2")?.category, "Payments");
    assert.equal(updated.get("5:6")?.category, "Payments");
    assert.equal(updated.get("3:4")?.category, "Keep me");
  });

  it("validates and exports checked Component rows in original paste order", () => {
    const drafts = new Map<string, ExportDraft>([
      ["1:2", { category: "Home", state: "Default", uxScenario: "" }],
      ["3:4", createEmptyExportDraft()],
      ["5:6", { category: "Home", state: "Error", uxScenario: "" }]
    ]);
    const result = buildImageExportRequest(
      "Component page",
      nodes,
      new Set(["1:2", "5:6"]),
      drafts
    );
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.deepEqual(
      result.request.records.map((record) => record.nodeId),
      ["1:2", "5:6"]
    );
  });

  it("requires only UX Scenario and omits blank optional UX fields", () => {
    const drafts = new Map<string, ExportDraft>([
      [
        "1:2",
        {
          category: "  ",
          state: "",
          uxScenario: "Guest checkout"
        }
      ],
      [
        "3:4",
        {
          category: "Payments",
          state: "Review",
          uxScenario: "Bulk payment"
        }
      ]
    ]);
    const result = buildImageExportRequest(
      "UX Key page",
      nodes,
      new Set(["1:2", "3:4"]),
      drafts
    );
    assert.equal(result.ok, true);
    if (!result.ok || result.request.exportType !== "UX Key page") {
      return;
    }
    assert.deepEqual(result.request.records, [
      {
        nodeId: "1:2",
        name: "Zulu",
        uxScenario: "Guest checkout"
      },
      {
        nodeId: "3:4",
        name: "Alpha",
        category: "Payments",
        state: "Review",
        uxScenario: "Bulk payment"
      }
    ]);
  });

  it("cycles Name sorting without changing export request order", () => {
    const ascending = getNextNameSort("original");
    const descending = getNextNameSort(ascending);
    assert.equal(getNextNameSort(descending), "original");
    assert.deepEqual(
      sortNodesByName(nodes, ascending).map((node) => node.name),
      ["Alpha", "Bravo", "Zulu"]
    );
    assert.deepEqual(
      sortNodesByName(nodes, descending).map((node) => node.name),
      ["Zulu", "Bravo", "Alpha"]
    );

    const drafts = new Map(
      nodes.map(
        (node) =>
          [
            node.id,
            { category: "C", state: "S", uxScenario: "" }
          ] as const
      )
    );
    const result = buildImageExportRequest(
      "Component page",
      nodes,
      setAllRowsChecked(nodes, true),
      drafts
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(
        result.request.records.map((record) => record.nodeId),
        ["1:2", "3:4", "5:6"]
      );
    }
  });

  it("does not validate unchecked rows but fails a checked required field", () => {
    const drafts = new Map<string, ExportDraft>([
      ["1:2", { category: "Home", state: "", uxScenario: "" }],
      ["3:4", createEmptyExportDraft()]
    ]);
    const component = buildImageExportRequest(
      "Component page",
      nodes,
      new Set(["1:2"]),
      drafts
    );
    assert.deepEqual(component, {
      ok: false,
      reason: "required-field",
      originalIndex: 0,
      nodeId: "1:2",
      field: "state",
      label: "State"
    });

    const ux = buildImageExportRequest(
      "UX Key page",
      nodes,
      new Set(["3:4"]),
      drafts
    );
    assert.equal(ux.ok, false);
    if (!ux.ok) {
      assert.equal(ux.reason, "required-field");
    }
  });
});
