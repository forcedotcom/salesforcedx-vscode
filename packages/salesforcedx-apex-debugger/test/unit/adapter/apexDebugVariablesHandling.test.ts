/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* tslint:disable:no-unused-expression */
import { expect } from 'chai';
import {
  ApexVariable,
  ApexVariableKind,
  ObjectReferenceContainer
} from '../../../src/adapter/apexDebug';
import {
  LocalValue,
  Reference,
  RequestService,
  Value
} from '../../../src/commands';
import { BreakpointService } from '../../../src/core/breakpointService';
import { SessionService } from '../../../src/core/sessionService';
import { StreamingService } from '../../../src/core/streamingService';
import { ApexDebugForTest } from './apexDebugForTest';

describe('Debugger adapter variable handling - unit', () => {
  describe('ApexVariable', () => {
    let value: Value;
    let variable: ApexVariable;

    beforeEach(() => {
      value = {
        name: 'name',
        nameForMessages: 'nameForMessages',
        declaredTypeRef: 'declaredTypeRef',
        value: 'value'
      };
      variable = new ApexVariable(value, ApexVariableKind.Local, 20);
    });

    it('Should use proper values from Value', async () => {
      expect(variable.name).to.equal(value.name);
      expect(variable.declaredTypeRef).to.equal(value.declaredTypeRef);
      expect(variable.value).to.equal(value.value);
      expect(variable.variablesReference).to.equal(20);
      expect(variable['kind']).to.equal(ApexVariableKind.Local);
    });

    it('Should set slot to MAX integer for non local value', async () => {
      expect(variable['slot']).to.equal(Number.MAX_SAFE_INTEGER);
    });

    it('Should set slot to specific value for LocalValue', async () => {
      const localvalue: LocalValue = {
        name: 'name',
        nameForMessages: 'nameForMessages',
        declaredTypeRef: 'declaredTypeRef',
        value: 'value',
        slot: 15
      };
      variable = new ApexVariable(localvalue, ApexVariableKind.Local, 20);
      expect(variable['slot']).to.equal(localvalue.slot);
    });

    it('Should correctly print null as "null"', async () => {
      value.value = undefined;
      variable = new ApexVariable(value, ApexVariableKind.Local, 20);
      expect(variable.value).to.equal('null');
    });

    it('Should correctly print empty string', async () => {
      value.value = '';
      value.declaredTypeRef = 'java/lang/String';
      variable = new ApexVariable(value, ApexVariableKind.Local, 20);
      expect(variable.value).to.equal('');
    });

    it('Should correctly print string', async () => {
      value.value = '123';
      value.declaredTypeRef = 'java/lang/String';
      variable = new ApexVariable(value, ApexVariableKind.Local, 20);
      expect(variable.value).to.equal('123');
    });

    it('Should correctly print value with type info', async () => {
      value.value = '123';
      value.nameForMessages = 'a-type';
      variable = new ApexVariable(value, ApexVariableKind.Local, 20);
      expect(variable.value).to.equal('123 (a-type)');
    });
  });

  describe('populateReferences', () => {
    let adapter: ApexDebugForTest;

    it('Should expand object correctly', async () => {
      adapter = new ApexDebugForTest(
        new SessionService(),
        new StreamingService(),
        new BreakpointService(),
        new RequestService()
      );

      const references: Reference[] = [
        {
          type: 'object',
          nameForMessages: 'Object',
          typeRef: 'Type',
          id: 0,
          fields: [
            {
              name: 'var',
              nameForMessages: 'varNameForMessages',
              value: 'varValue',
              declaredTypeRef: 'varDeclaredTypeRef',
              index: 0
            }
          ]
        }
      ];

      adapter.populateReferences(references, 'FakeRequestId');

      const variableRef = await adapter.resolveApexIdToVariableReference(
        'FakeRequestId',
        0
      );

      expect(variableRef).to.be.at.least(0);
      const container = adapter.getVariableContainer(variableRef as number);

      expect(container).to.be.ok;
      expect(container).to.be.instanceOf(ObjectReferenceContainer);
    });
  });
});
