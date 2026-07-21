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

export type UiToPluginMessage =
  | { type: "read-selection" }
  | { type: "select-nodes"; input: string }
  | { type: "focus-node"; id: string }
  | { type: "apply-selection"; ids: string[] };

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
  | { type: "apply-selection-error"; message: string };

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

  return (
    message.type === "apply-selection" &&
    Array.isArray(message.ids) &&
    message.ids.every(isNodeId)
  );
}
