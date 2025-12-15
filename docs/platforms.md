# Platforms

[← Documentation](./README.md) · [README](../README.md)

---

## Overview

Each platform has specific file locations, formats, and frontmatter conventions.

## Cursor

### Rules

| Property | Value |
|----------|-------|
| **Location** | `.cursor/rules/*.mdc` or `.md` |
| **Legacy** | `.cursorrules` (single file) |
| **Format** | YAML frontmatter + Markdown body |

**Frontmatter fields:**
```yaml
---
alwaysApply: true|false   # Whether rule applies to all files
globs: "**/*.ts"          # File pattern to match
description: "..."        # Description for model-triggered rules
---
```

### Workflows (Commands)

| Property | Value |
|----------|-------|
| **Location** | `.cursor/commands/*.md` |
| **Format** | YAML frontmatter + Markdown body |

**Frontmatter fields:**
```yaml
---
description: "What this command does"
---
```

---

## Antigravity

### Rules

| Property | Value |
|----------|-------|
| **Location** | `.agent/rules/*.md` |
| **Format** | YAML frontmatter + Markdown body |

**Frontmatter fields:**
```yaml
---
trigger: always|glob|model_decision
globs: "**/*.ts"          # Only for trigger: glob
description: "..."        # Only for trigger: model_decision
---
```

### Workflows

| Property | Value |
|----------|-------|
| **Location** | `.agent/workflows/*.md` |
| **Format** | YAML frontmatter + Markdown body |

**Frontmatter fields:**
```yaml
---
description: "What this workflow does"
---
```

---

## VS Code (GitHub Copilot)

### Rules (Instructions)

| Property | Value |
|----------|-------|
| **Location** | `.github/instructions/*.md` |
| **Format** | YAML frontmatter + Markdown body |

**Frontmatter fields:**
```yaml
---
applyTo: "**/*.ts"        # File pattern (glob)
---
```

### Workflows

VS Code Copilot does not currently support workflows.

---

## Format Conversion

When syncing between platforms, frontmatter is automatically converted:

| Source | Target | Conversion |
|--------|--------|------------|
| Cursor `alwaysApply: true` | Antigravity | `trigger: always` |
| Cursor `globs` without description | Antigravity | `trigger: glob` |
| Cursor `description` without globs | Antigravity | `trigger: model_decision` |
| Antigravity `trigger: always` | Cursor | `alwaysApply: true` |
| Antigravity `trigger: glob/model_decision` | Cursor | `alwaysApply: false` |

## Extension Mapping

| Platform | Rules Extension | Workflows Extension |
|----------|-----------------|---------------------|
| Cursor | `.mdc` or `.md` | `.md` |
| Antigravity | `.md` | `.md` |
| VS Code | `.md` | — |
