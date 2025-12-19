/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ClassMember, Location, DecoratorTargetType, DecoratorTargetProperty } from '@salesforce/salesforcedx-lightning-lsp-common';

export interface Metadata {
    decorators: (ApiDecorator | TrackDecorator | WireDecorator)[];
    classMembers?: ClassMember[];
    declarationLoc?: Location;
    doc?: string;
    exports: ModuleExports[];
}

export interface ApiDecorator {
    type: 'api';
    targets: ApiDecoratorTarget[];
}
export interface ClassMemberPropertyValue {
    type: string;
    value: any;
}
export interface ApiDecoratorTarget {
    name: string;
    type: DecoratorTargetType;
    value?: ClassMemberPropertyValue;
}

export interface TrackDecorator {
    type: 'track';
    targets: TrackDecoratorTarget[];
}

export interface TrackDecoratorTarget {
    name: string;
    type: DecoratorTargetProperty;
}

export interface WireDecorator {
    type: 'wire';
    targets: WireDecoratorTarget[];
}

export interface WireDecoratorTarget {
    name: string;
    params: { [name: string]: string };
    static: any;
    type: DecoratorTargetType;
    adapter?: unknown;
}

export interface ModuleExports {
    type: 'ExportNamedDeclaration' | 'ExportDefaultDeclaration' | 'ExportAllDeclaration';
    source?: string;
    value?: string;
}
