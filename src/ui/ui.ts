import { parseNodeIds } from "../shared/parse-node-ids";
import { serializeSelection } from "../shared/serialize-selection";
import {
  confirmResolvedRows,
  createEmptyResolvedRowsState,
  getHeaderCheckboxState,
  invalidateResolvedRows,
  setAllRowsChecked,
  switchResolvedView,
  type ResolvedView
} from "../shared/ui-state";
import type {
  CopyFormat,
  NodeReference
} from "../shared/types";
import {
  copyText,
  getElement,
  postToPlugin,
  receivePluginMessage,
  setStatus
} from "./dom";
import "./export-ui";

const selectionTab = getElement<HTMLButtonElement>("selection-tab");
const imageExportTab = getElement<HTMLButtonElement>("image-export-tab");
const selectionPanel = getElement<HTMLDivElement>("selection-panel");
const imageExportPanel = getElement<HTMLDivElement>("image-export-panel");

const readSelectionButton = getElement<HTMLButtonElement>("read-selection");
const selectionPreview = getElement<HTMLDivElement>("selection-preview");
const includeNamesInput = getElement<HTMLInputElement>("include-names");
const copyButton = getElement<HTMLButtonElement>("copy-selection");
const copyStatus = getElement<HTMLDivElement>("copy-status");

const idsInputTab = getElement<HTMLButtonElement>("ids-input-tab");
const idsResolvedTab = getElement<HTMLButtonElement>("ids-resolved-tab");
const idsInputView = getElement<HTMLDivElement>("ids-input-view");
const idsResolvedView = getElement<HTMLDivElement>("ids-resolved-view");
const nodeIdInput = getElement<HTMLTextAreaElement>("node-id-input");
const parseStatus = getElement<HTMLDivElement>("parse-status");
const selectNodesButton = getElement<HTMLButtonElement>("select-nodes");
const clearInputButton = getElement<HTMLButtonElement>("clear-input");
const parsedSelectionPreview = getElement<HTMLDivElement>(
  "parsed-selection-preview"
);
const parsedSelectionRows = getElement<HTMLDivElement>(
  "parsed-selection-rows"
);
const parsedSelectAll = getElement<HTMLInputElement>("parsed-select-all");
const checkedCount = getElement<HTMLSpanElement>("checked-count");
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
let parsedState = createEmptyResolvedRowsState();
let focusedNodeIndex: number | null = null;
let pendingFocusId: string | null = null;
let hasPendingApply = false;
let isSelecting = false;
let isFocusing = false;
let isApplying = false;

function setPrimaryTab(tab: "selection" | "export"): void {
  const showSelection = tab === "selection";
  selectionPanel.hidden = !showSelection;
  imageExportPanel.hidden = showSelection;
  selectionTab.classList.toggle("is-active", showSelection);
  imageExportTab.classList.toggle("is-active", !showSelection);
  selectionTab.setAttribute("aria-selected", String(showSelection));
  imageExportTab.setAttribute("aria-selected", String(!showSelection));
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
  header.className = "data-grid selection-grid table-header";
  header.setAttribute("role", "row");
  for (const [label, className] of [
    ["#", "sticky-index"],
    ["Name", "sticky-name"],
    ["Node ID", ""],
    ["Type", ""]
  ] as const) {
    const cell = document.createElement("span");
    cell.className = className;
    cell.setAttribute("role", "columnheader");
    cell.textContent = label;
    header.append(cell);
  }
  selectionPreview.append(header);

  nodes.forEach((node, index) => {
    const row = document.createElement("div");
    row.className = "data-grid selection-grid table-row";
    row.setAttribute("role", "row");

    const indexCell = document.createElement("span");
    indexCell.className = "sticky-index";
    indexCell.textContent = String(index + 1);

    const nameCell = document.createElement("span");
    nameCell.className = "sticky-name node-name";
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
  const input = document.querySelector<HTMLInputElement>(
    'input[name="copy-format"]:checked'
  );
  return input?.value === "json" ? "json" : "compact";
}

function showIdsView(view: ResolvedView): void {
  parsedState = switchResolvedView(parsedState, view);
  const showInput = parsedState.view === "input";
  idsInputView.hidden = !showInput;
  idsResolvedView.hidden = showInput;
  idsInputTab.classList.toggle("is-active", showInput);
  idsResolvedTab.classList.toggle("is-active", !showInput);
  idsInputTab.setAttribute("aria-selected", String(showInput));
  idsResolvedTab.setAttribute("aria-selected", String(!showInput));
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
  return parsedState.nodes.filter((node) =>
    parsedState.checkedNodeIds.has(node.id)
  );
}

function updateInputAvailability(): void {
  const isBusy = isSelecting || isFocusing || isApplying;
  nodeIdInput.disabled = isBusy;
  clearInputButton.disabled = isBusy;
  idsResolvedTab.disabled = parsedState.nodes.length === 0 || isSelecting;
}

function updateParsedControls(): void {
  const checkboxState = getHeaderCheckboxState(
    parsedState.nodes,
    parsedState.checkedNodeIds
  );
  const hasNodes = parsedState.nodes.length > 0;
  const isBusy = isFocusing || isApplying;
  parsedSelectAll.checked = checkboxState.checked;
  parsedSelectAll.indeterminate = checkboxState.indeterminate;
  parsedSelectAll.disabled = !hasNodes || isApplying;
  checkedCount.textContent = `${checkboxState.selectedCount} of ${parsedState.nodes.length} checked`;
  copyParsedSelectionButton.disabled =
    checkboxState.selectedCount === 0 || isApplying;
  applySelectionButton.disabled =
    checkboxState.selectedCount === 0 || isBusy;
  previousNodeButton.disabled =
    !hasNodes || isBusy || focusedNodeIndex === 0;
  nextNodeButton.disabled =
    !hasNodes ||
    isBusy ||
    focusedNodeIndex === parsedState.nodes.length - 1;
  parsedSelectionPreview.setAttribute("aria-busy", String(isBusy));
  updateInputAvailability();
}

function scrollFocusedRowIntoView(): void {
  if (focusedNodeIndex === null) {
    return;
  }
  parsedSelectionRows
    .querySelector<HTMLElement>(`[data-node-index="${focusedNodeIndex}"]`)
    ?.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function renderParsedSelection(): void {
  parsedSelectionRows.replaceChildren();
  parsedState.nodes.forEach((node, index) => {
    const row = document.createElement("div");
    const isFocused = index === focusedNodeIndex;
    row.className = `data-grid identity-grid table-row${isFocused ? " is-focused" : ""}`;
    row.dataset.nodeIndex = String(index);
    row.setAttribute("role", "row");
    if (isFocused) {
      row.setAttribute("aria-current", "true");
    }

    const checkCell = document.createElement("span");
    checkCell.className = "sticky-check";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = parsedState.checkedNodeIds.has(node.id);
    checkbox.disabled = isApplying;
    checkbox.setAttribute("aria-label", `Include ${node.name}`);
    checkbox.addEventListener("click", (event) => event.stopPropagation());
    checkbox.addEventListener("change", () => {
      const nextChecked = new Set(parsedState.checkedNodeIds);
      if (checkbox.checked) {
        nextChecked.add(node.id);
      } else {
        nextChecked.delete(node.id);
      }
      parsedState = { ...parsedState, checkedNodeIds: nextChecked };
      updateParsedControls();
      setStatus(
        selectionActionStatus,
        `${getHeaderCheckboxState(parsedState.nodes, nextChecked).selectedCount} of ${parsedState.nodes.length} nodes checked.`,
        "neutral"
      );
    });
    checkCell.append(checkbox);

    const indexCell = document.createElement("span");
    indexCell.className = "sticky-index";
    indexCell.textContent = String(index + 1);

    const nameCell = document.createElement("span");
    nameCell.className = "sticky-name node-name";
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

    row.append(checkCell, indexCell, nameCell, idCell, typeCell);
    row.addEventListener("click", () => focusNodeAt(index));
    parsedSelectionRows.append(row);
  });
  updateParsedControls();
  scrollFocusedRowIntoView();
}

function clearParsedSelection(): void {
  parsedState = invalidateResolvedRows(parsedState);
  focusedNodeIndex = null;
  pendingFocusId = null;
  hasPendingApply = false;
  isFocusing = false;
  isApplying = false;
  idsResolvedTab.disabled = true;
  parsedSelectionRows.replaceChildren();
  setStatus(selectionActionStatus, "", "neutral");
  showIdsView("input");
  updateParsedControls();
}

function focusNodeAt(index: number): void {
  if (
    index < 0 ||
    index >= parsedState.nodes.length ||
    isFocusing ||
    isApplying
  ) {
    return;
  }
  const node = parsedState.nodes[index];
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
    `Focusing ${index + 1} of ${parsedState.nodes.length}: ${node.name}…`,
    "neutral"
  );
  postToPlugin({ type: "focus-node", id: node.id });
}

function moveFocus(direction: -1 | 1): void {
  if (parsedState.nodes.length === 0) {
    return;
  }
  const nextIndex =
    focusedNodeIndex === null
      ? direction === 1
        ? 0
        : parsedState.nodes.length - 1
      : focusedNodeIndex + direction;
  focusNodeAt(nextIndex);
}

selectionTab.addEventListener("click", () => setPrimaryTab("selection"));
imageExportTab.addEventListener("click", () => setPrimaryTab("export"));
idsInputTab.addEventListener("click", () => showIdsView("input"));
idsResolvedTab.addEventListener("click", () => showIdsView("resolved"));

readSelectionButton.addEventListener("click", () => {
  readSelectionButton.disabled = true;
  setStatus(copyStatus, "Reading current selection…", "neutral");
  postToPlugin({ type: "read-selection" });
});

copyButton.addEventListener("click", async () => {
  if (selectedNodes.length === 0) {
    return;
  }
  copyButton.disabled = true;
  try {
    await copyText(
      serializeSelection(selectedNodes, {
        format: getCopyFormat(),
        includeNames: includeNamesInput.checked
      })
    );
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

parsedSelectAll.addEventListener("change", () => {
  parsedState = {
    ...parsedState,
    checkedNodeIds: setAllRowsChecked(
      parsedState.nodes,
      parsedSelectAll.checked
    )
  };
  renderParsedSelection();
  setStatus(
    selectionActionStatus,
    parsedSelectAll.checked
      ? `All ${parsedState.nodes.length} nodes are checked.`
      : "No nodes are checked.",
    "neutral"
  );
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
  if (nodes.length === 0) {
    return;
  }
  copyParsedSelectionButton.disabled = true;
  try {
    await copyText(
      serializeSelection(nodes, { format: "compact", includeNames: true })
    );
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
    case "selection-read-error":
      readSelectionButton.disabled = false;
      setStatus(copyStatus, `Read failed: ${message.message}`, "error");
      break;
    case "select-success": {
      isSelecting = false;
      parsedState = confirmResolvedRows(
        nodeIdInput.value,
        message.nodes,
        false
      );
      focusedNodeIndex = null;
      renderParsedSelection();
      showIdsView("input");
      updateInputAvailability();
      setStatus(
        parseStatus,
        `Success: selected ${message.count} node${message.count === 1 ? "" : "s"} on “${message.pageName}”. Open Resolved to review.`,
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
    case "select-error":
      isSelecting = false;
      updateInputAvailability();
      updateParseStatus();
      setStatus(parseStatus, `Selection failed: ${message.message}`, "error");
      break;
    case "focus-node-success": {
      if (message.id !== pendingFocusId) {
        break;
      }
      const focusedNode =
        focusedNodeIndex === null
          ? null
          : parsedState.nodes[focusedNodeIndex];
      pendingFocusId = null;
      isFocusing = false;
      renderParsedSelection();
      setStatus(
        selectionActionStatus,
        focusedNode === undefined || focusedNode === null
          ? `Focused node on “${message.pageName}”.`
          : `Viewing ${focusedNodeIndex! + 1} of ${parsedState.nodes.length}: ${focusedNode.name} on “${message.pageName}”.`,
        "success"
      );
      break;
    }
    case "focus-node-error":
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
    case "apply-selection-success":
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
    case "apply-selection-error":
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
});
