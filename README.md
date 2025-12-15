<table>
  <tr>
    <td width="140" valign="top">
      <img src="docs/assets/logo.png" alt="Sceny" width="128">
    </td>
    <td valign="top">
      <h1 style="margin: 0;">Sceny Editor Sync</h1>
      <span>Synchronize AI editor rules between Cursor, VS Code, and Antigravity</span><br><br>
      <a href="https://marketplace.visualstudio.com/items?itemName=sceny.sceny-editor-sync"><img src="https://img.shields.io/badge/VS%20Code-Extension-blue" alt="VS Code Extension"></a>
      <img src="https://img.shields.io/badge/build-passing-brightgreen" alt="Build Status">
      <img src="https://img.shields.io/badge/version-0.1.4-blue" alt="Version">
    </td>
  </tr>
</table>

## Overview

Sceny Editor Sync keeps your AI assistant rules synchronized across multiple editors. Edit your rules in Cursor, and they'll automatically appear in VS Code's GitHub Copilot format (and vice versa).

### Supported Platforms

| Platform | Rules Location | Workflows Location |
|----------|----------------|-------------------|
| **Cursor** | `.cursor/rules/*.mdc` | `.cursor/commands/*.md` |
| **Antigravity** | `.agent/rules/*.md` | `.agent/workflows/*.md` |
| **VS Code Copilot** | `.github/instructions/*.md` | — |

## Quick Start

1. Install the extension
2. Open Settings → Search "Sceny"
3. Enable **Sceny Editor Sync: Enabled**
4. Edit any rules file → it syncs to other platforms automatically

## Features

- **Auto-sync on save** - Edit a rule, save, and it syncs
- **Bi-directional** - Works from any platform to any other
- **Format conversion** - Automatically converts frontmatter formats
- **Rename/Delete propagation** - File operations sync too
- **Loop prevention** - Journal tracks writes to prevent infinite loops
- **Concurrent safety** - File-based locking prevents race conditions

## Documentation

- [Architecture](./docs/architecture.md) - System design and data flow
- [Platforms](./docs/platforms.md) - Platform-specific details
- [Sync Logic](./docs/sync-logic.md) - How synchronization works
- [Configuration](./docs/configuration.md) - Settings reference
- [Troubleshooting](./docs/troubleshooting.md) - Common issues and solutions

## Commands

| Command | Description |
|---------|-------------|
| `Sceny Editor Sync: Sync All` | Sync all files from default platform |
| `Sceny Editor Sync: Force Sync All` | Force re-sync ignoring cache |
| `Sceny Editor Sync: Sync from Cursor` | Sync using Cursor as source |
| `Sceny Editor Sync: Sync from Antigravity` | Sync using Antigravity as source |
| `Sceny Editor Sync: Sync from VS Code` | Sync using VS Code Copilot as source |

## Development

```bash
# Install dependencies
npm install

# Compile
npm run compile

# Watch mode
npm run watch

# Run tests
npm test

# Test with coverage
npm run test:coverage
```

## License

MIT
