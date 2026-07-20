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
  | { type: "select-nodes"; input: string };

export type PluginToUiMessage =
  | { type: "selection-result"; nodes: NodeReference[] }
  | { type: "selection-read-error"; message: string }
  | { type: "select-success"; count: number; pageName: string }
  | { type: "select-cross-page"; pages: PageSelectionSummary[] }
  | { type: "select-error"; message: string };

export function isUiToPluginMessage(value: unknown): value is UiToPluginMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const message = value as { type?: unknown; input?: unknown };

  if (message.type === "read-selection") {
    return true;
  }

  return message.type === "select-nodes" && typeof message.input === "string";
}
