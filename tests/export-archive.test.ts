import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { strFromU8, unzipSync } from "fflate";

import { createExportZip } from "../src/shared/export-archive";
import type { ExportSuccessMessage } from "../src/shared/types";

describe("createExportZip", () => {
  it("writes only PNGs and one manifest under the target input directory", () => {
    const imagePath =
      "input/Component page/5392-134853__Home Page-Batch-1-L2.png";
    const message: ExportSuccessMessage = {
      type: "export-success",
      manifest: {
        schemaVersion: 2,
        batchId: "component-page-20260727T163012123Z",
        exportType: "Component page",
        exportedAt: "2026-07-27T16:30:12.123Z",
        pngScale: 1,
        records: [
          {
            nodeId: "5392:134853",
            name: "Home Page/Batch-1/L2",
            type: "Component page",
            category: "首页",
            state: "默认",
            imagePath
          }
        ]
      },
      images: [
        {
          nodeId: "5392:134853",
          imagePath,
          bytes: Uint8Array.from([137, 80, 78, 71])
        }
      ]
    };

    const entries = unzipSync(createExportZip(message));
    assert.deepEqual(Object.keys(entries).sort(), [
      imagePath,
      "input/Component page/manifest--component-page--20260727T163012123Z.json"
    ]);
    assert.deepEqual(
      Array.from(entries[imagePath] ?? []),
      [137, 80, 78, 71]
    );

    const manifestBytes =
      entries[
        "input/Component page/manifest--component-page--20260727T163012123Z.json"
      ];
    assert.notEqual(manifestBytes, undefined);
    const manifest = JSON.parse(strFromU8(manifestBytes!));
    assert.deepEqual(manifest, message.manifest);
    assert.equal(manifest.records[0]?.imagePath, imagePath);
  });

  it("rejects a success payload whose PNG does not match its manifest", () => {
    const message: ExportSuccessMessage = {
      type: "export-success",
      manifest: {
        schemaVersion: 2,
        batchId: "ux-key-page-20260727T163500456Z",
        exportType: "UX Key page",
        exportedAt: "2026-07-27T16:35:00.456Z",
        pngScale: 1,
        records: [
          {
            nodeId: "5599:169576",
            name: "Home",
            type: "UX Key page",
            uxScenario: "Bulk disbursement",
            imagePath: "input/UX Key page/5599-169576__Home.png"
          }
        ]
      },
      images: [
        {
          nodeId: "other:node",
          imagePath: "input/UX Key page/other-node__Home.png",
          bytes: Uint8Array.from([1])
        }
      ]
    };

    assert.throws(() => createExportZip(message), /does not match/);
  });

  it("rejects manifest image paths outside the selected export directory", () => {
    const imagePath = "input/UX Key page/../escaped.png";
    const message: ExportSuccessMessage = {
      type: "export-success",
      manifest: {
        schemaVersion: 2,
        batchId: "ux-key-page-20260727T163500456Z",
        exportType: "UX Key page",
        exportedAt: "2026-07-27T16:35:00.456Z",
        pngScale: 1,
        records: [
          {
            nodeId: "5599:169576",
            name: "Home",
            type: "UX Key page",
            uxScenario: "Bulk disbursement",
            imagePath
          }
        ]
      },
      images: [
        {
          nodeId: "5599:169576",
          imagePath,
          bytes: Uint8Array.from([1])
        }
      ]
    };

    assert.throws(() => createExportZip(message), /outside/);
  });
});
