/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Mock DebugSession.run to prevent it from executing during tests
jest.mock('@vscode/debugadapter', () => ({
  ...jest.requireActual('@vscode/debugadapter'),
  DebugSession: {
    ...jest.requireActual('@vscode/debugadapter').DebugSession,
    run: jest.fn()
  }
}));

import { StackFrame } from '@vscode/debugadapter';
import * as sinon from 'sinon';
import { ApexReplayDebug } from '../../../src/adapter/apexReplayDebug';
import { LaunchRequestArguments } from '../../../src/adapter/types';
import { ApexVariableContainer, VariableContainer } from '../../../src/adapter/VariableContainer';
import { LogContext } from '../../../src/core';
import { FrameEntryState, VariableAssignmentState, VariableBeginState } from '../../../src/states';

describe('Variable assignment event', () => {
  let getUriFromSignatureStub: sinon.SinonStub;
  let context: LogContext;
  const logFileName = 'foo.log';
  const logFilePath = `path/${logFileName}`;
  const uriFromSignature = 'file:///path/foo.cls';
  const launchRequestArgs: LaunchRequestArguments = {
    logFile: logFilePath,
    trace: true,
    projectPath: undefined
  };
  describe('Primitive assignment', () => {
    const STATIC_PRIMITIVE_VARIABLE_SCOPE_BEGIN =
      'fakeTime|VARIABLE_SCOPE_BEGIN|[38]|signature.staticInteger|Integer|false|true';
    const LOCAL_PRIMITIVE_VARIABLE_SCOPE_BEGIN = 'fakeTime|VARIABLE_SCOPE_BEGIN|[38]|localInteger|Integer|false|false';
    const STATIC_PRIMITIVE_VARIABLE_ASSIGNMENT = 'fakeTime|VARIABLE_ASSIGNMENT|[5]|signature.staticInteger|5';
    const LOCAL_PRIMITIVE_VARIABLE_ASSIGNMENT = 'fakeTime|VARIABLE_ASSIGNMENT|[5]|localInteger|0';

    beforeEach(() => {
      // push frames on
      const state = new FrameEntryState(['signature']);
      context = new LogContext(launchRequestArgs, new ApexReplayDebug());
      context.getFrames().push({ id: 0, name: 'execute_anonymous_apex' } as StackFrame);
      expect(state.handle(context)).toBe(false);

      // add begin states for a local and static variable
      let beginState = new VariableBeginState(STATIC_PRIMITIVE_VARIABLE_SCOPE_BEGIN.split('|'));
      beginState.handle(context);
      beginState = new VariableBeginState(LOCAL_PRIMITIVE_VARIABLE_SCOPE_BEGIN.split('|'));
      beginState.handle(context);
      getUriFromSignatureStub = sinon.stub(LogContext.prototype, 'getUriFromSignature').returns(uriFromSignature);
    });

    afterEach(() => {
      getUriFromSignatureStub.restore();
    });

    it('Should assign static variable for class', () => {
      const state = new VariableAssignmentState(STATIC_PRIMITIVE_VARIABLE_ASSIGNMENT.split('|'));
      // expect unassigned beforehand
      expect(context.getStaticVariablesClassMap().get('signature')?.has('staticInteger')).toBe(true);
      expect(context.getStaticVariablesClassMap().get('signature')?.get('staticInteger')).toMatchObject({
        name: 'staticInteger',
        value: 'null'
      });
      state.handle(context);

      expect(context.getStaticVariablesClassMap().get('signature')?.has('staticInteger')).toBe(true);
      expect(context.getStaticVariablesClassMap().get('signature')?.get('staticInteger')).toMatchObject({
        name: 'staticInteger',
        value: '5'
      });
    });

    it('Should add local variable to frame', () => {
      const state = new VariableAssignmentState(LOCAL_PRIMITIVE_VARIABLE_ASSIGNMENT.split('|'));
      // locals of frame should one entry
      const frameInfo = context.getFrameHandler().get(context.getTopFrame()!.id);
      expect(frameInfo.locals.has('localInteger')).toBe(true);
      expect(frameInfo.locals.get('localInteger')).toMatchObject({
        name: 'localInteger',
        value: 'null'
      });
      state.handle(context);

      expect(frameInfo.locals.get('localInteger')).toMatchObject({
        name: 'localInteger',
        value: '0'
      });
    });
  });

  describe('Local nested assignment', () => {
    const DUMMY_REF = '0x00000000';
    const LOCAL_NESTED_VARIABLE_SCOPE_BEGIN = 'fakeTime|VARIABLE_SCOPE_BEGIN|[8]|this|NestedClass|true|false';
    const LOCAL_NESTED_VARIABLE_ASSIGNMENT = `fakeTime|VARIABLE_ASSIGNMENT|[8]|this|{}|${DUMMY_REF}`;
    const LOCAL_NESTED_JSON_VARIABLE_ASSIGNMENT = `fakeTime|VARIABLE_ASSIGNMENT|[8]|this|{"a":"0x37e2e22e","b1":BLOB(5 bytes),"b2":BLOB(50 bytes),"d":3.14,"m":"0xff6e2ff","s":"MyObject.s"}|${DUMMY_REF}`;
    const LOCAL_NESTED_INNER_VARIABLE_ASSIGNMENT = `fakeTime|VARIABLE_ASSIGNMENT|[12]|this.s|"MyObject.s"|${DUMMY_REF}`;
    const LOCAL_NESTED_JSON_INNER_VARIABLE_ASSIGNMENT = `fakeTime|VARIABLE_ASSIGNMENT|[10]|this.a|{"Name":"MyObjectAccount"}|${DUMMY_REF}`;
    beforeEach(() => {
      // push frames on
      const state = new FrameEntryState(['signature']);
      context = new LogContext(launchRequestArgs, new ApexReplayDebug());
      context.getFrames().push({ id: 0, name: 'execute_anonymous_apex' } as StackFrame);
      expect(state.handle(context)).toBe(false);
      // add begin states for a local and static variable
      const beginState = new VariableBeginState(LOCAL_NESTED_VARIABLE_SCOPE_BEGIN.split('|'));
      beginState.handle(context);
      getUriFromSignatureStub = sinon.stub(LogContext.prototype, 'getUriFromSignature').returns(uriFromSignature);
    });

    afterEach(() => {
      getUriFromSignatureStub.restore();
    });

    it('Should create a nested variable for an empty object', () => {
      const state = new VariableAssignmentState(LOCAL_NESTED_VARIABLE_ASSIGNMENT.split('|'));
      const frameInfo = context.getFrameHandler().get(context.getTopFrame()!.id);
      expect(Array.from(frameInfo.locals.keys())).toEqual(expect.arrayContaining(['this']));
      const container = frameInfo.locals.get('this') as ApexVariableContainer;
      expect(container.variablesRef).toBe(0);
      expect(Array.from(container.variables.keys())).toHaveLength(0);
      expect(container.value).toBe('null');
      state.handle(context);
      expect(container.variablesRef).not.toBe(0);
      expect(Array.from(container.variables.keys())).toHaveLength(0);
      expect(container.value).toBe('');
    });

    it('Should update variable to a nested variable if assigning to inner value', () => {
      let state = new VariableAssignmentState(LOCAL_NESTED_VARIABLE_ASSIGNMENT.split('|'));
      state.handle(context);
      const frameInfo = context.getFrameHandler().get(context.getTopFrame()!.id);
      const container = frameInfo.locals.get('this') as ApexVariableContainer;
      state = new VariableAssignmentState(LOCAL_NESTED_INNER_VARIABLE_ASSIGNMENT.split('|'));
      state.handle(context);
      expect(container.value).toBe('');
      expect(container.variablesRef).not.toBe(0);
      expect(container.variables.has('s')).toBe(true);
      const variables = container.getAllVariables();
      expect(variables.length).toBe(1);
      expect(variables[0]).toMatchObject({
        name: 's',
        value: "'MyObject.s'",
        evaluateName: "'MyObject.s'"
      });
      const innerContainer = container.variables.get('s') as ApexVariableContainer;
      expect(innerContainer.value).toBe("'MyObject.s'");
      expect(Array.from(innerContainer.variables.keys())).toHaveLength(0);
      expect(innerContainer.variablesRef).toBe(0);
    });

    it('Should update variable to a nested variable if json assignment', () => {
      let state = new VariableAssignmentState(LOCAL_NESTED_VARIABLE_ASSIGNMENT.split('|'));
      state.handle(context);
      const frameInfo = context.getFrameHandler().get(context.getTopFrame()!.id);
      const container = frameInfo.locals.get('this') as ApexVariableContainer;
      state = new VariableAssignmentState(LOCAL_NESTED_JSON_VARIABLE_ASSIGNMENT.split('|'));
      state.handle(context);
      expect(container.value).toBe('');
      expect(container.variablesRef).not.toBe(0);
      expect(Array.from(container.variables.keys())).toEqual(expect.arrayContaining(['a', 'b1', 'b2', 'd', 'm', 's']));
      const VAR_VALUES = ["'0x37e2e22e'", 'BLOB(5 bytes)', 'BLOB(50 bytes)', '3.14', "'0xff6e2ff'", "'MyObject.s'"];
      ['a', 'b1', 'b2', 'd', 'm', 's'].forEach((element, index) => {
        const innerContainer = container.variables.get(element) as ApexVariableContainer;
        expect(innerContainer.value).toBe(VAR_VALUES[index]);
        expect(Array.from(innerContainer.variables.keys())).toHaveLength(0);
        expect(innerContainer.variablesRef).toBe(0);
      });
    });

    it('Should update variable to a nested variable holding another nested variable if assigning json to inner value', () => {
      let state = new VariableAssignmentState(LOCAL_NESTED_VARIABLE_ASSIGNMENT.split('|'));
      state.handle(context);
      const frameInfo = context.getFrameHandler().get(context.getTopFrame()!.id);
      const container = frameInfo.locals.get('this') as ApexVariableContainer;
      state = new VariableAssignmentState(LOCAL_NESTED_JSON_INNER_VARIABLE_ASSIGNMENT.split('|'));
      state.handle(context);
      expect(container.value).toBe('');
      expect(container.variablesRef).not.toBe(0);
      expect(container.variables.has('a')).toBe(true);
      const innerContainer = container.variables.get('a') as ApexVariableContainer;
      const variables = innerContainer.getAllVariables();
      expect(variables.length).toBe(1);
      expect(variables[0]).toMatchObject({
        name: 'Name',
        value: "'MyObjectAccount'",
        evaluateName: "'MyObjectAccount'"
      });
      expect(innerContainer.value).toBe('');
      expect(innerContainer.variables.has('Name')).toBe(true);
      expect(innerContainer.variablesRef).not.toBe(0);
      const innerContainerVariable = innerContainer.variables.get('Name') as ApexVariableContainer;
      expect(innerContainerVariable.value).toBe("'MyObjectAccount'");
      expect(innerContainerVariable.variablesRef).toBe(0);
    });

    it('Should not overwrite the this variable once assigned', () => {
      const state = new VariableAssignmentState(LOCAL_NESTED_VARIABLE_ASSIGNMENT.split('|'));
      state.handle(context);
      const frameInfo = context.getFrameHandler().get(context.getTopFrame()!.id);
      expect(Array.from(frameInfo.locals.keys())).toEqual(expect.arrayContaining(['this']));
      const container = frameInfo.locals.get('this') as ApexVariableContainer;
      const originalVariablesRef = container.variablesRef;
      const originalRef = container.ref;
      const originalVariables = container.variables;
      const thisReassign =
        '09:43:08.67 (106051501)|VARIABLE_ASSIGNMENT|[EXTERNAL]|this|{"a1":"0x40dd809d","m2":"0x71c42b4c","s1":"MyObject.s2"}|0x1e2aeb71';
      const assign = new VariableAssignmentState(thisReassign.split('|'));
      assign.handle(context);
      expect(container.variables).toBe(originalVariables);
      expect(container.ref).toBe(originalRef);
      expect(container.variablesRef).toBe(originalVariablesRef);
    });
  });

  describe('Static nested assignment', () => {
    const DUMMY_REF = '0x00000000';
    const DUMMY_REF1 = '0x00000001';
    const DUMMY_REF2 = '0x00000002';
    const STATIC_NESTED_VARIABLE_SCOPE_BEGIN = 'fakeTime|VARIABLE_SCOPE_BEGIN|[6]|NestedClass.sa|Account|true|true';
    const STATIC_NESTED_VARIABLE_ASSIGNMENT = `fakeTime|VARIABLE_ASSIGNMENT|[6]|NestedClass.sa|{}|${DUMMY_REF}`;
    const STATIC_NESTED_JSON_VARIABLE_ASSIGNMENT = `fakeTime|VARIABLE_ASSIGNMENT|[8]|NestedClass.sa|{"Name":"testName"}|${DUMMY_REF}`;
    const STATIC_NESTED_INNER_VARIABLE_ASSIGNMENT = `fakeTime|VARIABLE_ASSIGNMENT|[12]|sa.Name|"testName2"|${DUMMY_REF}`;
    const STATIC_NESTED_REASSIGNMENT_BEGIN =
      '04:35:37.25 (27947754)|VARIABLE_SCOPE_BEGIN|[10]|NestedClass.staticAcc1|Account|true|true';
    const STATIC_NESTED_REASSIGNMENT_BEGIN1 =
      '04:35:37.25 (27955171)|VARIABLE_SCOPE_BEGIN|[11]|NestedClass.staticAcc2|Account|true|true';
    const STATIC_NESTED_REASSIGNMENT = `04:35:37.25 (28650946)|VARIABLE_ASSIGNMENT|[10]|NestedClass.staticAcc1|{"Name":"staticacc1"}|${DUMMY_REF1}`;
    const STATIC_NESTED_REASSIGNMENT2 = `04:35:37.25 (28667298)|VARIABLE_ASSIGNMENT|[11]|NestedClass.staticAcc2|{"Name":"staticacc1"}|${DUMMY_REF1}`;
    const STATIC_NESTED_REASSIGNMENT3 = `04:35:37.25 (30077406)|VARIABLE_ASSIGNMENT|[16]|NestedClass.staticAcc1|{"Name":"changed in method1"}|${DUMMY_REF2}`;

    beforeEach(() => {
      // push frames on
      const state = new FrameEntryState(['signature']);
      context = new LogContext(launchRequestArgs, new ApexReplayDebug());
      context.getFrames().push({ id: 0, name: 'execute_anonymous_apex' } as StackFrame);
      expect(state.handle(context)).toBe(false);
      // add begin states for a local and static variable
      const beginState = new VariableBeginState(STATIC_NESTED_VARIABLE_SCOPE_BEGIN.split('|'));
      beginState.handle(context);
      getUriFromSignatureStub = sinon.stub(LogContext.prototype, 'getUriFromSignature').returns(uriFromSignature);
    });

    afterEach(() => {
      getUriFromSignatureStub.restore();
    });

    it('Should create a nested variable for an empty object', () => {
      const state = new VariableAssignmentState(STATIC_NESTED_VARIABLE_ASSIGNMENT.split('|'));
      const staticMapping = context.getStaticVariablesClassMap();
      expect(Array.from(staticMapping.keys())).toEqual(expect.arrayContaining(['NestedClass']));
      const classMap = staticMapping.get('NestedClass') as Map<string, VariableContainer>;
      expect(classMap.has('sa')).toBe(true);
      const container = classMap.get('sa')! as ApexVariableContainer;
      expect(container.variablesRef).toBe(0);
      expect(Array.from(container.variables.keys())).toHaveLength(0);
      expect(container.value).toBe('null');
      state.handle(context);
      expect(container.variablesRef).not.toBe(0);
      expect(Array.from(container.variables.keys())).toHaveLength(0);
      expect(container.value).toBe('');
    });

    it('Should update variable to a nested variable if json assignment', () => {
      let state = new VariableAssignmentState(STATIC_NESTED_VARIABLE_ASSIGNMENT.split('|'));
      state.handle(context);
      const staticMapping = context.getStaticVariablesClassMap();
      expect(Array.from(staticMapping.keys())).toEqual(expect.arrayContaining(['NestedClass']));
      const classMap = staticMapping.get('NestedClass') as Map<string, VariableContainer>;
      expect(classMap.has('sa')).toBe(true);
      const container = classMap.get('sa')! as ApexVariableContainer;
      expect(container.variablesRef).not.toBe(0);
      expect(Array.from(container.variables.keys())).toHaveLength(0);
      expect(container.value).toBe('');

      state = new VariableAssignmentState(STATIC_NESTED_JSON_VARIABLE_ASSIGNMENT.split('|'));
      state.handle(context);
      expect(container.value).toBe('');
      expect(container.variablesRef).not.toBe(0);
      expect(container.variables.has('Name')).toBe(true);
      const innerContainer = container.variables.get('Name') as ApexVariableContainer;
      expect(innerContainer.value).toBe("'testName'");
    });

    it('Should update variable if inner variable assigned', () => {
      let state = new VariableAssignmentState(STATIC_NESTED_VARIABLE_ASSIGNMENT.split('|'));
      state.handle(context);
      const staticMapping = context.getStaticVariablesClassMap();
      expect(Array.from(staticMapping.keys())).toEqual(expect.arrayContaining(['NestedClass']));
      const classMap = staticMapping.get('NestedClass') as Map<string, VariableContainer>;
      expect(classMap.has('sa')).toBe(true);
      const container = classMap.get('sa')! as ApexVariableContainer;
      expect(container.variablesRef).not.toBe(0);
      expect(Array.from(container.variables.keys())).toHaveLength(0);
      expect(container.value).toBe('');

      state = new VariableAssignmentState(STATIC_NESTED_INNER_VARIABLE_ASSIGNMENT.split('|'));
      state.handle(context);
      expect(container.variablesRef).not.toBe(0);
      expect(container.value).toBe('');
      expect(container.variables.has('Name')).toBe(true);
      const innerContainer = container.variables.get('Name') as ApexVariableContainer;
      expect(innerContainer.value).toBe("'testName2'");
    });

    it('Should update variable if reassigned to newly created reference', () => {
      let beginState = new VariableBeginState(STATIC_NESTED_REASSIGNMENT_BEGIN.split('|'));
      beginState.handle(context);
      beginState = new VariableBeginState(STATIC_NESTED_REASSIGNMENT_BEGIN1.split('|'));
      beginState.handle(context);
      let state = new VariableAssignmentState(STATIC_NESTED_REASSIGNMENT.split('|'));
      state.handle(context);
      state = new VariableAssignmentState(STATIC_NESTED_REASSIGNMENT2.split('|'));
      state.handle(context);
      const staticMapping = context.getStaticVariablesClassMap();
      expect(Array.from(staticMapping.keys())).toEqual(expect.arrayContaining(['NestedClass']));
      const classMap = staticMapping.get('NestedClass') as Map<string, VariableContainer>;
      expect(Array.from(classMap.keys())).toEqual(expect.arrayContaining(['staticAcc1', 'staticAcc2']));
      let acc1Container = classMap.get('staticAcc1')! as ApexVariableContainer;
      let acc2Container = classMap.get('staticAcc2')! as ApexVariableContainer;
      expect(acc1Container.variables).toBe(acc2Container.variables);
      state = new VariableAssignmentState(STATIC_NESTED_REASSIGNMENT3.split('|'));
      state.handle(context);
      acc1Container = classMap.get('staticAcc1')! as ApexVariableContainer;
      acc2Container = classMap.get('staticAcc2')! as ApexVariableContainer;
      expect(acc1Container.variables).not.toBe(acc2Container.variables);
    });
  });

  describe('Find references in reference map', () => {
    const PARENT_REF = '0x000000';
    const CHILD_REF = '0x000001';
    const PARENT_VARIABLE_BEGIN = 'fakeTime|VARIABLE_SCOPE_BEGIN|[17]|this|NestedClass|true|false';
    const CHILD_VARIABLE_ASSIGNMENT = `fakeTime|VARIABLE_ASSIGNMENT|[11]|this.Name|"MyObjectAccount"|${CHILD_REF}`;
    const PARENT_JSON_VARIABLE_ASSIGNMENT = `fakeTime|VARIABLE_ASSIGNMENT|[17]|this|{"a":"${CHILD_REF}"}|${PARENT_REF}`;
    const PARENT_VARIABLE_ASSIGNMENT = `fakeTime|VARIABLE_ASSIGNMENT|[10]|this.m|${CHILD_REF}|${PARENT_REF}`;
    const PARENT_VARIABLE_ASSIGNMENT2 = `fakeTime|VARIABLE_ASSIGNMENT|[10]|this.n|${CHILD_REF}|${PARENT_REF}`;

    beforeEach(() => {
      // push frames on
      const state = new FrameEntryState(['signature']);
      context = new LogContext(launchRequestArgs, new ApexReplayDebug());
      context.getFrames().push({ id: 0, name: 'execute_anonymous_apex' } as StackFrame);
      expect(state.handle(context)).toBe(false);
      // add begin states for a local and static variable
      let assignState = new VariableAssignmentState(CHILD_VARIABLE_ASSIGNMENT.split('|'));
      assignState.handle(context);
      const beginState = new VariableBeginState(PARENT_VARIABLE_BEGIN.split('|'));
      assignState = new VariableAssignmentState(PARENT_JSON_VARIABLE_ASSIGNMENT.split('|'));
      beginState.handle(context);
      assignState.handle(context);
      assignState = new VariableAssignmentState(PARENT_VARIABLE_ASSIGNMENT.split('|'));
      assignState.handle(context);
      assignState = new VariableAssignmentState(PARENT_VARIABLE_ASSIGNMENT2.split('|'));
      assignState.handle(context);
      getUriFromSignatureStub = sinon.stub(LogContext.prototype, 'getUriFromSignature').returns(uriFromSignature);
    });

    afterEach(() => {
      getUriFromSignatureStub.restore();
    });

    it('Should be able to pull reference values from json in assignments', () => {
      expect(Array.from(context.getRefsMap().keys())).toEqual(expect.arrayContaining([PARENT_REF, CHILD_REF]));
      const container = context.getRefsMap().get(PARENT_REF) as ApexVariableContainer;
      const childRefContainer = context.getRefsMap().get(CHILD_REF) as ApexVariableContainer;
      expect(Array.from(container.variables.keys())).toEqual(expect.arrayContaining(['a']));
      const childParentContainer = container.variables.get('a')!;
      expect(childParentContainer.variables).toBe(childRefContainer.variables);
    });

    it('Should be able to pull reference from assignment value', () => {
      expect(Array.from(context.getRefsMap().keys())).toEqual(expect.arrayContaining([PARENT_REF, CHILD_REF]));
      const container = context.getRefsMap().get(PARENT_REF) as ApexVariableContainer;
      const childRefContainer = context.getRefsMap().get(CHILD_REF) as ApexVariableContainer;
      expect(Array.from(container.variables.keys())).toEqual(expect.arrayContaining(['m']));
      const childParentContainer = container.variables.get('m')!;
      expect(childParentContainer.variables).toBe(childRefContainer.variables);
    });

    it('Should change both variable containers if they share a common reference', () => {
      expect(Array.from(context.getRefsMap().keys())).toEqual(expect.arrayContaining([PARENT_REF, CHILD_REF]));
      const container = context.getRefsMap().get(PARENT_REF) as ApexVariableContainer;
      expect(Array.from(container.variables.keys())).toEqual(expect.arrayContaining(['m']));
      const mContainer = container.variables.get('m')! as ApexVariableContainer;
      expect(Array.from(container.variables.keys())).toEqual(expect.arrayContaining(['n']));
      const nContainer = container.variables.get('n')! as ApexVariableContainer;
      expect(mContainer.variables).toBe(nContainer.variables);
      expect(mContainer.ref).toBe(nContainer.ref);
      const REF_ASSIGNMENT = `17:39:36.83 (150355500)|VARIABLE_ASSIGNMENT|[11]|this.Name|"both are updated"|${CHILD_REF}`;
      const state = new VariableAssignmentState(REF_ASSIGNMENT.split('|'));
      state.handle(context);
      expect(Array.from(mContainer.variables.keys())).toEqual(expect.arrayContaining(['Name']));
      expect(Array.from(nContainer.variables.keys())).toEqual(expect.arrayContaining(['Name']));
      const nSubContainer = nContainer.variables.get('Name') as ApexVariableContainer;
      const mSubContainer = mContainer.variables.get('Name') as ApexVariableContainer;
      expect(mSubContainer.value).toBe("'both are updated'");
      expect(nSubContainer.value).toBe("'both are updated'");
    });
  });

  describe('Collections', () => {
    const DUMMY_REF = '0x00000000';
    const DUMMY_REF2 = '0x00000001';
    const DUMMY_REF3 = '0x00000002';
    const MAP_VALUE =
      '{"1":{"a1":"0x3cc65531","m2":"0x25ba7599","s1":"MyObject.s2"},"2":{"a1":"0x603ac3f0","m2":"0x594a2142","s1":"MyObject.s2"}}';
    const MAP_BEGIN = '00:55:54.84 (116142294)|VARIABLE_SCOPE_BEGIN|[24]|amap|Map<String,MyObject>|true|false';
    const MAP_ASSIGNMENT = `00:55:54.84 (116191871)|VARIABLE_ASSIGNMENT|[24]|amap|${MAP_VALUE}|${DUMMY_REF}`;
    const LIST_VALUE =
      '[{"a1":"0x2f9c0fba","m2":"0xdc12056","s1":"MyObject.s2"},{"a1":"0xcdd88c9","m2":"0x6f90123a","s1":"MyObject.s2"}]';
    const LIST_BEGIN = '09:43:08.67 (106919036)|VARIABLE_SCOPE_BEGIN|[30]|alist|List<MyObject>|true|false';
    const LIST_ASSIGNMENT = `09:43:08.67 (107017879)|VARIABLE_ASSIGNMENT|[30]|alist|${LIST_VALUE}|${DUMMY_REF2}`;
    const SET_VALUE =
      '[{"a1":"0x40dd809d","m2":"0x71c42b4c","s1":"MyObject.s2"},{"a1":"0x46867f90","m2":"0x4f675045","s1":"MyObject.s2"}]';
    const SET_BEGIN = '09:43:08.67 (107041268)|VARIABLE_SCOPE_BEGIN|[30]|aset|Set<MyObject>|true|false';
    const SET_ASSIGNMENT = `09:43:08.67 (107119928)|VARIABLE_ASSIGNMENT|[30]|aset|${SET_VALUE}|${DUMMY_REF3}`;

    beforeEach(() => {
      // push frames on
      const state = new FrameEntryState(['signature']);
      context = new LogContext(launchRequestArgs, new ApexReplayDebug());
      context.getFrames().push({ id: 0, name: 'execute_anonymous_apex' } as StackFrame);
      expect(state.handle(context)).toBe(false);
      getUriFromSignatureStub = sinon.stub(LogContext.prototype, 'getUriFromSignature').returns(uriFromSignature);
    });

    afterEach(() => {
      getUriFromSignatureStub.restore();
    });

    it('Should not created a nested ref for maps', () => {
      const begin = new VariableBeginState(MAP_BEGIN.split('|'));
      begin.handle(context);
      const assign = new VariableAssignmentState(MAP_ASSIGNMENT.split('|'));
      assign.handle(context);
      const frameInfo = context.getFrameHandler().get(context.getTopFrame()!.id);
      expect(Array.from(frameInfo.locals.keys())).toEqual(expect.arrayContaining(['amap']));
      const container = frameInfo.locals.get('amap') as ApexVariableContainer;
      expect(container.value).toBe(MAP_VALUE);
      expect(container.ref).toBeUndefined();
      expect(container.variablesRef).toBe(0);
    });

    it('Should not created a nested ref for lists', () => {
      const begin = new VariableBeginState(LIST_BEGIN.split('|'));
      begin.handle(context);
      const assign = new VariableAssignmentState(LIST_ASSIGNMENT.split('|'));
      assign.handle(context);
      const frameInfo = context.getFrameHandler().get(context.getTopFrame()!.id);
      expect(Array.from(frameInfo.locals.keys())).toEqual(expect.arrayContaining(['alist']));
      const container = frameInfo.locals.get('alist') as ApexVariableContainer;
      expect(container.value).toBe(LIST_VALUE);
      expect(container.ref).toBeUndefined();
      expect(container.variablesRef).toBe(0);
    });

    it('Should not created a nested ref for sets', () => {
      const begin = new VariableBeginState(SET_BEGIN.split('|'));
      begin.handle(context);
      const assign = new VariableAssignmentState(SET_ASSIGNMENT.split('|'));
      assign.handle(context);
      const frameInfo = context.getFrameHandler().get(context.getTopFrame()!.id);
      expect(Array.from(frameInfo.locals.keys())).toEqual(expect.arrayContaining(['aset']));
      const container = frameInfo.locals.get('aset') as ApexVariableContainer;
      expect(container.value).toBe(SET_VALUE);
      expect(container.ref).toBeUndefined();
      expect(container.variablesRef).toBe(0);
    });
  });
});
