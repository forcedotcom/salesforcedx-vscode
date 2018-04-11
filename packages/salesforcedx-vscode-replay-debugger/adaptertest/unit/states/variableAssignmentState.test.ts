/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { StackFrame } from 'vscode-debugadapter';
import {
  ApexReplayDebug,
  LaunchRequestArguments,
  ApexVariableContainer
} from '../../../src/adapter/apexReplayDebug';
import { LogContext } from '../../../src/core';
import {
  FrameEntryState,
  VariableAssignmentState,
  VariableBeginState
} from '../../../src/states';

// tslint:disable:no-unused-expression
describe('Variable assignment event', () => {
  let getUriFromSignatureStub: sinon.SinonStub;
  let context: LogContext;
  const logFileName = 'foo.log';
  const logFilePath = `path/${logFileName}`;
  const uriFromSignature = 'file:///path/foo.cls';
  const launchRequestArgs: LaunchRequestArguments = {
    logFile: logFilePath,
    trace: true
  };
  describe('Primitive assignment', () => {
    const STATIC_PRIMITIVE_VARIABLE_SCOPE_BEGIN =
      'fakeTime|VARIABLE_SCOPE_BEGIN|[38]|signature.staticInteger|Integer|false|true';
    const LOCAL_PRIMITIVE_VARIABLE_SCOPE_BEGIN =
      'fakeTime|VARIABLE_SCOPE_BEGIN|[38]|localInteger|Integer|false|false';
    const STATIC_PRIMITIVE_VARIABLE_ASSIGNMENT =
      'fakeTime|VARIABLE_ASSIGNMENT|[5]|signature.staticInteger|5';
    const LOCAL_PRIMITIVE_VARIABLE_ASSIGNMENT =
      'fakeTime|VARIABLE_ASSIGNMENT|[5]|localInteger|0';

    beforeEach(() => {
      // push frames on
      const state = new FrameEntryState(['signature']);
      context = new LogContext(launchRequestArgs, new ApexReplayDebug());
      context
        .getFrames()
        .push({ id: 0, name: 'execute_anonymous_apex' } as StackFrame);
      expect(state.handle(context)).to.be.false;

      // add begin states for a local and static variable
      let beginState = new VariableBeginState(
        STATIC_PRIMITIVE_VARIABLE_SCOPE_BEGIN.split('|')
      );
      beginState.handle(context);
      beginState = new VariableBeginState(
        LOCAL_PRIMITIVE_VARIABLE_SCOPE_BEGIN.split('|')
      );
      beginState.handle(context);
      getUriFromSignatureStub = sinon
        .stub(LogContext.prototype, 'getUriFromSignature')
        .returns(uriFromSignature);
    });

    afterEach(() => {
      getUriFromSignatureStub.restore();
    });

    it('Should assign static variable for class', () => {
      const state = new VariableAssignmentState(
        STATIC_PRIMITIVE_VARIABLE_ASSIGNMENT.split('|')
      );
      // expect unassigned beforehand
      expect(context.getStaticVariablesClassMap().get('signature')).to.have.key(
        'signature.staticInteger'
      );
      expect(
        context.getStaticVariablesClassMap().get('signature')!.get(
          'signature.staticInteger'
        )
      ).to.include({
        name: 'staticInteger',
        value: 'null'
      });
      state.handle(context);

      expect(context.getStaticVariablesClassMap().get('signature')).to.have.key(
        'signature.staticInteger'
      );
      expect(
        context.getStaticVariablesClassMap().get('signature')!.get(
          'signature.staticInteger'
        )
      ).to.include({
        name: 'staticInteger',
        value: '5'
      });
    });

    it('Should add local variable to frame', () => {
      const state = new VariableAssignmentState(
        LOCAL_PRIMITIVE_VARIABLE_ASSIGNMENT.split('|')
      );
      // locals of frame should one entry
      const frameInfo = context
        .getFrameHandler()
        .get(context.getTopFrame()!.id);
      expect(frameInfo.locals).to.have.key('localInteger');
      expect(frameInfo.locals.get('localInteger')).to.include({
        name: 'localInteger',
        value: 'null'
      });
      state.handle(context);

      expect(frameInfo.locals.get('localInteger')).to.include({
        name: 'localInteger',
        value: '0'
      });
    });
  });

  describe('Local nested assignment', () => {
    const DUMMY_REF = '0x00000000';
    const LOCAL_NESTED_VARIABLE_SCOPE_BEGIN =
      'fakeTime|VARIABLE_SCOPE_BEGIN|[8]|this|NestedClass|true|false';
    const LOCAL_NESTED_VARIABLE_ASSIGNMENT = `fakeTime|VARIABLE_ASSIGNMENT|[8]|this|{}|${DUMMY_REF}`;
    const LOCAL_NESTED_JSON_VARIABLE_ASSIGNMENT = `fakeTime|VARIABLE_ASSIGNMENT|[8]|this|{"a":"0x37e2e22e","m":"0xff6e2ff","s":"MyObject.s"}|${DUMMY_REF}`;
    const LOCAL_NESTED_INNER_VARIABLE_ASSIGNMENT = `fakeTime|VARIABLE_ASSIGNMENT|[12]|this.s|"MyObject.s"|${DUMMY_REF}`;
    const LOCAL_NESTED_JSON_INNER_VARIABLE_ASSIGNMENT = `fakeTime|VARIABLE_ASSIGNMENT|[10]|this.a|{"Name":"MyObjectAccount"}|${DUMMY_REF}`;
    beforeEach(() => {
      // push frames on
      const state = new FrameEntryState(['signature']);
      context = new LogContext(launchRequestArgs, new ApexReplayDebug());
      context
        .getFrames()
        .push({ id: 0, name: 'execute_anonymous_apex' } as StackFrame);
      expect(state.handle(context)).to.be.false;
      // add begin states for a local and static variable
      const beginState = new VariableBeginState(
        LOCAL_NESTED_VARIABLE_SCOPE_BEGIN.split('|')
      );
      beginState.handle(context);
      getUriFromSignatureStub = sinon
        .stub(LogContext.prototype, 'getUriFromSignature')
        .returns(uriFromSignature);
    });

    afterEach(() => {
      getUriFromSignatureStub.restore();
    });

    it('Should not create a nested variable for an empty object', () => {
      const state = new VariableAssignmentState(
        LOCAL_NESTED_VARIABLE_ASSIGNMENT.split('|')
      );
      const frameInfo = context
        .getFrameHandler()
        .get(context.getTopFrame()!.id);
      expect(frameInfo.locals).to.have.key('this');
      const container = frameInfo.locals.get('this') as ApexVariableContainer;
      expect(container.variablesRef).to.equal(0);
      expect(container.variables).to.be.empty;
      expect(container.value).to.equal('null');
      state.handle(context);
      expect(container.variablesRef).to.equal(0);
      expect(container.variables).to.be.empty;
      expect(container.value).to.equal('{}');
    });

    it('Should update variable to a nested variable if assigning to inner value', () => {
      let state = new VariableAssignmentState(
        LOCAL_NESTED_VARIABLE_ASSIGNMENT.split('|')
      );
      state.handle(context);
      const frameInfo = context
        .getFrameHandler()
        .get(context.getTopFrame()!.id);
      const container = frameInfo.locals.get('this') as ApexVariableContainer;
      state = new VariableAssignmentState(
        LOCAL_NESTED_INNER_VARIABLE_ASSIGNMENT.split('|')
      );
      state.handle(context);
      expect(container.value).to.equal('');
      expect(container.variablesRef).to.not.equal(0);
      expect(container.variables).to.have.key('s');
      const innerContainer = container.variables.get(
        's'
      ) as ApexVariableContainer;
      expect(innerContainer.value).to.equal('"MyObject.s"');
      expect(innerContainer.variables).to.be.empty;
      expect(innerContainer.variablesRef).to.equal(0);
    });

    it('Should update variable to a nested variable if json assignment', () => {
      let state = new VariableAssignmentState(
        LOCAL_NESTED_VARIABLE_ASSIGNMENT.split('|')
      );
      state.handle(context);
      const frameInfo = context
        .getFrameHandler()
        .get(context.getTopFrame()!.id);
      const container = frameInfo.locals.get('this') as ApexVariableContainer;
      state = new VariableAssignmentState(
        LOCAL_NESTED_JSON_VARIABLE_ASSIGNMENT.split('|')
      );
      state.handle(context);
      expect(container.value).to.equal('');
      expect(container.variablesRef).to.not.equal(0);
      expect(container.variables).to.have.keys(['a', 'm', 's']);
      const VAR_VALUES = ['0x37e2e22e', '0xff6e2ff', 'MyObject.s'];
      ['a', 'm', 's'].forEach((element, index) => {
        const innerContainer = container.variables.get(
          element
        ) as ApexVariableContainer;
        expect(innerContainer.value).to.equal(VAR_VALUES[index]);
        expect(innerContainer.variables).to.be.empty;
        expect(innerContainer.variablesRef).to.equal(0);
      });
    });

    it('Should update variable to a nested variable holding another nested variable if assigning json to inner value', () => {
      let state = new VariableAssignmentState(
        LOCAL_NESTED_VARIABLE_ASSIGNMENT.split('|')
      );
      state.handle(context);
      const frameInfo = context
        .getFrameHandler()
        .get(context.getTopFrame()!.id);
      const container = frameInfo.locals.get('this') as ApexVariableContainer;
      state = new VariableAssignmentState(
        LOCAL_NESTED_JSON_INNER_VARIABLE_ASSIGNMENT.split('|')
      );
      state.handle(context);
      expect(container.value).to.equal('');
      expect(container.variablesRef).to.not.equal(0);
      expect(container.variables).to.have.key('a');
      const innerContainer = container.variables.get(
        'a'
      ) as ApexVariableContainer;
      expect(innerContainer.value).to.equal('');
      expect(innerContainer.variables).to.have.key('Name');
      expect(innerContainer.variablesRef).to.not.equal(0);
      const innerContainerVariable = innerContainer.variables.get(
        'Name'
      ) as ApexVariableContainer;
      expect(innerContainerVariable.value).to.equal('MyObjectAccount');
      expect(innerContainerVariable.variablesRef).to.equal(0);
    });
  });
});
