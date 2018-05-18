/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { StackFrame, Variable } from 'vscode-debugadapter';
import {
  ApexReplayDebug,
  ApexVariableContainer,
  LaunchRequestArguments,
  VariableContainer
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
        'staticInteger'
      );
      expect(
        context.getStaticVariablesClassMap().get('signature')!.get(
          'staticInteger'
        )
      ).to.include({
        name: 'staticInteger',
        value: 'null'
      });
      state.handle(context);

      expect(context.getStaticVariablesClassMap().get('signature')).to.have.key(
        'staticInteger'
      );
      expect(
        context.getStaticVariablesClassMap().get('signature')!.get(
          'staticInteger'
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

    it('Should create a nested variable for an empty object', () => {
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
      expect(container.variablesRef).to.not.equal(0);
      expect(container.variables).to.be.empty;
      expect(container.value).to.equal('');
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
      const variables = container.getAllVariables();
      expect(variables.length).to.equal(1);
      expect(variables[0]).to.include({
        name: 's',
        value: '"MyObject.s"',
        evaluateName: '"MyObject.s"'
      });
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
      const variables = innerContainer.getAllVariables();
      expect(variables.length).to.equal(1);
      expect(variables[0]).to.include({
        name: 'Name',
        value: 'MyObjectAccount',
        evaluateName: 'MyObjectAccount'
      });
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

  describe('Static nested assignment', () => {
    const DUMMY_REF = '0x00000000';
    const DUMMY_REF1 = '0x00000001';
    const DUMMY_REF2 = '0x00000002';
    const STATIC_NESTED_VARIABLE_SCOPE_BEGIN =
      'fakeTime|VARIABLE_SCOPE_BEGIN|[6]|NestedClass.sa|Account|true|true';
    const STATIC_NESTED_VARIABLE_ASSIGNMENT = `fakeTime|VARIABLE_ASSIGNMENT|[6]|NestedClass.sa|{}|${DUMMY_REF}`;
    const STATIC_NESTED_JSON_VARIABLE_ASSIGNMENT = `fakeTime|VARIABLE_ASSIGNMENT|[8]|NestedClass.sa|{"Name":"testName"}|${DUMMY_REF}`;
    const STATIC_NESTED_INNER_VARIABLE_ASSIGNMENT = `fakeTime|VARIABLE_ASSIGNMENT|[12]|sa.Name|"testName2"|${DUMMY_REF}`;
    const STATIC_NESTED_REASSIGNMENT_BEGIN = `04:35:37.25 (27947754)|VARIABLE_SCOPE_BEGIN|[10]|NestedClass.staticAcc1|Account|true|true`;
    const STATIC_NESTED_REASSIGNMENT_BEGIN1 = `04:35:37.25 (27955171)|VARIABLE_SCOPE_BEGIN|[11]|NestedClass.staticAcc2|Account|true|true`;
    const STATIC_NESTED_REASSIGNMENT = `04:35:37.25 (28650946)|VARIABLE_ASSIGNMENT|[10]|NestedClass.staticAcc1|{"Name":"staticacc1"}|${DUMMY_REF1}`;
    const STATIC_NESTED_REASSIGNMENT2 = `04:35:37.25 (28667298)|VARIABLE_ASSIGNMENT|[11]|NestedClass.staticAcc2|{"Name":"staticacc1"}|${DUMMY_REF1}`;
    const STATIC_NESTED_REASSIGNMENT3 = `04:35:37.25 (30077406)|VARIABLE_ASSIGNMENT|[16]|NestedClass.staticAcc1|{"Name":"changed in method1"}|${DUMMY_REF2}`;

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
        STATIC_NESTED_VARIABLE_SCOPE_BEGIN.split('|')
      );
      beginState.handle(context);
      getUriFromSignatureStub = sinon
        .stub(LogContext.prototype, 'getUriFromSignature')
        .returns(uriFromSignature);
    });

    afterEach(() => {
      getUriFromSignatureStub.restore();
    });

    it('Should create a nested variable for an empty object', () => {
      const state = new VariableAssignmentState(
        STATIC_NESTED_VARIABLE_ASSIGNMENT.split('|')
      );
      const staticMapping = context.getStaticVariablesClassMap() as Map<
        string,
        Map<string, VariableContainer>
      >;
      expect(staticMapping).to.include.keys('NestedClass');
      const classMap = staticMapping.get('NestedClass') as Map<
        string,
        VariableContainer
      >;
      expect(classMap).to.have.key('sa');
      const container = classMap.get('sa')! as ApexVariableContainer;
      expect(container.variablesRef).to.equal(0);
      expect(container.variables).to.be.empty;
      expect(container.value).to.equal('null');
      state.handle(context);
      expect(container.variablesRef).to.not.equal(0);
      expect(container.variables).to.be.empty;
      expect(container.value).to.equal('');
    });

    it('Should update variable to a nested variable if json assignment', () => {
      let state = new VariableAssignmentState(
        STATIC_NESTED_VARIABLE_ASSIGNMENT.split('|')
      );
      state.handle(context);
      const staticMapping = context.getStaticVariablesClassMap() as Map<
        string,
        Map<string, VariableContainer>
      >;
      expect(staticMapping).to.include.keys('NestedClass');
      const classMap = staticMapping.get('NestedClass') as Map<
        string,
        VariableContainer
      >;
      expect(classMap).to.have.key('sa');
      const container = classMap.get('sa')! as ApexVariableContainer;
      expect(container.variablesRef).to.not.equal(0);
      expect(container.variables).to.be.empty;
      expect(container.value).to.equal('');

      state = new VariableAssignmentState(
        STATIC_NESTED_JSON_VARIABLE_ASSIGNMENT.split('|')
      );
      state.handle(context);
      expect(container.value).to.equal('');
      expect(container.variablesRef).to.not.equal(0);
      expect(container.variables).to.have.key('Name');
      const innerContainer = container.variables.get(
        'Name'
      ) as ApexVariableContainer;
      expect(innerContainer.value).to.equal('testName');
    });

    it('Should update variable if inner variable assigned', () => {
      let state = new VariableAssignmentState(
        STATIC_NESTED_VARIABLE_ASSIGNMENT.split('|')
      );
      state.handle(context);
      const staticMapping = context.getStaticVariablesClassMap() as Map<
        string,
        Map<string, VariableContainer>
      >;
      expect(staticMapping).to.include.keys('NestedClass');
      const classMap = staticMapping.get('NestedClass') as Map<
        string,
        VariableContainer
      >;
      expect(classMap).to.have.key('sa');
      const container = classMap.get('sa')! as ApexVariableContainer;
      expect(container.variablesRef).to.not.equal(0);
      expect(container.variables).to.be.empty;
      expect(container.value).to.equal('');

      state = new VariableAssignmentState(
        STATIC_NESTED_INNER_VARIABLE_ASSIGNMENT.split('|')
      );
      state.handle(context);
      expect(container.variablesRef).to.not.equal(0);
      expect(container.value).to.equal('');
      expect(container.variables).to.have.key('Name');
      const innerContainer = container.variables.get(
        'Name'
      ) as ApexVariableContainer;
      expect(innerContainer.value).to.equal('"testName2"');
    });

    it('Should update variable if reassigned to newly created reference', () => {
      let beginState = new VariableBeginState(
        STATIC_NESTED_REASSIGNMENT_BEGIN.split('|')
      );
      beginState.handle(context);
      beginState = new VariableBeginState(
        STATIC_NESTED_REASSIGNMENT_BEGIN1.split('|')
      );
      beginState.handle(context);
      let state = new VariableAssignmentState(
        STATIC_NESTED_REASSIGNMENT.split('|')
      );
      state.handle(context);
      state = new VariableAssignmentState(
        STATIC_NESTED_REASSIGNMENT2.split('|')
      );
      state.handle(context);
      const staticMapping = context.getStaticVariablesClassMap() as Map<
        string,
        Map<string, VariableContainer>
      >;
      expect(staticMapping).to.include.keys('NestedClass');
      const classMap = staticMapping.get('NestedClass') as Map<
        string,
        VariableContainer
      >;
      expect(classMap).to.include.keys('staticAcc1', 'staticAcc2');
      let acc1Container = classMap.get('staticAcc1')! as ApexVariableContainer;
      let acc2Container = classMap.get('staticAcc2')! as ApexVariableContainer;
      expect(acc1Container.variables).to.equal(acc2Container.variables);
      state = new VariableAssignmentState(
        STATIC_NESTED_REASSIGNMENT3.split('|')
      );
      state.handle(context);
      acc1Container = classMap.get('staticAcc1')! as ApexVariableContainer;
      acc2Container = classMap.get('staticAcc2')! as ApexVariableContainer;
      expect(acc1Container.variables).to.not.equal(acc2Container.variables);
    });
  });

  describe('Find references in reference map', () => {
    const PARENT_VARIABLE_BEGIN =
      '17:39:36.83 (152679235)|VARIABLE_SCOPE_BEGIN|[17]|this|NestedClass|true|false';
    const CHILD_VARIABLE_ASSIGNMENT =
      '17:39:36.83 (150355500)|VARIABLE_ASSIGNMENT|[11]|this.Name|"MyObjectAccount"|0x114423';
    const PARENT_JSON_VARIABLE_ASSIGNMENT =
      '17:39:36.83 (152855711)|VARIABLE_ASSIGNMENT|[17]|this|{"a":"0x114423"}|0xf8a3b94';
    const PARENT_VARIABLE_ASSIGNMENT =
      '17:39:36.83 (150148801)|VARIABLE_ASSIGNMENT|[10]|this.m|0x114423|0xf8a3b94';
    const PARENT_VARIABLE_ASSIGNMENT2 =
      '17:39:36.83 (150148801)|VARIABLE_ASSIGNMENT|[10]|this.n|0x114423|0xf8a3b94';

    beforeEach(() => {
      // push frames on
      const state = new FrameEntryState(['signature']);
      context = new LogContext(launchRequestArgs, new ApexReplayDebug());
      context
        .getFrames()
        .push({ id: 0, name: 'execute_anonymous_apex' } as StackFrame);
      expect(state.handle(context)).to.be.false;
      // add begin states for a local and static variable
      let assignState = new VariableAssignmentState(
        CHILD_VARIABLE_ASSIGNMENT.split('|')
      );
      assignState.handle(context);
      const beginState = new VariableBeginState(
        PARENT_VARIABLE_BEGIN.split('|')
      );
      assignState = new VariableAssignmentState(
        PARENT_JSON_VARIABLE_ASSIGNMENT.split('|')
      );
      beginState.handle(context);
      assignState.handle(context);
      assignState = new VariableAssignmentState(
        PARENT_VARIABLE_ASSIGNMENT.split('|')
      );
      assignState.handle(context);
      assignState = new VariableAssignmentState(
        PARENT_VARIABLE_ASSIGNMENT2.split('|')
      );
      assignState.handle(context);
      getUriFromSignatureStub = sinon
        .stub(LogContext.prototype, 'getUriFromSignature')
        .returns(uriFromSignature);
    });

    afterEach(() => {
      getUriFromSignatureStub.restore();
    });

    it('Should be able to pull reference values from json in assignments', () => {
      expect(context.getRefsMap()).to.have.keys('0x114423', '0xf8a3b94');
      const container = context
        .getRefsMap()
        .get('0xf8a3b94') as ApexVariableContainer;
      const childRefContainer = context
        .getRefsMap()
        .get('0x114423') as ApexVariableContainer;
      expect(container.variables).to.include.keys('a');
      const childParentContainer = container.variables.get('a')!;
      expect(childParentContainer.variables).to.equal(
        childRefContainer.variables
      );
    });

    it('Should be able to pull reference values from json in assignments', () => {
      expect(context.getRefsMap()).to.have.keys('0x114423', '0xf8a3b94');
      const container = context
        .getRefsMap()
        .get('0xf8a3b94') as ApexVariableContainer;
      const childRefContainer = context
        .getRefsMap()
        .get('0x114423') as ApexVariableContainer;
      expect(container.variables).to.include.keys('m');
      const childParentContainer = container.variables.get('m')!;
      expect(childParentContainer.variables).to.equal(
        childRefContainer.variables
      );
    });

    it('Should change both variable containers if they share a common reference', () => {
      expect(context.getRefsMap()).to.have.keys('0x114423', '0xf8a3b94');
      const container = context
        .getRefsMap()
        .get('0xf8a3b94') as ApexVariableContainer;
      const childRefContainer = context
        .getRefsMap()
        .get('0x114423') as ApexVariableContainer;
      expect(container.variables).to.include.keys('m');
      const mContainer = container.variables.get('m')! as ApexVariableContainer;
      expect(container.variables).to.include.keys('n');
      const nContainer = container.variables.get('n')! as ApexVariableContainer;
      expect(mContainer.variables).to.equal(nContainer.variables);
      expect(mContainer.ref).to.equal(nContainer.ref);
      const REF_ASSIGNMENT =
        '17:39:36.83 (150355500)|VARIABLE_ASSIGNMENT|[11]|this.Name|"both are updated"|0x114423';
      const state = new VariableAssignmentState(REF_ASSIGNMENT.split('|'));
      state.handle(context);
      expect(mContainer.variables).to.include.keys('Name');
      expect(nContainer.variables).to.include.keys('Name');
      const nSubContainer = nContainer.variables.get(
        'Name'
      ) as ApexVariableContainer;
      const mSubContainer = mContainer.variables.get(
        'Name'
      ) as ApexVariableContainer;
      expect(mSubContainer.value).to.equal('"both are updated"');
      expect(nSubContainer.value).to.equal('"both are updated"');
    });
  });
});
