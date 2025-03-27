import * as DurationKit from '@salesforce/kit';
import { PredicateWithTimeout } from './predicates';
import { WebElement } from 'vscode-extension-tester';
export declare function pause(duration?: Duration): Promise<void>;
export declare function log(message: string): void;
export declare function debug(message: string): void;
export declare function error(message: string): void;
export declare function currentOsUserName(): string;
export declare function transformedUserName(): string;
/**
 * @param type type of html tag we want to find
 * @param attribute attribute that holds the given text
 * @param labelText text of the element we want to find
 * @param waitForClickable whether to wait until the element is clickable
 * @param waitOptions options for waiting until the element is clickable
 * @returns element that contains the given text
 */
export declare function findElementByText(type: string, attribute: string, labelText: string | undefined, waitForClickable?: boolean | undefined, waitOptions?: {
    timeout?: Duration;
    interval?: Duration;
    reverse?: boolean;
    timeoutMsg?: string;
}): Promise<WebElement>;
export declare function createCommand(type: string, name: string, folder: string, extension: string): Promise<string | undefined>;
export declare function setDefaultOrg(targetOrg: string): Promise<void>;
export declare function isDuration(predicateOrWait: PredicateWithTimeout | Duration): predicateOrWait is Duration;
export declare enum Unit {
    MINUTES = 0,
    MILLISECONDS = 1,
    SECONDS = 2,
    HOURS = 3,
    DAYS = 4,
    WEEKS = 5
}
export declare class Duration extends DurationKit.Duration {
    private scaleFactor;
    constructor(quantity: number, unit: Unit, scaleFactor?: number);
    get minutes(): number;
    get hours(): number;
    get milliseconds(): number;
    get seconds(): number;
    get days(): number;
    get weeks(): number;
    static ONE_MINUTE: Duration;
    static FIVE_MINUTES: Duration;
    static TEN_MINUTES: Duration;
    static milliseconds(quantity: number): Duration;
    static seconds(quantity: number): Duration;
    static minutes(quantity: number): Duration;
    static hours(quantity: number): Duration;
    static days(quantity: number): Duration;
    static weeks(quantity: number): Duration;
}
export declare function sleep(duration: number): Promise<void>;
export declare function openFolder(path: string): Promise<void>;
/**
 * An definite alternative of getTextEditor to open a file in text editor
 * @param path
 */
export declare function openFile(path: string): Promise<void>;
