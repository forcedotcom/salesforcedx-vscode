/* eslint-disable @lwc/lwc/prefer-custom-event */
/* eslint-disable @lwc/lwc/no-inner-html */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import { createElement } from 'lwc';
import WhereModifierGroup from 'querybuilder/whereModifierGroup';
import { debounce } from 'debounce';

jest.mock('debounce');
// @ts-ignore
debounce.mockImplementation((callback) => {
  // @ts-ignore
  // eslint-disable-next-line no-undef
  return callback;
});

describe('WhereModifierGroup should', () => {
  let modifierGroup;

  function getModifierElements() {
    const selectFieldEl = modifierGroup.shadowRoot.querySelector(
      'querybuilder-custom-select'
    );
    const selectOperatorEl: HTMLSelectElement =
      modifierGroup.shadowRoot.querySelector('[data-el-where-operator-input]');
    const criteriaInputEl: HTMLInputElement =
      modifierGroup.shadowRoot.querySelector('[data-el-where-criteria-input]');

    return {
      selectFieldEl,
      selectOperatorEl,
      criteriaInputEl
    };
  }

  function setModifiersToHaveAValue(scope: string) {
    const { selectFieldEl, selectOperatorEl, criteriaInputEl } =
      getModifierElements();

    switch (scope) {
      case 'all':
        selectFieldEl.selectedOptions = ['foo'];
        selectOperatorEl.value = 'EQ';
        criteriaInputEl.value = 'test';
        break;
      case 'some':
        selectFieldEl.selectedOptions = ['foo'];
        selectOperatorEl.value = undefined;
        criteriaInputEl.value = null;
        break;
      case 'none':
        selectFieldEl.selectedOptions = [];
        selectOperatorEl.value = undefined;
        criteriaInputEl.value = null;
        break;
      default:
        console.log('Unkown Case to Set Values');
        break;
    }
  }

  beforeEach(() => {
    modifierGroup = createElement('querybuilder-where-modifier-group', {
      is: WhereModifierGroup
    });

    // set up cmp api properties here
    modifierGroup.allFields = ['foo', 'bar'];
    modifierGroup.sobjectMetadata = {
      fields: [
        { name: 'foo', type: 'string' },
        { name: 'bar', type: 'string' }
      ]
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  it('know when all modifers have a value', () => {
    document.body.appendChild(modifierGroup);

    expect(modifierGroup.allModifiersHaveValue).toBeFalsy();

    setModifiersToHaveAValue('all');
    const { criteriaInputEl } = getModifierElements();
    criteriaInputEl.dispatchEvent(new Event('input'));

    return Promise.resolve().then(() => {
      expect(modifierGroup.allModifiersHaveValue).toBeTruthy();
    });
  });

  it('emit event when all modfiers have value', () => {
    document.body.appendChild(modifierGroup);
    const handler = jest.fn();
    modifierGroup.addEventListener('modifiergroupselection', handler);

    setModifiersToHaveAValue('all');
    const { criteriaInputEl } = getModifierElements();
    criteriaInputEl.dispatchEvent(new Event('input'));

    expect(handler).toHaveBeenCalled();
  });

  it.skip('not emit event when criteria is multi and input ends with comma and optional space', () => {
    modifierGroup.condition = {
      field: { fieldName: 'foo' },
      operator: 'IN',
      values: [{ type: 'string', value: '' }]
    };
    modifierGroup.sobjectMetadata = {
      fields: [{ name: 'foo', type: 'string' }]
    };
    const handler = jest.fn();
    modifierGroup.addEventListener('modifiergroupselection', handler);
    document.body.appendChild(modifierGroup);

    const { criteriaInputEl } = getModifierElements();
    criteriaInputEl.value = "'peach', 'banana', ";
    criteriaInputEl.dispatchEvent(new Event('input'));

    expect(handler).not.toHaveBeenCalled();

    criteriaInputEl.value = "'peach', 'banana', 'mango'";
    criteriaInputEl.dispatchEvent(new Event('input'));
    expect(handler).toHaveBeenCalled();
  });

  it('not emit event when SOME modfiers have no value', () => {
    document.body.appendChild(modifierGroup);
    const handler = jest.fn();
    modifierGroup.addEventListener('modifiergroupselection', handler);

    setModifiersToHaveAValue('some');
    const { criteriaInputEl } = getModifierElements();
    criteriaInputEl.dispatchEvent(new Event('input'));

    expect(handler).not.toHaveBeenCalled();
  });

  it('not emit event when ALL modfiers have no value', () => {
    document.body.appendChild(modifierGroup);
    const handler = jest.fn();
    modifierGroup.addEventListener('modifiergroupselection', handler);

    setModifiersToHaveAValue('none');
    const { criteriaInputEl } = getModifierElements();
    criteriaInputEl.dispatchEvent(new Event('input'));

    expect(handler).not.toHaveBeenCalled();
  });

  it('emit event when modifier group is removed', () => {
    document.body.appendChild(modifierGroup);
    const handler = jest.fn();
    modifierGroup.addEventListener('where__condition_removed', handler);

    const closeButton = modifierGroup.shadowRoot.querySelector(
      '[data-el-where-delete]'
    );

    closeButton.click();
    expect(handler).toHaveBeenCalled();
  });

  it('clears all the values when the X is clicked', () => {
    modifierGroup.condition = {
      field: { fieldName: 'foo' },
      operator: '!=',
      compareValue: { type: 'STRING', value: "'HELLO'" }
    };
    document.body.appendChild(modifierGroup);

    const clearConditionBtn = modifierGroup.shadowRoot.querySelector(
      '[data-el-where-delete]'
    );
    const { selectFieldEl, selectOperatorEl, criteriaInputEl } =
      getModifierElements();

    expect(selectFieldEl.value[0]).toEqual('foo');
    expect(selectOperatorEl.value).toEqual('NOT_EQ');
    expect(criteriaInputEl.value).toEqual('HELLO');

    clearConditionBtn.click();
    return Promise.resolve().then(() => {
      expect(selectFieldEl.value).toEqual([]);
      expect(selectOperatorEl.value).toEqual('EQ');
      expect(criteriaInputEl.value).toEqual('');
    });
  });

  it('clears any errors when X is clicked', () => {
    modifierGroup.condition = {
      field: { fieldName: 'foo' },
      operator: '=',
      compareValue: { type: 'BOOLEAN', value: 'TRUE' }
    };
    modifierGroup.sobjectMetadata = {
      fields: [{ name: 'foo', type: 'boolean' }]
    };
    document.body.appendChild(modifierGroup);
    const { criteriaInputEl } = getModifierElements();
    criteriaInputEl.value = 'Hello'; // not a valid boolean criteria
    criteriaInputEl.dispatchEvent(new Event('input'));

    return Promise.resolve()
      .then(() => {
        const operatorContainerEl = modifierGroup.shadowRoot.querySelector(
          '[data-el-where-criteria]'
        );
        expect(operatorContainerEl.className).toContain('error');
      })
      .then(() => {
        const clearConditionBtn = modifierGroup.shadowRoot.querySelector(
          '[data-el-where-delete]'
        );
        clearConditionBtn.click();
      })
      .then(() => {
        const operatorContainerEl = modifierGroup.shadowRoot.querySelector(
          '[data-el-where-criteria]'
        );
        expect(operatorContainerEl.className).not.toContain('error');
      });
  });

  it('updates inputs when condition model changes', () => {
    modifierGroup.condition = {
      field: { fieldName: 'foo' },
      operator: '!=',
      compareValue: { type: 'STRING', value: "'HELLO'" }
    };
    document.body.appendChild(modifierGroup);

    const { selectFieldEl, selectOperatorEl, criteriaInputEl } =
      getModifierElements();
    expect(selectFieldEl.value[0]).toEqual('foo');
    expect(selectOperatorEl.value).toEqual('NOT_EQ');
    expect(criteriaInputEl.value).toEqual('HELLO');

    modifierGroup.condition = {
      operator: '='
    };
    return Promise.resolve().then(() => {
      expect(selectFieldEl.value).toEqual([]);
      expect(selectOperatorEl.value).toEqual('EQ');
      expect(criteriaInputEl.value).toEqual('');
    });
  });

  it('display the correct operator', () => {
    modifierGroup.condition = {
      operator: '<'
    };
    document.body.appendChild(modifierGroup);

    const { selectOperatorEl } = getModifierElements();

    expect(selectOperatorEl.value).toBe('LT');
    const firstOptionElement = selectOperatorEl
      .children[0] as HTMLOptionElement;

    expect(firstOptionElement.selected).toBeTruthy();
    expect(selectOperatorEl.children[0].innerHTML).toContain('&lt;');
  });

  it('display the correct criteria value for strings', () => {
    modifierGroup.condition = {
      field: { fieldName: 'foo' },
      operator: '=',
      compareValue: { type: 'STRING', value: "'HELLO'" }
    };
    document.body.appendChild(modifierGroup);

    const { criteriaInputEl } = getModifierElements();
    expect(criteriaInputEl.value).toEqual('HELLO');
  });

  it('display the correct criteria value for non-strings', () => {
    modifierGroup.condition = {
      field: { fieldName: 'foo' },
      operator: '=',
      compareValue: { type: 'BOOLEAN', value: 'TRUE' }
    };
    document.body.appendChild(modifierGroup);

    const { criteriaInputEl } = getModifierElements();
    expect(criteriaInputEl.value).toEqual('TRUE');
  });

  it('normalize criteria input for strings', () => {
    modifierGroup.condition = {
      field: { fieldName: 'foo' },
      operator: '=',
      compareValue: { type: 'STRING', value: "'HELLO'" }
    };
    modifierGroup.sobjectMetadata = {
      fields: [{ name: 'foo', type: 'string' }]
    };
    let resultingCriteria;
    const handler = (e) => {
      resultingCriteria = e.detail.condition.compareValue;
    };
    modifierGroup.addEventListener('modifiergroupselection', handler);

    document.body.appendChild(modifierGroup);

    const { criteriaInputEl } = getModifierElements();
    criteriaInputEl.value = 'WORLD';
    criteriaInputEl.dispatchEvent(new Event('input'));

    expect(resultingCriteria).toEqual({ type: 'STRING', value: "'WORLD'" });
  });

  it('normalize criteria input for strings, null value', () => {
    modifierGroup.condition = {
      field: { fieldName: 'foo' },
      operator: '=',
      compareValue: { type: 'STRING', value: 'null' }
    };
    modifierGroup.sobjectMetadata = {
      fields: [{ name: 'foo', type: 'string' }]
    };
    let resultingCriteria;
    const handler = (e) => {
      resultingCriteria = e.detail.condition.compareValue;
    };
    modifierGroup.addEventListener('modifiergroupselection', handler);

    document.body.appendChild(modifierGroup);

    const { criteriaInputEl } = getModifierElements();
    criteriaInputEl.value = 'null';
    criteriaInputEl.dispatchEvent(new Event('input'));

    expect(resultingCriteria).toEqual({ type: 'NULL', value: 'null' });
  });

  it('normalize criteria input for non-strings', () => {
    modifierGroup.condition = {
      field: { fieldName: 'foo' },
      operator: '=',
      compareValue: { type: 'BOOLEAN', value: 'TRUE' }
    };
    modifierGroup.sobjectMetadata = {
      fields: [{ name: 'foo', type: 'boolean' }]
    };
    let resultingCriteria;
    const handler = (e) => {
      resultingCriteria = e.detail.condition.compareValue;
    };
    modifierGroup.addEventListener('modifiergroupselection', handler);
    document.body.appendChild(modifierGroup);

    const { criteriaInputEl } = getModifierElements();
    criteriaInputEl.value = 'FALSE';
    criteriaInputEl.dispatchEvent(new Event('input'));

    expect(resultingCriteria).toEqual({ type: 'BOOLEAN', value: 'FALSE' });
  });

  it('normalize criteria input for multi-value operators', () => {
    modifierGroup.condition = {
      field: { fieldName: 'foo' },
      operator: 'IN',
      values: [{ type: 'BOOLEAN', value: 'TRUE' }]
    };
    modifierGroup.sobjectMetadata = {
      fields: [{ name: 'foo', type: 'boolean' }]
    };
    let resultingCriteria;
    const handler = (e) => {
      resultingCriteria = e.detail.condition.values;
    };
    modifierGroup.addEventListener('modifiergroupselection', handler);
    document.body.appendChild(modifierGroup);

    const { criteriaInputEl } = getModifierElements();
    criteriaInputEl.value = 'TRUE, FALSE';
    criteriaInputEl.dispatchEvent(new Event('input'));

    expect(resultingCriteria).toEqual([
      { type: 'BOOLEAN', value: 'TRUE' },
      { type: 'BOOLEAN', value: 'FALSE' }
    ]);
  });

  it('handle picklists', () => {
    modifierGroup.condition = {
      field: { fieldName: 'foo' },
      operator: '=',
      compareValue: {
        type: 'STRING',
        value: 'xyz'
      }
    };
    modifierGroup.sobjectMetadata = {
      fields: [
        {
          name: 'foo',
          type: 'picklist',
          picklistValues: [{ value: 'Testing1' }, { value: 'Testing2' }]
        }
      ]
    };
    let resultingCriteria;
    const handler = (e) => {
      resultingCriteria = e.detail.condition.compareValue;
    };
    modifierGroup.addEventListener('modifiergroupselection', handler);
    document.body.appendChild(modifierGroup);

    const { criteriaInputEl } = getModifierElements();
    criteriaInputEl.value = 'Testing2';
    criteriaInputEl.dispatchEvent(new Event('input'));

    expect(resultingCriteria).toEqual({ type: 'STRING', value: "'Testing2'" });
  });

  it('handle null in picklists when field is nillable', () => {
    modifierGroup.condition = {
      field: { fieldName: 'foo' },
      operator: '=',
      compareValue: {
        type: 'STRING',
        value: 'xyz2'
      }
    };
    modifierGroup.sobjectMetadata = {
      fields: [
        {
          name: 'foo',
          type: 'picklist',
          picklistValues: [{ value: 'Testing1' }, { value: 'Testing2' }],
          nillable: true
        }
      ]
    };
    let resultingCriteria;
    const handler = (e) => {
      resultingCriteria = e.detail.condition.compareValue;
    };
    modifierGroup.addEventListener('modifiergroupselection', handler);
    document.body.appendChild(modifierGroup);

    const { criteriaInputEl } = getModifierElements();
    expect(criteriaInputEl.value).toEqual('xyz2');
    criteriaInputEl.value = 'null';
    criteriaInputEl.dispatchEvent(new Event('input'));

    expect(resultingCriteria).toEqual({ type: 'NULL', value: 'null' });
  });

  it('handle null in picklists when field is NOT nillable', () => {
    modifierGroup.condition = {
      field: { fieldName: 'foo' },
      operator: '=',
      compareValue: {
        type: 'STRING',
        value: 'xyz3'
      }
    };
    modifierGroup.sobjectMetadata = {
      fields: [
        {
          name: 'foo',
          type: 'picklist',
          picklistValues: [{ value: 'Testing1' }, { value: 'Testing2' }],
          nillable: false
        }
      ]
    };

    const handler = jest.fn();
    modifierGroup.addEventListener('modifiergroupselection', handler);
    document.body.appendChild(modifierGroup);

    const { criteriaInputEl } = getModifierElements();
    expect(criteriaInputEl.value).toEqual('xyz3');
    criteriaInputEl.value = 'null';
    criteriaInputEl.dispatchEvent(new Event('input'));

    expect(handler).not.toHaveBeenCalled();
    return Promise.resolve().then(() => {
      const operatorContainerEl = modifierGroup.shadowRoot.querySelector(
        '[data-el-where-criteria]'
      );
      expect(operatorContainerEl.className).toContain('error');
    });
  });

  it('set error class on invalid operator input', async () => {
    modifierGroup.condition = {
      field: { fieldName: 'foo' },
      operator: '<',
      compareValue: { type: 'BOOLEAN', value: 'TRUE' }
    };
    modifierGroup.sobjectMetadata = {
      fields: [{ name: 'foo', type: 'boolean' }]
    };
    const handler = jest.fn();
    modifierGroup.addEventListener('modifiergroupselection', handler);
    document.body.appendChild(modifierGroup);
    const { criteriaInputEl } = getModifierElements();
    criteriaInputEl.value = 'true';
    criteriaInputEl.dispatchEvent(new Event('input'));
    expect(handler).not.toHaveBeenCalled();
    return Promise.resolve().then(() => {
      const operatorContainerEl = modifierGroup.shadowRoot.querySelector(
        '[data-el-where-operator]'
      );
      expect(operatorContainerEl.className).toContain('error');
    });
  });

  it('set error class of invalid criteria input and clear when sobject changes', async () => {
    modifierGroup.condition = {
      field: { fieldName: 'foo' },
      operator: '=',
      compareValue: { type: 'BOOLEAN', value: 'TRUE' }
    };
    modifierGroup.sobjectMetadata = {
      fields: [{ name: 'foo', type: 'boolean' }]
    };
    const handler = jest.fn();
    modifierGroup.addEventListener('modifiergroupselection', handler);
    document.body.appendChild(modifierGroup);
    const { criteriaInputEl } = getModifierElements();
    criteriaInputEl.value = 'Hello'; // not a valid boolean criteria
    criteriaInputEl.dispatchEvent(new Event('input'));
    expect(handler).not.toHaveBeenCalled();
    return Promise.resolve()
      .then(() => {
        const operatorContainerEl = modifierGroup.shadowRoot.querySelector(
          '[data-el-where-criteria]'
        );
        expect(operatorContainerEl.className).toContain('error');
      })
      .then(() => {
        modifierGroup.sobjectMetadata = { fields: [] };
      })
      .then(() => {
        const operatorContainerEl = modifierGroup.shadowRoot.querySelector(
          '[data-el-where-criteria]'
        );
        expect(operatorContainerEl.className).not.toContain('error');
      });
  });

  it('allow user to filter by null with SObject type String', async () => {
    modifierGroup.condition = {
      field: { fieldName: 'NamespacePrefix' },
      operator: '=',
      compareValue: { type: 'STRING', value: 'null' }
    };
    modifierGroup.sobjectMetadata = {
      fields: [{ name: 'NamespacePrefix', type: 'string' }]
    };
    const handler = jest.fn();
    modifierGroup.addEventListener('modifiergroupselection', handler);
    document.body.appendChild(modifierGroup);
    const { criteriaInputEl } = getModifierElements();
    criteriaInputEl.value = 'null';
    criteriaInputEl.dispatchEvent(new Event('input'));
    expect(handler).toHaveBeenCalled();
    return Promise.resolve().then(() => {
      const operatorContainerEl = modifierGroup.shadowRoot.querySelector(
        '[data-el-where-criteria]'
      );
      expect(operatorContainerEl.className).not.toContain('error');
    });
  });

  describe('LIKE CONDITIONS', () => {
    describe('display the correct operator for', () => {
      it('LIKE', () => {
        modifierGroup.condition = {
          field: { fieldName: 'foo' },
          operator: 'LIKE',
          compareValue: { type: 'STRING', value: "'HELLO'" }
        };
        document.body.appendChild(modifierGroup);

        const { selectOperatorEl } = getModifierElements();

        expect(selectOperatorEl.value).toBe('LIKE');
        const firstOptionElement = selectOperatorEl
          .children[0] as HTMLOptionElement;

        expect(firstOptionElement.selected).toBeTruthy();
        expect(selectOperatorEl.children[0].innerHTML).toContain('like');
      });

      it('STARTS_WITH', () => {
        modifierGroup.condition = {
          field: { fieldName: 'foo' },
          operator: 'LIKE',
          compareValue: { type: 'STRING', value: "'HELLO%'" }
        };
        document.body.appendChild(modifierGroup);

        const { selectOperatorEl } = getModifierElements();

        expect(selectOperatorEl.value).toBe('LIKE_START');
        const firstOptionElement = selectOperatorEl
          .children[0] as HTMLOptionElement;

        expect(firstOptionElement.selected).toBeTruthy();
        expect(selectOperatorEl.children[0].innerHTML).toContain('starts with');
      });

      it('ENDS_WITH', () => {
        modifierGroup.condition = {
          field: { fieldName: 'foo' },
          operator: 'LIKE',
          compareValue: { type: 'STRING', value: "'%HELLO'" }
        };
        document.body.appendChild(modifierGroup);

        const { selectOperatorEl } = getModifierElements();

        expect(selectOperatorEl.value).toBe('LIKE_END');
        const firstOptionElement = selectOperatorEl
          .children[0] as HTMLOptionElement;

        expect(firstOptionElement.selected).toBeTruthy();
        expect(selectOperatorEl.children[0].innerHTML).toContain('ends with');
      });

      it('CONTAINS', () => {
        modifierGroup.condition = {
          field: { fieldName: 'foo' },
          operator: 'LIKE',
          compareValue: { type: 'STRING', value: "'%HELLO%'" }
        };
        document.body.appendChild(modifierGroup);

        const { selectOperatorEl } = getModifierElements();

        expect(selectOperatorEl.value).toBe('LIKE_CONTAINS');
        const firstOptionElement = selectOperatorEl
          .children[0] as HTMLOptionElement;

        expect(firstOptionElement.selected).toBeTruthy();
        expect(selectOperatorEl.children[0].innerHTML).toContain('contains');
      });
    });

    it('display the correct criteria value for LIKE', () => {
      modifierGroup.condition = {
        field: { fieldName: 'foo' },
        operator: 'LIKE',
        compareValue: { type: 'STRING', value: "'%HELLO%'" }
      };
      document.body.appendChild(modifierGroup);

      let { criteriaInputEl } = getModifierElements();
      expect(criteriaInputEl.value).toEqual('HELLO');

      modifierGroup.condition = {
        field: { fieldName: 'foo' },
        operator: 'LIKE',
        compareValue: { type: 'STRING', value: "'%HE%%O%'" }
      };
      return Promise.resolve().then(() => {
        ({ criteriaInputEl } = getModifierElements());
        expect(criteriaInputEl.value).toEqual('HE%%O');
      });
    });
  });
});
