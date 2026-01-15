/**
 * ERROR HANDLING UTILITIES
 * THIS CAN BE REPLACED WITH IMPORT FROM SOQL_MODEL ( Fernando work )
 */
export enum ErrorType {
  UNKNOWN = 'UNKNOWN',
  EMPTY = 'EMPTY',
  NOSELECT = 'NOSELECT',
  NOSELECTIONS = 'NOSELECTIONS',
  NOFROM = 'NOFROM',
  INCOMPLETEFROM = 'INCOMPLETEFROM',
  INCOMPLETELIMIT = 'INCOMPLETELIMIT'
}

// recoverable field errors
export const recoverableFieldErrors: Partial<Record<ErrorType, boolean>> = {
  [ErrorType.NOSELECT]: true,
  [ErrorType.NOSELECTIONS]: true,
  [ErrorType.EMPTY]: true
};

// recoverable from errors
export const recoverableFromErrors: Partial<Record<ErrorType, boolean>> = {
  [ErrorType.INCOMPLETEFROM]: true,
  [ErrorType.NOFROM]: true,
  [ErrorType.EMPTY]: true
};

// recoverable limit errors
export const recoverableLimitErrors: Partial<Record<ErrorType, boolean>> = {
  [ErrorType.INCOMPLETELIMIT]: true
};

// general recoverable errors
export const recoverableErrors: Partial<Record<ErrorType, boolean>> = {
  ...recoverableFieldErrors,
  ...recoverableFromErrors,
  ...recoverableLimitErrors,
  [ErrorType.EMPTY]: true
};

// unrecoverable errors
export const unrecoverableErrors: Partial<Record<ErrorType, boolean>> = {
  [ErrorType.UNKNOWN]: true
};

// END ERROR HANDLING UTLIITIES
