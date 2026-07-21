import { parseNodeIds } from "../shared/parse-node-ids";
import { serializeSelection } from "../shared/serialize-selection";
import type {
  CopyFormat,
  NodeReference,
  PluginToUiMessage,
  UiToPluginMessage
} from "../shared/types";

type StatusTone = "neutral" | "success" | "error";

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (element === null) {
    throw new Error(`Missing UI element: ${id}`);
  }
  return element as T;
}

const readSelectionButton = getElement<HTMLButtonElement>("read-selection");
const selectionPreview = getElement<HTMLDivElement>("selection-preview");
const includeNamesInput = getElement<HTMLInputElement>("include-names");
const copyButton = getElement<HTMLButtonElement>("copy-selection");
const copyStatus = getElement<HTMLDivElement>("copy-status");
const nodeIdInput = getElement<HTMLTextAreaElement>("node-id-input");
const parseStatus = getElement<HTMLDivElement>("parse-status");
const selectNodesButton = getElement<HTMLButtonElement>("select-nodes");
const clearInputButton = getElement<HTMLButtonElement>("clear-input");
const parsedSelectionPanel = getElement<HTMLDivElement>(
  "parsed-selection-panel"
);
const parsedSelectionPreview = getElement<HTMLDivElement>(
  "parsed-selection-preview"
);
const checkedCount = getElement<HTMLSpanElement>("checked-count");
const selectAllButton = getElement<HTMLButtonElement>("select-all");
const clearAllButton = getElement<HTMLButtonElement>("clear-all");
const previousNodeButton = getElement<HTMLButtonElement>("previous-node");
const nextNodeButton = getElement<HTMLButtonElement>("next-node");
const copyParsedSelectionButton = getElement<HTMLButtonElement>(
  "copy-parsed-selection"
);
const applySelectionButton = getElement<HTMLButtonElement>("apply-selection");
const selectionActionStatus = getElement<HTMLDivElement>(
  "selection-action-status"
);

let selectedNodes: NodeReference[] = [];
let parsedNodes: NodeReference[] = [];
let checkedNodeIds = new Set<string>();
let focusedNodeIndex: number | null = null;
let pendingFocusId: string | null = null;
let hasPendingApply = false;
let isSelecting = false;
let isFocusing = false;
let isApplying = false;

function postToPlugin(message: UiToPluginMessage): void {
  parent.postMessage({ pluginMessage: message }, "*");
}

function setStatus(
  element: HTMLElement,
  message: string,
  tone: StatusTone
): void {
  element.textContent = message;
  element.dataset.tone = tone;
}

function renderSelection(nodes: readonly NodeReference[]): void {
  selectionPreview.replaceChildren();

  if (nodes.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.textContent =
      "No nodes are selected. Select one or more canvas nodes and read again.";
    selectionPreview.append(emptyState);
    return;
  }

  const header = document.createElement("div");
  header.className = "preview-header";
  header.setAttribute("aria-hidden", "true");

  for (const label of ["#", "Name", "Node ID", "Type"]) {
    const cell = document.createElement("span");
    cell.textContent = label;
    header.append(cell);
  }
  selectionPreview.append(header);

  nodes.forEach((node, index) => {
    const row = document.createElement("div");
    row.className = "preview-row";

    const indexCell = document.createElement("span");
    indexCell.className = "node-index";
    indexCell.textContent = String(index + 1);

    const nameCell = document.createElement("span");
    nameCell.className = "node-name";
    nameCell.textContent = node.name;
    nameCell.title = node.name;

    const idCell = document.createElement("span");
    idCell.className = "node-id";
    idCell.textContent = node.id;
    idCell.title = node.id;

    const typeCell = document.createElement("span");
    typeCell.className = "node-type";
    typeCell.textContent = node.type;
    typeCell.title = node.type;

    row.append(indexCell, nameCell, idCell, typeCell);
    selectionPreview.append(row);
  });
}

function getCopyFormat(): CopyFormat {
  const checkedInput = document.querySelector<HTMLInputElement>(
    'input[name="copy-format"]:checked'
  );
  return checkedInput?.value === "json" ? "json" : "compact";
}

function updateParseStatus(): void {
  const ids = parseNodeIds(nodeIdInput.value);
  selectNodesButton.disabled = ids.length === 0 || isSelecting;

  if (nodeIdInput.value.trim().length === 0) {
    setStatus(parseStatus, "No node IDs found yet.", "neutral");
  } else if (ids.length === 0) {
    setStatus(
      parseStatus,
      "No node IDs found. Check the input; your text has been kept.",
      "error"
    );
  } else {
    setStatus(
      parseStatus,
      `Found ${ids.length} unique node ID${ids.length === 1 ? "" : "s"}.`,
      "success"
    );
  }
}

function getCheckedNodes(): NodeReference[] {
  return parsedNodes.filter((node) => checkedNodeIds.has(node.id));
}

function updateInputAvailability(): void {
  const isBusy = isSelecting || isFocusing || isApplying;
  nodeIdInput.disabled = isBusy;
  clearInputButton.disabled = isBusy;
}

function updateParsedControls(): void {
  const selectedCount = checkedNodeIds.size;
  const hasNodes = parsedNodes.length > 0;
  const isBusy = isFocusing || isApplying;

  checkedCount.textContent = `${selectedCount} of ${parsedNodes.length} checked`;
  selectAllButton.disabled =
    !hasNodes || selectedCount === parsedNodes.length || isApplying;
  clearAllButton.disabled = !hasNodes || selectedCount === 0 || isApplying;
  copyParsedSelectionButton.disabled = selectedCount === 0 || isApplying;
  applySelectionButton.disabled = selectedCount === 0 || isBusy;
  previousNodeButton.disabled =
    !hasNodes || isBusy || focusedNodeIndex === 0;
  nextNodeButton.disabled =
    !hasNodes || isBusy || focusedNodeIndex === parsedNodes.length - 1;
  parsedSelectionPreview.setAttribute("aria-busy", String(isBusy));
  updateInputAvailability();
}

function scrollFocusedRowIntoView(): void {
  if (focusedNodeIndex === null) {
    return;
  }

  const focusedRow = parsedSelectionPreview.querySelector<HTMLElement>(
    `[data-node-index="${focusedNodeIndex}"]`
  );
  focusedRow?.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function renderParsedSelection(): void {
  parsedSelectionPreview.replaceChildren();

  parsedNodes.forEach((node, index) => {
    const row = document.createElement("div");
    const isFocused = index === focusedNodeIndex;
    row.className = `parsed-node-row${isFocused ? " is-focused" : ""}`;
    row.dataset.nodeIndex = String(index);
    row.setAttribute("role", "listitem");
    if (isFocused) {
      row.setAttribute("aria-current", "true");
    }

    const checkbox = document.createElement("input");
    checkbox.className = "parsed-node-checkbox";
    checkbox.type = "checkbox";
    checkbox.checked = checkedNodeIds.has(node.id);
    checkbox.disabled = isApplying;
    checkbox.setAttribute("aria-label", `Keep ${node.name} in final selection`);
    checkbox.addEventListener("click", (event) => event.stopPropagation());
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        checkedNodeIds.add(node.id);
      } else {
        checkedNodeIds.delete(node.id);
      }
      updateParsedControls();
      setStatus(
        selectionActionStatus,
        `${checkedNodeIds.size} of ${parsedNodes.length} nodes checked.`,
        "neutral"
      );
    });

    const indexCell = document.createElement("span");
    indexCell.className = "parsed-node-index";
    indexCell.textContent = String(index + 1);

    const details = document.createElement("span");
    details.className = "parsed-node-details";

    const primary = document.createElement("span");
    primary.className = "parsed-node-primary";

    const name = document.createElement("span");
    name.className = "parsed-node-name";
    name.textContent = node.name;
    name.title = node.name;

    const type = document.createElement("span");
    type.className = "parsed-node-type";
    type.textContent = node.type;
    type.title = node.type;
    primary.append(name, type);

    const metadata = document.createElement("span");
    metadata.className = "parsed-node-metadata";

    const id = document.createElement("span");
    id.className = "node-id";
    id.textContent = node.id;
    id.title = node.id;

    const page = document.createElement("span");
    page.className = "parsed-node-page";
    page.textContent = node.pageName;
    page.title = node.pageName;
    metadata.append(id, page);

    details.append(primary, metadata);
    row.append(checkbox, indexCell, details);
    row.addEventListener("click", () => focusNodeAt(index));
    parsedSelectionPreview.append(row);
  });

  updateParsedControls();
  scrollFocusedRowIntoView();
}

function clearParsedSelection(): void {
  parsedNodes = [];
  checkedNodeIds = new Set<string>();
  focusedNodeIndex = null;
  pendingFocusId = null;
  hasPendingApply = false;
  isFocusing = false;
  isApplying = false;
  parsedSelectionPanel.hidden = true;
  parsedSelectionPreview.replaceChildren();
  checkedCount.textContent = "";
  setStatus(selectionActionStatus, "", "neutral");
  updateParsedControls();
}

function focusNodeAt(index: number): void {
  if (
    index < 0 ||
    index >= parsedNodes.length ||
    isFocusing ||
    isApplying
  ) {
    return;
  }

  const node = parsedNodes[index];
  if (node === undefined) {
    return;
  }

  focusedNodeIndex = index;
  pendingFocusId = node.id;
  isFocusing = true;
  renderParsedSelection();
  parsedSelectionPreview.focus({ preventScroll: true });
  setStatus(
    selectionActionStatus,
    `Focusing ${index + 1} of ${parsedNodes.length}: ${node.name}…`,
    "neutral"
  );
  postToPlugin({ type: "focus-node", id: node.id });
}

function moveFocus(direction: -1 | 1): void {
  if (parsedNodes.length === 0) {
    return;
  }

  const nextIndex =
    focusedNodeIndex === null
      ? direction === 1
        ? 0
        : parsedNodes.length - 1
      : focusedNodeIndex + direction;
  focusNodeAt(nextIndex);
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText !== undefined) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Continue to the document.execCommand fallback below.
    }
  }

  const fallbackInput = document.createElement("textarea");
  fallbackInput.value = text;
  fallbackInput.setAttribute("readonly", "");
  fallbackInput.style.position = "fixed";
  fallbackInput.style.opacity = "0";
  fallbackInput.style.pointerEvents = "none";
  document.body.append(fallbackInput);
  fallbackInput.select();
  fallbackInput.setSelectionRange(0, fallbackInput.value.length);

  const copied = document.execCommand("copy");
  fallbackInput.remove();

  if (!copied) {
    throw new Error("Clipboard access was denied.");
  }
}

function receivePluginMessage(data: unknown): PluginToUiMessage | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }

  const envelope = data as { pluginMessage?: unknown };
  if (typeof envelope.pluginMessage !== "object" || envelope.pluginMessage === null) {
    return null;
  }

  return envelope.pluginMessage as PluginToUiMessage;
}

readSelectionButton.addEventListener("click", () => {
  readSelectionButton.disabled = true;
  setStatus(copyStatus, "Reading current selection…", "neutral");
  postToPlugin({ type: "read-selection" });
});

copyButton.addEventListener("click", async () => {
  if (selectedNodes.length === 0) {
    return;
  }

  const text = serializeSelection(selectedNodes, {
    format: getCopyFormat(),
    includeNames: includeNamesInput.checked
  });

  if (text.length === 0) {
    return;
  }

  copyButton.disabled = true;
  try {
    await copyText(text);
    setStatus(
      copyStatus,
      `Success: copied ${selectedNodes.length} node${selectedNodes.length === 1 ? "" : "s"}.`,
      "success"
    );
  } catch (error: unknown) {
    const detail = error instanceof Error ? ` ${error.message}` : "";
    setStatus(copyStatus, `Copy failed.${detail}`, "error");
  } finally {
    copyButton.disabled = selectedNodes.length === 0;
  }
});

nodeIdInput.addEventListener("input", () => {
  clearParsedSelection();
  updateParseStatus();
});

selectNodesButton.addEventListener("click", () => {
  const ids = parseNodeIds(nodeIdInput.value);
  if (ids.length === 0) {
    updateParseStatus();
    return;
  }

  clearParsedSelection();
  isSelecting = true;
  updateInputAvailability();
  selectNodesButton.disabled = true;
  setStatus(
    parseStatus,
    `Validating all ${ids.length} node ID${ids.length === 1 ? "" : "s"}…`,
    "neutral"
  );
  postToPlugin({ type: "select-nodes", input: nodeIdInput.value });
});

clearInputButton.addEventListener("click", () => {
  nodeIdInput.value = "";
  isSelecting = false;
  clearParsedSelection();
  updateParseStatus();
  nodeIdInput.focus();
});

selectAllButton.addEventListener("click", () => {
  checkedNodeIds = new Set(parsedNodes.map((node) => node.id));
  renderParsedSelection();
  setStatus(
    selectionActionStatus,
    `All ${parsedNodes.length} nodes are checked.`,
    "neutral"
  );
});

clearAllButton.addEventListener("click", () => {
  checkedNodeIds.clear();
  renderParsedSelection();
  setStatus(selectionActionStatus, "No nodes are checked.", "neutral");
});

previousNodeButton.addEventListener("click", () => moveFocus(-1));
nextNodeButton.addEventListener("click", () => moveFocus(1));

parsedSelectionPreview.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
    return;
  }

  event.preventDefault();
  moveFocus(event.key === "ArrowUp" ? -1 : 1);
});

copyParsedSelectionButton.addEventListener("click", async () => {
  const nodes = getCheckedNodes();
  const text = serializeSelection(nodes, {
    format: "compact",
    includeNames: true
  });
  if (text.length === 0) {
    return;
  }

  copyParsedSelectionButton.disabled = true;
  try {
    await copyText(text);
    setStatus(
      selectionActionStatus,
      `Success: copied ${nodes.length} checked node${nodes.length === 1 ? "" : "s"}.`,
      "success"
    );
  } catch (error: unknown) {
    const detail = error instanceof Error ? ` ${error.message}` : "";
    setStatus(selectionActionStatus, `Copy failed.${detail}`, "error");
  } finally {
    updateParsedControls();
  }
});

applySelectionButton.addEventListener("click", () => {
  const ids = getCheckedNodes().map((node) => node.id);
  if (ids.length === 0) {
    return;
  }

  hasPendingApply = true;
  isApplying = true;
  renderParsedSelection();
  setStatus(
    selectionActionStatus,
    `Validating and applying ${ids.length} checked node${ids.length === 1 ? "" : "s"}…`,
    "neutral"
  );
  postToPlugin({ type: "apply-selection", ids });
});

window.addEventListener("message", (event: MessageEvent<unknown>) => {
  const message = receivePluginMessage(event.data);
  if (message === null) {
    return;
  }

  switch (message.type) {
    case "selection-result": {
      readSelectionButton.disabled = false;
      selectedNodes = message.nodes;
      renderSelection(selectedNodes);
      copyButton.disabled = selectedNodes.length === 0;
      setStatus(
        copyStatus,
        selectedNodes.length === 0
          ? "Nothing to copy: the current selection is empty."
          : `Ready to copy ${selectedNodes.length} node${selectedNodes.length === 1 ? "" : "s"}.`,
        selectedNodes.length === 0 ? "neutral" : "success"
      );
      break;
    }
    case "selection-read-error": {
      readSelectionButton.disabled = false;
      setStatus(copyStatus, `Read failed: ${message.message}`, "error");
      break;
    }
    case "select-success": {
      isSelecting = false;
      parsedNodes = message.nodes;
      checkedNodeIds = new Set(message.nodes.map((node) => node.id));
      focusedNodeIndex = null;
      parsedSelectionPanel.hidden = false;
      renderParsedSelection();
      updateParseStatus();
      setStatus(
        parseStatus,
        `Success: selected ${message.count} node${message.count === 1 ? "" : "s"} on “${message.pageName}”.`,
        "success"
      );
      setStatus(
        selectionActionStatus,
        `All ${message.count} nodes are checked. Use ↑ or ↓ to inspect them.`,
        "neutral"
      );
      break;
    }
    case "select-cross-page": {
      isSelecting = false;
      updateInputAvailability();
      updateParseStatus();
      const pageDetails = message.pages
        .map(
          (page) =>
            `${page.pageName}: ${page.count} node${page.count === 1 ? "" : "s"}`
        )
        .join("; ");
      setStatus(
        parseStatus,
        `Cannot select across pages. ${pageDetails}. Split the IDs by page and try again; nothing was selected.`,
        "error"
      );
      break;
    }
    case "select-error": {
      isSelecting = false;
      updateInputAvailability();
      updateParseStatus();
      setStatus(parseStatus, `Selection failed: ${message.message}`, "error");
      break;
    }
    case "focus-node-success": {
      if (message.id !== pendingFocusId) {
        break;
      }

      const focusedNode =
        focusedNodeIndex === null ? null : parsedNodes[focusedNodeIndex];
      pendingFocusId = null;
      isFocusing = false;
      renderParsedSelection();
      setStatus(
        selectionActionStatus,
        focusedNode == null
          ? `Focused node on “${message.pageName}”.`
          : `Viewing ${focusedNodeIndex! + 1} of ${parsedNodes.length}: ${focusedNode.name} on “${message.pageName}”.`,
        "success"
      );
      break;
    }
    case "focus-node-error": {
      if (message.id !== pendingFocusId) {
        break;
      }

      pendingFocusId = null;
      isFocusing = false;
      focusedNodeIndex = null;
      renderParsedSelection();
      setStatus(
        selectionActionStatus,
        `Could not focus node: ${message.message}`,
        "error"
      );
      break;
    }
    case "apply-selection-success": {
      if (!hasPendingApply) {
        break;
      }

      hasPendingApply = false;
      isApplying = false;
      focusedNodeIndex = null;
      renderParsedSelection();
      setStatus(
        selectionActionStatus,
        `Success: applied ${message.count} node${message.count === 1 ? "" : "s"} on “${message.pageName}”.`,
        "success"
      );
      break;
    }
    case "apply-selection-error": {
      if (!hasPendingApply) {
        break;
      }

      hasPendingApply = false;
      isApplying = false;
      renderParsedSelection();
      setStatus(
        selectionActionStatus,
        `Apply failed: ${message.message}`,
        "error"
      );
      break;
    }
  }
});
