const NODE_ID_PATTERN = /I\d+[:-]\d+(?:;\d+[:-]\d+)+|\d+[:-]\d+/g;
const EXACT_NODE_ID_PATTERN =
  /^(?:I\d+[:-]\d+(?:;\d+[:-]\d+)+|\d+[:-]\d+)$/;

export function isNodeId(value: unknown): value is string {
  return typeof value === "string" && EXACT_NODE_ID_PATTERN.test(value);
}

export function parseNodeIds(input: string): string[] {
  const matches = input.match(NODE_ID_PATTERN) ?? [];
  const uniqueIds = new Set<string>();

  for (const match of matches) {
    uniqueIds.add(match.replace(/-/g, ":"));
  }

  return [...uniqueIds];
}
