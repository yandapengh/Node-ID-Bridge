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

let selectedNodes: NodeReference[] = [];
let isSelecting = false;

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

nodeIdInput.addEventListener("input", updateParseStatus);

selectNodesButton.addEventListener("click", () => {
  const ids = parseNodeIds(nodeIdInput.value);
  if (ids.length === 0) {
    updateParseStatus();
    return;
  }

  isSelecting = true;
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
  updateParseStatus();
  nodeIdInput.focus();
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
      updateParseStatus();
      setStatus(
        parseStatus,
        `Success: selected ${message.count} node${message.count === 1 ? "" : "s"} on “${message.pageName}”.`,
        "success"
      );
      break;
    }
    case "select-cross-page": {
      isSelecting = false;
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
      updateParseStatus();
      setStatus(parseStatus, `Selection failed: ${message.message}`, "error");
      break;
    }
  }
});
