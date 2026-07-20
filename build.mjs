import { build } from "esbuild";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const rootDirectory = import.meta.dirname;
const outputDirectory = resolve(rootDirectory, "dist");

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

await build({
  entryPoints: [resolve(rootDirectory, "src/main.ts")],
  outfile: resolve(outputDirectory, "main.js"),
  bundle: true,
  minify: true,
  platform: "browser",
  target: "es2017",
  logLevel: "info"
});

const uiBuild = await build({
  entryPoints: [resolve(rootDirectory, "src/ui/ui.ts")],
  bundle: true,
  minify: true,
  platform: "browser",
  target: "es2017",
  write: false,
  logLevel: "silent"
});

const uiJavaScript = uiBuild.outputFiles
  .map((outputFile) => outputFile.text)
  .join("\n")
  .replaceAll("</script", "<\\/script");
const [htmlTemplate, styles] = await Promise.all([
  readFile(resolve(rootDirectory, "src/ui/index.html"), "utf8"),
  readFile(resolve(rootDirectory, "src/ui/styles.css"), "utf8")
]);

const bundledHtml = htmlTemplate
  .replace("/*__STYLES__*/", styles.replaceAll("</style", "<\\/style"))
  .replace("/*__UI_SCRIPT__*/", uiJavaScript);

await writeFile(resolve(outputDirectory, "ui.html"), bundledHtml, "utf8");

console.log("Built dist/main.js and dist/ui.html");
