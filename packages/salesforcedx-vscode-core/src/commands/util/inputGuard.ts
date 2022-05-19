import { notificationService } from '@salesforce/salesforcedx-utils-vscode/out/src/commands';
import { format } from 'util';
import { nls } from '../../messages';

const NOT_ALPHANUMERIC_OR_UNDERSCORE_ERROR = 'not_alphanumeric_or_underscore_error';
const NOT_START_WITH_LOWERCASE_ERROR = 'not_start_with_lowercase_error';
const HAS_WHITE_SPACE_ERROR = 'has_white_space_error';
const END_WITH_UNDERSCORE_ERROR = 'end_with_underscore_error';
const HAS_TWO_CONSECUTIVE_UNDERSCORES_ERROR = 'has_two_consecutive_underscores_error';
const HAS_HYPHEN_ERROR = 'has_hyphen_error';

// guard lwc component name
export function lwcComponentInputGuard(newName: string) {
  beginWithLowerCase(newName);
  HasAlphanumericOrUnderscore(newName);
  hasWhiteSpace(newName);
  endWithUnderscore(newName);
  hasConsecutiveUnderscores(newName);
  hasHyphen(newName);
}

// guard aura component name
export function auraComponentInputGuard(newName: string) {
  //
}

function HasAlphanumericOrUnderscore(input: string) {
  const invalidPattern = /\W/;
  if (input.match(invalidPattern)) {
    showErrorMessage(NOT_ALPHANUMERIC_OR_UNDERSCORE_ERROR);
  }
}

function beginWithLowerCase(input: string) {
  const firstChar = input.charAt(0);
  if (!isLowerCase(firstChar)) {
    showErrorMessage(NOT_START_WITH_LOWERCASE_ERROR);
  }
}

function hasWhiteSpace(input: string) {
  if (input.indexOf(' ') >= 0) {
    showErrorMessage(HAS_WHITE_SPACE_ERROR);
  }
}

function endWithUnderscore(input: string) {
  const endChar = input.charAt(input.length - 1);
  if (endChar === '_') {
    showErrorMessage(END_WITH_UNDERSCORE_ERROR);
  }
}

function hasConsecutiveUnderscores(input: string) {
  if (input.indexOf('__') >= 0) {
    showErrorMessage(HAS_TWO_CONSECUTIVE_UNDERSCORES_ERROR);
  }
}

function hasHyphen(input: string) {
  if (input.indexOf('-') >= 0) {
    showErrorMessage(HAS_HYPHEN_ERROR);
  }
}

function isLowerCase(str: string): boolean {
  return str === str.toLowerCase() && str !== str.toUpperCase();
}

function showErrorMessage(message: string) {
  const errorMessage = nls.localize(message);
  notificationService.showErrorMessage(errorMessage);
  throw new Error(format(errorMessage));
}
