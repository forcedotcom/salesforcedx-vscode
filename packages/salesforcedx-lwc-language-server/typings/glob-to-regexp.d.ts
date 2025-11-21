/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
declare module 'glob-to-regexp' {
  interface GlobToRegExpOptions {
    globstar?: boolean;
    extended?: boolean;
    flags?: string;
  }

  function globToRegExp(pattern: string, options?: GlobToRegExpOptions): RegExp;
  export default globToRegExp;
}
