/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import { api, LightningElement, track } from 'lwc';
import { JsonMap } from '@salesforce/ts-types';
import { AndOr } from '../services/model';

interface ConditionTemplate {
  condition: JsonMap;
  index: number;
}

interface ModifierGroupNode extends Node {
  allModifiersHaveValue: boolean;
}

export default class Where extends LightningElement {
  @api public isLoading = false;
  @api public whereFields: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @api public sobjectMetadata: any;
  @track public _conditionsStore: JsonMap[] = [];
  public _andOr = AndOr.AND;
  public conditionTemplate: ConditionTemplate = {
    condition: {
      operator: '='
    },
    index: this.templateIndex
  };
  public lastModifierGroupIsComplete = false;

  @api public get whereExpr(): JsonMap {
    return { conditions: this._conditionsStore, andOr: this._andOr };
  }

  public set whereExpr(where: JsonMap) {
    if (where.conditions && where.conditions.length) {
      this._conditionsStore = where.conditions;
    } else {
      this._conditionsStore = [this.conditionTemplate];
    }

    if (where.andOr) {
      this._andOr = where.andOr;
    }
  }

  public get templateIndex(): number {
    return this._conditionsStore.length;
  }

  public headerSelectedClass = ' header__btn--selected';
  public get andBtnClassList(): string {
    let andClassList = 'header__btn header__btn--and';
    andClassList += this._andOr === AndOr.AND ? this.headerSelectedClass : '';

    return andClassList;
  }

  public get orBtnClassList(): string {
    let orClassList = 'header__btn header__btn--or';
    orClassList += this._andOr === AndOr.OR ? this.headerSelectedClass : '';

    return orClassList;
  }

  public get addBtnClassList(): string {
    const disabledBtnClass = 'btn--disabled';
    let classList = '';
    classList += !this.lastModifierGroupIsComplete ? disabledBtnClass : '';
    return classList;
  }

  public renderedCallback(): void {
    this.checkLastModifierGroup();
  }

  public getModfierGroupsRendered(): NodeList {
    return this.template.querySelectorAll('querybuilder-where-modifier-group');
  }

  public checkLastModifierGroup(): void {
    const modfierGroupsRendered = this.getModfierGroupsRendered();

    if (this.getModfierGroupsRendered().length) {
      const lastGroupIndex = modfierGroupsRendered.length - 1;
      const lastGroupIsComplete = (
        modfierGroupsRendered[lastGroupIndex] as ModifierGroupNode
      ).allModifiersHaveValue;

      this.lastModifierGroupIsComplete = lastGroupIsComplete;
    }
  }

  public handleAddModGroup(e: { preventDefault: () => void }): void {
    e.preventDefault();
    const newTemplate = {
      ...this.conditionTemplate,
      index: this.templateIndex
    };
    this._conditionsStore = [...this._conditionsStore, newTemplate];
  }

  /* eslint-disable @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-assignment */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/explicit-module-boundary-types
  public handleSetAndOr(e: any): void {
    e.preventDefault();
    const selectedValue = e.target.value;
    const isValidValue =
      selectedValue === AndOr.AND || selectedValue === AndOr.OR;

    if (isValidValue && selectedValue !== this._andOr) {
      this._andOr = selectedValue;

      if (
        this.getModfierGroupsRendered().length > 1 &&
        this.lastModifierGroupIsComplete
      ) {
        const andOrSelectionEvent = new CustomEvent('where__andor_selection', {
          detail: selectedValue
        });
        this.dispatchEvent(andOrSelectionEvent);
      }
    }
  }

  public handleModifierGroupSelection(e: Event): void {
    e.preventDefault();
    // eslint-disable-next-line camelcase
    const where__group_selectionEvent = new CustomEvent(
      'where__group_selection',
      {
        detail: { fieldCompareExpr: e.detail, andOr: this._andOr }
      }
    );
    this.dispatchEvent(where__group_selectionEvent);
  }
}
