/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ApexVariable } from './apexVariable';
import { ScopeType } from './types';

export class ApexVariableContainer {
  public variables: Map<string, ApexVariableContainer>;
  public name: string;
  public value: string;
  public type: string;
  public ref: string | undefined;
  public variablesRef: number;

  constructor(
    name = '',
    value = '',
    type = '',
    ref?: string,
    variablesRef = 0,
    variables?: Map<string, ApexVariableContainer>
  ) {
    this.name = name;
    this.value = value;
    this.type = type;
    this.ref = ref;
    this.variablesRef = variablesRef;
    this.variables = variables ?? new Map<string, ApexVariableContainer>();
  }

  public getAllVariables(): ApexVariable[] {
    return Array.from(this.variables.values()).map(
      container => new ApexVariable(container.name, container.value, container.type, container.variablesRef)
    );
  }

  public copy(): ApexVariableContainer {
    return new ApexVariableContainer(
      this.name,
      this.value,
      this.type,
      this.ref,
      this.variablesRef,
      new Map(Array.from(this.variables.entries()).map(([key, value]) => [key, value.copy()]))
    );
  }
}

export class ScopeContainer extends ApexVariableContainer {
  public readonly scopeType: ScopeType;

  constructor(type: ScopeType, variables: Map<string, ApexVariableContainer>) {
    super('', '', '', undefined, 0, variables);
    this.scopeType = type;
  }
}
