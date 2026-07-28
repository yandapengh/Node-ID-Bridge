import {
  createExportBatchIdentity,
  createPngImagePath
} from "./export-format";
import type {
  ExportErrorMessage,
  ExportItemStatusMessage,
  ExportManifestRecord,
  ExportSuccessMessage,
  ImageExportRequest
} from "./types";

export type PngExportSettings = {
  format: "PNG";
  constraint: {
    type: "SCALE";
    value: 1;
  };
};

export type ExportableFigmaNode = {
  id: string;
  name: string;
  exportAsync(settings: PngExportSettings): Promise<Uint8Array>;
};

export type ExportBatchDependencies = {
  getNodeByIdAsync(id: string): Promise<ExportableFigmaNode | null>;
  now?: () => Date;
  onItemStatus?: (message: ExportItemStatusMessage) => void;
};

export type ExportBatchResult =
  | { ok: true; message: ExportSuccessMessage }
  | { ok: false; message: ExportErrorMessage };

const PNG_1X_SETTINGS: PngExportSettings = {
  format: "PNG",
  constraint: {
    type: "SCALE",
    value: 1
  }
};

function createManifestRecord(
  request: ImageExportRequest,
  index: number,
  actualName: string,
  imagePath: string
): ExportManifestRecord {
  if (request.exportType === "Component page") {
    const source = request.records[index];
    if (source === undefined) {
      throw new Error("The export request changed while it was being processed.");
    }
    return {
      nodeId: source.nodeId,
      name: actualName,
      type: "Component page",
      category: source.category,
      state: source.state,
      imagePath
    };
  }

  const source = request.records[index];
  if (source === undefined) {
    throw new Error("The export request changed while it was being processed.");
  }
  const record: ExportManifestRecord = {
    nodeId: source.nodeId,
    name: actualName,
    type: "UX Key page",
    uxScenario: source.uxScenario,
    imagePath
  };
  if (source.category !== undefined) {
    record.category = source.category;
  }
  if (source.state !== undefined) {
    record.state = source.state;
  }
  return record;
}

export async function exportImageBatch(
  request: ImageExportRequest,
  dependencies: ExportBatchDependencies
): Promise<ExportBatchResult> {
  const identity = createExportBatchIdentity(
    request.exportType,
    dependencies.now?.() ?? new Date()
  );
  const records: ExportManifestRecord[] = [];
  const images: ExportSuccessMessage["images"] = [];

  for (let index = 0; index < request.records.length; index += 1) {
    const source = request.records[index];
    if (source === undefined) {
      continue;
    }

    dependencies.onItemStatus?.({
      type: "export-item-status",
      batchId: identity.batchId,
      nodeId: source.nodeId,
      status: "exporting"
    });

    try {
      const node = await dependencies.getNodeByIdAsync(source.nodeId);
      if (node === null) {
        return {
          ok: false,
          message: {
            type: "export-error",
            batchId: identity.batchId,
            nodeId: source.nodeId,
            message: `Node ${source.nodeId} could not be found or exported. The whole batch was cancelled and no ZIP was downloaded.`
          }
        };
      }

      const warning =
        node.name === source.name
          ? undefined
          : `Name changed from “${source.name}” to “${node.name}”. Fields remained linked by Node ID.`;
      const imagePath = createPngImagePath(
        request.exportType,
        source.nodeId,
        node.name
      );
      const bytes = await node.exportAsync(PNG_1X_SETTINGS);
      records.push(createManifestRecord(request, index, node.name, imagePath));
      images.push({ nodeId: source.nodeId, imagePath, bytes });
      const completedStatus: ExportItemStatusMessage = {
        type: "export-item-status",
        batchId: identity.batchId,
        nodeId: source.nodeId,
        status: "exported",
        actualName: node.name
      };
      if (warning !== undefined) {
        completedStatus.warning = warning;
      }
      dependencies.onItemStatus?.(completedStatus);
    } catch (error: unknown) {
      const detail = error instanceof Error ? ` ${error.message}` : "";
      return {
        ok: false,
        message: {
          type: "export-error",
          batchId: identity.batchId,
          nodeId: source.nodeId,
          message: `PNG export failed for node ${source.nodeId}.${detail} The whole batch was cancelled and no ZIP was downloaded.`
        }
      };
    }
  }

  return {
    ok: true,
    message: {
      type: "export-success",
      manifest: {
        schemaVersion: 2,
        batchId: identity.batchId,
        exportType: request.exportType,
        exportedAt: identity.exportedAt,
        pngScale: 1,
        records
      },
      images
    }
  };
}
