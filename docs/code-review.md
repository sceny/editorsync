<img src="../icon.png" alt="Sceny" width="32" align="left" style="margin-right: 10px;">

# Code Quality

[← Documentation](./README.md) · [README](../README.md)

---

## Shared Utilities

### `utils.ts`
| Function | Purpose |
|----------|---------|
| `normalizePath(p)` | Convert backslashes to forward slashes |
| `ensureDir(dir)` | Create directory recursively |
| `safeUnlink(path)` | Delete file, ignore ENOENT |
| `ensureGitignore(dir, entries)` | Ensure entries in .gitignore |

### `platforms/helpers.ts`
| Function | Purpose |
|----------|---------|
| `findFilesRecursive(dir, ext)` | Find files with extension |
| `ensureDir(dir)` | Create directory recursively |
| `normalizePath(p)` | Normalize path separators |

---

## Error Handling

All event handlers in `extension.ts` use error boundaries:

```typescript
const saveDisposable = vscode.workspace.onDidSaveTextDocument(async (document) => {
    try {
        syncQueue.queueSync(document.uri.fsPath, () => syncFile(document));
    } catch (error) {
        logger.error('Error in save handler', { error: String(error) });
    }
});
```

---

## Logging Guidelines

| Level | Use Case |
|-------|----------|
| `error` | Operation failed |
| `warn` | Unexpected but recovered |
| `info` | Major operations |
| `debug` | Internal flow details |

---

## Testing

**Framework:** Jest + ts-jest

**Test Files:**
- `transforms.test.ts` - Frontmatter parsing (6 tests)
- `utils.test.ts` - Path/file utilities (9 tests)
- `platforms/helpers.test.ts` - File operations (6 tests)

**Commands:**
```bash
npm test              # Run all tests
npm run test:coverage # With coverage report
```

---

## Code Organization

| Layer | Files |
|-------|-------|
| Entry | `extension.ts` |
| Orchestration | `fileSync.ts` |
| Platforms | `platforms/*.ts` |
| Infrastructure | `journal.ts`, `syncLock.ts`, `syncQueue.ts` |
| Utilities | `utils.ts`, `platforms/helpers.ts` |
| Config | `config.ts`, `logger.ts` |
