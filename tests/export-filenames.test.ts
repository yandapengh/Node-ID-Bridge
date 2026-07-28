import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createManifestPath,
  createPngImagePath,
  createExportBatchIdentity,
  sanitizeNameForFilename,
  sanitizeNodeIdForFilename
} from "../src/shared/export-format";

describe("export filename formatting", () => {
  it("sanitizes ordinary and instance-context node IDs", () => {
    assert.equal(sanitizeNodeIdForFilename("259:54127"), "259-54127");
    assert.equal(
      sanitizeNodeIdForFilename("I6003:47907;6003:40969"),
      "I6003-47907-6003-40969"
    );
  });

  it("replaces unsafe name separators without removing readable characters", () => {
    assert.equal(
      sanitizeNameForFilename('Home Page/Batch\\1:L2*?"<>|'),
      "Home Page-Batch-1-L2"
    );
    assert.equal(sanitizeNameForFilename("状态=1 | 中文"), "状态=1 - 中文");
  });

  it("uses Untitled for an empty sanitized name", () => {
    assert.equal(sanitizeNameForFilename("  .--///||  "), "Untitled");
    assert.equal(sanitizeNameForFilename(""), "Untitled");
  });

  it("limits names to 100 Unicode characters without splitting characters", () => {
    const result = sanitizeNameForFilename(`${"界".repeat(99)}😀extra`);
    assert.equal(Array.from(result).length, 100);
    assert.equal(result.endsWith("😀"), true);
  });

  it("collapses repeated unsafe separators", () => {
    assert.equal(sanitizeNameForFilename("A///||\\\\B"), "A-B");
  });

  it("creates one PNG path even when the Figma name contains slashes", () => {
    assert.equal(
      createPngImagePath(
        "UX Key page",
        "5599:169576",
        "Home Page/Batch-1/L2"
      ),
      "input/UX Key page/5599-169576__Home Page-Batch-1-L2.png"
    );
  });

  it("creates stable batch, ZIP-manifest timestamp, and folder names", () => {
    const date = new Date("2026-07-27T16:30:12.123Z");
    const identity = createExportBatchIdentity("Component page", date);
    assert.deepEqual(identity, {
      batchId: "component-page-20260727T163012123Z",
      exportedAt: "2026-07-27T16:30:12.123Z",
      timestamp: "20260727T163012123Z"
    });
    assert.equal(
      createManifestPath("Component page", identity.exportedAt),
      "input/Component page/manifest--component-page--20260727T163012123Z.json"
    );
  });
});
