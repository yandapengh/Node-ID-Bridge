import type { ExportType } from "./types";

const EXPORT_TYPE_DETAILS: Record<
  ExportType,
  { slug: string; directory: string }
> = {
  "Component page": {
    slug: "component-page",
    directory: "input/Component page"
  },
  "UX Key page": {
    slug: "ux-key-page",
    directory: "input/UX Key page"
  }
};

export type ExportBatchIdentity = {
  batchId: string;
  exportedAt: string;
  timestamp: string;
};

export function sanitizeNodeIdForFilename(nodeId: string): string {
  return (
    nodeId
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "node"
  );
}

export function sanitizeNameForFilename(name: string): string {
  const replaced = name
    .replace(/[\/\\:*?"<>|\u0000-\u001F\u007F]+/g, "-")
    .replace(/\s+/gu, " ");
  const trimmed = replaced.replace(/^[ .-]+|[ .-]+$/gu, "");
  const truncated = Array.from(trimmed).slice(0, 100).join("");
  return truncated.replace(/[ .-]+$/gu, "") || "Untitled";
}

export function getExportTypeSlug(exportType: ExportType): string {
  return EXPORT_TYPE_DETAILS[exportType].slug;
}

export function getExportDirectory(exportType: ExportType): string {
  return EXPORT_TYPE_DETAILS[exportType].directory;
}

export function formatExportTimestamp(date: Date): string {
  return date.toISOString().replace(/[-:.]/g, "");
}

export function createExportBatchIdentity(
  exportType: ExportType,
  date: Date
): ExportBatchIdentity {
  const exportedAt = date.toISOString();
  const timestamp = formatExportTimestamp(date);
  return {
    batchId: `${getExportTypeSlug(exportType)}-${timestamp}`,
    exportedAt,
    timestamp
  };
}

export function createPngImagePath(
  exportType: ExportType,
  nodeId: string,
  name: string
): string {
  const filename = `${sanitizeNodeIdForFilename(nodeId)}__${sanitizeNameForFilename(name)}.png`;
  return `${getExportDirectory(exportType)}/${filename}`;
}

export function createManifestPath(
  exportType: ExportType,
  exportedAt: string
): string {
  const timestamp = formatExportTimestamp(new Date(exportedAt));
  return `${getExportDirectory(exportType)}/manifest--${getExportTypeSlug(exportType)}--${timestamp}.json`;
}

export function createZipFilename(batchId: string): string {
  return `${batchId}.zip`;
}
