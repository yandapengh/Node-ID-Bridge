# Node ID Bridge

Node ID Bridge is a focused Figma Design plugin that bridges canvas selections and Figma node IDs. Its two independent tabs copy or restore canvas selections and resolve pasted IDs into annotated PNG batches for DesignDiffAgent.

The plugin runs locally, has no allowed network domains, and does not send design data anywhere.

Current usability release: **V1.1** (`1.1.0`).

## Features

- Read the current Figma selection and preview each node's name, ID, and type.
- Copy selection data as Compact text or compact JSON, with optional node names.
- Extract ordinary node IDs, URL-style IDs, and instance-context IDs from arbitrary text.
- Keep independent input, resolution, checkbox, and draft state while switching between **Selection ↔ IDs** and **Selection → Image export**.
- Review resolved nodes in a horizontally scrollable table, keep or clear individual nodes with the header checkbox, and copy the checked list as `ID | Name`.
- Step through resolved nodes with the arrow controls or keyboard, then restore the checked nodes with **Apply selection**.
- Resolve all IDs before changing the selection, preventing partial selection on errors or across pages.
- Resolve a separate set of export IDs across Pages without changing the current Figma selection, Page, or viewport.
- Export checked rows as PNG 1x for either **Component page** or **UX Key page**, with inline or bulk-written metadata.
- Download an atomic ZIP containing `input/<export type>/` PNGs plus one batch-specific UTF-8 manifest. Any node failure prevents the ZIP download.

Supported input examples:

```text
5309:30855
5309-30855
I6003:47907;6003:40969 | Toast
I6057:28440;6003:47907;6003:40969
https://www.figma.com/design/example/file?node-id=5309-30855
```

Instance-context IDs beginning with `I` are preserved as one complete node address, including nested `;` path segments.

## V1.1 workflow

1. Paste node IDs or any text containing node IDs, then choose **Select nodes**.
2. Selection succeeds atomically and stays in **Input**. Open **Resolved** when you want to review the table; every node is checked initially.
3. Use row checkboxes or the header checkbox to build the final selection. Its half-selected state reflects a partial selection.
4. Click a row or use ↑/↓ to inspect each node on the Figma canvas. Inspection does not change its checkbox.
5. Choose **Copy** to copy checked nodes as `ID | Figma name`, or **Apply** to restore checked nodes as the final canvas selection.

Changing or clearing the input invalidates its old resolved rows. Node validation is atomic: missing, deleted, non-selectable, or cross-page nodes do not produce a partial final selection.

## Image export

1. Open **Selection → Image export**, choose **Component page** or **UX Key page**, and paste node IDs.
2. Choose **Confirm**. Every ID must resolve, but the nodes may span Pages; confirmation never changes the canvas selection or viewport.
3. In the automatically opened table, check the rows to update and export. Use **批量写入** for one checked-row field or edit metadata inline.
4. For Component pages, **Category** and **State** are required. For UX Key pages, **UX Scenario** is required while **Category** and **State** are optional. Unchecked rows are not validated or exported, and their drafts remain intact.
5. Click the **Name** header to cycle original, ascending, and descending display order. Choose **Export PNG 1x + ZIP** when ready.

The main thread resolves every checked row again by Node ID before export. If a Figma name changed, the manifest and PNG filename use the current name while the entered fields remain linked to the same Node ID. Display sorting never changes ZIP or manifest order: both follow the original pasted-ID order. ZIP entries use this shape:

```text
input/
└── Component page/
    ├── 5392-134853__Home Page-Batch-1-L2.png
    └── manifest--component-page--20260727T163012123Z.json
```

Each export is an independent batch. The plugin does not merge previous manifests, hash images, call localhost, or send data over the network.

Every generated manifest uses `schemaVersion: 2`. Component records contain `nodeId`, current `name`, `type`, required `category`, required `state`, and `imagePath`. UX Key records contain required `uxScenario`; non-empty `category` and `state` drafts are included, while empty optional fields are omitted.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

Run the full verification pipeline with:

```bash
npm run check
```

Build output is written to `dist/main.js` and `dist/ui.html`.

## Load in Figma Desktop

1. Run `npm install` and `npm run build` in this directory.
2. Open the Figma Desktop app and a Figma Design file.
3. Open **Plugins → Development → Import plugin from manifest…**.
4. Choose this project's `manifest.json`.
5. Launch **Node ID Bridge** from **Plugins → Development**.

After source changes, run `npm run build`, then reopen or rerun the development plugin in Figma.

The manifest contains a stable local-development ID. If you publish the plugin,
replace it with the plugin ID assigned by Figma during registration.
