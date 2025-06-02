import type { VSCodeTestOptions, VSCodeWorkerOptions } from 'vscode-test-playwright';
import { defineConfig } from '@playwright/test';
import path from 'path';

/**
 * Use this as a template for adding playwright-based e2e to other packages
 */
export default defineConfig<VSCodeTestOptions, VSCodeWorkerOptions>({
  // testDir: path.join(__dirname, 'test'),
  reporter: process.env.CI ? 'html' : 'list',
  timeout: 120_000,
  forbidOnly: !!process.env.CI,
  use: {
    // path to your extension folder, where its package.json is located
    extensionDevelopmentPath: path.join(__dirname, '..'),
    vscodeTrace: {
      mode: 'on',
      screenshots: true,
      snapshots: true
    },
    baseDir: 'integration-output'
  },
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  expect: {
    timeout: 30_000
  },
  globalSetup: './src/globalSetup',
  projects: [
    {
      name: 'VSCode insiders',
      use: {
        vscodeVersion: 'insiders'
      }
    }
  ]
});
