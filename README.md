# DataLens UI — with Chart Editor restored (OSS)

> **Fork of [`datalens-tech/datalens-ui`](https://github.com/datalens-tech/datalens-ui) at tag `v0.3831.0`.**
> This fork **restores the Chart Editor** (custom JavaScript charts) that was removed from
> the open-source build of DataLens, so editor charts (`table_node`, custom heatmaps, etc.)
> render in a self-hosted instance — not only in managed Yandex Cloud DataLens.

## Why

The Chart Editor — the engine that runs user-authored JavaScript charts (the `Params` /
`Urls` / `JavaScript` / `UI` / `Config` tabs) — was stripped from the OSS codebase
(PR [#1783 "Remove CE"](https://github.com/datalens-tech/datalens-ui/pull/1783) and the
UI-side removal in #2353). On a self-hosted OSS instance, any dashboard containing editor
charts fails with `POST /api/run 400 Unknown config type table_node`. The visual chart
authoring (shelves/pivot wizard) survives in OSS, but the JS Editor does not.

This fork brings the whole server-side editor pipeline back.

## What is restored

- **Editor runner + isolated-vm sandbox** — the full `charts-engine` editor execution path
  (`runners/editor.ts`, `processor/isolated-sandbox/*`, the ChartEditor API interop) that
  `#1783` deleted, re-applied onto `v0.3831.0` and adapted to ~15 months of API drift.
- **`EnableChartEditor` feature** + the **Editor chart** entry in the "Create" menu and the
  `/editor` route (UI side).
- **Bundled editor libraries** (`libs/dataset/v2`, `libs/datalens/v3`, `libs/control/v1`,
  `libs/qlchart/v1`) — built into `ce-dist/bundled-libs.js` via `npm run build:ce-bundle`
  and loaded into the sandbox, with dependency resolution skipping the United Storage lookup
  for them (they don't exist in OSS US).
- **`ChartEditor.getId(linkAlias)`** — resolves editor link aliases (`config.meta.links`) to
  real entry ids, plus the legacy `Editor` / `editor` global aliases.
- **Workbook import** of editor charts and tab-name alignment so the shared chart-api context
  serves both the wizard (`Sources`/`Prepare`/`Controls`) and editor (`Urls`/`JavaScript`/`UI`)
  tab names.

Verified end-to-end: `table_node` tables and custom heatmap editor charts render with live
data in a self-hosted instance.

## Build & use

```bash
# 1. Build the image (adds isolated-vm + the CE bundle; ~8 min)
git clone https://github.com/fdsov/datalens-ui-editor.git
cd datalens-ui-editor
docker build -t datalens-ui:0.3831.0-editor .

# 2. In a standard datalens-tech/datalens deployment, point the `ui` and `ui-api`
#    services at this image instead of ghcr.io/datalens-tech/datalens-ui:0.3831.0,
#    then start the stack (HC=1 keeps Highcharts rendering):
HC=1 docker compose up -d ui ui-api
```

Notes:
- `isolated-vm` is a native module — the Dockerfile installs `python3` + `g++`/`make` for it.
- The CE bundle is rebuilt during `docker build` (`npm run build:ce-bundle`); `ce-dist/` is
  git-ignored.
- Highcharts (`HC=1`) remains proprietary; for a fully-permissive prod build, migrate charts
  to `@gravity-ui/charts` (Gravity Charts), which this fork's bundle already supports.

## License & attribution

DataLens is licensed under **Apache-2.0** (see [`LICENSE`](./LICENSE), Copyright YANDEX LLC).
This fork is a derivative work distributed under the same license. All credit for DataLens
goes to the [datalens-tech](https://github.com/datalens-tech) team; this repository only
re-enables the Chart Editor in the open-source build.

---

# DataLens (upstream documentation)

### Prerequisites

[Install docker](https://docs.docker.com/engine/install/)

[Install docker compose plugin](https://docs.docker.com/compose/install/linux/) if it not already installed

### Start project in dev mode

#### In Docker mode (easy-mode):

On Linux systems:

```bash
git clone git@github.com:datalens-tech/datalens.git
cd datalens
./init.sh --ipv6 --docker-ipv6 --dev-light --dev-root --dev-ui
```

On macOS systems:

```bash
git clone git@github.com:datalens-tech/datalens.git
cd datalens
./init.sh --dev-light --dev-ui
```

#### Local mode:

Install Node.js >= v18.17.0 manually or via [node version manager](https://github.com/nvm-sh/nvm).

Start project in dev mode:

```bash
# Start backend for datalens:
git clone git@github.com:datalens-tech/datalens.git
cd datalens
docker compose -f docker-compose.dev.yaml up

# Start datalens ui in dev mode:
git clone git@github.com:datalens-tech/datalens-ui.git
cd ui
npm ci
npm run dev
```

Now you can open datalens in dev mode at [http://localhost:8080](http://localhost:8080)

### Credentials for postgres

Hostname:

```
pg-demo-connection
```

Port:

```
5432
```

Path to database:

```
demo
```

Username:

```
demo
```

Password:

```
demo
```
