/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Messages } from '../messages/messages';
import { ValidateResult, Validator } from './validator';

export class DateValidator extends Validator {
  public validate(input: string): ValidateResult {
    const isValid = isDateLiteral(input.trim());
    const message = isValid ? undefined : Messages.error_fieldInput_date;
    return { isValid, message };
  }
}

export function isDateLiteral(s: string): boolean {
  return isDatePattern(s) || isDateRangeLiteral(s);
}

const staticDateRangeLiterals = new Set([
  'yesterday',
  'today',
  'tomorrow',
  'last_week',
  'this_week',
  'next_week',
  'last_month',
  'thid_month',
  'next_month',
  'last_90_days',
  'next_90_days',
  'last_quarter',
  'this_quarter',
  'next_quarter',
  'last_year',
  'this_year',
  'next_year',
  'last_fiscal_quarter',
  'this_fiscal_quarter',
  'next_fiscal_quarter',
  'last_fiscal_year',
  'this_fiscal_year',
  'next_fiscal_year',
]);

const parameterizedDateRangeLiteralPrefixes = new Set([
  'last_n_days:',
  'next_n_days:',
  'last_n_weeks:',
  'next_n_weeks:',
  'last_n_months:',
  'next_n_months:',
  'last_n_quarters:',
  'next_n_quarters:',
  'last_n_years:',
  'next_n_years:',
  'last_n_fiscal_quarters:',
  'next_n_fiscal_quarters:',
  'last_n_fiscal_years:',
  'next_n_fiscal_years:',
]);

function isDatePattern(s: string): boolean {
  const DATE_ONLY_PATTERN = /^[1-4][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]$/;
  const DATE_TIME_UTC_PATTERN = /^[1-4][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9][tT][0-2][0-9]:[0-5][0-9]:[0-5][0-9][zZ]$/;
  const DATE_TIME_OFFSET_PATTERN =
    /^[1-4][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9][tT][0-2][0-9]:[0-5][0-9]:[0-5][0-9][+-][0-1][0-9]:[0-5][0-9]$/;
  return (
    DATE_ONLY_PATTERN.test(s.trim()) || DATE_TIME_UTC_PATTERN.test(s.trim()) || DATE_TIME_OFFSET_PATTERN.test(s.trim())
  );
}

function isDateRangeLiteral(s: string): boolean {
  return isStaticDateRangeLiteral(s) || isParameterizedDateRangeLiteral(s);
}

function isStaticDateRangeLiteral(s: string): boolean {
  return staticDateRangeLiterals.has(s.trim().toLowerCase());
}

function isParameterizedDateRangeLiteral(s: string): boolean {
  let isMatch = false;
  const trimmed = s.trim();
  const colonIdx = trimmed.indexOf(':');
  if (colonIdx >= 0) {
    const prefix = trimmed.substring(0, colonIdx + 1);
    if (parameterizedDateRangeLiteralPrefixes.has(prefix.toLowerCase())) {
      const theRest = trimmed.substring(colonIdx + 1);
      isMatch = /^[0-9]+$/.test(theRest);
    }
  }
  return isMatch;
}
