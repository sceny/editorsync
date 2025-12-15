# Configuration

[← Documentation](./README.md) · [README](../README.md)

---

## Settings

All settings are prefixed with `scenyAIEditorSync.`

### Core Settings

#### `enabled`
| Property | Value |
|----------|-------|
| Type | `boolean` |
| Default | `false` |
| Description | Master switch to enable/disable all sync functionality |

Must be enabled for any sync operations to occur.

---

### Behavior Settings

#### `deletionBehavior`
| Property | Value |
|----------|-------|
| Type | `"ignore"` \| `"delete"` \| `"ask"` |
| Default | `"ask"` |
| Description | What to do when a source file is deleted |

- `ignore` - Leave target files in place
- `delete` - Automatically delete corresponding target files
- `ask` - Prompt before deleting (not yet implemented, acts like `delete`)

#### `limitBehavior`
| Property | Value |
|----------|-------|
| Type | `"warn"` \| `"silent"` |
| Default | `"warn"` |
| Description | What to do when content exceeds platform limits |

Antigravity has a 12,000 character limit. When exceeded:
- `warn` - Show warning notification
- `silent` - Sync anyway without warning

---

### Platform Settings

#### `syncPlatforms`
| Property | Value |
|----------|-------|
| Type | `array` of `"cursor"` \| `"antigravity"` \| `"vscode"` |
| Default | `[]` (auto-detect) |
| Description | Explicitly configure which platforms to sync to |

When empty, platforms are auto-detected based on folder existence.

---

### Logging Settings

#### `logLevel`
| Property | Value |
|----------|-------|
| Type | `"error"` \| `"warn"` \| `"info"` \| `"debug"` |
| Default | `"info"` |
| Description | Minimum log level to record |

Logs are written to `.rulessync/logs/sceny-YYYY-MM-DD.log`

#### `logRetentionDays`
| Property | Value |
|----------|-------|
| Type | `number` |
| Default | `7` |
| Description | Days to keep log files before auto-cleanup |

---

## Example Configuration

```json
// .vscode/settings.json
{
    "scenyAIEditorSync.enabled": true,
    "scenyAIEditorSync.deletionBehavior": "delete",
    "scenyAIEditorSync.limitBehavior": "warn",
    "scenyAIEditorSync.syncPlatforms": ["cursor", "antigravity"],
    "scenyAIEditorSync.logLevel": "debug",
    "scenyAIEditorSync.logRetentionDays": 14
}
```

---

## Per-Workspace vs User Settings

All settings can be configured at:
- **User level** - Applies to all workspaces
- **Workspace level** - Overrides user settings for specific workspace

Workspace settings take precedence.
