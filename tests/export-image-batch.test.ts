import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  exportImageBatch,
  type ExportableFigmaNode,
  type PngExportSettings
} from "../src/shared/export-batch";
import type {
  ExportItemStatusMessage,
  ImageExportRequest
} from "../src/shared/types";

const exportedAt = new Date("2026-07-27T16:30:12.123Z");

describe("exportImageBatch", () => {
  it("re-fetches every Node ID, exports PNG 1x, and uses the actual name", async () => {
    const lookups: string[] = [];
    const settings: PngExportSettings[] = [];
    const statuses: ExportItemStatusMessage[] = [];
    const nodes = new Map<string, ExportableFigmaNode>([
      [
        "259:54127",
        {
          id: "259:54127",
          name: "状态=1/Splash",
          async exportAsync(value) {
            settings.push(value);
            return Uint8Array.from([1, 2, 3]);
          }
        }
      ],
      [
        "5444:127635",
        {
          id: "5444:127635",
          name: "2-welcome",
          async exportAsync(value) {
            settings.push(value);
            return Uint8Array.from([4, 5, 6]);
          }
        }
      ]
    ]);
    const request: ImageExportRequest = {
      type: "export-images",
      exportType: "Component page",
      records: [
        {
          nodeId: "259:54127",
          name: "Old Splash",
          category: "Splash",
          state: "Loading"
        },
        {
          nodeId: "5444:127635",
          name: "2-welcome",
          category: "Onboarding",
          state: "Default"
        }
      ]
    };

    const result = await exportImageBatch(request, {
      now: () => exportedAt,
      async getNodeByIdAsync(id) {
        lookups.push(id);
        return nodes.get(id) ?? null;
      },
      onItemStatus(message) {
        statuses.push(message);
      }
    });

    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.deepEqual(lookups, ["259:54127", "5444:127635"]);
    assert.deepEqual(settings, [
      { format: "PNG", constraint: { type: "SCALE", value: 1 } },
      { format: "PNG", constraint: { type: "SCALE", value: 1 } }
    ]);
    assert.equal(
      result.message.manifest.batchId,
      "component-page-20260727T163012123Z"
    );
    assert.equal(result.message.manifest.schemaVersion, 2);
    assert.equal(result.message.manifest.pngScale, 1);
    assert.deepEqual(result.message.manifest.records[0], {
      nodeId: "259:54127",
      name: "状态=1/Splash",
      type: "Component page",
      category: "Splash",
      state: "Loading",
      imagePath:
        "input/Component page/259-54127__状态=1-Splash.png"
    });
    assert.equal(result.message.images.length, 2);
    assert.equal(statuses.length, 4);
    assert.equal(statuses[0]?.status, "exporting");
    assert.equal(statuses[1]?.status, "exported");
    assert.match(statuses[1]?.warning ?? "", /Name changed/);
  });

  it("cancels the whole batch when a node is missing", async () => {
    const request: ImageExportRequest = {
      type: "export-images",
      exportType: "UX Key page",
      records: [
        {
          nodeId: "5599:169576",
          name: "Home",
          uxScenario: "Bulk disbursement"
        }
      ]
    };
    const result = await exportImageBatch(request, {
      now: () => exportedAt,
      async getNodeByIdAsync() {
        return null;
      }
    });

    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }
    assert.equal(result.message.nodeId, "5599:169576");
    assert.match(result.message.message, /whole batch was cancelled/i);
    assert.match(result.message.message, /no ZIP was downloaded/i);
  });

  it("creates the conditional UX Key page manifest record", async () => {
    const request: ImageExportRequest = {
      type: "export-images",
      exportType: "UX Key page",
      records: [
        {
          nodeId: "5599:169576",
          name: "Home Page/Batch-1/L2",
          category: "Payments",
          state: "Review",
          uxScenario: "Bulk disbursement"
        }
      ]
    };
    const result = await exportImageBatch(request, {
      now: () => new Date("2026-07-27T16:35:00.456Z"),
      async getNodeByIdAsync(id) {
        return {
          id,
          name: "Home Page/Batch-1/L2",
          async exportAsync() {
            return Uint8Array.from([137, 80, 78, 71]);
          }
        };
      }
    });

    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.deepEqual(result.message.manifest.records[0], {
      nodeId: "5599:169576",
      name: "Home Page/Batch-1/L2",
      type: "UX Key page",
      category: "Payments",
      state: "Review",
      uxScenario: "Bulk disbursement",
      imagePath:
        "input/UX Key page/5599-169576__Home Page-Batch-1-L2.png"
    });
  });

  it("returns only a batch failure when one PNG export throws", async () => {
    const statuses: ExportItemStatusMessage[] = [];
    const request: ImageExportRequest = {
      type: "export-images",
      exportType: "UX Key page",
      records: [
        { nodeId: "1:2", name: "First", uxScenario: "First flow" },
        { nodeId: "3:4", name: "Second", uxScenario: "Second flow" }
      ]
    };
    const result = await exportImageBatch(request, {
      now: () => exportedAt,
      async getNodeByIdAsync(id) {
        return {
          id,
          name: id === "1:2" ? "First" : "Second",
          async exportAsync() {
            if (id === "3:4") {
              throw new Error("Renderer unavailable");
            }
            return Uint8Array.from([137, 80, 78, 71]);
          }
        };
      },
      onItemStatus(message) {
        statuses.push(message);
      }
    });

    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }
    assert.equal(result.message.nodeId, "3:4");
    assert.match(result.message.message, /Renderer unavailable/);
    assert.deepEqual(
      statuses.map((message) => [message.nodeId, message.status]),
      [
        ["1:2", "exporting"],
        ["1:2", "exported"],
        ["3:4", "exporting"]
      ]
    );
  });
});
