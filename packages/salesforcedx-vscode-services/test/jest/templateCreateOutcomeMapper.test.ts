/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { CreateOutput } from '@salesforce/templates';
import { toTemplateCreateOutcome } from '../../src/owned/templateCreateOutcomeMapper';

describe('templateCreateOutcomeMapper', () => {
  describe('toTemplateCreateOutcome', () => {
    it('should map all fields from CreateOutput to TemplateCreateOutcome', () => {
      const source: CreateOutput = {
        outputDir: '/path/to/project/force-app/main/default/classes',
        created: [
          '/path/to/project/force-app/main/default/classes/MyClass.cls',
          '/path/to/project/force-app/main/default/classes/MyClass.cls-meta.xml'
        ],
        rawOutput:
          'target dir = /path/to/project/force-app/main/default/classes\n   create MyClass.cls\n   create MyClass.cls-meta.xml\n'
      };

      const result = toTemplateCreateOutcome(source);

      expect(result).toEqual({
        outputDir: '/path/to/project/force-app/main/default/classes',
        created: [
          '/path/to/project/force-app/main/default/classes/MyClass.cls',
          '/path/to/project/force-app/main/default/classes/MyClass.cls-meta.xml'
        ],
        rawOutput:
          'target dir = /path/to/project/force-app/main/default/classes\n   create MyClass.cls\n   create MyClass.cls-meta.xml\n'
      });
    });

    it('should handle empty created array', () => {
      const source: CreateOutput = {
        outputDir: '/path/to/project',
        created: [],
        rawOutput: ''
      };

      const result = toTemplateCreateOutcome(source);

      expect(result).toEqual({
        outputDir: '/path/to/project',
        created: [],
        rawOutput: ''
      });
    });

    it('should map multiple created files', () => {
      const source: CreateOutput = {
        outputDir: '/path/to/project/force-app/main/default/lwc/myComponent',
        created: [
          '/path/to/project/force-app/main/default/lwc/myComponent/myComponent.js',
          '/path/to/project/force-app/main/default/lwc/myComponent/myComponent.html',
          '/path/to/project/force-app/main/default/lwc/myComponent/myComponent.js-meta.xml',
          '/path/to/project/force-app/main/default/lwc/myComponent/__tests__/myComponent.test.js'
        ],
        rawOutput: 'Created LWC component'
      };

      const result = toTemplateCreateOutcome(source);

      expect(result.created).toHaveLength(4);
      expect(result.outputDir).toBe('/path/to/project/force-app/main/default/lwc/myComponent');
      expect(result.rawOutput).toBe('Created LWC component');
    });

    it('should handle single file creation', () => {
      const source: CreateOutput = {
        outputDir: '/path/to/project/force-app/main/default/triggers',
        created: ['/path/to/project/force-app/main/default/triggers/AccountTrigger.trigger'],
        rawOutput: 'Created trigger file'
      };

      const result = toTemplateCreateOutcome(source);

      expect(result.created).toHaveLength(1);
      expect(result.created[0]).toBe('/path/to/project/force-app/main/default/triggers/AccountTrigger.trigger');
    });

    it('should preserve exact rawOutput string including whitespace', () => {
      const rawOutputWithFormatting = '   target dir = /some/path\n      create File1.cls\n      create File2.cls\n';
      const source: CreateOutput = {
        outputDir: '/some/path',
        created: ['/some/path/File1.cls', '/some/path/File2.cls'],
        rawOutput: rawOutputWithFormatting
      };

      const result = toTemplateCreateOutcome(source);

      expect(result.rawOutput).toBe(rawOutputWithFormatting);
    });
  });
});
