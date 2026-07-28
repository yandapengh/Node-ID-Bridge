import { isNodeId } from "./parse-node-ids";

export type NodeReference = {
  id: string;
  name: string;
  type: string;
  pageId: string;
  pageName: string;
};

export type CopyFormat = "compact" | "json";

export type SerializeSelectionOptions = {
  format: CopyFormat;
  includeNames: boolean;
};

export type PageSelectionSummary = {
  pageId: string;
  pageName: string;
  count: number;
};

export type ExportType = "Component page" | "UX Key page";

export type ComponentExportRequestRecord = {
  nodeId: string;
  name: string;
  category: string;
  state: string;
};

export type UxKeyExportRequestRecord = {
  nodeId: string;
  name: string;
  category?: string;
  state?: string;
  uxScenario: string;
};

export type ResolveExportNodesRequest = {
  type: "resolve-export-nodes";
  input: string;
};

export type ImageExportRequest =
  | {
      type: "export-images";
      exportType: "Component page";
      records: ComponentExportRequestRecord[];
    }
  | {
      type: "export-images";
      exportType: "UX Key page";
      records: UxKeyExportRequestRecord[];
    };

export type ComponentManifestRecord = {
  nodeId: string;
  name: string;
  type: "Component page";
  category: string;
  state: string;
  imagePath: string;
};

export type UxKeyManifestRecord = {
  nodeId: string;
  name: string;
  type: "UX Key page";
  category?: string;
  state?: string;
  uxScenario: string;
  imagePath: string;
};

export type ExportManifestRecord =
  | ComponentManifestRecord
  | UxKeyManifestRecord;

export type ExportManifest = {
  schemaVersion: 2;
  batchId: string;
  exportType: ExportType;
  exportedAt: string;
  pngScale: 1;
  records: ExportManifestRecord[];
};

export type ExportedPng = {
  nodeId: string;
  imagePath: string;
  bytes: Uint8Array;
};

export type ExportItemStatusMessage = {
  type: "export-item-status";
  batchId: string;
  nodeId: string;
  status: "exporting" | "exported";
  actualName?: string;
  warning?: string;
};

export type ExportSuccessMessage = {
  type: "export-success";
  manifest: ExportManifest;
  images: ExportedPng[];
};

export type ExportErrorMessage = {
  type: "export-error";
  batchId: string;
  message: string;
  nodeId?: string;
};

export type UiToPluginMessage =
  | { type: "read-selection" }
  | { type: "select-nodes"; input: string }
  | { type: "focus-node"; id: string }
  | { type: "apply-selection"; ids: string[] }
  | ResolveExportNodesRequest
  | ImageExportRequest;

export type PluginToUiMessage =
  | { type: "selection-result"; nodes: NodeReference[] }
  | { type: "selection-read-error"; message: string }
  | {
      type: "select-success";
      count: number;
      pageName: string;
      nodes: NodeReference[];
    }
  | { type: "select-cross-page"; pages: PageSelectionSummary[] }
  | { type: "select-error"; message: string }
  | { type: "focus-node-success"; id: string; pageName: string }
  | { type: "focus-node-error"; id: string; message: string }
  | { type: "apply-selection-success"; count: number; pageName: string }
  | { type: "apply-selection-error"; message: string }
  | { type: "resolve-export-nodes-success"; nodes: NodeReference[] }
  | { type: "resolve-export-nodes-error"; message: string }
  | ExportItemStatusMessage
  | ExportSuccessMessage
  | ExportErrorMessage;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[]
): boolean {
  const actualKeys = Object.keys(value).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();
  return (
    actualKeys.length === sortedExpectedKeys.length &&
    actualKeys.every((key, index) => key === sortedExpectedKeys[index])
  );
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isComponentExportRecord(
  value: unknown
): value is ComponentExportRequestRecord {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["nodeId", "name", "category", "state"]) &&
    isNodeId(value.nodeId) &&
    typeof value.name === "string" &&
    isNonBlankString(value.category) &&
    isNonBlankString(value.state)
  );
}

function isUxKeyExportRecord(
  value: unknown
): value is UxKeyExportRequestRecord {
  const requiredKeys = ["nodeId", "name", "uxScenario"];
  const allowedKeys = new Set([...requiredKeys, "category", "state"]);
  return (
    isRecord(value) &&
    requiredKeys.every((key) =>
      Object.prototype.hasOwnProperty.call(value, key)
    ) &&
    Object.keys(value).every((key) => allowedKeys.has(key)) &&
    isNodeId(value.nodeId) &&
    typeof value.name === "string" &&
    (!Object.prototype.hasOwnProperty.call(value, "category") ||
      isNonBlankString(value.category)) &&
    (!Object.prototype.hasOwnProperty.call(value, "state") ||
      isNonBlankString(value.state)) &&
    isNonBlankString(value.uxScenario)
  );
}

export function isImageExportRequest(
  value: unknown
): value is ImageExportRequest {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["type", "exportType", "records"]) ||
    value.type !== "export-images" ||
    !Array.isArray(value.records) ||
    value.records.length === 0
  ) {
    return false;
  }

  const recordsAreValid =
    value.exportType === "Component page"
      ? value.records.every(isComponentExportRecord)
      : value.exportType === "UX Key page"
        ? value.records.every(isUxKeyExportRecord)
        : false;

  if (!recordsAreValid) {
    return false;
  }

  const nodeIds = value.records.map((record) => record.nodeId);
  return new Set(nodeIds).size === nodeIds.length;
}

export function isUiToPluginMessage(value: unknown): value is UiToPluginMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const message = value as {
    type?: unknown;
    input?: unknown;
    id?: unknown;
    ids?: unknown;
  };

  if (message.type === "read-selection") {
    return true;
  }

  if (message.type === "select-nodes") {
    return typeof message.input === "string";
  }

  if (message.type === "focus-node") {
    return isNodeId(message.id);
  }

  if (message.type === "apply-selection") {
    return Array.isArray(message.ids) && message.ids.every(isNodeId);
  }

  if (message.type === "resolve-export-nodes") {
    return (
      isRecord(value) &&
      hasExactKeys(value, ["type", "input"]) &&
      typeof message.input === "string"
    );
  }

  return isImageExportRequest(value);
}
