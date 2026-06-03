/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { RuleTester } from '@typescript-eslint/rule-tester';
import { noSwallowedRejection } from '../src/noSwallowedRejection';

const ruleTester = new RuleTester();

ruleTester.run('no-swallowed-rejection', noSwallowedRejection, {
  valid: [
    // try/catch but no expect call inside
    {
      code: `async function f() { try { await foo(); } catch {} }`
    },
    // .catch on non-expect chain
    {
      code: `async function f() { await page.click().catch(() => {}); }`
    },
    // helpers.ts:179-182 pattern — locator.isVisible().catch(() => false)
    {
      code: `async function f() { await page.locator('foo').isVisible({ timeout: 400 }).catch(() => false); }`
    },
    // helpers.ts:185-188 pattern — non-expect chain cleanup
    {
      code: `async function f() { await welcomeOverlay.first().waitFor({ state: 'hidden' }).catch(() => {}); }`
    },
    // try/expect with re-throw
    {
      code: `async function f() { try { await expect(x).toBeVisible(); } catch (e) { throw new Error('wrap', { cause: e }); } }`
    },
    // try/expect with log + re-throw
    {
      code: `async function f() { try { await expect(x).toBeVisible(); } catch (e) { console.error(e); throw e; } }`
    },
    // bare expect, no catch — the right way
    {
      code: `async function f() { await expect(x).toBeVisible({ timeout: 1000 }); }`
    },
    // expect inside catch only — no swallowing of expect rejection in the try block
    {
      code: `async function f() { try { await foo(); } catch (e) { expect(e).toBeDefined(); } }`
    }
  ],
  invalid: [
    // empty catch around expect
    {
      code: `async function f() { try { await expect(x).toBeVisible(); } catch {} }`,
      errors: [{ messageId: 'swallowedRejection' }]
    },
    // empty body
    {
      code: `async function f() { try { await expect(x).toBeVisible(); } catch (e) { /* ignore */ } }`,
      errors: [{ messageId: 'swallowedRejection' }]
    },
    // log-only
    {
      code: `async function f() { try { expect(x).toBe(1); } catch (e) { console.log(e); } }`,
      errors: [{ messageId: 'swallowedRejection' }]
    },
    // empty arrow on expect chain
    {
      code: `async function f() { await expect(x).toBeVisible().catch(() => {}); }`,
      errors: [{ messageId: 'swallowedRejection' }]
    },
    // discarding fallback on assertion
    {
      code: `async function f() { await expect(x).toBeVisible().catch(() => false); }`,
      errors: [{ messageId: 'swallowedRejection' }]
    },
    // log-only on expect chain
    {
      code: `async function f() { await expect(locator).toHaveText('foo').catch(e => logger.warn(e)); }`,
      errors: [{ messageId: 'swallowedRejection' }]
    }
  ]
});
