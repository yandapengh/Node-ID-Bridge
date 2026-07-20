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
    const results = await Promise.all(
      ids.map(async (id) => ({ id, node: await figma.getNodeByIdAsync(id) }))
    );
    const missingIds = results
      .filter((result) => result.node === null)
      .map((result) => result.id);

    if (missingIds.length > 0) {
      postToUi({
        type: "select-error",
        message: `Not found or deleted: ${missingIds.join(", ")}. Nothing was selected.`
      });
      return;
    }

    const nonSceneIds = results
      .filter(
        (result) => result.node !== null && !isSceneNode(result.node)
      )
      .map((result) => result.id);

    if (nonSceneIds.length > 0) {
      postToUi({
        type: "select-error",
        message: `Not selectable canvas nodes: ${nonSceneIds.join(", ")}. Nothing was selected.`
      });
      return;
    }

    const resolvedNodes = results.map((result) => result.node as SceneNode);
    const nodesWithPages: Array<{ node: SceneNode; page: PageNode }> = [];

    for (const node of resolvedNodes) {
      const page = getContainingPage(node);
      if (page === null) {
        postToUi({
          type: "select-error",
          message: `Could not determine the page for node ${node.id}. Nothing was selected.`
        });
        return;
      }
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
      const pages: PageSelectionSummary[] = [...pageGroups.values()].map(
        (group) => ({
          pageId: group.page.id,
          pageName: group.page.name,
          count: group.nodes.length
        })
      );
      postToUi({ type: "select-cross-page", pages });
      return;
    }

    const group = pageGroups.values().next().value;
    if (group === undefined) {
      postToUi({
        type: "select-error",
        message: "No selectable nodes were resolved. Nothing was selected."
      });
      return;
    }

    if (figma.currentPage.id !== group.page.id) {
      await figma.setCurrentPageAsync(group.page);
    }

    figma.currentPage.selection = group.nodes;
    figma.viewport.scrollAndZoomIntoView(group.nodes);
    postToUi({
      type: "select-success",
      count: group.nodes.length,
      pageName: group.page.name
    });
  } catch (error: unknown) {
    const detail = error instanceof Error ? ` ${error.message}` : "";
    postToUi({
      type: "select-error",
      message: `Figma could not complete the node lookup.${detail}`
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

  await selectNodesFromInput(message.input);
};
