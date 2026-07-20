# Node ID Bridge

Node ID Bridge is a focused Figma Design plugin that bridges canvas selections and Figma node IDs. It reads the current selection into a human-readable preview and copies either Compact text or JSON. It can also extract node IDs from arbitrary pasted text and select all resolved nodes when they belong to one page.

The plugin runs locally, has no allowed network domains, and does not send design data anywhere.

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
