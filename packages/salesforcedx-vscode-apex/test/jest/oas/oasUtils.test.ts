/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ApexOASClassDetail, ApexOASMethodDetail, ApexClassOASGatherContextResponse } from '../../../src/oas/schemas';
import {
  hasValidRestAnnotations,
  hasAuraFrameworkCapability,
  hasMixedFrameworks,
  isValidRegistrationProviderType,
  hasNoClassAnnotations,
  summarizeDiagnostics,
  getCurrentTimestamp,
  cleanupGeneratedDoc,
  parseOASDocFromJson,
  parseOASDocFromYaml
} from '../../../src/oasUtils';

describe('hasValidRestAnnotations', () => {
  it('should return true when class has RestResource annotation and methods have HTTP REST annotations', () => {
    const classDetail: ApexOASClassDetail = {
      name: 'TestClass',
      annotations: [
        {
          name: 'RestResource',
          parameters: {
            urlMapping: '/test'
          }
        }
      ],
      interfaces: [],
      extendedClass: null,
      definitionModifiers: [],
      accessModifiers: [],
      innerClasses: [],
      comment: ''
    };

    const methods: ApexOASMethodDetail[] = [
      {
        name: 'testMethod',
        returnType: 'String',
        parameterTypes: [],
        modifiers: [],
        annotations: [
          {
            name: 'HttpGet',
            parameters: {}
          }
        ],
        comment: ''
      }
    ];

    const context: ApexClassOASGatherContextResponse = {
      classDetail,
      methods,
      properties: [],
      relationships: new Map()
    };
    const result = hasValidRestAnnotations(context);
    expect(result).toBe(true);
  });

  it('should return false when class has no RestResource annotation', () => {
    const classDetail: ApexOASClassDetail = {
      name: 'TestClass',
      annotations: [],
      interfaces: [],
      extendedClass: null,
      definitionModifiers: [],
      accessModifiers: [],
      innerClasses: [],
      comment: ''
    };

    const methods: ApexOASMethodDetail[] = [
      {
        name: 'testMethod',
        returnType: 'String',
        parameterTypes: [],
        modifiers: [],
        annotations: [
          {
            name: 'HttpGet',
            parameters: {}
          }
        ],
        comment: ''
      }
    ];

    const context: ApexClassOASGatherContextResponse = {
      classDetail,
      methods,
      properties: [],
      relationships: new Map()
    };
    const result = hasValidRestAnnotations(context);
    expect(result).toBe(false);
  });

  it('should return false when class has RestResource annotation but no methods have HTTP REST annotations', () => {
    const classDetail: ApexOASClassDetail = {
      name: 'TestClass',
      annotations: [
        {
          name: 'RestResource',
          parameters: {
            urlMapping: '/test'
          }
        }
      ],
      interfaces: [],
      extendedClass: null,
      definitionModifiers: [],
      accessModifiers: [],
      innerClasses: [],
      comment: ''
    };

    const methods: ApexOASMethodDetail[] = [
      {
        name: 'testMethod',
        returnType: 'String',
        parameterTypes: [],
        modifiers: [],
        annotations: [
          {
            name: 'AuraEnabled',
            parameters: {}
          }
        ],
        comment: ''
      }
    ];

    const context: ApexClassOASGatherContextResponse = {
      classDetail,
      methods,
      properties: [],
      relationships: new Map()
    };
    const result = hasValidRestAnnotations(context);
    expect(result).toBe(false);
  });

  it('should return true when class has RestResource annotation and at least one method has HTTP REST annotation', () => {
    const classDetail: ApexOASClassDetail = {
      name: 'TestClass',
      annotations: [
        {
          name: 'RestResource',
          parameters: {
            urlMapping: '/test'
          }
        }
      ],
      interfaces: [],
      extendedClass: null,
      definitionModifiers: [],
      accessModifiers: [],
      innerClasses: [],
      comment: ''
    };

    const methods: ApexOASMethodDetail[] = [
      {
        name: 'testMethod1',
        returnType: 'String',
        parameterTypes: [],
        modifiers: [],
        annotations: [
          {
            name: 'AuraEnabled',
            parameters: {}
          }
        ],
        comment: ''
      },
      {
        name: 'testMethod2',
        returnType: 'String',
        parameterTypes: [],
        modifiers: [],
        annotations: [
          {
            name: 'HttpPost',
            parameters: {}
          }
        ],
        comment: ''
      }
    ];

    const context: ApexClassOASGatherContextResponse = {
      classDetail,
      methods,
      properties: [],
      relationships: new Map()
    };
    const result = hasValidRestAnnotations(context);
    expect(result).toBe(true);
  });

  it('should handle empty methods array', () => {
    const classDetail: ApexOASClassDetail = {
      name: 'TestClass',
      annotations: [
        {
          name: 'RestResource',
          parameters: {
            urlMapping: '/test'
          }
        }
      ],
      interfaces: [],
      extendedClass: null,
      definitionModifiers: [],
      accessModifiers: [],
      innerClasses: [],
      comment: ''
    };

    const methods: ApexOASMethodDetail[] = [];

    const context: ApexClassOASGatherContextResponse = {
      classDetail,
      methods,
      properties: [],
      relationships: new Map()
    };
    const result = hasValidRestAnnotations(context);
    expect(result).toBe(false);
  });

  it('should work with various HTTP REST annotations', () => {
    const classDetail: ApexOASClassDetail = {
      name: 'TestClass',
      annotations: [
        {
          name: 'RestResource',
          parameters: {
            urlMapping: '/test'
          }
        }
      ],
      interfaces: [],
      extendedClass: null,
      definitionModifiers: [],
      accessModifiers: [],
      innerClasses: [],
      comment: ''
    };

    const httpMethods = ['HttpGet', 'HttpPost', 'HttpPut', 'HttpPatch', 'HttpDelete'];

    for (const httpMethod of httpMethods) {
      const methods: ApexOASMethodDetail[] = [
        {
          name: 'testMethod',
          returnType: 'String',
          parameterTypes: [],
          modifiers: [],
          annotations: [
            {
              name: httpMethod,
              parameters: {}
            }
          ],
          comment: ''
        }
      ];

      const context: ApexClassOASGatherContextResponse = {
        classDetail,
        methods,
        properties: [],
        relationships: new Map()
      };
      const result = hasValidRestAnnotations(context);
      expect(result).toBe(true);
    }
  });
});

describe('hasAuraFrameworkCapability', () => {
  it('should return true when class has no annotations and methods have AuraEnabled annotations', () => {
    const context: Partial<ApexClassOASGatherContextResponse> = {
      classDetail: {
        name: 'TestClass',
        annotations: [],
        interfaces: [],
        extendedClass: null,
        definitionModifiers: [],
        accessModifiers: [],
        innerClasses: [],
        comment: ''
      },
      methods: [
        {
          name: 'testMethod',
          returnType: 'String',
          parameterTypes: [],
          modifiers: [],
          annotations: [
            {
              name: 'AuraEnabled',
              parameters: {}
            }
          ],
          comment: ''
        }
      ]
    };

    const result = hasAuraFrameworkCapability(context as ApexClassOASGatherContextResponse);
    expect(result).toBe(true);
  });

  it('should return false when class has annotations even if methods have AuraEnabled annotations', () => {
    const context: Partial<ApexClassOASGatherContextResponse> = {
      classDetail: {
        name: 'TestClass',
        annotations: [
          {
            name: 'RestResource',
            parameters: {}
          }
        ],
        interfaces: [],
        extendedClass: null,
        definitionModifiers: [],
        accessModifiers: [],
        innerClasses: [],
        comment: ''
      },
      methods: [
        {
          name: 'testMethod',
          returnType: 'String',
          parameterTypes: [],
          modifiers: [],
          annotations: [
            {
              name: 'AuraEnabled',
              parameters: {}
            }
          ],
          comment: ''
        }
      ]
    };

    const result = hasAuraFrameworkCapability(context as ApexClassOASGatherContextResponse);
    expect(result).toBe(false);
  });

  it('should return false when class has no annotations but methods have no AuraEnabled annotations', () => {
    const context: Partial<ApexClassOASGatherContextResponse> = {
      classDetail: {
        name: 'TestClass',
        annotations: [],
        interfaces: [],
        extendedClass: null,
        definitionModifiers: [],
        accessModifiers: [],
        innerClasses: [],
        comment: ''
      },
      methods: [
        {
          name: 'testMethod',
          returnType: 'String',
          parameterTypes: [],
          modifiers: [],
          annotations: [
            {
              name: 'HttpGet',
              parameters: {}
            }
          ],
          comment: ''
        }
      ]
    };

    const result = hasAuraFrameworkCapability(context as ApexClassOASGatherContextResponse);
    expect(result).toBe(false);
  });

  it('should return true when class has no annotations and at least one method has AuraEnabled annotation', () => {
    const context: Partial<ApexClassOASGatherContextResponse> = {
      classDetail: {
        name: 'TestClass',
        annotations: [],
        interfaces: [],
        extendedClass: null,
        definitionModifiers: [],
        accessModifiers: [],
        innerClasses: [],
        comment: ''
      },
      methods: [
        {
          name: 'testMethod1',
          returnType: 'String',
          parameterTypes: [],
          modifiers: [],
          annotations: [
            {
              name: 'HttpGet',
              parameters: {}
            }
          ],
          comment: ''
        },
        {
          name: 'testMethod2',
          returnType: 'String',
          parameterTypes: [],
          modifiers: [],
          annotations: [
            {
              name: 'AuraEnabled',
              parameters: {}
            }
          ],
          comment: ''
        }
      ]
    };

    const result = hasAuraFrameworkCapability(context as ApexClassOASGatherContextResponse);
    expect(result).toBe(true);
  });

  it('should return false when class has no annotations but methods array is empty', () => {
    const context: Partial<ApexClassOASGatherContextResponse> = {
      classDetail: {
        name: 'TestClass',
        annotations: [],
        interfaces: [],
        extendedClass: null,
        definitionModifiers: [],
        accessModifiers: [],
        innerClasses: [],
        comment: ''
      },
      methods: []
    };

    const result = hasAuraFrameworkCapability(context as ApexClassOASGatherContextResponse);
    expect(result).toBe(false);
  });
});

describe('hasMixedFrameworks', () => {
  it('should return true when class has RestResource and methods have AuraEnabled', () => {
    const context: ApexClassOASGatherContextResponse = {
      classDetail: {
        name: 'TestClass',
        annotations: [{ name: 'RestResource', parameters: { urlMapping: '/test' } }],
        interfaces: [],
        extendedClass: null,
        definitionModifiers: [],
        accessModifiers: [],
        innerClasses: [],
        comment: ''
      },
      methods: [
        {
          name: 'testMethod',
          returnType: 'String',
          parameterTypes: [],
          modifiers: [],
          annotations: [{ name: 'AuraEnabled', parameters: {} }],
          comment: ''
        }
      ],
      properties: [],
      relationships: new Map()
    };
    expect(hasMixedFrameworks(context)).toBe(true);
  });

  it('should return true when class has HTTP annotations and methods have AuraEnabled', () => {
    const context: ApexClassOASGatherContextResponse = {
      classDetail: {
        name: 'TestClass',
        annotations: [],
        interfaces: [],
        extendedClass: null,
        definitionModifiers: [],
        accessModifiers: [],
        innerClasses: [],
        comment: ''
      },
      methods: [
        {
          name: 'testMethod1',
          returnType: 'String',
          parameterTypes: [],
          modifiers: [],
          annotations: [{ name: 'HttpGet', parameters: {} }],
          comment: ''
        },
        {
          name: 'testMethod2',
          returnType: 'String',
          parameterTypes: [],
          modifiers: [],
          annotations: [{ name: 'AuraEnabled', parameters: {} }],
          comment: ''
        }
      ],
      properties: [],
      relationships: new Map()
    };
    expect(hasMixedFrameworks(context)).toBe(true);
  });

  it('should return false when class has only RestResource and methods have only HTTP annotations', () => {
    const context: ApexClassOASGatherContextResponse = {
      classDetail: {
        name: 'TestClass',
        annotations: [{ name: 'RestResource', parameters: { urlMapping: '/test' } }],
        interfaces: [],
        extendedClass: null,
        definitionModifiers: [],
        accessModifiers: [],
        innerClasses: [],
        comment: ''
      },
      methods: [
        {
          name: 'testMethod',
          returnType: 'String',
          parameterTypes: [],
          modifiers: [],
          annotations: [{ name: 'HttpGet', parameters: {} }],
          comment: ''
        }
      ],
      properties: [],
      relationships: new Map()
    };
    expect(hasMixedFrameworks(context)).toBe(false);
  });
});

describe('isValidRegistrationProviderType', () => {
  it('should return true for valid provider types', () => {
    expect(isValidRegistrationProviderType('Custom')).toBe(true);
    expect(isValidRegistrationProviderType('ApexRest')).toBe(true);
    expect(isValidRegistrationProviderType('AuraEnabled')).toBe(true);
  });

  it('should return false for invalid provider types', () => {
    expect(isValidRegistrationProviderType('Invalid')).toBe(false);
    expect(isValidRegistrationProviderType('')).toBe(false);
  });

  it('should return false for undefined input', () => {
    expect(isValidRegistrationProviderType(undefined)).toBe(false);
  });
});

describe('hasNoClassAnnotations', () => {
  it('should return true when class has no annotations', () => {
    const context: ApexClassOASGatherContextResponse = {
      classDetail: {
        name: 'TestClass',
        annotations: [],
        interfaces: [],
        extendedClass: null,
        definitionModifiers: [],
        accessModifiers: [],
        innerClasses: [],
        comment: ''
      },
      methods: [],
      properties: [],
      relationships: new Map()
    };
    expect(hasNoClassAnnotations(context)).toBe(true);
  });

  it('should return false when class has annotations', () => {
    const context: ApexClassOASGatherContextResponse = {
      classDetail: {
        name: 'TestClass',
        annotations: [{ name: 'RestResource', parameters: { urlMapping: '/test' } }],
        interfaces: [],
        extendedClass: null,
        definitionModifiers: [],
        accessModifiers: [],
        innerClasses: [],
        comment: ''
      },
      methods: [],
      properties: [],
      relationships: new Map()
    };
    expect(hasNoClassAnnotations(context)).toBe(false);
  });
});

describe('summarizeDiagnostics', () => {
  // Local mock for just this suite
  const DiagnosticSeverity = {
    Error: 0,
    Warning: 1,
    Information: 2,
    Hint: 3
  };
  class Range {}
  class Diagnostic {
    range: Range;
    message: string;
    severity: number;
    constructor(range: Range, message: string, severity: number) {
      this.range = range;
      this.message = message;
      this.severity = severity;
    }
  }

  it('should correctly count diagnostics by severity', () => {
    const diagnostics = [
      new Diagnostic(new Range(), 'Error', DiagnosticSeverity.Error),
      new Diagnostic(new Range(), 'Warning', DiagnosticSeverity.Warning),
      new Diagnostic(new Range(), 'Info', DiagnosticSeverity.Information),
      new Diagnostic(new Range(), 'Hint', DiagnosticSeverity.Hint)
    ];
    // Cast to any to avoid type error with VSCode Diagnostic
    const result = summarizeDiagnostics(diagnostics as any);
    expect(result).toEqual([1, 1, 1, 1, 4]); // [error, warning, info, hint, total]
  });

  it('should handle empty diagnostics array', () => {
    const result = summarizeDiagnostics([]);
    expect(result).toEqual([0, 0, 0, 0, 0]);
  });
});

describe('getCurrentTimestamp', () => {
  it('should return timestamp in correct format', () => {
    const timestamp = getCurrentTimestamp();
    expect(timestamp).toMatch(/^\d{8}_\d{6}$/);
  });
});

describe('cleanupGeneratedDoc', () => {
  it('should extract JSON string from valid JSON object', () => {
    const doc = '{"key": "value"}';
    expect(cleanupGeneratedDoc(doc)).toBe('{"key": "value"}');
  });

  it('should throw error for invalid JSON object', () => {
    const doc = 'invalid json';
    expect(() => cleanupGeneratedDoc(doc)).toThrow('The document is not a valid JSON object.');
  });
});

describe('parseOASDocFromJson', () => {
  it('should parse valid JSON string', () => {
    const doc = '{"openapi": "3.0.0", "info": {"title": "Test API"}}';
    const result = parseOASDocFromJson(doc);
    expect(result).toEqual({
      openapi: '3.0.0',
      info: { title: 'Test API' }
    });
  });

  it('should throw error for invalid JSON', () => {
    const doc = 'invalid json';
    expect(() => parseOASDocFromJson(doc)).toThrow();
  });
});

describe('parseOASDocFromYaml', () => {
  it('should parse valid YAML string', () => {
    const doc = 'openapi: 3.0.0\ninfo:\n  title: Test API';
    const result = parseOASDocFromYaml(doc);
    expect(result).toEqual({
      openapi: '3.0.0',
      info: { title: 'Test API' }
    });
  });

  it('should throw error for invalid YAML', () => {
    const doc = 'invalid: yaml: :';
    expect(() => parseOASDocFromYaml(doc)).toThrow();
  });
});
