const NODE_ID_PATTERN = /I\d+[:-]\d+(?:;\d+[:-]\d+)+|\d+[:-]\d+/g;

export function parseNodeIds(input: string): string[] {
  const matches = input.match(NODE_ID_PATTERN) ?? [];
  const uniqueIds = new Set<string>();

  for (const match of matches) {
    uniqueIds.add(match.replace(/-/g, ":"));
  }

  return [...uniqueIds];
}
