import { parseNodeIds } from "./shared/parse-node-ids";
import type {
  NodeReference,
  PageSelectionSummary,
  PluginToUiMessage
} from "./shared/types";
import { isUiToPluginMessage } from "./shared/types";

declare const __html__: string;

figma.showUI(__html__, {
  width: 480,
  height: 680,
  themeColors: true
});

function postToUi(message: PluginToUiMessage): void {
  figma.ui.postMessage(message);
}

function isSceneNode(node: BaseNode): node is SceneNode {
  return node.type !== "DOCUMENT" && node.type !== "PAGE";
}

function getContainingPage(node: SceneNode): PageNode | null {
  let ancestor: BaseNode | null = node.parent;

  while (ancestor !== null) {
    if (ancestor.type === "PAGE") {
      return ancestor;
    }
    ancestor = ancestor.parent;
  }

  return null;
}

function readCurrentSelection(): void {
  const page = figma.currentPage;
  const nodes: NodeReference[] = page.selection.map((node) => ({
    id: node.id,
    name: node.name,
    type: node.type,
    pageId: page.id,
    pageName: page.name
  }));

  postToUi({ type: "selection-result", nodes });
}

type ResolvedSelection = {
  nodes: SceneNode[];
  page: PageNode;
  references: NodeReference[];
};

type ResolutionResult =
  | { ok: true; selection: ResolvedSelection }
  | {
      ok: false;
      message: string;
      pages?: PageSelectionSummary[];
    };

async function resolveNodes(ids: readonly string[]): Promise<ResolutionResult> {
  if (ids.length === 0) {
    return {
      ok: false,
      message: "No Figma node IDs were provided. Nothing was selected."
    };
  }

  const results = await Promise.all(
    ids.map(async (id) => ({ id, node: await figma.getNodeByIdAsync(id) }))
  );
  const missingIds = results
    .filter((result) => result.node === null)
    .map((result) => result.id);

  if (missingIds.length > 0) {
    return {
      ok: false,
      message: `Not found or deleted: ${missingIds.join(", ")}. Nothing was selected.`
    };
  }

  const nonSceneIds = results
    .filter((result) => result.node !== null && !isSceneNode(result.node))
    .map((result) => result.id);

  if (nonSceneIds.length > 0) {
    return {
      ok: false,
      message: `Not selectable canvas nodes: ${nonSceneIds.join(", ")}. Nothing was selected.`
    };
  }

  const nodesWithPages: Array<{ node: SceneNode; page: PageNode }> = [];
  const seenNodeIds = new Set<string>();

  for (const result of results) {
    const node = result.node as SceneNode;
    if (seenNodeIds.has(node.id)) {
      continue;
    }

    const page = getContainingPage(node);
    if (page === null) {
      return {
        ok: false,
        message: `Could not determine the page for node ${node.id}. Nothing was selected.`
      };
    }
    seenNodeIds.add(node.id);
    nodesWithPages.push({ node, page });
  }

  const pageGroups = new Map<
    string,
    { page: PageNode; nodes: SceneNode[] }
  >();

  for (const item of nodesWithPages) {
    const group = pageGroups.get(item.page.id);
    if (group === undefined) {
      pageGroups.set(item.page.id, { page: item.page, nodes: [item.node] });
    } else {
      group.nodes.push(item.node);
    }
  }

  if (pageGroups.size > 1) {
    return {
      ok: false,
      message: "Nodes belong to more than one page. Nothing was selected.",
      pages: [...pageGroups.values()].map((group) => ({
        pageId: group.page.id,
        pageName: group.page.name,
        count: group.nodes.length
      }))
    };
  }

  const group = pageGroups.values().next().value;
  if (group === undefined) {
    return {
      ok: false,
      message: "No selectable nodes were resolved. Nothing was selected."
    };
  }

  return {
    ok: true,
    selection: {
      nodes: group.nodes,
      page: group.page,
      references: group.nodes.map((node) => ({
        id: node.id,
        name: node.name,
        type: node.type,
        pageId: group.page.id,
        pageName: group.page.name
      }))
    }
  };
}

async function applyResolvedSelection(
  selection: ResolvedSelection
): Promise<void> {
  if (figma.currentPage.id !== selection.page.id) {
    await figma.setCurrentPageAsync(selection.page);
  }

  figma.currentPage.selection = selection.nodes;
  figma.viewport.scrollAndZoomIntoView(selection.nodes);
}

function formatCrossPageMessage(pages: readonly PageSelectionSummary[]): string {
  const pageDetails = pages
    .map(
      (page) =>
        `${page.pageName}: ${page.count} node${page.count === 1 ? "" : "s"}`
    )
    .join("; ");
  return `Cannot select across pages. ${pageDetails}. Nothing was selected.`;
}

async function selectNodesFromInput(input: string): Promise<void> {
  const ids = parseNodeIds(input);

  if (ids.length === 0) {
    postToUi({
      type: "select-error",
      message: "No Figma node IDs were found. The input was left unchanged."
    });
    return;
  }

  try {
    const result = await resolveNodes(ids);
    if (!result.ok) {
      if (result.pages !== undefined) {
        postToUi({ type: "select-cross-page", pages: result.pages });
      } else {
        postToUi({ type: "select-error", message: result.message });
      }
      return;
    }

    await applyResolvedSelection(result.selection);
    postToUi({
      type: "select-success",
      count: result.selection.nodes.length,
      pageName: result.selection.page.name,
      nodes: result.selection.references
    });
  } catch (error: unknown) {
    const detail = error instanceof Error ? ` ${error.message}` : "";
    postToUi({
      type: "select-error",
      message: `Figma could not complete the node lookup.${detail}`
    });
  }
}

async function focusNode(id: string): Promise<void> {
  try {
    const parsedIds = parseNodeIds(id);
    if (parsedIds.length !== 1 || parsedIds[0] !== id) {
      postToUi({
        type: "focus-node-error",
        id,
        message: "The requested node ID is invalid. The selection was not changed."
      });
      return;
    }

    const result = await resolveNodes(parsedIds);
    if (!result.ok) {
      postToUi({ type: "focus-node-error", id, message: result.message });
      return;
    }

    await applyResolvedSelection(result.selection);
    postToUi({
      type: "focus-node-success",
      id,
      pageName: result.selection.page.name
    });
  } catch (error: unknown) {
    const detail = error instanceof Error ? ` ${error.message}` : "";
    postToUi({
      type: "focus-node-error",
      id,
      message: `Figma could not focus this node.${detail}`
    });
  }
}

async function applySelection(ids: readonly string[]): Promise<void> {
  try {
    const parsedIds = parseNodeIds(ids.join("\n"));
    const idsAreValid =
      parsedIds.length === ids.length &&
      parsedIds.every((id, index) => id === ids[index]);

    if (!idsAreValid) {
      postToUi({
        type: "apply-selection-error",
        message: "One or more requested node IDs are invalid. Nothing was selected."
      });
      return;
    }

    const result = await resolveNodes(parsedIds);
    if (!result.ok) {
      postToUi({
        type: "apply-selection-error",
        message:
          result.pages === undefined
            ? result.message
            : formatCrossPageMessage(result.pages)
      });
      return;
    }

    await applyResolvedSelection(result.selection);
    postToUi({
      type: "apply-selection-success",
      count: result.selection.nodes.length,
      pageName: result.selection.page.name
    });
  } catch (error: unknown) {
    const detail = error instanceof Error ? ` ${error.message}` : "";
    postToUi({
      type: "apply-selection-error",
      message: `Figma could not apply the selection.${detail}`
    });
  }
}

figma.ui.onmessage = async (message: unknown): Promise<void> => {
  if (!isUiToPluginMessage(message)) {
    postToUi({
      type: "select-error",
      message: "The plugin received an unrecognized request."
    });
    return;
  }

  if (message.type === "read-selection") {
    try {
      readCurrentSelection();
    } catch (error: unknown) {
      const detail = error instanceof Error ? ` ${error.message}` : "";
      postToUi({
        type: "selection-read-error",
        message: `Could not read the current selection.${detail}`
      });
    }
    return;
  }

  if (message.type === "select-nodes") {
    await selectNodesFromInput(message.input);
    return;
  }

  if (message.type === "focus-node") {
    await focusNode(message.id);
    return;
  }

  await applySelection(message.ids);
};
