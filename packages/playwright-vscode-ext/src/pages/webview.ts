/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type FrameLocator, type Locator, type Page } from '@playwright/test';

/**
 * VS Code mounts every webview as an `iframe.webview` whose inner `#active-frame`
 * holds the extension's content. None of the outer iframe's own attributes are
 * deterministic: `id` is empty, `name` is a per-run UUID, the class is always
 * `webview ready`, and the `src` host is a random per-run subdomain. When two
 * webviews are open at once, `.first()`/`.last()` is the only way to tell them
 * apart by the outer iframe alone — and that depends on mount order, which is
 * exactly the brittleness we want to avoid.
 *
 * The deterministic signal lives on the inner `#active-frame` element (VS Code
 * sets `newFrame.title = data.title` from the webview panel title in its
 * webview pre/index.html). `webviewActiveFrame` resolves the right webview by
 * matching against that element, so callers never assume DOM order.
 */
const OUTER_WEBVIEW = 'iframe.webview.ready';
const ACTIVE_FRAME = '#active-frame';

/** Predicate over a webview's `#active-frame` element, used to pick the right webview. */
export type ActiveFrameMatcher = (activeFrame: Locator) => Promise<boolean>;

/** Matches the webview whose `#active-frame` carries the given `title` attribute (the panel title). */
export const hasTitle =
  (title: string): ActiveFrameMatcher =>
  async activeFrame =>
    (await activeFrame.getAttribute('title')) === title;

/** Matches the webview whose inner document contains an element matching `selector` (e.g. an app root). */
export const hasContent =
  (selector: string): ActiveFrameMatcher =>
  async activeFrame =>
    (await activeFrame.contentFrame().locator(selector).count()) > 0;

/** Index of the first `iframe.webview.ready` whose `#active-frame` satisfies `match`, or -1. */
const matchingWebviewIndex = async (page: Page, match: ActiveFrameMatcher): Promise<number> => {
  const outers = page.locator(OUTER_WEBVIEW);
  const count = await outers.count();
  const matches = await Promise.all(
    Array.from({ length: count }, (_unused, i) =>
      match(outers.nth(i).contentFrame().locator(ACTIVE_FRAME)).catch(() => false)
    )
  );
  return matches.indexOf(true);
};

/**
 * Resolve the inner `#active-frame` FrameLocator of the webview whose `#active-frame`
 * satisfies `match`, regardless of mount order. Polls until a webview matches (webviews
 * mount asynchronously), then returns its content frame.
 *
 * `frameLocator` chaining always descends into the first matching outer iframe, so a
 * content filter can never reach a second webview through chaining alone — this resolves
 * the outer index explicitly before returning the frame.
 */
export const webviewActiveFrame = async (
  page: Page,
  match: ActiveFrameMatcher,
  options?: { timeout?: number }
): Promise<FrameLocator> => {
  await expect
    .poll(() => matchingWebviewIndex(page, match), {
      timeout: options?.timeout ?? 15_000,
      message: 'no open webview matched the predicate'
    })
    .toBeGreaterThanOrEqual(0);

  const index = await matchingWebviewIndex(page, match);
  return page.locator(OUTER_WEBVIEW).nth(index).contentFrame().locator(ACTIVE_FRAME).contentFrame();
};
