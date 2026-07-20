# Node ID Bridge

Node ID Bridge is a focused Figma Design plugin that bridges canvas selections and Figma node IDs. It reads the current selection into a human-readable preview and copies either Compact text or JSON. It can also extract node IDs from arbitrary pasted text and select all resolved nodes when they belong to one page.

The plugin runs locally, has no allowed network domains, and does not send design data anywhere.

## Features

- Read the current Figma selection and preview each node's name, ID, and type.
- Copy selection data as Compact text or compact JSON, with optional node names.
- Extract ordinary node IDs, URL-style IDs, and instance-context IDs from arbitrary text.
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
