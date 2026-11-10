/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { containerTest } from './containerFixtures';
import type * as desktopFixturesType from './desktopFixtures';

// Exported so a spec shared across desktop and container can branch on the one thing container
// genuinely can't share: its org is boot-authed by the orchestrator, so specs that need a real,
// freshly-created org locally (setupWorkbenchAndAuth) must skip that step in container mode.
export const isContainer = process.env.VSCODE_CONTAINER === '1';

/**
 * `desktopFixtures.ts` registers `oasDesktopTest.beforeEach(() => oasDesktopTest.skip(true, ...))` at
 * module scope (A4V v4 regression). Playwright attaches hooks registered during a shared fixture
 * module's one-time (cached) load to whichever spec file happens to trigger that load first in a
 * given run — not to the specific `TestType` the hook was declared on. That's harmless in `index.ts`,
 * where every consumer is `oasDesktopTest` anyway (today's desktop-only specs are meant to always
 * skip). It is NOT harmless here: importing `desktopFixtures` eagerly would make a container-mode run
 * of this module's `oasTest` (usually `containerTest`, never skipped) silently eat that same skip hook
 * just because it happened to load first — reproduced and confirmed via `--only`-isolated runs. Load
 * it lazily, and only on the desktop branch, so a container-mode run never evaluates it at all.
 */
export const oasTest = isContainer
  ? containerTest
  : (require('./desktopFixtures') as typeof desktopFixturesType).oasDesktopTest;
