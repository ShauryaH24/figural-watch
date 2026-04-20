## figural-watch

`figural-watch` is a **Node-only CLI** that helps teams feel (and fix) multi-agent drift.

It compares what changed in a PR (git diff) against a repo’s **`specpack.json`** (a versioned, validated contract), then produces a **deterministic, CI-friendly** Markdown report.

### 60-second quickstart

From any repo you’re working in:

```bash
npx -y figural-watch init
npx -y figural-watch validate
npx -y figural-watch report --base origin/main --head HEAD
```

This writes:
- `specpack.json` (your source-of-truth contract)
- `figural-watch-report.md` (the diff vs contract report)

### How a user sets this up in their repo

There are two ways to use `figural-watch`:

#### Option A: Run locally (manual)

1) From the repo root, create a `specpack.json`:

```bash
npx -y figural-watch init
```

2) Edit `specpack.json` to match your decision + constraints.

3) Validate any time (no git required):

```bash
npx -y figural-watch validate
```

4) Generate a report for a PR branch (uses git refs):

```bash
npx -y figural-watch report --base origin/main --head HEAD
```

Notes:
- `validate` checks **local files only** (it does not require commits).
- `report` compares `base..head`, so make sure the base ref exists locally (often `git fetch origin`).

#### Option B: Run on GitHub PRs (automatic)

Add a workflow file to your repo at **`.github/workflows/figural-watch.yml`**, then commit + push it.

The recommended workflow (with **Check Summary + report artifact**) is in this repo at:
- `examples/github-actions/figural-watch.yml`

Copy that file into your repo at **`.github/workflows/figural-watch.yml`**.

If your default branch is `main`, you can use it as-is. If your default branch is `master`, change `origin/main` → `origin/master`.

Minimal scaffold (README-only) version:

```yaml
name: figural-watch
on:
  pull_request:
jobs:
  specpack:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      - run: npx -y figural-watch validate
      - run: npx -y figural-watch report --base origin/main --head HEAD
```

### Philosophy (why this exists)

- **Multi-agent drift is real**: multiple AI sessions can slowly “bend” a repo in different directions.
- **SpecPack is the source of truth**: a small JSON contract describing the decision, boundaries, tests, and success criteria.
- **Free vs paid boundary**:
  - **Free (this repo)**: post-hoc validation + reporting on diffs (no LLMs, deterministic).
  - **Paid (Figural app + MCP)**: live enforcement during agent sessions (prevents drift mid-session).

### SpecPack v1 (baseline)

Canonical file path: `./specpack.json`

Must include `specpack_version: 1` and validate against [`schemas/specpack.schema.json`](schemas/specpack.schema.json).

Example minimal SpecPack (what `figural-watch init` generates):

```json
{
  "specpack_version": 1,
  "decision": "Describe the single core decision this change set enforces.",
  "rationale": "Why this decision is the right trade-off.",
  "confidence": 0.7,
  "scope_in": ["What is explicitly in scope"],
  "scope_out": ["What is explicitly out of scope / forbidden"],
  "edge_cases": [],
  "tests": [],
  "success": [],
  "agent_brief": "A short brief for agents: what to do, what not to do, and constraints to respect."
}
```

### Commands

#### `figural-watch init`
- Creates `./specpack.json` from a minimal v1 template.

#### `figural-watch validate`
- Validates `./specpack.json` against the v1 JSON Schema.
- Exits non-zero on failure (CI-friendly).

#### `figural-watch report --base <ref> --head <ref>`
- Reads git diff between `base..head`
- Infers a small set of high-signal decisions (v0: deterministic heuristics only)
- Flags conflicts vs `scope_out`
- Writes `figural-watch-report.md`
- Exits **2** if “fail” conflicts exist, otherwise **0**

### GitHub Actions (scaffold)

```yaml
name: figural-watch
on:
  pull_request:
jobs:
  specpack:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      - run: npx -y figural-watch validate
      - run: npx -y figural-watch report --base origin/main --head HEAD
```

### License

MIT. See [`LICENSE`](LICENSE).

