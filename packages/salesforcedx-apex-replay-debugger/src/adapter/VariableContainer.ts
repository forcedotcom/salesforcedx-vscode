import { ApexVariable } from './ApexVariable';
import { ScopeType } from './types';

export abstract class VariableContainer {
  public variables: Map<string, VariableContainer>;

  public constructor(variables: Map<string, VariableContainer> = new Map<string, VariableContainer>()) {
    this.variables = variables;
  }

  public getAllVariables(): ApexVariable[] {
    const result: ApexVariable[] = [];
    this.variables.forEach(container => {
      const avc = container as ApexVariableContainer;
      result.push(new (require('./ApexVariable').ApexVariable)(avc.name, avc.value, avc.type, avc.variablesRef));
    });
    return result;
  }

  public copy(): VariableContainer {
    const me = Object.assign(Object.create(Object.getPrototypeOf(this)));
    me.variables = new Map<string, VariableContainer>();
    this.variables.forEach((value, key) => {
      me.variables.set(key, value.copy());
    });
    return me;
  }
}

export class ApexVariableContainer extends VariableContainer {
  public name: string;
  public value: string;
  public type: string;
  public ref: string | undefined;
  public variablesRef: number;
  public constructor(name: string, value: string, type: string, ref?: string, variablesRef: number = 0) {
    super();
    this.name = name;
    this.value = value;
    this.type = type;
    this.ref = ref;
    this.variablesRef = variablesRef;
  }

  public copy(): ApexVariableContainer {
    const me = super.copy() as ApexVariableContainer;
    me.name = this.name;
    me.value = this.value;
    me.type = this.type;
    me.ref = this.ref;
    me.variablesRef = this.variablesRef;
    return me;
  }
}

export class ScopeContainer extends VariableContainer {
  public readonly type: ScopeType;

  public constructor(type: ScopeType, variables: Map<string, VariableContainer>) {
    super(variables);
    this.type = type;
  }

  public getAllVariables(): ApexVariable[] {
    const apexVariables: ApexVariable[] = [];
    this.variables.forEach(entry => {
      const avc = entry as ApexVariableContainer;
      apexVariables.push(new ApexVariable(avc.name, avc.value, avc.type, avc.variablesRef));
    });
    return apexVariables;
  }
}
