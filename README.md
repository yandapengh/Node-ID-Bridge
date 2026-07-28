# Node ID Bridge

Node ID Bridge 是一个本地运行的 Figma Design 插件，用于复制节点 ID、恢复画布选择，以及为 DesignDiffAgent 导出带元数据的 PNG 批次。

当前版本：**V1.2**（`1.2.0`）。

插件不允许访问任何网络域名，也不会向外部发送设计数据。

## 功能

- 读取当前 Figma 选择，并将节点 ID 复制为 Compact 文本或 JSON。
- 将粘贴的 ID 解析为可检查的表格，再复制或应用选择。
- 在两个工作流页签之间切换时，分别保留输入、解析结果、勾选状态和草稿。
- 通过点击行、按钮或键盘方向键，在画布中聚焦解析后的节点。
- 跨多个 Figma Page 解析图片导出 ID，同时不改变当前 Page、选择或视口。
- 行内编辑 Component 或 UX Key 元数据，也可以向所有勾选行批量写入一个字段。
- 仅导出勾选行，并始终按照最初粘贴 ID 的顺序生成 PNG。
- 下载一个原子 ZIP，其中包含 PNG 文件和 `schemaVersion: 2` manifest；任意节点失败时整批不下载。

支持的输入示例：

```text
5309:30855
5309-30855
I6003:47907;6003:40969 | Toast
I6057:28440;6003:47907;6003:40969
https://www.figma.com/design/example/file?node-id=5309-30855
```

以 `I` 开头的实例上下文 ID 会作为一个完整节点地址保留，包括嵌套的 `;` 路径段。

## 普通用户快速开始

Node ID Bridge 不是命令行程序，不使用 `npm start`。终端命令只用于准备或重新构建插件，插件本身在 Figma Desktop 中运行。

仓库已经包含 `dist/` 预构建文件，因此普通用户 Clone 仓库或下载 ZIP 并解压后，可以直接在 Figma Desktop 中导入插件。拉取更新后，或者 `dist/` 缺失时，建议使用 Node.js 重新构建。

### 使用要求

- Figma Desktop
- 只有使用 `git clone` 时才需要安装 Git
- 只有重新构建插件时才需要安装 Node.js 和 npm

需要 Node.js 时，请从 [nodejs.org](https://nodejs.org/) 安装当前的 Node.js LTS 版本。安装后关闭并重新打开终端，再继续执行命令。

## Windows — 命令提示符（CMD）

### 方式 A：Clone 仓库

打开 Windows 的**命令提示符（CMD）**，然后运行：

```bat
cd /d "%USERPROFILE%\Downloads"
git clone https://github.com/yandapengh/Node-ID-Bridge.git
cd "Node-ID-Bridge"
```

### 方式 B：下载并解压 ZIP

1. 在 GitHub 仓库页面选择 **Code → Download ZIP**。
2. 解压下载的 ZIP。
3. 打开 Windows 的**命令提示符（CMD）**，进入解压后的目录。默认目录名通常是 `Node-ID-Bridge-main`：

```bat
cd /d "%USERPROFILE%\Downloads\Node-ID-Bridge-main"
```

如果文件夹解压到了其他位置，请将命令中的路径替换为实际路径。路径中包含空格时，请保留双引号。

### 在 Windows 中检查或重新构建

预构建插件应当包含 `dist/main.js` 和 `dist/ui.html`。在 CMD 中运行：

```bat
dir dist
```

如果需要从源码重新构建，请先确认 Node.js 和 npm 可用，再安装依赖并构建：

```bat
node --version
npm --version
npm install
npm run build
```

终端显示以下内容时，表示构建完成：

```text
Built dist/main.js and dist/ui.html
```

## macOS — 终端（Terminal）

### 方式 A：Clone 仓库

打开 macOS 的**终端（Terminal）**，然后运行：

```bash
cd "$HOME/Downloads"
git clone https://github.com/yandapengh/Node-ID-Bridge.git
cd "Node-ID-Bridge"
```

### 方式 B：下载并解压 ZIP

1. 在 GitHub 仓库页面选择 **Code → Download ZIP**。
2. 双击下载的 ZIP 完成解压。
3. 打开 macOS 的**终端（Terminal）**，进入解压后的目录：

```bash
cd "$HOME/Downloads/Node-ID-Bridge-main"
```

如果文件夹解压到了其他位置，请将命令中的路径替换为实际路径。路径中包含空格时，请保留双引号。

### 在 macOS 中检查或重新构建

预构建插件应当包含 `dist/main.js` 和 `dist/ui.html`。在终端中运行：

```bash
ls -l dist
```

如果需要从源码重新构建，请先确认 Node.js 和 npm 可用，再安装依赖并构建：

```bash
node --version
npm --version
npm install
npm run build
```

终端显示以下内容时，表示构建完成：

```text
Built dist/main.js and dist/ui.html
```

## 在 Figma Desktop 中导入并运行

完成 Clone、ZIP 解压或重新构建后：

1. 打开 Figma Desktop，并打开任意 Figma Design 文件。
2. 打开 **Plugins → Development → Import plugin from manifest…**。
3. 选择 `Node-ID-Bridge` 根目录中的 `manifest.json`。
4. 打开 **Plugins → Development → Node ID Bridge** 运行插件。

重新构建后，请关闭并重新运行开发插件，让 Figma 重新加载 `dist/main.js` 和 `dist/ui.html`。

## Selection ↔ IDs 使用方法

### Selection → IDs

1. 在 Figma 画布中选择一个或多个节点。
2. 打开 **Selection ↔ IDs** 页签。
3. 点击 **Read current selection**。
4. 选择 Compact 或 JSON，并决定是否包含节点名称。
5. 点击 **Copy**。

### IDs → Selection

1. 粘贴节点 ID，或者粘贴包含节点 ID 的文本。
2. 点击 **Select nodes**。插件会先验证所有 ID，验证成功后才改变画布选择。
3. 成功后插件仍停留在 **Input**；打开 **Resolved** 查看解析表格。
4. 使用行复选框或表头复选框确定最终节点集合。
5. 点击一行或使用 ↑/↓ 在 Figma 画布中聚焦节点。
6. 点击 **Copy** 复制勾选 ID，或者点击 **Apply** 将勾选节点应用为最终画布选择。

修改或清空输入会使之前的解析结果失效。节点缺失、已删除、不可选择或跨 Page 时，不会产生部分应用的选择结果。

## Selection → Image export 使用方法

1. 打开 **Selection → Image export** 页签。
2. 选择 **Component page** 或 **UX Key page**。
3. 粘贴节点 ID，然后点击 **Confirm**。ID 可以跨 Page，确认过程不会改变画布。
4. 在表格中勾选需要更新和导出的行。
5. 点击一行中复选框和输入框以外的区域，Figma 会选中该节点、切换到对应 Page，并缩放聚焦到节点。行本身获得键盘焦点后，也可以按 Enter 执行相同操作。
6. 参考画布中聚焦的节点填写行内元数据，或者使用 **批量写入** 向所有勾选行写入一个字段。
7. Component page 必须填写 **Category** 和 **State**。
8. UX Key page 必须填写 **UX Scenario**，**Category** 和 **State** 为可选字段。
9. 如需改变表格显示顺序，可点击 **Name** 表头，在原始顺序、升序和降序之间切换。
10. 点击 **Export PNG 1x + ZIP**。

未勾选行不会被校验、更新或导出，但其草稿会保留。表格显示排序不会改变 ZIP 或 manifest 的记录顺序；输出始终按照最初粘贴 ID 的顺序生成。

主线程会在导出前重新解析每个勾选 Node ID。如果 Figma 节点名称发生变化，manifest 和 PNG 文件名会使用当前名称，表格中同时显示警告。如果任意行导出失败，整个批次失败，并且不会下载 ZIP。

ZIP 内容结构示例：

```text
input/
└── Component page/
    ├── 5392-134853__Home Page-Batch-1-L2.png
    └── manifest--component-page--20260727T163012123Z.json
```

每个 manifest 均使用 `schemaVersion: 2`。Component 记录包含必填的 `category` 和 `state`；UX Key 记录包含必填的 `uxScenario`，非空的可选 `category` 和 `state` 会被写入，空的可选字段会被省略。

### 分批导出说明

每次导出都是一个独立、不可变的批次，并生成带时间戳的独立 manifest。不要直接将存在重复 Node ID 的多个 ZIP 无差别解压到同一目录，否则 PNG 可能被覆盖，旧 manifest 也可能指向被覆盖后的文件。

如果多个批次的 Node ID 完全不重叠，可以在后续流程中合并 PNG 和 manifest 记录。如果 Node ID 存在重复，应使用下游脚本以 `nodeId` 为主键执行冲突检查，并明确选择报错或“最新批次优先”策略。插件本身不会读取或合并之前下载的批次。

## 更新已有 Clone

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

构建完成后，请在 Figma Desktop 中重新运行插件。

## 常见问题

- **无法识别 `git`：** 安装 Git，关闭并重新打开 CMD 或 Terminal 后重试；也可以改用 **Download ZIP**。
- **无法识别 `node` 或 `npm`：** 安装 Node.js LTS，关闭并重新打开终端，然后运行 `node --version` 和 `npm --version` 检查。
- **缺少 `dist`：** 运行 `npm install`，然后运行 `npm run build`。
- **Figma 找不到插件文件：** 请选择根目录中的 `manifest.json`，不要选择 `dist/` 内的文件。
- **修改后 Figma 中没有变化：** 运行 `npm run build`，然后关闭并重新运行开发插件。

## 开发

安装依赖并运行完整验证：

```bash
npm install
npm run check
```

也可以单独运行：

```bash
npm run typecheck
npm test
npm run build
```

构建产物写入 `dist/main.js` 和 `dist/ui.html`。这两个文件会提交到仓库，因此用户下载仓库快照后可以直接在 Figma Desktop 中加载插件。

`node_modules/` 不会提交到仓库；依赖版本由 `package.json` 和 `package-lock.json` 管理。

manifest 中包含稳定的本地开发插件 ID。如果通过 Figma Community 发布插件，请将其替换为 Figma 注册时分配的插件 ID。
