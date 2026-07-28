import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isImageExportRequest,
  isUiToPluginMessage
} from "../src/shared/types";

describe("image export request validation", () => {
  it("accepts Component page records with required human-entered fields", () => {
    const value = {
      type: "export-images",
      exportType: "Component page",
      records: [
        {
          nodeId: "5392:134853",
          name: "Home Page/Batch-1/L2",
          category: "Homepage",
          state: "Default"
        }
      ]
    };
    assert.equal(isImageExportRequest(value), true);
    assert.equal(isUiToPluginMessage(value), true);
  });

  it("accepts UX Key page records and instance-context IDs", () => {
    assert.equal(
      isUiToPluginMessage({
        type: "export-images",
        exportType: "UX Key page",
        records: [
          {
            nodeId: "I6003:47907;6003:40969",
            name: "批量付款",
            category: "Payments",
            state: "Review",
            uxScenario: "Bulk disbursement"
          }
        ]
      }),
      true
    );
  });

  it("accepts UX Key records when optional Category and State are omitted", () => {
    assert.equal(
      isUiToPluginMessage({
        type: "export-images",
        exportType: "UX Key page",
        records: [
          {
            nodeId: "1:2",
            name: "Checkout",
            uxScenario: "Guest checkout"
          }
        ]
      }),
      true
    );
  });

  it("rejects blank optional UX fields when they are present", () => {
    for (const value of [
      {
        type: "export-images",
        exportType: "UX Key page",
        records: [
          {
            nodeId: "1:2",
            name: "Checkout",
            category: "",
            uxScenario: "Guest checkout"
          }
        ]
      },
      {
        type: "export-images",
        exportType: "UX Key page",
        records: [
          {
            nodeId: "1:2",
            name: "Checkout",
            state: "   ",
            uxScenario: "Guest checkout"
          }
        ]
      },
      {
        type: "export-images",
        exportType: "UX Key page",
        records: [
          {
            nodeId: "1:2",
            name: "Checkout",
            category: undefined,
            uxScenario: "Guest checkout"
          }
        ]
      }
    ]) {
      assert.equal(isUiToPluginMessage(value), false);
    }
  });

  it("rejects missing, empty, and whitespace-only conditional fields", () => {
    for (const value of [
      {
        type: "export-images",
        exportType: "Component page",
        records: [
          { nodeId: "1:2", name: "A", category: "", state: "Default" }
        ]
      },
      {
        type: "export-images",
        exportType: "Component page",
        records: [
          { nodeId: "1:2", name: "A", category: "Home", state: "   " }
        ]
      },
      {
        type: "export-images",
        exportType: "UX Key page",
        records: [{ nodeId: "1:2", name: "A" }]
      }
    ]) {
      assert.equal(isUiToPluginMessage(value), false);
    }
  });

  it("rejects fields belonging to the other export type", () => {
    assert.equal(
      isUiToPluginMessage({
        type: "export-images",
        exportType: "UX Key page",
        records: [
          {
            nodeId: "1:2",
            name: "A",
            category: "Home",
            state: "Default"
          }
        ]
      }),
      false
    );
  });

  it("rejects duplicate Node IDs instead of choosing one silently", () => {
    assert.equal(
      isUiToPluginMessage({
        type: "export-images",
        exportType: "UX Key page",
        records: [
          { nodeId: "1:2", name: "A", uxScenario: "First" },
          { nodeId: "1:2", name: "B", uxScenario: "Second" }
        ]
      }),
      false
    );
  });

  it("rejects empty batches and malformed export messages", () => {
    for (const value of [
      { type: "export-images", exportType: "Component page", records: [] },
      { type: "export-images", exportType: "Unknown", records: [] },
      { type: "export-images", exportType: "UX Key page", records: "1:2" },
      {
        type: "export-images",
        exportType: "UX Key page",
        records: [
          { nodeId: "not-an-id", name: "A", uxScenario: "Checkout" }
        ]
      },
      {
        type: "export-images",
        exportType: "UX Key page",
        records: [
          { nodeId: "1:2", name: "A", uxScenario: "Checkout", extra: true }
        ]
      }
    ]) {
      assert.equal(isUiToPluginMessage(value), false);
    }
  });
});
