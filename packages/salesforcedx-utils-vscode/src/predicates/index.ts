/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// This file is meant to mimics the functionality of Predicate and Predicates from Google Guava.
// Expand as necessary.

export type Predicate<T> = {
  apply(item: T): PredicateResponse | Promise<PredicateResponse>;
};

export class PredicateResponse {
  public result: boolean;
  public message: string;

  private constructor(result: boolean, message: string) {
    this.result = result;
    this.message = message;
  }

  public static of(result: boolean, message: string): PredicateResponse {
    return new PredicateResponse(result, message);
  }

  public static true(): PredicateResponse {
    return new PredicateResponse(true, '');
  }

  public static false(): PredicateResponse {
    return new PredicateResponse(false, 'GENERAL ERROR');
  }
}
