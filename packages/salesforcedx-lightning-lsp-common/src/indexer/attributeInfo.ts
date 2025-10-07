/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Location } from 'vscode-languageserver';

export type AttributeInfo = {
    name: string;
    documentation: string;
    memberType: MemberType;
    decorator: DecoratorType;
    type: string;
    location?: Location;
    detail?: string;
};

export type MemberType = 'PROPERTY' | 'METHOD';

export type DecoratorType = 'API' | 'TRACK';

// Factory function to replace constructor usage
export const createAttributeInfo = (
    name: string,
    documentation: string,
    memberType: MemberType,
    decorator: DecoratorType,
    type: string,
    location?: Location,
    detail?: string,
): AttributeInfo => ({
    name,
    documentation,
    memberType,
    decorator,
    type,
    location,
    detail,
});
