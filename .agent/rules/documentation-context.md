---
trigger: always
description: Always load and consider project documentation before making decisions
---

# Documentation Context Rule

**Critical**: Always load and consider these documentation files before making any code or design decisions:

## Required Context Files

1. **README.md** - Project overview, features, supported platforms
2. **docs/architecture.md** - System design, project structure, data flow
3. **docs/platforms.md** - Platform file formats, frontmatter fields, format conversion
4. **docs/sync-logic.md** - Synchronization mechanics, loop prevention
5. **docs/configuration.md** - Available settings
6. **docs/code-review.md** - Code quality standards, utilities, testing

## Behavior

- If context window discards documentation, reload it before continuing
- All decisions must align with documented architecture and patterns
- When asked to change things, verify the change is consistent with existing docs
- If a change conflicts with docs, either update the docs or explain the conflict

## Decision Framework

Before implementing any change:
1. Check if it affects documented behavior
2. Check if it follows documented patterns
3. Check if it requires documentation updates
4. If updating docs, follow `/update-docs` workflow

## After Every Change

**Important**: At the end of any code or documentation change, run the `/update-docs` workflow to ensure all documentation stays synchronized with the current state of the codebase.
