/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { chromium, Browser, BrowserContext, Page } from '@playwright/test';

type ConsoleCapture = {
  consoleErrors: string[];
  removeAllListenersErrors: string[];
  fiberFailureErrors: string[];
  authLogs: string[];
  allLogs: string[];
};

export type CDPConnection = {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  capture: ConsoleCapture;
};

/**
 * Connect to an existing Chrome instance via CDP and set up console logging
 */
export const connectToCDPBrowser = async (port: number = 9222): Promise<CDPConnection> => {
  console.log('Connecting to existing Chrome instance via CDP...');

  const browser = await chromium.connectOverCDP(`http://localhost:${port}`);
  const contexts = browser.contexts();
  console.log(`Contexts in CDP session: ${contexts.length}`);

  if (contexts.length === 0) {
    throw new Error('No browser contexts found in CDP session');
  }

  const context = contexts[0];
  const pages = context.pages();
  console.log(`Pages in context: ${pages.length}`);

  if (pages.length === 0) {
    throw new Error('No pages found in browser context');
  }

  // Find the VS Code page (usually the one with localhost:3000)
  const page = pages.find(p => p.url().includes('localhost:3000')) ?? pages[0];
  console.log(`Connected to page: ${page.url()}`);

  // Set up console message tracking
  const capture: ConsoleCapture = {
    consoleErrors: [],
    removeAllListenersErrors: [],
    fiberFailureErrors: [],
    authLogs: [],
    allLogs: []
  };

  page.on('console', msg => {
    const text = msg.text();
    console.log(`[Console ${msg.type()}] ${text}`);

    // Capture ALL messages for debugging
    capture.allLogs.push(`[${msg.type()}] ${text}`);

    // Track auth-related logs
    const authMarkers = ['🔍', '✅', '❌', 'auth', 'Auth', 'Effect'];
    if (authMarkers.some(marker => text.includes(marker))) {
      capture.authLogs.push(text);
    }

    const errorMarkers = ['TypeError', 'Error:', 'Uncaught', 'removeAllListeners', 'FiberFailure'];
    if (msg.type() === 'error' || errorMarkers.some(marker => text.includes(marker))) {
      capture.consoleErrors.push(text);

      if (text.includes('removeAllListeners')) {
        capture.removeAllListenersErrors.push(text);
      }

      if (text.includes('FiberFailure')) {
        capture.fiberFailureErrors.push(text);
      }
    }
  });

  return { browser, context, page, capture };
};

/**
 * Report console capture results
 */
export const reportConsoleCapture = (capture: ConsoleCapture): void => {
  console.log(`Total console errors captured: ${capture.consoleErrors.length}`);
  console.log(`removeAllListeners errors found: ${capture.removeAllListenersErrors.length}`);
  console.log(`FiberFailure errors found: ${capture.fiberFailureErrors.length}`);
  console.log(`Auth-related logs found: ${capture.authLogs.length}`);
  console.log(`Total console messages: ${capture.allLogs.length}`);

  if (capture.authLogs.length > 0) {
    console.log('\n🔍 Auth Logs:');
    capture.authLogs.forEach(log => console.log(`  ${log}`));
  }

  if (capture.allLogs.length > 0 && capture.allLogs.length < 20) {
    console.log('\n📋 All Console Messages:');
    capture.allLogs.forEach(log => console.log(`  ${log}`));
  }

  if (capture.removeAllListenersErrors.length > 0) {
    console.log('\n❌ removeAllListeners Errors:');
    capture.removeAllListenersErrors.forEach(error => console.log(`  ${error}`));
  }

  if (capture.fiberFailureErrors.length > 0) {
    console.log('\n❌ FiberFailure Errors:');
    capture.fiberFailureErrors.forEach(error => console.log(`  ${error}`));
  }
};
