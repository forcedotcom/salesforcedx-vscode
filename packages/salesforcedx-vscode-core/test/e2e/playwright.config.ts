/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig } from '@playwright/test';
import path from 'node:path';
import type { VSCodeTestOptions, VSCodeWorkerOptions } from 'vscode-test-playwright';

export default defineConfig<VSCodeTestOptions, VSCodeWorkerOptions>({
  testDir: path.join(__dirname),
  reporter: process.env.CI ? 'html' : 'list',
  timeout: 120_000,
  forbidOnly: !!process.env.CI,
  use: {
    // path to your extension folder, where its package.json is located
    extensionDevelopmentPath: path.join(__dirname, '..', '..'),
    vscodeTrace: {
      mode: 'on',
      screenshots: true,
      snapshots: true
    },
    baseDir: 'e2e-output'
  },
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  expect: {
    timeout: 30_000
  },
  // globalSetup: './src/globalSetup',
  projects: [
    {
      name: 'VSCode insiders',
      use: {
        vscodeVersion: 'insiders'
      }
    }
  ]
});
