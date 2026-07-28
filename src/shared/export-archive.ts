import { strToU8, zipSync } from "fflate";

import {
  createManifestPath,
  getExportDirectory
} from "./export-format";
import type { ExportSuccessMessage } from "./types";

export function createExportZip(message: ExportSuccessMessage): Uint8Array {
  const { manifest, images } = message;
  if (
    manifest.records.length === 0 ||
    images.length !== manifest.records.length
  ) {
    throw new Error("The completed export does not contain one PNG per record.");
  }

  const entries: Record<string, Uint8Array> = {};
  const expectedDirectory = `${getExportDirectory(manifest.exportType)}/`;
  for (const record of manifest.records) {
    const relativeFilename = record.imagePath.slice(expectedDirectory.length);
    if (
      record.type !== manifest.exportType ||
      !record.imagePath.startsWith(expectedDirectory) ||
      relativeFilename.length === 0 ||
      relativeFilename.includes("/") ||
      !relativeFilename.endsWith(".png")
    ) {
      throw new Error(
        `Manifest image path is outside ${getExportDirectory(manifest.exportType)}: ${record.imagePath}.`
      );
    }
  }
  const recordKeys = new Set(
    manifest.records.map((record) => `${record.nodeId}\u0000${record.imagePath}`)
  );
  if (recordKeys.size !== manifest.records.length) {
    throw new Error("The manifest contains duplicate Node ID and image paths.");
  }

  for (const image of images) {
    const key = `${image.nodeId}\u0000${image.imagePath}`;
    if (!recordKeys.has(key)) {
      throw new Error(
        `PNG ${image.imagePath} does not match a manifest record.`
      );
    }
    if (entries[image.imagePath] !== undefined) {
      throw new Error(`Duplicate ZIP entry: ${image.imagePath}.`);
    }
    entries[image.imagePath] = image.bytes;
  }

  const manifestPath = createManifestPath(
    manifest.exportType,
    manifest.exportedAt
  );
  entries[manifestPath] = strToU8(`${JSON.stringify(manifest, null, 2)}\n`);
  return zipSync(entries, { level: 6 });
}
