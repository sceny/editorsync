---
description: Update project documentation after code changes
---

# Documentation Update Workflow

Use this workflow after making code changes to ensure docs stay in sync.

## Steps

### 1. Check What Changed
Review recent code changes:
- New files or modules added?
- APIs or interfaces modified?
- Configuration options added?
- Bug fixes that affect documented behavior?

### 2. Update Architecture Docs
If structural changes were made, update:
- `docs/architecture.md` - Project structure, data flow diagrams
- `docs/code-review.md` - Utilities, testing info

### 3. Update Platform Docs
If platform behavior changed, update:
- `docs/platforms.md` - File locations, frontmatter fields, format conversion tables

### 4. Update User-Facing Docs
If features or config changed, update:
- `README.md` - Quick start, features list
- `docs/configuration.md` - Settings reference
- `docs/troubleshooting.md` - Common issues

### 5. Update Sync Logic Docs
If sync behavior changed, update:
- `docs/sync-logic.md` - Flow diagrams, loop prevention, concurrency

### 6. Update Documentation Context Rule
If any doc files were added, removed, or renamed, update:
- `.agent/rules/documentation-context.md`

Changes to make:
- Add/remove file names in "Required Context Files" list
- Update file descriptions if purpose changed
- Keep summaries concise but accurate

## Documentation Principles

1. **No before/after language** - Describe current state only
2. **Keep it concise** - Use tables over paragraphs where possible
3. **Use Mermaid diagrams** - For architecture and data flow
4. **Link between docs** - Use relative links with breadcrumbs
5. **Update version** - Bump version in package.json if significant

## Branding Layout

### README.md (main)
Add the big logo centered at the top:
```html
<p align="center">
  <img src="docs/assets/logo.png" alt="Sceny Editor Sync" width="200">
</p>
```

### All docs/ files
Add the small icon header left-aligned before the title:
```html
<img src="../icon.png" alt="Sceny" width="32" align="left" style="margin-right: 10px;">

# Title
```

**Assets:**
- `docs/assets/logo.png` - Large logo for README
- `icon.png` - Small icon for doc headers

## Verification

After updating:
1. Check all links work
2. Verify Mermaid diagrams render
3. Run `npm run compile` to ensure no broken imports
4. Run `npm test` to ensure tests pass
