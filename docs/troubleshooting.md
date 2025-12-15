# Troubleshooting

[← Documentation](./README.md) · [README](../README.md)

---

## Common Issues

### Sync Not Working

#### Check if extension is enabled

1. Open Settings
2. Search "Sceny AI Editor Sync: Enabled"
3. Ensure checkbox is checked

#### Check logs

1. Navigate to `.rulessync/logs/` in your workspace
2. Open the latest `sceny-YYYY-MM-DD.log` file
3. Look for errors or unexpected "skip" messages

#### Verify file is in a known platform location

Files must match one of these patterns:
- `.cursor/rules/**/*.mdc` or `.md`
- `.cursor/commands/**/*.md`
- `.agent/rules/**/*.md`
- `.agent/workflows/**/*.md`
- `.github/instructions/**/*.md`

---

### Infinite Loop / Constant Activity

#### Symptom

Logs show continuous "File changed" events even with no user activity.

#### Cause

Journal mismatch - files we write aren't being recognized as "ours".

#### Solution

1. Delete the journal file:
   ```powershell
   Remove-Item ".rulessync/journal.json"
   ```
2. Reload VS Code window
3. The journal will regenerate with correct paths

---

### Files Not Syncing on Save

#### Check the log for the flow

Look for these log entries in order:
1. `File saved event` - Event was detected
2. `syncFile triggered` - Sync function was called
3. `Platform detection` - Source platform was identified
4. `Syncing file` - Actual sync is happening

If it stops at any point, the log will explain why.

#### Common reasons for skipping

| Log Message | Meaning |
|-------------|---------|
| `Sync disabled, ignoring` | Extension is disabled |
| `No workspace folder` | File is not in an open workspace |
| `Skipping bounceback` | File was just written by us |
| `Not a platform file` | Path doesn't match any platform |

---

### Deletion Not Propagating

#### Symptom

Deleting a source file doesn't delete the corresponding target files.

#### Check deletion behavior setting

1. Open Settings
2. Search "Sceny AI Editor Sync: Deletion Behavior"
3. Set to `delete` (not `ignore`)

---

### Rename Not Working

#### Symptom

Renaming a file creates the new target but doesn't delete the old one.

#### Cause

VS Code may not fire `onDidRenameFiles` for all rename operations (especially external ones).

#### Workaround

1. Manually delete the old target file, or
2. Use "Sync All" command to clean up

---

## Diagnostic Commands

### Check journal contents

```powershell
type ".rulessync/journal.json"
```

### View recent logs

```powershell
Get-Content ".rulessync/logs/sceny-$(Get-Date -Format 'yyyy-MM-dd').log" -Tail 50
```

### Force re-sync

Use Command Palette → "Sceny AI Editor Sync: Force Sync All"

---

## Getting Help

1. Set log level to `debug` for more detail
2. Reproduce the issue
3. Check the log file
4. Look for error messages or unexpected flow
