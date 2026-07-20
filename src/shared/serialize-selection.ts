import type {
  NodeReference,
  SerializeSelectionOptions
} from "./types";

export function serializeSelection(
  nodes: readonly NodeReference[],
  options: SerializeSelectionOptions
): string {
  if (nodes.length === 0) {
    return "";
  }

  if (options.format === "compact") {
    return nodes
      .map((node) =>
        options.includeNames ? `${node.id} | ${node.name}` : node.id
      )
      .join("\n");
  }

  const values: Array<string | { id: string; name: string }> = nodes.map(
    (node) =>
      options.includeNames ? { id: node.id, name: node.name } : node.id
  );

  return JSON.stringify(values.length === 1 ? values[0] : values);
}
