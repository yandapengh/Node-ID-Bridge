# Node ID Bridge

Node ID Bridge is a focused Figma Design plugin that bridges canvas selections and Figma node IDs. It reads the current selection into a human-readable preview and copies either Compact text or JSON. It can also extract node IDs from arbitrary pasted text and select all resolved nodes when they belong to one page.

The plugin runs locally, has no allowed network domains, and does not send design data anywhere.

Current usability release: **V1.1** (`1.1.0`).

## Features

- Read the current Figma selection and preview each node's name, ID, and type.
- Copy selection data as Compact text or compact JSON, with optional node names.
- Extract ordinary node IDs, URL-style IDs, and instance-context IDs from arbitrary text.
- Review resolved nodes in input order, keep or clear individual nodes, and copy the checked list as `ID | Name`.
- Step through resolved nodes with the arrow controls or keyboard, then restore the checked nodes with **Apply selection**.
- Resolve all IDs before changing the selection, preventing partial selection on errors or across pages.

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
2. Review the resolved nodes in their original input order. Every node is checked initially.
3. Use the checkboxes, **Select all**, or **Clear all** to build the final selection.
4. Click a row or use ↑/↓ to inspect each node on the Figma canvas. Inspection does not change its checkbox.
5. Choose **Copy to clipboard** to copy checked nodes as `ID | Figma name`, or **Apply selection** to restore the checked nodes as the final canvas selection.

Node validation is atomic: missing, deleted, non-selectable, or cross-page nodes do not produce a partial final selection.

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
