/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */
import { api, LightningElement, track } from 'lwc';
import {
  REL_PREFIX,
  DrillLevel,
  buildDrilledOptions,
  applyDrillMetadata,
  buildBreadcrumb,
  buildQualifiedFieldName,
  popDrillStack,
  findReferenceTo
} from '../services/drillUtils';
import debounce from 'debounce';
import { messages } from 'querybuilder/messages';
import { ConditionOperator, LiteralType, SObjectFieldType, UiOperatorValue } from '@salesforce/soql-model/model/model';
import { getFieldInputValidator, getFieldMultipleInputValidator, getOperatorValidator } from '@salesforce/soql-model/validators/validatorFactory';
import { splitMultiInputValues } from '@salesforce/soql-model/validators/inputUtils';
import { JsonMap } from '@salesforce/types';
import { OperatorOption, operatorOptions } from '../services/model';
import { SObjectTypeUtils } from '../services/sobjectUtils';
import {
  displayValueToSoqlStringLiteral,
  soqlStringLiteralToDisplayValue,
  addWildCardToValue,
  stripWildCardPadding
} from '../services/soqlUtils';

const DEFAULT_FIELD_INPUT_VALUE = '';
const DEFAULT_OPERATOR_INPUT_VALUE = 'EQ';
const DEFAULT_CRITERIA_INPUT_VALUE = '';


export default class WhereModifierGroup extends LightningElement {
  @api public allFields: string[];
  @api public isLoading = false;
  @api public index;
  @track public _currentFieldSelection;
  @track public _criteriaDisplayValue;
  @track public _drillStack: DrillLevel[] = [];
  public sobjectTypeUtils: SObjectTypeUtils;
  public fieldEl: HTMLSelectElement;
  public operatorEl: HTMLSelectElement;
  public criteriaEl: HTMLInputElement;
  public operatorErrorMessage = '';
  public criteriaErrorMessage = '';
  public hasOperatorError = false;
  public hasCriteriaError = false;
  public selectPlaceHolderText = messages.placeholder_search_fields;
  public _allModifiersHaveValue = false;
  public _sobjectMetadata: any;
  public _condition: JsonMap;
  public _currentOperatorValue: UiOperatorValue | undefined;
  public handleSelectionEvent: () => void;

  @api
  public get sobjectMetadata(): any {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this._sobjectMetadata;
  }
  public set sobjectMetadata(sobjectMetadata: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this._sobjectMetadata = sobjectMetadata;
    this.sobjectTypeUtils = new SObjectTypeUtils(sobjectMetadata);
    this.resetErrorFlagsAndMessages();
  }

  // Base fields + → relationship entries, or drilled-in fields + deeper → entries
  public get computedAllFields(): string[] {
    if (this._drillStack.length > 0) {
      const currentMeta = this._drillStack[this._drillStack.length - 1].metadata;
      return buildDrilledOptions(currentMeta, this._drillStack.length);
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const relEntries: string[] = (this._sobjectMetadata?.fields || [])
      .filter((f: any) => f.type === 'reference' && f.relationshipName)
      .map((f: any) => `${REL_PREFIX}${f.relationshipName as string}`)
      .sort();
    return [...(this.allFields || []), ...relEntries];
  }

  public get relDrillBreadcrumb(): string {
    return buildBreadcrumb(this._drillStack);
  }

  public get isDrilledIn(): boolean {
    return this._drillStack.length > 0;
  }

  @api
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public setRelDrillMetadata(metadata: any): void {
    if (this._drillStack.length === 0) return;
    this._drillStack = applyDrillMetadata(this._drillStack, metadata);
  }

  public handleRelDrillBack(): void {
    if (this._drillStack.length <= 1) {
      this._drillStack = [];
    } else {
      this._drillStack = popDrillStack(this._drillStack);
    }
  }

  public handleFieldOptionSelection(e: CustomEvent): void {
    const value: string = e.detail?.value;
    if (!value) return;

    if (value.startsWith(REL_PREFIX)) {
      const relName = value.slice(REL_PREFIX.length);
      const sourceMeta = this._drillStack.length > 0
        ? this._drillStack[this._drillStack.length - 1].metadata
        : this._sobjectMetadata;
      const referenceTo = findReferenceTo(sourceMeta, relName);
      if (!referenceTo) return;
      this._drillStack = [...this._drillStack, { relationshipName: relName, referenceTo, metadata: null }];
      this.dispatchEvent(new CustomEvent('where__loadrelationship', {
        detail: { index: this.index, relationshipName: relName, referenceTo },
        bubbles: true,
        composed: true
      }));
      return;
    }

    // Plain field — build full dotted path from stack
    this._currentFieldSelection = buildQualifiedFieldName(this._drillStack, value);
    this._drillStack = [];
  }

  @api // this need to be public so parent can read value
  public get allModifiersHaveValue(): boolean {
    return this._allModifiersHaveValue;
  }

  @api
  public get condition(): JsonMap {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this._condition;
  }

  public set condition(condition: JsonMap) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this._condition = condition;
    this._criteriaDisplayValue = '';

    this._currentFieldSelection = this.getFieldName();

    const matchingOption = condition ? operatorOptions.find(option => option.predicate(condition)) : undefined;
    this._currentOperatorValue = matchingOption ? matchingOption.value : undefined;

    if (this._selectedOperator && this.isMultipleValueOperator(this._selectedOperator.value)) {
      if (Array.isArray(condition.values)) {
        this._criteriaDisplayValue = condition.values.map(value => value.value).join(', ');
      }
    } else {
      if (
        condition.compareValue &&
        condition.compareValue.type &&
        condition.compareValue.value &&
        matchingOption &&
        matchingOption.value
      ) {
        this._criteriaDisplayValue = this.displayValue(
          condition.compareValue.type,
          condition.compareValue.value,
          matchingOption.value
        );
      }
    }
  }
  /* ======= CSS CLASS METHODS ======= */
  public get operatorClasses(): string {
    let classes = 'modifier__item modifier__operator';
    classes = this.hasOperatorError ? classes + ' tooltip tooltip--error' : classes;
    return classes;
  }

  public get criteriaClasses(): string {
    let classes = 'modifier__item modifier__criteria';
    classes = this.hasCriteriaError ? classes + ' tooltip tooltip--error' : classes;
    return classes;
  }
  /* --------------------------------- */
  public constructor() {
    super();
    this.handleSelectionEvent = debounce(selectionEventHandler.bind(this), 500);
  }
  /* ======= LIFECYCLE HOOKS ======= */
  public renderedCallback(): void {
    this.fieldEl = this.template.querySelector('querybuilder-custom-select');
    this.operatorEl = this.template.querySelector('[data-el-where-operator-input]');
    this.criteriaEl = this.template.querySelector('[data-el-where-criteria-input]');
    this.checkAllModifiersHaveValues();
  }

  /* ======= FIELDS ======= */
  public get _selectedField(): any[] {
    return this._currentFieldSelection ? [this._currentFieldSelection] : [];
  }

  public get defaultFieldOptionText(): string {
    return this.isLoading ? messages.label_loading : messages.placeholder_select_field;
  }

  public getFieldName(): string | undefined {
    return this.condition && this.condition.field && this.condition.field.fieldName
      ? this.condition.field.fieldName
      : undefined;
  }

  /* ======= OPERATORS ======= */
  public get hasSelectedOperator(): boolean {
    return !!this._currentOperatorValue;
  }
  // consumed in UI template for rendering
  public get _selectedOperator(): OperatorOption | undefined {
    return operatorOptions.find(option => option.value === this._currentOperatorValue);
  }

  public get filteredOperators(): OperatorOption[] {
    return operatorOptions.filter(option => {
      return option.value !== this._currentOperatorValue;
    });
  }

  public toOperatorModelValue(value: UiOperatorValue): ConditionOperator | undefined {
    const matchingOption = operatorOptions.find(option => option.value === value);
    return matchingOption ? matchingOption.modelValue : undefined;
  }

  /* ======= CRITERIA ======= */
  public get criteriaDisplayValue(): string | undefined {
    return this._criteriaDisplayValue;
  }

  /* ======= UTILITIES ======= */
  public resetErrorFlagsAndMessages(): void {
    this.operatorErrorMessage = this.criteriaErrorMessage = '';
    this.hasOperatorError = this.hasCriteriaError = false;
  }

  public checkAllModifiersHaveValues(): boolean {
    const allHaveValues = Boolean(this.fieldEl.value[0] && this.operatorEl.value && this.criteriaEl.value);
    this._allModifiersHaveValue = allHaveValues;
    return allHaveValues;
  }

  public isMultipleValueOperator(operatorValue: UiOperatorValue): boolean {
    return (
      operatorValue === 'IN' ||
      operatorValue === 'NOT_IN' ||
      operatorValue === 'INCLUDES' ||
      operatorValue === 'EXCLUDES'
    );
  }

  public isSpecialLikeCondition(operatorValue: UiOperatorValue): boolean {
    return operatorValue === 'LIKE_START' || operatorValue === 'LIKE_END' || operatorValue === 'LIKE_CONTAINS';
  }

  // This is the value displayed in modifier <input>
  public displayValue(type: LiteralType, rawValue: string, operatorValue?: UiOperatorValue): string {
    let displayValue = rawValue;
    // eslint-disable-next-line default-case
    switch (type) {
      case 'STRING':
        displayValue = soqlStringLiteralToDisplayValue(rawValue);
        if (this.isSpecialLikeCondition(operatorValue)) {
          displayValue = stripWildCardPadding(displayValue);
        }
        break;
    }

    return displayValue;
  }
  // This is represents the compareValue in the SOQL Query
  public normalizeInput(type: SObjectFieldType, value: string, operatorValue?: UiOperatorValue): string {
    let normalized = value;
    if (!this.isMultipleValueOperator(this._currentOperatorValue)) {
      switch (type) {
        case SObjectFieldType.Boolean:
        case SObjectFieldType.Integer:
        case SObjectFieldType.Long:
        case SObjectFieldType.Double:
        case SObjectFieldType.Date:
        case SObjectFieldType.DateTime:
        case SObjectFieldType.Time:
        case SObjectFieldType.Currency: {
          // do nothing
          break;
        }
        default: {
          // treat like string
          if (value.toLowerCase().trim() !== 'null') {
            if (this.isSpecialLikeCondition(operatorValue)) {
              const wildCardValue = addWildCardToValue(operatorValue, value);
              normalized = displayValueToSoqlStringLiteral(wildCardValue);
            } else {
              normalized = displayValueToSoqlStringLiteral(normalized);
            }
          }
          break;
        }
      }
    }
    return normalized;
  }

  public getSObjectFieldType(fieldName: string): SObjectFieldType {
    return this.sobjectTypeUtils ? this.sobjectTypeUtils.getType(fieldName) : SObjectFieldType.AnyType;
  }

  public getPicklistValues(fieldName: string): string[] {
    // values need to be quoted
    return this.sobjectTypeUtils ? this.sobjectTypeUtils.getPicklistValues(fieldName).map(value => `'${value}'`) : [];
  }

  public getCriteriaType(type: SObjectFieldType, value: string): LiteralType {
    let criteriaType: LiteralType = 'STRING';
    if (value.toLowerCase() === 'null') {
      return 'NULL';
    }
    // eslint-disable-next-line default-case
    switch (type) {
      case SObjectFieldType.Boolean: {
        criteriaType = 'BOOLEAN';
        break;
      }
      case SObjectFieldType.Currency: {
        criteriaType = 'CURRENCY';
        break;
      }
      case SObjectFieldType.DateTime:
      case SObjectFieldType.Date:
      case SObjectFieldType.Time: {
        criteriaType = 'DATE';
        break;
      }
      case SObjectFieldType.Integer:
      case SObjectFieldType.Long:
      case SObjectFieldType.Percent:
      case SObjectFieldType.Double: {
        criteriaType = 'NUMBER';
        break;
      }
    }

    return criteriaType;
  }

  public validateInput(): boolean {
    if (this.checkAllModifiersHaveValues()) {
      this.resetErrorFlagsAndMessages();

      const fieldName = (this._currentFieldSelection = this.fieldEl.value[0]);
      const op = (this._currentOperatorValue = this.operatorEl.value as UiOperatorValue);
      const opModelValue = this.toOperatorModelValue(op);

      this._criteriaDisplayValue = this.criteriaEl.value;
      const type = this.getSObjectFieldType(fieldName);
      const normalizedInput = this.normalizeInput(type, this.criteriaEl.value, op);
      const critType = this.getCriteriaType(type, normalizedInput);
      const picklistValues = this.getPicklistValues(fieldName);
      const nillable = this.sobjectTypeUtils.getNillable(fieldName);

      const validateOptions = {
        type,
        picklistValues,
        nillable
      };

      const isMultiInput = this.isMultipleValueOperator(this._currentOperatorValue);

      const inputValidator = isMultiInput
        ? getFieldMultipleInputValidator(validateOptions)
        : getFieldInputValidator(validateOptions);
      let result = inputValidator.validate(normalizedInput);
      if (!result.isValid) {
        this.errorMessage = this.criteriaErrorMessage = result.message;
        this.hasCriteriaError = true;
        return false;
      }

      const operatorValidator = getOperatorValidator(validateOptions);
      result = operatorValidator.validate(op);
      if (!result.isValid) {
        this.errorMessage = this.operatorErrorMessage = result.message;
        this.hasOperatorError = true;
        return false;
      }

      const conditionTemplate = {
        field: { fieldName },
        operator: opModelValue
      };
      if (isMultiInput) {
        const endsWithCommaAndOptionalSpaceRegex = /,\s*$/; // matches ',' or ', ' or ',  '
        if (normalizedInput && !endsWithCommaAndOptionalSpaceRegex.test(normalizedInput)) {
          const rawValues = splitMultiInputValues(normalizedInput);
          const values = rawValues.map(value => {
            return {
              type: critType,
              value
            };
          });
          // eslint-disable-next-line @lwc/lwc/no-api-reassignments
          this.condition = {
            ...conditionTemplate,
            values
          };
        } else {
          // Do not trigger update. User is still typing or not finished their input.
        }
      } else {
        // eslint-disable-next-line @lwc/lwc/no-api-reassignments
        this.condition = {
          ...conditionTemplate,
          compareValue: {
            type: critType,
            value: normalizedInput
          }
        };
      }
    }

    return true;
  }
  /* ======= EVENT HANDLERS ======= */
  public handleConditionRemoved(e): void {
    // reset inputs to defaults
    this._currentFieldSelection = DEFAULT_FIELD_INPUT_VALUE;
    this._currentOperatorValue = DEFAULT_OPERATOR_INPUT_VALUE;
    this._criteriaDisplayValue = DEFAULT_CRITERIA_INPUT_VALUE;
    this.resetErrorFlagsAndMessages();

    e.preventDefault();
    const conditionRemovedEvent = new CustomEvent('where__condition_removed', {
      detail: {
        index: this.index
      },
      bubbles: true,
      composed: true
    });

    this.dispatchEvent(conditionRemovedEvent);
  }
}

const selectionEventHandler = function (e): void {
  e.preventDefault();
  // note: this.validateInput() will change state by setting this.condition
  if (this.checkAllModifiersHaveValues() && this.validateInput()) {
    const modGroupSelectionEvent = new CustomEvent('modifiergroupselection', {
      detail: {
        condition: this.condition,
        index: this.index
      }
    });
    this.dispatchEvent(modGroupSelectionEvent);
  }
};
