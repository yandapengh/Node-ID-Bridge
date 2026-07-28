# Node ID Bridge

Node ID Bridge is a local Figma Design plugin for copying node IDs, restoring canvas selections, and exporting annotated PNG batches for DesignDiffAgent.

Current release: **V1.2** (`1.2.0`).

The plugin has no allowed network domains and does not send design data anywhere.

## Features

- Read the current Figma selection and copy node IDs as Compact text or JSON.
- Resolve pasted IDs into a review table before copying or applying a selection.
- Keep independent input, resolved rows, checkbox state, and drafts across the two workflow tabs.
- Focus resolved nodes from the table with row clicks, buttons, or the Up/Down Arrow keys.
- Resolve export IDs across multiple Figma Pages without changing the current Page, selection, or viewport.
- Edit Component or UX Key metadata inline or write one field to all checked rows.
- Export only checked rows as PNG 1x in their original pasted-ID order.
- Download one atomic ZIP with PNG files and a `schemaVersion: 2` manifest.

Supported input examples:

```text
5309:30855
5309-30855
I6003:47907;6003:40969 | Toast
I6057:28440;6003:47907;6003:40969
https://www.figma.com/design/example/file?node-id=5309-30855
```

Instance-context IDs beginning with `I` are preserved as one complete node address, including nested `;` path segments.

## Quick start for regular users

Node ID Bridge is not a command-line program and does not use `npm start`. Terminal commands prepare or rebuild the plugin; the plugin itself runs inside the Figma Desktop app.

The repository includes prebuilt files in `dist/`, so a regular user can load the plugin immediately after cloning or extracting the downloaded ZIP. Rebuilding with Node.js is recommended after pulling updates or when `dist/` is missing.

### Requirements

- Figma Desktop
- Git, only when using `git clone`
- Node.js and npm, only when rebuilding the plugin

If Node.js is needed, install a current Node.js LTS release from [nodejs.org](https://nodejs.org/), then close and reopen the terminal before continuing.

### Windows — Command Prompt (CMD)

#### Option A: clone the repository

Open **Command Prompt**, then run:

```bat
cd /d "%USERPROFILE%\Downloads"
git clone https://github.com/yandapengh/Node-ID-Bridge.git
cd "Node-ID-Bridge"
```

#### Option B: download and extract the ZIP

1. On GitHub, choose **Code → Download ZIP**.
2. Extract the ZIP.
3. Open **Command Prompt** and enter the extracted folder. The default folder name is usually `Node-ID-Bridge-main`:

```bat
cd /d "%USERPROFILE%\Downloads\Node-ID-Bridge-main"
```

If the folder was extracted elsewhere, replace the path with its actual location. Keep the quotation marks when the path contains spaces.

#### Verify or rebuild on Windows

The prebuilt plugin should contain these two files:

```bat
dir dist
```

To rebuild from source, verify Node.js and npm, install dependencies, and run the build:

```bat
node --version
npm --version
npm install
npm run build
```

The build is ready when the terminal prints:

```text
Built dist/main.js and dist/ui.html
```

### macOS — Terminal

#### Option A: clone the repository

Open **Terminal**, then run:

```bash
cd "$HOME/Downloads"
git clone https://github.com/yandapengh/Node-ID-Bridge.git
cd "Node-ID-Bridge"
```

#### Option B: download and extract the ZIP

1. On GitHub, choose **Code → Download ZIP**.
2. Double-click the downloaded ZIP to extract it.
3. Open **Terminal** and enter the extracted folder:

```bash
cd "$HOME/Downloads/Node-ID-Bridge-main"
```

If the folder was extracted elsewhere, replace the path with its actual location. Keep the quotation marks when the path contains spaces.

#### Verify or rebuild on macOS

The prebuilt plugin should contain these two files:

```bash
ls -l dist
```

To rebuild from source, verify Node.js and npm, install dependencies, and run the build:

```bash
node --version
npm --version
npm install
npm run build
```

The build is ready when the terminal prints:

```text
Built dist/main.js and dist/ui.html
```

## Load and run the plugin in Figma Desktop

After cloning, extracting, or rebuilding:

1. Open the Figma Desktop app and open any Figma Design file.
2. Open **Plugins → Development → Import plugin from manifest…**.
3. Select `manifest.json` in the root of the `Node-ID-Bridge` folder.
4. Open **Plugins → Development → Node ID Bridge** to run it.

After rebuilding, close and rerun the development plugin in Figma so it reloads `dist/main.js` and `dist/ui.html`.

## How to use Selection ↔ IDs

### Selection → IDs

1. Select one or more nodes on the Figma canvas.
2. Open **Selection ↔ IDs**.
3. Choose **Read current selection**.
4. Choose Compact or JSON and whether node names should be included.
5. Choose **Copy**.

### IDs → Selection

1. Paste node IDs or text containing node IDs.
2. Choose **Select nodes**. All IDs are validated before the canvas selection changes.
3. The plugin stays on **Input** after success; open **Resolved** to review the table.
4. Use row checkboxes or the header checkbox to choose the final set.
5. Click a row or use ↑/↓ to focus nodes on the canvas.
6. Choose **Copy** for the checked ID list or **Apply** for the checked canvas selection.

Changing or clearing the input invalidates the previous resolved rows. Missing, deleted, non-selectable, or cross-page nodes never produce a partial applied selection.

## How to use Selection → Image export

1. Open **Selection → Image export**.
2. Choose **Component page** or **UX Key page**.
3. Paste node IDs and choose **Confirm**. IDs may span Pages, and confirmation does not change the canvas.
4. In the table, check the rows that should be updated and exported.
5. Click a row outside its checkbox and input fields to select, reveal, and zoom to that node on the Figma canvas. Press Enter while the row itself is focused for the same action.
6. Use the focused canvas node as visual context while editing metadata inline, or use **批量写入** to write a field to every checked row.
7. For Component pages, fill required **Category** and **State** fields.
8. For UX Key pages, fill required **UX Scenario**; **Category** and **State** are optional.
9. Optionally click the **Name** header to change display sorting.
10. Choose **Export PNG 1x + ZIP**.

Unchecked rows are not validated, updated, or exported, but their drafts are retained. Display sorting never changes ZIP or manifest order: output always follows the original pasted-ID order.

The main thread resolves each checked Node ID again before exporting. If a Figma name changed, the manifest and PNG filename use the current name and the table shows a warning. If any row fails, the whole batch fails and no ZIP is downloaded.

ZIP entries use this shape:

```text
input/
└── Component page/
    ├── 5392-134853__Home Page-Batch-1-L2.png
    └── manifest--component-page--20260727T163012123Z.json
```

Every generated manifest uses `schemaVersion: 2`. Component records contain required `category` and `state`. UX Key records contain required `uxScenario`; non-empty optional `category` and `state` values are included, while empty optional fields are omitted.

## Updating an existing clone

### Windows CMD

```bat
cd /d "C:\path\to\Node-ID-Bridge"
git pull
npm install
npm run build
```

### macOS Terminal

```bash
cd "/path/to/Node-ID-Bridge"
git pull
npm install
npm run build
```

Rerun the plugin in Figma Desktop after the build completes.

## Troubleshooting

- **`git` is not recognized:** install Git, reopen Command Prompt or Terminal, and retry. Alternatively, use **Download ZIP**.
- **`node` or `npm` is not recognized:** install Node.js LTS, close and reopen the terminal, then check `node --version` and `npm --version`.
- **`dist` is missing:** run `npm install` followed by `npm run build`.
- **Figma cannot find the plugin files:** select the root `manifest.json`, not a file inside `dist/`.
- **Changes do not appear in Figma:** run `npm run build`, then close and rerun the development plugin.

## Development

Install dependencies and run the complete verification pipeline:

```bash
npm install
npm run check
```

Individual commands:

```bash
npm run typecheck
npm test
npm run build
```

Build output is written to `dist/main.js` and `dist/ui.html`. Both files are committed so downloaded repository snapshots can be loaded directly in Figma Desktop.

The manifest contains a stable local-development ID. If you publish the plugin through the Figma Community, replace it with the plugin ID assigned by Figma during registration.
