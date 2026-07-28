import type {
  ExportType,
  ImageExportRequest,
  NodeReference
} from "./types";

export type ResolvedView = "input" | "resolved";

export type ResolvedRowsState = {
  view: ResolvedView;
  resolvedInput: string | null;
  nodes: NodeReference[];
  checkedNodeIds: Set<string>;
};

export type HeaderCheckboxState = {
  checked: boolean;
  indeterminate: boolean;
  selectedCount: number;
};

export type ExportField = "category" | "state" | "uxScenario";

export type ExportDraft = Record<ExportField, string>;

export type NameSort = "original" | "ascending" | "descending";

export type ExportValidationResult =
  | { ok: true; request: ImageExportRequest }
  | { ok: false; reason: "no-selection" }
  | {
      ok: false;
      reason: "required-field";
      originalIndex: number;
      nodeId: string;
      field: ExportField;
      label: string;
    };

export function createEmptyResolvedRowsState(): ResolvedRowsState {
  return {
    view: "input",
    resolvedInput: null,
    nodes: [],
    checkedNodeIds: new Set<string>()
  };
}

export function confirmResolvedRows(
  input: string,
  nodes: readonly NodeReference[],
  openResolvedView: boolean
): ResolvedRowsState {
  return {
    view: openResolvedView ? "resolved" : "input",
    resolvedInput: input,
    nodes: [...nodes],
    checkedNodeIds: new Set(nodes.map((node) => node.id))
  };
}

export function switchResolvedView(
  state: ResolvedRowsState,
  view: ResolvedView
): ResolvedRowsState {
  if (view === "resolved" && state.nodes.length === 0) {
    return state;
  }
  return { ...state, view };
}

export function invalidateResolvedRows(
  state: ResolvedRowsState
): ResolvedRowsState {
  if (
    state.nodes.length === 0 &&
    state.resolvedInput === null &&
    state.view === "input"
  ) {
    return state;
  }
  return createEmptyResolvedRowsState();
}

export function getHeaderCheckboxState(
  nodes: readonly NodeReference[],
  checkedNodeIds: ReadonlySet<string>
): HeaderCheckboxState {
  const selectedCount = nodes.reduce(
    (count, node) => count + Number(checkedNodeIds.has(node.id)),
    0
  );
  return {
    checked: nodes.length > 0 && selectedCount === nodes.length,
    indeterminate: selectedCount > 0 && selectedCount < nodes.length,
    selectedCount
  };
}

export function setAllRowsChecked(
  nodes: readonly NodeReference[],
  checked: boolean
): Set<string> {
  return checked
    ? new Set(nodes.map((node) => node.id))
    : new Set<string>();
}

export function getNextNameSort(sort: NameSort): NameSort {
  if (sort === "original") {
    return "ascending";
  }
  return sort === "ascending" ? "descending" : "original";
}

export function sortNodesByName(
  nodes: readonly NodeReference[],
  sort: NameSort
): NodeReference[] {
  if (sort === "original") {
    return [...nodes];
  }
  const originalIndex = new Map(
    nodes.map((node, index) => [node.id, index] as const)
  );
  const direction = sort === "ascending" ? 1 : -1;
  return [...nodes].sort((left, right) => {
    const nameOrder = left.name.localeCompare(right.name, undefined, {
      sensitivity: "base",
      numeric: true
    });
    if (nameOrder !== 0) {
      return nameOrder * direction;
    }
    return (
      (originalIndex.get(left.id) ?? 0) -
      (originalIndex.get(right.id) ?? 0)
    );
  });
}

export function createEmptyExportDraft(): ExportDraft {
  return { category: "", state: "", uxScenario: "" };
}

export function applyBulkExportValue(
  drafts: ReadonlyMap<string, ExportDraft>,
  nodes: readonly NodeReference[],
  checkedNodeIds: ReadonlySet<string>,
  field: ExportField,
  value: string
): Map<string, ExportDraft> {
  const nextDrafts = new Map(drafts);
  for (const node of nodes) {
    if (!checkedNodeIds.has(node.id)) {
      continue;
    }
    const draft = nextDrafts.get(node.id) ?? createEmptyExportDraft();
    nextDrafts.set(node.id, { ...draft, [field]: value });
  }
  return nextDrafts;
}

function getDraft(
  drafts: ReadonlyMap<string, ExportDraft>,
  nodeId: string
): ExportDraft {
  return drafts.get(nodeId) ?? createEmptyExportDraft();
}

function requiredFieldError(
  originalIndex: number,
  nodeId: string,
  field: ExportField,
  label: string
): ExportValidationResult {
  return {
    ok: false,
    reason: "required-field",
    originalIndex,
    nodeId,
    field,
    label
  };
}

export function buildImageExportRequest(
  exportType: ExportType,
  nodes: readonly NodeReference[],
  checkedNodeIds: ReadonlySet<string>,
  drafts: ReadonlyMap<string, ExportDraft>
): ExportValidationResult {
  const checkedNodes = nodes
    .map((node, originalIndex) => ({ node, originalIndex }))
    .filter(({ node }) => checkedNodeIds.has(node.id));
  if (checkedNodes.length === 0) {
    return { ok: false, reason: "no-selection" };
  }

  if (exportType === "Component page") {
    const records: Extract<
      ImageExportRequest,
      { exportType: "Component page" }
    >["records"] = [];
    for (const { node, originalIndex } of checkedNodes) {
      const draft = getDraft(drafts, node.id);
      const category = draft.category.trim();
      const state = draft.state.trim();
      if (category.length === 0) {
        return requiredFieldError(
          originalIndex,
          node.id,
          "category",
          "Category"
        );
      }
      if (state.length === 0) {
        return requiredFieldError(
          originalIndex,
          node.id,
          "state",
          "State"
        );
      }
      records.push({
        nodeId: node.id,
        name: node.name,
        category,
        state
      });
    }
    return {
      ok: true,
      request: { type: "export-images", exportType, records }
    };
  }

  const records: Extract<
    ImageExportRequest,
    { exportType: "UX Key page" }
  >["records"] = [];
  for (const { node, originalIndex } of checkedNodes) {
    const draft = getDraft(drafts, node.id);
    const uxScenario = draft.uxScenario.trim();
    if (uxScenario.length === 0) {
      return requiredFieldError(
        originalIndex,
        node.id,
        "uxScenario",
        "UX Scenario"
      );
    }
    const category = draft.category.trim();
    const state = draft.state.trim();
    const record: (typeof records)[number] = {
      nodeId: node.id,
      name: node.name,
      uxScenario
    };
    if (category.length > 0) {
      record.category = category;
    }
    if (state.length > 0) {
      record.state = state;
    }
    records.push(record);
  }
  return {
    ok: true,
    request: { type: "export-images", exportType, records }
  };
}
