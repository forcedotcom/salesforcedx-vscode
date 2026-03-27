/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as utilsVscode from '@salesforce/salesforcedx-utils-vscode';
import { projectGenerateWithManifest, sfProjectGenerate } from '../../../src/commands/projectGenerate';

describe('projectGenerate', () => {
  let sfCommandletSpy: jest.SpyInstance;
  let capturedExecutor: any;

  beforeEach(() => {
    capturedExecutor = undefined;
    sfCommandletSpy = jest.spyOn(utilsVscode, 'SfCommandlet').mockImplementation(function (this: any, ...args: any[]) {
      capturedExecutor = args[2];
      return { run: jest.fn().mockResolvedValue(undefined) } as any;
    });
  });

  afterEach(() => {
    sfCommandletSpy.mockRestore();
  });

  describe('sfProjectGenerate', () => {
    it('should run commandlet with executor that has manifest false by default', async () => {
      await sfProjectGenerate();
      expect(sfCommandletSpy).toHaveBeenCalled();
      expect(capturedExecutor).toBeDefined();
      const options = capturedExecutor.constructTemplateOptions({
        projectName: 'TestProject',
        projectUri: '/tmp',
        projectTemplate: 'standard'
      });
      expect(options.manifest).toBe(false);
    });

    it('should pass through all project template types in template options', async () => {
      await sfProjectGenerate();
      const templates = ['standard', 'empty', 'analytics', 'reactinternalapp', 'reactexternalapp'] as const;
      for (const template of templates) {
        const options = capturedExecutor.constructTemplateOptions({
          projectName: 'TestProject',
          projectUri: '/tmp',
          projectTemplate: template
        });
        expect(options.template).toBe(template);
      }
    });
  });

  describe('projectGenerateWithManifest', () => {
    it('should run commandlet with executor that has manifest true', async () => {
      await projectGenerateWithManifest();
      expect(sfCommandletSpy).toHaveBeenCalled();
      expect(capturedExecutor).toBeDefined();
      const options = capturedExecutor.constructTemplateOptions({
        projectName: 'TestProject',
        projectUri: '/tmp',
        projectTemplate: 'standard'
      });
      expect(options.manifest).toBe(true);
    });
  });
});
