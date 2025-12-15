# Sceny Editor Sync

> Sync AI assistant configuration files between Cursor, Antigravity, and VS Code.

[![VS Code Extension](https://img.shields.io/badge/VS%20Code-Extension-blue)](https://marketplace.visualstudio.com/items?itemName=sceny.sceny-editor-sync)

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
