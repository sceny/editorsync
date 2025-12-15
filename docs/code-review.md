# Code Quality

[← Documentation](./README.md) · [README](../README.md)

---

## Overview

This document describes the code quality standards and patterns used in this codebase.

---

## Architecture Patterns

### Shared Utilities (`utils.ts`)

Common operations are centralized:

| Utility | Purpose |
|---------|---------|
| `normalizePath(p)` | Convert backslashes to forward slashes for consistent path keys |
| `ensureDir(dir)` | Create directory recursively if it doesn't exist |
| `safeUnlink(path)` | Delete file, ignoring ENOENT errors |
| `ensureGitignore(dir, entries)` | Ensure .gitignore contains specified entries |

### Platform Helpers (`platforms/helpers.ts`)

| Utility | Purpose |
|---------|---------|
| `findFilesRecursive(dir, ext)` | Recursively find files with specific extension |
| `ensureDir(dir)` | Create directory recursively |
| `normalizePath(p)` | Normalize path separators |

### Error Boundaries

All event handlers in `extension.ts` are wrapped with try-catch:

```typescript
const saveDisposable = vscode.workspace.onDidSaveTextDocument(async (document) => {
    try {
        syncQueue.queueSync(document.uri.fsPath, () => syncFile(document));
    } catch (error) {
        logger.error('Error in save handler', { error: String(error) });
    }
});
```

### Intermediate Model

All platforms export to a common `IntermediateModel` format, reducing N×(N-1) transforms to 2N.

### File-Based Locking

Uses `fs.watch` to react immediately when lock is released, with `wx` flag for atomic creation.

---

## Logging Guidelines

| Level | When to Use | Examples |
|-------|-------------|----------|
| `error` | Operation failed, requires attention | Handler errors, sync failures |
| `warn` | Unexpected but recovered | Stale lock removed, watcher error |
| `info` | Major operations | File saved, sync started, watcher setup |
| `debug` | Internal flow details | Exported model, target platforms, bounceback skipped |

---

## Code Organization

### Core Files
- `extension.ts` - VS Code entry point, event handlers with error boundaries
- `fileSync.ts` - Sync orchestration
- `model.ts` - Intermediate model types
- `transforms.ts` - Frontmatter parsing

### Platform Modules (`platforms/`)
- `index.ts` - Registry, detection, exports
- `types.ts` - Platform interface
- `helpers.ts` - Shared file operations
- `cursor.ts` - Cursor platform
- `antigravity.ts` - Antigravity platform
- `vscode.ts` - VS Code Copilot platform

### Infrastructure
- `utils.ts` - Shared utilities
- `journal.ts` - Loop prevention
- `syncLock.ts` - Concurrency with fs.watch
- `syncQueue.ts` - Debouncing
- `config.ts` - Settings
- `logger.ts` - Rotating logs
