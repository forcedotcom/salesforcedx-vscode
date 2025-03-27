import { WebElement } from 'vscode-extension-tester';
import { Duration } from './miscellaneous';
export declare function openOrgBrowser(wait?: Duration): Promise<void>;
export declare function verifyOrgBrowserIsOpen(): Promise<void>;
export declare function findTypeInOrgBrowser(type: string): Promise<WebElement | undefined>;
