---
description: Writing Playwright tests (*.spec.ts)
---

# Coding Playwright Tests

## Reuse

Check playwright ext for reuse before creating utilities/PageObjects

## Structure

One test per file. Many steps allowed.

## Waiting and Timing

- Never `waitForTimeout` - wait for specific page elements
- `page.waitForSelector()` - elements appear
- `expect(locator).toBeVisible()` - visibility
- `page.waitForLoadState()` - page state changes
- Don't use `page.waitForResponse()` - doesn't work in desktop/electron
- Don't use `networkidle` - not available on desktop/electron
- Use `test.step` to organize sequential tests

## File System and VS Code API

**NEVER use Node.js fs/path or VS Code API** - desktop only, not web

**Use UI interactions:**

- `Control+p` - Quick Open
- `Control+Home`, `Control+s` - navigate and save
- `page.keyboard.type()` - edit content
- Monaco editor selectors - interact with editor

Tests must work identically in web and desktop.

## Virtualized DOM

VS Code API (tree views, editors, output panels) only contains visible DOM lines (rest not present until scrolled into view).

- Don't rely on `scrollTo` - target element won't exist
- `scrollIntoViewIfNeeded` probably won't help

## ContextMenus and Mac

No way to read/interact with context menus (right click) on mac+Desktop+electron. Tests/steps must skip themselves. Windows and Web are fine.

## Selectors and Assertions

- Prefer `aria` (getByRole) over css selectors
- `expect` assertions need clear error messages. Import `expect` from playwright
- Fail early, avoid fallbacks/retries
- Reusable locators belong in `locators.ts` - check before creating new ones

## Commands and Shortcuts

- Use `f1` for commands, not meta-shift-P
- Use `Control` for all. No ControlOrMeta
