import { Locator } from 'vscode-extension-tester';
import { Duration } from './miscellaneous';
import { getBrowser } from './workbench';

export interface PredicateWithTimeout {
  predicate: () => Promise<boolean>;
  maxWaitTime: Duration; // in milliseconds
}

export const standardPredicates = {
  alwaysTrue: async () => true,
  waitForElement: async (selector: Locator) => {
    return await getBrowser().findElement(selector).isDisplayed();
  },
  waitForCondition: async (condition: () => boolean) => {
    while (!condition()) {
      await new Promise((resolve) => setTimeout(resolve, 100)); // Adjust polling interval as needed
    }
    return true;
  }
};

export function createPredicateWithTimeout(
  predicate: () => Promise<boolean>,
  maxWaitTime: Duration
): PredicateWithTimeout {
  return {
    predicate,
    maxWaitTime
  };
}
