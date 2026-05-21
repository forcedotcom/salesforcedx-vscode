/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { packageJsonNoDefaultTrue } from '../src/packageJsonNoDefaultTrue';
import { createJsonLinter, filterByRule } from './jsonLintHelper';

const RULE_NAME = 'package-json-no-default-true';

describe('package-json-no-default-true', () => {
  it('should be exported', () => {
    expect(packageJsonNoDefaultTrue).toBeDefined();
    expect(packageJsonNoDefaultTrue.meta).toBeDefined();
    expect(packageJsonNoDefaultTrue.meta?.type).toBe('problem');
  });

  describe('with Linter', () => {
    const lintJson = createJsonLinter(RULE_NAME, packageJsonNoDefaultTrue);

    it('should pass when boolean setting uses default: false', () => {
      const code = JSON.stringify(
        {
          name: 'test',
          contributes: {
            configuration: {
              properties: {
                'test.setting': {
                  type: 'boolean',
                  default: false,
                  description: '%test_description%'
                }
              }
            }
          }
        },
        null,
        2
      );

      const errors = filterByRule(lintJson(code), RULE_NAME);
      expect(errors).toHaveLength(0);
    });

    it('should pass when boolean setting uses default: null', () => {
      const code = JSON.stringify(
        {
          name: 'test',
          contributes: {
            configuration: {
              properties: {
                'test.setting': {
                  type: 'boolean',
                  default: null,
                  description: '%test_description%'
                }
              }
            }
          }
        },
        null,
        2
      );

      const errors = filterByRule(lintJson(code), RULE_NAME);
      expect(errors).toHaveLength(0);
    });

    it('should pass when non-boolean setting uses default: true', () => {
      const code = JSON.stringify(
        {
          name: 'test',
          contributes: {
            configuration: {
              properties: {
                'test.stringSetting': {
                  type: 'string',
                  default: 'true',
                  description: '%test_description%'
                }
              }
            }
          }
        },
        null,
        2
      );

      const errors = filterByRule(lintJson(code), RULE_NAME);
      expect(errors).toHaveLength(0);
    });

    it('should pass when number setting uses default: 1', () => {
      const code = JSON.stringify(
        {
          name: 'test',
          contributes: {
            configuration: {
              properties: {
                'test.numberSetting': {
                  type: 'number',
                  default: 1,
                  description: '%test_description%'
                }
              }
            }
          }
        },
        null,
        2
      );

      const errors = filterByRule(lintJson(code), RULE_NAME);
      expect(errors).toHaveLength(0);
    });

    it('should pass for allowlisted visualforce.format.enable', () => {
      const code = JSON.stringify(
        {
          name: 'test',
          contributes: {
            configuration: {
              properties: {
                'visualforce.format.enable': {
                  type: 'boolean',
                  default: true,
                  description: '%visualforce.format.enable.desc%'
                }
              }
            }
          }
        },
        null,
        2
      );

      const errors = filterByRule(lintJson(code), RULE_NAME);
      expect(errors).toHaveLength(0);
    });

    it('should pass for allowlisted salesforcedx-vscode-core.show-cli-success-msg', () => {
      const code = JSON.stringify(
        {
          name: 'test',
          contributes: {
            configuration: {
              properties: {
                'salesforcedx-vscode-core.show-cli-success-msg': {
                  type: 'boolean',
                  default: true,
                  description: '%show_cli_success_msg_description%'
                }
              }
            }
          }
        },
        null,
        2
      );

      const errors = filterByRule(lintJson(code), RULE_NAME);
      expect(errors).toHaveLength(0);
    });

    it('should pass for allowlisted salesforcedx-vscode-metadata.sourceTracking.enableConflictDetection', () => {
      const code = JSON.stringify(
        {
          name: 'test',
          contributes: {
            configuration: {
              properties: {
                'salesforcedx-vscode-metadata.sourceTracking.enableConflictDetection': {
                  type: 'boolean',
                  default: true,
                  description: '%source_tracking_enable_conflict_detection_description%'
                }
              }
            }
          }
        },
        null,
        2
      );

      const errors = filterByRule(lintJson(code), RULE_NAME);
      expect(errors).toHaveLength(0);
    });

    it('should error when new boolean setting uses default: true', () => {
      const code = JSON.stringify(
        {
          name: 'test',
          contributes: {
            configuration: {
              properties: {
                'test.newFeature': {
                  type: 'boolean',
                  default: true,
                  description: '%test_new_feature_description%'
                }
              }
            }
          }
        },
        null,
        2
      );

      const errors = filterByRule(lintJson(code), RULE_NAME);
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('defaultTrue');
      expect(errors[0].message).toContain('test.newFeature');
      expect(errors[0].message).toContain('unintuitive override behavior');
    });

    it('should error when boolean with type array ["boolean"] uses default: true', () => {
      const code = JSON.stringify(
        {
          name: 'test',
          contributes: {
            configuration: {
              properties: {
                'test.nullableBoolean': {
                  type: ['boolean', 'null'],
                  default: true,
                  description: '%test_description%'
                }
              }
            }
          }
        },
        null,
        2
      );

      const errors = filterByRule(lintJson(code), RULE_NAME);
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('defaultTrue');
      expect(errors[0].message).toContain('test.nullableBoolean');
    });

    it('should handle multiple settings - error only on the violating one', () => {
      const code = JSON.stringify(
        {
          name: 'test',
          contributes: {
            configuration: {
              properties: {
                'test.goodSetting': {
                  type: 'boolean',
                  default: false,
                  description: '%test_good%'
                },
                'test.badSetting': {
                  type: 'boolean',
                  default: true,
                  description: '%test_bad%'
                },
                'test.stringSetting': {
                  type: 'string',
                  default: 'value',
                  description: '%test_string%'
                }
              }
            }
          }
        },
        null,
        2
      );

      const errors = filterByRule(lintJson(code), RULE_NAME);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('test.badSetting');
    });

    it('should ignore package.json files outside packages directory', () => {
      const code = JSON.stringify(
        {
          name: 'test',
          contributes: {
            configuration: {
              properties: {
                'test.setting': {
                  type: 'boolean',
                  default: true,
                  description: '%test%'
                }
              }
            }
          }
        },
        null,
        2
      );

      const errors = filterByRule(lintJson(code, 'other/package.json'), RULE_NAME);
      expect(errors).toHaveLength(0);
    });

    it('should handle package.json without contributes section', () => {
      const code = JSON.stringify(
        {
          name: 'test',
          version: '1.0.0'
        },
        null,
        2
      );

      const errors = filterByRule(lintJson(code), RULE_NAME);
      expect(errors).toHaveLength(0);
    });

    it('should handle package.json without configuration properties', () => {
      const code = JSON.stringify(
        {
          name: 'test',
          contributes: {
            commands: []
          }
        },
        null,
        2
      );

      const errors = filterByRule(lintJson(code), RULE_NAME);
      expect(errors).toHaveLength(0);
    });
  });
});
