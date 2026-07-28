import { parseNodeIds } from "../shared/parse-node-ids";
import { createExportZip } from "../shared/export-archive";
import { createZipFilename } from "../shared/export-format";
import {
  applyBulkExportValue,
  buildImageExportRequest,
  confirmResolvedRows,
  createEmptyExportDraft,
  createEmptyResolvedRowsState,
  getHeaderCheckboxState,
  getNextNameSort,
  invalidateResolvedRows,
  setAllRowsChecked,
  sortNodesByName,
  switchResolvedView,
  type ExportDraft,
  type ExportField,
  type NameSort,
  type ResolvedView
} from "../shared/ui-state";
import type {
  ExportErrorMessage,
  ExportItemStatusMessage,
  ExportSuccessMessage,
  ExportType,
  NodeReference
} from "../shared/types";
import {
  getElement,
  postToPlugin,
  receivePluginMessage,
  setStatus,
  type StatusTone
} from "./dom";

type RowStatus = { message: string; tone: StatusTone };

const exportInputTab = getElement<HTMLButtonElement>("export-input-tab");
const exportResolvedTab = getElement<HTMLButtonElement>(
  "export-resolved-tab"
);
const exportInputView = getElement<HTMLDivElement>("export-input-view");
const exportResolvedView = getElement<HTMLDivElement>(
  "export-resolved-view"
);
const exportNodeIdInput = getElement<HTMLTextAreaElement>(
  "export-node-id-input"
);
const exportResolveStatus = getElement<HTMLDivElement>(
  "export-resolve-status"
);
const confirmExportNodesButton = getElement<HTMLButtonElement>(
  "confirm-export-nodes"
);
const clearExportInputButton = getElement<HTMLButtonElement>(
  "clear-export-input"
);
const exportTable = getElement<HTMLDivElement>("export-table");
const exportTableHeader = getElement<HTMLDivElement>("export-table-header");
const exportRows = getElement<HTMLDivElement>("export-rows");
const exportSelectAll = getElement<HTMLInputElement>("export-select-all");
const exportCheckedCount = getElement<HTMLSpanElement>(
  "export-checked-count"
);
const sortExportNameButton = getElement<HTMLButtonElement>(
  "sort-export-name"
);
const sortExportNameIndicator = getElement<HTMLSpanElement>(
  "sort-export-name-indicator"
);
const uxScenarioHeading = getElement<HTMLSpanElement>("ux-scenario-heading");
const bulkWriteButton = getElement<HTMLButtonElement>("bulk-write");
const bulkFieldMenu = getElement<HTMLDivElement>("bulk-field-menu");
const bulkUxScenarioButton = getElement<HTMLButtonElement>(
  "bulk-ux-scenario"
);
const exportButton = getElement<HTMLButtonElement>("export-images");
const exportStatus = getElement<HTMLDivElement>("export-status");
const exportTypeInputs = Array.from(
  document.querySelectorAll<HTMLInputElement>('input[name="export-type"]')
);

const bulkModal = getElement<HTMLDivElement>("bulk-modal");
const bulkModalTitle = getElement<HTMLHeadingElement>("bulk-modal-title");
const bulkModalDescription = getElement<HTMLParagraphElement>(
  "bulk-modal-description"
);
const bulkModalInput = getElement<HTMLInputElement>("bulk-modal-input");
const bulkModalCancel = getElement<HTMLButtonElement>("bulk-modal-cancel");
const bulkModalConfirm = getElement<HTMLButtonElement>("bulk-modal-confirm");

let resolvedState = createEmptyResolvedRowsState();
let exportType: ExportType = "Component page";
let nameSort: NameSort = "original";
let isResolving = false;
let isExporting = false;
let activeBatchId: string | null = null;
let activeBulkField: ExportField | null = null;
let focusedExportNodeId: string | null = null;
let pendingExportFocusId: string | null = null;
let drafts = new Map<string, ExportDraft>();
const rowStatuses = new Map<string, RowStatus>();
const rowStatusElements = new Map<string, HTMLElement>();
const nameWarnings = new Set<string>();

function getDraft(nodeId: string): ExportDraft {
  const existing = drafts.get(nodeId);
  if (existing !== undefined) {
    return existing;
  }
  const draft = createEmptyExportDraft();
  drafts.set(nodeId, draft);
  return draft;
}

function setRowStatus(nodeId: string, status: RowStatus): void {
  rowStatuses.set(nodeId, status);
  const element = rowStatusElements.get(nodeId);
  if (element !== undefined) {
    setStatus(element, status.message, status.tone);
  }
}

function showExportView(view: ResolvedView): void {
  resolvedState = switchResolvedView(resolvedState, view);
  const showInput = resolvedState.view === "input";
  exportInputView.hidden = !showInput;
  exportResolvedView.hidden = showInput;
  exportInputTab.classList.toggle("is-active", showInput);
  exportResolvedTab.classList.toggle("is-active", !showInput);
  exportInputTab.setAttribute("aria-selected", String(showInput));
  exportResolvedTab.setAttribute("aria-selected", String(!showInput));
}

function updateResolveStatus(): void {
  const ids = parseNodeIds(exportNodeIdInput.value);
  confirmExportNodesButton.disabled =
    ids.length === 0 || isResolving || isExporting;
  if (exportNodeIdInput.value.trim().length === 0) {
    setStatus(exportResolveStatus, "No node IDs found yet.", "neutral");
  } else if (ids.length === 0) {
    setStatus(
      exportResolveStatus,
      "No node IDs found. Check the input; your text has been kept.",
      "error"
    );
  } else {
    setStatus(
      exportResolveStatus,
      `Found ${ids.length} unique node ID${ids.length === 1 ? "" : "s"}. Confirm to resolve without changing the canvas.`,
      "success"
    );
  }
}

function updateSortControl(): void {
  const details =
    nameSort === "original"
      ? { indicator: "↕", label: "original order" }
      : nameSort === "ascending"
        ? { indicator: "↑", label: "ascending" }
        : { indicator: "↓", label: "descending" };
  sortExportNameIndicator.textContent = details.indicator;
  sortExportNameButton.setAttribute(
    "aria-label",
    `Sort Name, currently ${details.label}`
  );
  sortExportNameButton.setAttribute(
    "aria-sort",
    nameSort === "original" ? "none" : nameSort
  );
}

function updateExportControls(): void {
  const checkboxState = getHeaderCheckboxState(
    resolvedState.nodes,
    resolvedState.checkedNodeIds
  );
  const hasRows = resolvedState.nodes.length > 0;
  exportSelectAll.checked = checkboxState.checked;
  exportSelectAll.indeterminate = checkboxState.indeterminate;
  exportSelectAll.disabled = !hasRows || isExporting;
  exportCheckedCount.textContent = `${checkboxState.selectedCount} of ${resolvedState.nodes.length} checked`;
  exportButton.disabled =
    checkboxState.selectedCount === 0 || isExporting || isResolving;
  bulkWriteButton.disabled =
    checkboxState.selectedCount === 0 || isExporting || isResolving;
  exportResolvedTab.disabled = !hasRows || isResolving;
  exportNodeIdInput.disabled = isResolving || isExporting;
  clearExportInputButton.disabled = isResolving || isExporting;
  sortExportNameButton.disabled = isExporting;
  exportTable.setAttribute("aria-busy", String(isExporting));
  for (const input of exportTypeInputs) {
    input.disabled = isResolving || isExporting;
  }
  updateResolveStatus();
}

function createMetadataInput(
  node: NodeReference,
  field: ExportField,
  placeholder: string
): HTMLSpanElement {
  const cell = document.createElement("span");
  const input = document.createElement("input");
  input.type = "text";
  input.className = "export-cell-input";
  input.value = getDraft(node.id)[field];
  input.placeholder = placeholder;
  input.disabled = isExporting;
  input.dataset.exportNodeId = node.id;
  input.dataset.exportField = field;
  input.setAttribute(
    "aria-label",
    `${field === "uxScenario" ? "UX Scenario" : field} for ${node.name}`
  );
  input.addEventListener("input", () => {
    const draft = getDraft(node.id);
    drafts.set(node.id, { ...draft, [field]: input.value });
    input.classList.remove("is-invalid");
    input.removeAttribute("aria-invalid");
  });
  cell.append(input);
  return cell;
}

function updateFocusedExportRow(): void {
  for (const row of exportRows.querySelectorAll<HTMLElement>(
    ".export-grid.table-row"
  )) {
    const isFocused = row.dataset.exportNodeId === focusedExportNodeId;
    row.classList.toggle("is-focused", isFocused);
    if (isFocused) {
      row.setAttribute("aria-current", "true");
    } else {
      row.removeAttribute("aria-current");
    }
  }
}

function focusExportNode(node: NodeReference): void {
  if (isExporting || pendingExportFocusId !== null) {
    return;
  }
  focusedExportNodeId = node.id;
  pendingExportFocusId = node.id;
  updateFocusedExportRow();
  setStatus(
    exportStatus,
    `Focusing ${node.name} on the Figma canvas…`,
    "neutral"
  );
  postToPlugin({ type: "focus-node", id: node.id });
}

function isInteractiveExportRowTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest("input, button, select, textarea, label, a") !== null
  );
}

function renderExportRows(): void {
  exportRows.replaceChildren();
  rowStatusElements.clear();
  const isUx = exportType === "UX Key page";
  exportTableHeader.classList.toggle("is-ux", isUx);
  uxScenarioHeading.hidden = !isUx;
  bulkUxScenarioButton.hidden = !isUx;

  const originalIndex = new Map(
    resolvedState.nodes.map((node, index) => [node.id, index] as const)
  );
  const displayedNodes = sortNodesByName(resolvedState.nodes, nameSort);
  for (const node of displayedNodes) {
    const index = originalIndex.get(node.id) ?? 0;
    const row = document.createElement("div");
    const isFocused = node.id === focusedExportNodeId;
    row.className = `data-grid export-grid table-row${isUx ? " is-ux" : ""}${isFocused ? " is-focused" : ""}`;
    row.setAttribute("role", "row");
    row.dataset.exportNodeId = node.id;
    row.tabIndex = 0;
    row.title = `Focus ${node.name} on the Figma canvas`;
    row.setAttribute(
      "aria-label",
      `${node.name}, row ${index + 1}. Press Enter to focus this node on the Figma canvas.`
    );
    if (isFocused) {
      row.setAttribute("aria-current", "true");
    }

    const checkCell = document.createElement("span");
    checkCell.className = "sticky-check";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = resolvedState.checkedNodeIds.has(node.id);
    checkbox.disabled = isExporting;
    checkbox.setAttribute("aria-label", `Include ${node.name} in export`);
    checkbox.addEventListener("change", () => {
      const checkedNodeIds = new Set(resolvedState.checkedNodeIds);
      if (checkbox.checked) {
        checkedNodeIds.add(node.id);
      } else {
        checkedNodeIds.delete(node.id);
      }
      resolvedState = { ...resolvedState, checkedNodeIds };
      updateExportControls();
      setStatus(
        exportStatus,
        `${getHeaderCheckboxState(resolvedState.nodes, checkedNodeIds).selectedCount} rows will be updated and exported.`,
        "neutral"
      );
    });
    checkCell.append(checkbox);

    const indexCell = document.createElement("span");
    indexCell.className = "sticky-index";
    indexCell.textContent = String(index + 1);

    const nameCell = document.createElement("span");
    nameCell.className = "sticky-name export-identity";
    const name = document.createElement("span");
    name.className = "node-name";
    name.textContent = node.name;
    name.title = node.name;
    const itemStatus = document.createElement("span");
    itemStatus.className = "row-item-status";
    itemStatus.setAttribute("role", "status");
    const savedStatus = rowStatuses.get(node.id);
    setStatus(
      itemStatus,
      savedStatus?.message ?? "",
      savedStatus?.tone ?? "neutral"
    );
    rowStatusElements.set(node.id, itemStatus);
    nameCell.append(name, itemStatus);

    const idCell = document.createElement("span");
    idCell.className = "node-id";
    idCell.textContent = node.id;
    idCell.title = node.id;

    const typeCell = document.createElement("span");
    typeCell.className = "node-type";
    typeCell.textContent = node.type;
    typeCell.title = node.type;

    row.append(
      checkCell,
      indexCell,
      nameCell,
      idCell,
      typeCell,
      createMetadataInput(node, "category", isUx ? "Optional" : "Required"),
      createMetadataInput(node, "state", isUx ? "Optional" : "Required")
    );
    if (isUx) {
      row.append(
        createMetadataInput(node, "uxScenario", "Required UX scenario")
      );
    }
    row.addEventListener("click", (event) => {
      if (!isInteractiveExportRowTarget(event.target)) {
        focusExportNode(node);
      }
    });
    row.addEventListener("keydown", (event) => {
      if (event.target === row && event.key === "Enter") {
        event.preventDefault();
        focusExportNode(node);
      }
    });
    exportRows.append(row);
  }
  updateSortControl();
  updateExportControls();
}

function invalidateExportRows(): void {
  resolvedState = invalidateResolvedRows(resolvedState);
  nameSort = "original";
  activeBatchId = null;
  focusedExportNodeId = null;
  pendingExportFocusId = null;
  rowStatuses.clear();
  nameWarnings.clear();
  exportRows.replaceChildren();
  closeBulkMenu();
  closeBulkModal();
  showExportView("input");
  updateExportControls();
}

function setExporting(value: boolean): void {
  isExporting = value;
  exportButton.textContent = value
    ? "Exporting PNG 1x…"
    : "Export PNG 1x + ZIP";
  for (const input of exportRows.querySelectorAll<HTMLInputElement>("input")) {
    input.disabled = value;
  }
  updateExportControls();
}

function focusInvalidField(nodeId: string, field: ExportField): void {
  const input = Array.from(
    exportRows.querySelectorAll<HTMLInputElement>(".export-cell-input")
  ).find(
    (candidate) =>
      candidate.dataset.exportNodeId === nodeId &&
      candidate.dataset.exportField === field
  );
  if (input === undefined) {
    return;
  }
  input.classList.add("is-invalid");
  input.setAttribute("aria-invalid", "true");
  input.focus();
  input.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function downloadExportZip(message: ExportSuccessMessage): void {
  const bytes = createExportZip(message);
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
  const url = URL.createObjectURL(
    new Blob([arrayBuffer], { type: "application/zip" })
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = createZipFilename(message.manifest.batchId);
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function handleItemStatus(message: ExportItemStatusMessage): void {
  if (activeBatchId === null) {
    activeBatchId = message.batchId;
  }
  if (message.batchId !== activeBatchId) {
    return;
  }
  if (message.status === "exporting") {
    setRowStatus(message.nodeId, {
      message: "Resolving and exporting…",
      tone: "neutral"
    });
    return;
  }
  if (message.warning !== undefined) {
    nameWarnings.add(message.nodeId);
    setRowStatus(message.nodeId, {
      message: `Ready · ${message.warning}`,
      tone: "neutral"
    });
  } else {
    setRowStatus(message.nodeId, { message: "PNG ready.", tone: "success" });
  }
}

function handleExportSuccess(message: ExportSuccessMessage): void {
  if (
    activeBatchId !== null &&
    message.manifest.batchId !== activeBatchId
  ) {
    return;
  }
  try {
    downloadExportZip(message);
    setStatus(
      exportStatus,
      `Downloaded ${createZipFilename(message.manifest.batchId)} with ${message.manifest.records.length} PNG${message.manifest.records.length === 1 ? "" : "s"} and one v2 manifest${nameWarnings.size === 0 ? "." : `; ${nameWarnings.size} name-change warning${nameWarnings.size === 1 ? "" : "s"} shown in the table.`}`,
      "success"
    );
  } catch (error: unknown) {
    const detail = error instanceof Error ? ` ${error.message}` : "";
    setStatus(
      exportStatus,
      `ZIP creation failed.${detail} No ZIP was downloaded.`,
      "error"
    );
  } finally {
    activeBatchId = null;
    setExporting(false);
  }
}

function handleExportError(message: ExportErrorMessage): void {
  if (activeBatchId !== null && message.batchId !== activeBatchId) {
    return;
  }
  if (message.nodeId !== undefined) {
    setRowStatus(message.nodeId, {
      message: "Batch failed here.",
      tone: "error"
    });
  }
  setStatus(exportStatus, message.message, "error");
  activeBatchId = null;
  setExporting(false);
}

function closeBulkMenu(): void {
  bulkFieldMenu.hidden = true;
  bulkWriteButton.setAttribute("aria-expanded", "false");
}

function openBulkModal(field: ExportField): void {
  activeBulkField = field;
  const label =
    field === "category"
      ? "Category"
      : field === "state"
        ? "State"
        : "UX Scenario";
  const selectedCount = getHeaderCheckboxState(
    resolvedState.nodes,
    resolvedState.checkedNodeIds
  ).selectedCount;
  bulkModalTitle.textContent = `批量写入 ${label}`;
  bulkModalDescription.textContent = `Apply one non-empty value to ${selectedCount} checked row${selectedCount === 1 ? "" : "s"}.`;
  bulkModalInput.value = "";
  bulkModalConfirm.disabled = true;
  bulkModal.hidden = false;
  bulkModalInput.focus();
}

function closeBulkModal(): void {
  bulkModal.hidden = true;
  activeBulkField = null;
}

exportInputTab.addEventListener("click", () => showExportView("input"));
exportResolvedTab.addEventListener("click", () => showExportView("resolved"));

exportNodeIdInput.addEventListener("input", () => {
  invalidateExportRows();
  updateResolveStatus();
});

confirmExportNodesButton.addEventListener("click", () => {
  const ids = parseNodeIds(exportNodeIdInput.value);
  if (ids.length === 0) {
    updateResolveStatus();
    return;
  }
  invalidateExportRows();
  isResolving = true;
  updateExportControls();
  setStatus(
    exportResolveStatus,
    `Resolving all ${ids.length} node ID${ids.length === 1 ? "" : "s"} across pages…`,
    "neutral"
  );
  postToPlugin({
    type: "resolve-export-nodes",
    input: exportNodeIdInput.value
  });
});

clearExportInputButton.addEventListener("click", () => {
  exportNodeIdInput.value = "";
  drafts = new Map<string, ExportDraft>();
  isResolving = false;
  invalidateExportRows();
  updateResolveStatus();
  exportNodeIdInput.focus();
});

for (const input of exportTypeInputs) {
  input.addEventListener("change", () => {
    if (!input.checked || isExporting || isResolving) {
      return;
    }
    exportType =
      input.value === "UX Key page" ? "UX Key page" : "Component page";
    rowStatuses.clear();
    nameWarnings.clear();
    renderExportRows();
    setStatus(
      exportStatus,
      exportType === "Component page"
        ? "Category and State are required for checked rows. Click a row to focus its node on the canvas."
        : "UX Scenario is required; Category and State are optional. Click a row to focus its node on the canvas.",
      "neutral"
    );
  });
}

exportSelectAll.addEventListener("change", () => {
  resolvedState = {
    ...resolvedState,
    checkedNodeIds: setAllRowsChecked(
      resolvedState.nodes,
      exportSelectAll.checked
    )
  };
  renderExportRows();
  setStatus(
    exportStatus,
    exportSelectAll.checked
      ? `All ${resolvedState.nodes.length} rows will be updated and exported.`
      : "No rows are selected for update or export.",
    "neutral"
  );
});

sortExportNameButton.addEventListener("click", () => {
  if (isExporting) {
    return;
  }
  nameSort = getNextNameSort(nameSort);
  renderExportRows();
});

bulkWriteButton.addEventListener("click", (event) => {
  event.stopPropagation();
  const willOpen = bulkFieldMenu.hidden;
  bulkFieldMenu.hidden = !willOpen;
  bulkWriteButton.setAttribute("aria-expanded", String(willOpen));
  if (willOpen) {
    bulkFieldMenu
      .querySelector<HTMLButtonElement>('button[role="menuitem"]:not([hidden])')
      ?.focus();
  }
});

bulkFieldMenu.addEventListener("click", (event) => {
  const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
    "[data-bulk-field]"
  );
  if (target === null) {
    return;
  }
  closeBulkMenu();
  openBulkModal(target.dataset.bulkField as ExportField);
});

document.addEventListener("click", (event) => {
  if (!(event.target as Node).isConnected) {
    return;
  }
  if (
    !bulkFieldMenu.contains(event.target as Node) &&
    event.target !== bulkWriteButton
  ) {
    closeBulkMenu();
  }
});

bulkModalInput.addEventListener("input", () => {
  bulkModalConfirm.disabled = bulkModalInput.value.trim().length === 0;
});
bulkModalCancel.addEventListener("click", closeBulkModal);
bulkModal.addEventListener("click", (event) => {
  if (event.target === bulkModal) {
    closeBulkModal();
  }
});
bulkModal.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    closeBulkModal();
  }
});
bulkModalConfirm.addEventListener("click", () => {
  const value = bulkModalInput.value.trim();
  if (activeBulkField === null || value.length === 0) {
    return;
  }
  const field = activeBulkField;
  drafts = applyBulkExportValue(
    drafts,
    resolvedState.nodes,
    resolvedState.checkedNodeIds,
    field,
    value
  );
  const selectedCount = getHeaderCheckboxState(
    resolvedState.nodes,
    resolvedState.checkedNodeIds
  ).selectedCount;
  closeBulkModal();
  renderExportRows();
  setStatus(
    exportStatus,
    `Applied ${field === "uxScenario" ? "UX Scenario" : field} to ${selectedCount} checked row${selectedCount === 1 ? "" : "s"}.`,
    "success"
  );
});

exportButton.addEventListener("click", () => {
  if (isExporting || resolvedState.nodes.length === 0) {
    return;
  }
  rowStatuses.clear();
  nameWarnings.clear();
  renderExportRows();

  const validation = buildImageExportRequest(
    exportType,
    resolvedState.nodes,
    resolvedState.checkedNodeIds,
    drafts
  );
  if (!validation.ok) {
    if (validation.reason === "no-selection") {
      setStatus(exportStatus, "Check at least one row to export.", "error");
      return;
    }
    setStatus(
      exportStatus,
      `Row ${validation.originalIndex + 1}: ${validation.label} is required.`,
      "error"
    );
    focusInvalidField(validation.nodeId, validation.field);
    return;
  }

  activeBatchId = null;
  setExporting(true);
  setStatus(
    exportStatus,
    `Preparing ${validation.request.records.length} PNG 1x export${validation.request.records.length === 1 ? "" : "s"} in original input order…`,
    "neutral"
  );
  postToPlugin(validation.request);
});

window.addEventListener("message", (event: MessageEvent<unknown>) => {
  const message = receivePluginMessage(event.data);
  if (message === null) {
    return;
  }
  switch (message.type) {
    case "resolve-export-nodes-success":
      isResolving = false;
      resolvedState = confirmResolvedRows(
        exportNodeIdInput.value,
        message.nodes,
        true
      );
      nameSort = "original";
      rowStatuses.clear();
      nameWarnings.clear();
      renderExportRows();
      showExportView("resolved");
      setStatus(
        exportResolveStatus,
        `Confirmed ${message.nodes.length} node${message.nodes.length === 1 ? "" : "s"} across any pages. The canvas was not changed.`,
        "success"
      );
      setStatus(
        exportStatus,
        exportType === "Component page"
          ? "Category and State are required for checked rows. Click a row to focus its node on the canvas."
          : "UX Scenario is required; Category and State are optional. Click a row to focus its node on the canvas.",
        "neutral"
      );
      break;
    case "resolve-export-nodes-error":
      isResolving = false;
      updateExportControls();
      setStatus(
        exportResolveStatus,
        `Confirm failed: ${message.message}`,
        "error"
      );
      break;
    case "focus-node-success": {
      if (message.id !== pendingExportFocusId) {
        break;
      }
      pendingExportFocusId = null;
      const node = resolvedState.nodes.find(
        (candidate) => candidate.id === message.id
      );
      setStatus(
        exportStatus,
        `Viewing ${node?.name ?? message.id} on “${message.pageName}”. Continue filling the checked row values.`,
        "success"
      );
      break;
    }
    case "focus-node-error":
      if (message.id !== pendingExportFocusId) {
        break;
      }
      pendingExportFocusId = null;
      focusedExportNodeId = null;
      updateFocusedExportRow();
      setStatus(
        exportStatus,
        `Could not focus this export node: ${message.message}`,
        "error"
      );
      break;
    case "export-item-status":
      handleItemStatus(message);
      break;
    case "export-success":
      handleExportSuccess(message);
      break;
    case "export-error":
      handleExportError(message);
      break;
  }
});
