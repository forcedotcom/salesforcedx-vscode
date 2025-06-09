/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ApexOASClassDetail, ApexOASMethodDetail, ApexClassOASGatherContextResponse } from '../../../src/oas/schemas';
import { hasValidRestAnnotations, hasAuraEnabledMethods } from '../../../src/oasUtils';

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

describe('hasAuraEnabledMethods', () => {
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

    const result = hasAuraEnabledMethods(context as ApexClassOASGatherContextResponse);
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

    const result = hasAuraEnabledMethods(context as ApexClassOASGatherContextResponse);
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

    const result = hasAuraEnabledMethods(context as ApexClassOASGatherContextResponse);
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

    const result = hasAuraEnabledMethods(context as ApexClassOASGatherContextResponse);
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

    const result = hasAuraEnabledMethods(context as ApexClassOASGatherContextResponse);
    expect(result).toBe(false);
  });
});
