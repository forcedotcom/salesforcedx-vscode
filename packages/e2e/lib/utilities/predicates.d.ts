import { Locator } from 'vscode-extension-tester';
import { Duration } from './miscellaneous';
export interface PredicateWithTimeout {
    predicate: () => Promise<boolean>;
    maxWaitTime: Duration;
}
export declare const standardPredicates: {
    alwaysTrue: () => Promise<boolean>;
    waitForElement: (selector: Locator) => Promise<boolean>;
    waitForCondition: (condition: () => boolean) => Promise<boolean>;
};
export declare function createPredicateWithTimeout(predicate: () => Promise<boolean>, maxWaitTime: Duration): PredicateWithTimeout;
