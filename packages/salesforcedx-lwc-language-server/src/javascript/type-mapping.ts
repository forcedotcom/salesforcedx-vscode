/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Class, ClassMethod, ClassProperty, ScriptFile, WireDecorator, LwcDecorator, SourceLocation, Value } from '@lwc/metadata';

import { ClassMember as InternalClassMember, Location as InternalLocation } from '@salesforce/salesforcedx-lightning-lsp-common';
import {
    Metadata as InternalMetadata,
    ModuleExports as InternalModuleExports,
    ApiDecorator as InternalApiDecorator,
    TrackDecorator as InternalTrackDecorator,
    WireDecorator as InternalWireDecorator,
    ApiDecoratorTarget,
    TrackDecoratorTarget,
    WireDecoratorTarget,
    ClassMemberPropertyValue,
} from '../decorators';

type InternalDecorator = InternalApiDecorator | InternalTrackDecorator | InternalWireDecorator;
// This can be removed once @lwc/metadata exposes `Export` and `DataProperty` types
type LwcExport = ScriptFile['exports'][0];
type DataProperty = ClassProperty['dataProperty'];

const decoratorTypeMap = {
    Api: 'api',
    Track: 'track',
    Wire: 'wire',
} as const;

type DecoratorKeyType = keyof typeof decoratorTypeMap;
type DecoratorValType = (typeof decoratorTypeMap)[DecoratorKeyType];

/**
 * In the old metadata, when certain information is unavailable, the corresponding
 * key/val pair is simply omitted from the output. In order to replicate this behavior,
 * the stripKeysWithUndefinedVals helper function removes any key/val pair where the
 * value is `undefined`.
 */
const stripKeysWithUndefinedVals = <T>(obj: T): T => Object.fromEntries(Object.entries(obj).filter(([, val]) => val !== undefined)) as T;

const externalToInternalLoc = (ext?: SourceLocation): InternalLocation | undefined => {
    if (!ext) {
        return;
    }

    return {
        start: {
            line: ext.startLine,
            // Old metadata seems to use zero-indexed columns (ಠ_ಠ)
            column: ext.startColumn - 1,
        },
        end: {
            line: ext.endLine,
            // Old metadata seems to use zero-indexed columns (ಠ_ಠ)
            column: ext.endColumn - 1,
        },
    };
};

const getDecorator = (decorators: LwcDecorator[], member: ClassProperty | ClassMethod): LwcDecorator | null => {
    if (decorators.length > 0 && decorators.length > 1) {
        throw new Error(`Unexpected number of decorators in ${member.name}: ${member.decorators.length}`);
    }
    return decorators[0] ?? null;
};

const dataPropertyToPropValue = (decoratorType: DecoratorValType, extDataProp?: DataProperty): ClassMemberPropertyValue | undefined => {
    if (!extDataProp) {
        return;
    }
    return externalToInternalPropValue(decoratorType, extDataProp.initialValue);
};

/**
 * This function exposes metadata related to the initialized values of decorated
 * properties. The implementation of old metadata for these initial values is
 * extremely quirky, and depends significantly on what type of decorator is applied
 * to the initialized property.
 */
const externalToInternalPropValue = (decoratorType: DecoratorValType, initialValue: Value, isWireParam = false): ClassMemberPropertyValue | undefined => {
    switch (initialValue.type) {
        case 'Array':
            // Underlying types were unified in @lwc/metadata that were not unified
            // in the old compiler's metadata. For that reason, we have to treat this
            // single case differently than we do every other case in this function's
            // transformation.
            if (isWireParam) {
                return {
                    type: 'array',
                    value: initialValue.value.map((el) => (el.type === 'ImportedValue' ? undefined : el.value)),
                };
            }

            // In a bizarre twist, Values of array elements are included in the metadata, even
            // though their non-array counterparts are excluded!
            return decoratorType !== 'api'
                ? undefined
                : {
                      type: 'array',
                      value: initialValue.value.map((el) => externalToInternalPropValue(decoratorType, el)).filter(Boolean),
                  };

        case 'Object':
            if (isWireParam) {
                return {
                    type: 'unresolved',
                    value: undefined,
                };
            }

            // There's similar weirdness here for object Values.
            return {
                type: 'object',
                value: Object.fromEntries(Object.entries(initialValue.value).map(([key, val]) => [key, externalToInternalPropValue(decoratorType, val)])),
            };

        case 'Boolean':
            return {
                type: 'boolean',
                value: initialValue.value,
            };

        case 'ImportedValue':
            // There does not appear to be a corresponding case in old metadata, so
            // we'll treat it as unresolved.
            return {
                type: 'unresolved',
                value: undefined,
            };

        case 'Null':
            return {
                type: 'null',
                value: null,
            };

        case 'Number':
            // A value isn't reported in the old metadata for numbers (unless in an Array!)
            return decoratorType !== 'api' && !isWireParam
                ? undefined
                : {
                      type: 'number',
                      value: initialValue.value,
                  };

        case 'String':
            // A value isn't reported in the old metadata for strings.
            return decoratorType === 'track'
                ? undefined
                : {
                      type: 'string',
                      value: initialValue.value,
                  };

        case 'Undefined':
            // Who knows why the old metadata treats @api differently from @wire
            // and @track here...
            return decoratorType !== 'api'
                ? undefined
                : {
                      type: 'unresolved',
                      value: undefined,
                  };

        case 'Unresolved':
            return {
                type: 'unresolved',
                value: undefined,
            };
    }
};

/**
 * This transforms information about class properties from the old to the
 * new format.
 */
const getMemberProperty = (propertyObj: ClassProperty): InternalClassMember | null => {
    if (propertyObj.decorators.length > 1) {
        throw new Error(`LWC language server does not support multiple decorators on property ${propertyObj.name}`);
    }

    // Private properties are not included in old metadata.
    if (propertyObj.name[0] === '_') {
        return null;
    }

    const decorator = propertyObj.decorators[0];
    const decoratorType = decorator ? decoratorTypeMap[decorator.type] : undefined;
    const value = dataPropertyToPropValue(
        // The old metadata represented values for @track different than those for @wire or @api.
        decoratorType,
        propertyObj.dataProperty,
    );

    // Note there can only be a getter or only a setter, both are not required.
    // Use the getter if available, or the setter if there is no getter.
    let loc: SourceLocation;
    if (propertyObj.propertyType === 'accessor') {
        if (propertyObj.getter) {
            loc = propertyObj.getter.location;
        } else if (propertyObj.setter) {
            loc = propertyObj.setter.location;
        }
    } else {
        loc = propertyObj?.dataProperty.location;
    }
    return stripKeysWithUndefinedVals({
        name: propertyObj.name,
        type: 'property',
        value,
        decorator: decoratorType,
        doc: propertyObj.__internal__doc,
        loc: externalToInternalLoc(loc),
    });
};

/**
 * This transforms information about class methods from the old to the
 * new format.
 */
const getMemberMethod = (methodObj: ClassMethod): InternalClassMember | null => {
    if (methodObj.decorators.length > 1) {
        throw new Error(`LWC language server does not support multiple decorators on method ${methodObj.name}`);
    }

    // Private methods are not included in old metadata.
    if (methodObj.name[0] === '_') {
        return null;
    }

    const decorator = methodObj.decorators[0];
    const decoratorType = decorator ? decoratorTypeMap[decorator.type] : undefined;

    return stripKeysWithUndefinedVals({
        name: methodObj.name,
        type: 'method',
        decorator: decoratorType,
        doc: methodObj.__internal__doc,
        loc: externalToInternalLoc(methodObj.location),
    });
};

/**
 * This transforms information about class properties & methods from the old
 * to the new format.
 */
const getMembers = (classObj: Class): InternalClassMember[] => {
    const properties: InternalClassMember[] = classObj.properties.map(getMemberProperty).filter(Boolean);
    const methods: InternalClassMember[] = classObj.methods.map(getMemberMethod).filter(Boolean);

    // In the original metadata, the properties & methods were intermixed in the order
    // that they appeared in the component code. Since the new metadata exposes this information
    // separately, we need to combine & reorder to match the old behavior.
    const members = [...properties, ...methods];
    members.sort((memberA, memberB) => memberA.loc?.start.line - memberB.loc?.start.line);
    return members;
};

const getDecoratedApiMethod = (method: ClassMethod): ApiDecoratorTarget => ({
    type: 'method',
    name: method.name,
});

/**
 * Wire adapters can have params passed to them. These params take the form:
 *   {
 *     key: value
 *   }
 *
 * The value can either be a raw string (like 'foobar') or they can reference
 * some internal Salesforce data property (like '$searchString'). The distinguishing
 * characteristic is the presence of the dollar sign.
 *
 * This function collects metadata about both types of params and returns them.
 */
const getWireParams = (decorator: WireDecorator) => {
    let staticObj: Record<string, ClassMemberPropertyValue> = {};
    let params: Record<string, string> = {};
    if (decorator.adapterConfig) {
        staticObj = Object.fromEntries(
            Object.entries(decorator.adapterConfig.static).map(([key, staticParam]) => [key, externalToInternalPropValue('wire', staticParam.value, true)]),
        );
        params = Object.fromEntries(Object.entries(decorator.adapterConfig.reactive).map(([key, { classProperty }]) => [key, classProperty]));
    }
    return {
        staticObj,
        params,
    };
};

const getDecoratedWiredMethod = (method: ClassMethod, decorator: WireDecorator): WireDecoratorTarget => {
    const { staticObj, params } = getWireParams(decorator);

    const adapter = {
        name: decorator.adapterId.localName,
        reference: decorator.adapterModule,
    };

    return {
        type: 'method',
        name: method.name,
        static: staticObj,
        params,
        // The old LWC metadata included an 'adapter' property, which
        // is not used by lightning-language-server and is not captured in
        // the WireDecoratorTarget type. But we've captured it here so that
        // the output exactly matches that of the old LWC compiler's metadata.
        adapter,
    };
};

const getDecoratedMethods = (
    methods: ClassMethod[],
): {
    wiredMethods: WireDecoratorTarget[];
    apiMethods: ApiDecoratorTarget[];
    methodLocs: Map<string, number>;
} => {
    const wiredMethods: WireDecoratorTarget[] = [];
    const apiMethods: ApiDecoratorTarget[] = [];
    const methodLocs: Map<string, number> = new Map();

    for (const method of methods) {
        const decorator = getDecorator(method.decorators, method);
        if (!decorator) {
            continue;
        }

        // This information is later used to reorder the combination of
        // methods and properties, so that the order matches their original
        // locations in the component code.
        methodLocs.set(method.name, method.location.start);

        if (decorator.type === 'Api') {
            apiMethods.push(getDecoratedApiMethod(method));
        } else if (decorator.type === 'Wire') {
            wiredMethods.push(getDecoratedWiredMethod(method, decorator));
        }
    }

    return {
        wiredMethods,
        apiMethods,
        methodLocs,
    };
};

const getDecoratedApiProperty = (prop: ClassProperty): ApiDecoratorTarget =>
    stripKeysWithUndefinedVals({
        name: prop.name,
        type: 'property',
        value: dataPropertyToPropValue('api', prop.dataProperty),
    });

const getDecoratedWiredProperty = (prop: ClassProperty, decorator: WireDecorator): WireDecoratorTarget => {
    const { staticObj, params } = getWireParams(decorator);

    const adapter = {
        name: decorator.adapterId.localName,
        reference: decorator.adapterModule,
    };

    return {
        name: prop.name,
        type: 'property',
        static: staticObj,
        params,
        // The old LWC metadata included an 'adapter' property, which
        // is not used by lightning-language-server and is not captured in
        // the WireDecoratorTarget type. But we've captured it here so that
        // the output exactly matches that of the old LWC compiler's metadata.
        adapter,
    };
};

const getDecoratedTrackedProperty = (prop: ClassProperty): TrackDecoratorTarget => ({
    name: prop.name,
    type: 'property',
});

/**
 * In the old metadata, a single location was provided for a property. However,
 * in the new metadata, either 1 or 2 locations are provided, depending whether
 * the prop is defined as a getter/setter or just a normal value. To transform
 * the new metadata into the old, we choose here which location to report as
 * the "one true location" in the old metadata format.
 */
const getPropLoc = (prop: ClassProperty): number | undefined => {
    const dataPropLoc = prop.dataProperty?.location?.start;
    const getterLoc = prop.getter?.location?.start;
    const setterLoc = prop.setter?.location?.start;
    return [dataPropLoc, getterLoc, setterLoc].sort()[0];
};

const getDecoratedProperties = (
    properties: ClassProperty[],
): {
    wiredProperties: WireDecoratorTarget[];
    trackedProperties: TrackDecoratorTarget[];
    apiProperties: ApiDecoratorTarget[];
    propLocs: Map<string, number>;
} => {
    const wiredProperties: WireDecoratorTarget[] = [];
    const trackedProperties: TrackDecoratorTarget[] = [];
    const apiProperties: ApiDecoratorTarget[] = [];
    const propLocs: Map<string, number> = new Map();

    for (const prop of properties) {
        const decorator = getDecorator(prop.decorators, prop);
        if (!decorator) {
            continue;
        }

        propLocs.set(prop.name, getPropLoc(prop));

        if (decorator.type === 'Api') {
            apiProperties.push(getDecoratedApiProperty(prop));
        } else if (decorator.type === 'Track') {
            trackedProperties.push(getDecoratedTrackedProperty(prop));
        } else if (decorator.type === 'Wire') {
            wiredProperties.push(getDecoratedWiredProperty(prop, decorator));
        }
    }

    return {
        wiredProperties,
        trackedProperties,
        apiProperties,
        propLocs,
    };
};

/**
 * In the old metadata, properties and methods were intermingled in a
 * single array, in the order they appeared in the original component
 * code. However, in the new metadata, properties and methods are surfaced
 * in separate data-structures. In order to map the new metadata to the old,
 * it is necessary to combine properties & methods in a single array and
 * then re-order by their original location in the code.
 *
 * However, their original locations are not present in the output
 * data-structure. So we collect the locations separately and then correlate
 * property/method names to their locations using this Map.
 */
const sortDecorators = <T extends { name: string }>(decorators: T[], locations: Map<string, number>): T[] =>
    decorators.concat().sort((a: T, b: T) => locations.get(a.name) - locations.get(b.name));

const getDecorators = (classObj: Class): InternalDecorator[] => {
    const {
        apiMethods,
        wiredMethods,
        // Note: There is no such thing as a tracked method.
        methodLocs,
    } = getDecoratedMethods(classObj.methods);
    const { wiredProperties, trackedProperties, apiProperties, propLocs } = getDecoratedProperties(classObj.properties);

    const allLocations: Map<string, number> = new Map([...methodLocs, ...propLocs]);

    const wire: InternalWireDecorator =
        wiredMethods.length > 0 || wiredProperties.length > 0
            ? {
                  type: 'wire',
                  targets: sortDecorators([...wiredProperties, ...wiredMethods], allLocations),
              }
            : null;
    const track: InternalTrackDecorator = trackedProperties.length > 0
        ? {
              type: 'track',
              targets: trackedProperties,
          }
        : null;
    const api: InternalApiDecorator =
        apiMethods.length > 0 || apiProperties.length > 0
            ? {
                  type: 'api',
                  targets: sortDecorators([...apiProperties, ...apiMethods], allLocations),
              }
            : null;

    return [api, wire, track].filter(Boolean);
};

const getExports = (lwcExports: LwcExport[]): InternalModuleExports[] =>
    lwcExports.flatMap((lwcExport) => {
        if (lwcExport.namedExports) {
            return lwcExport.namedExports.map((namedExport) =>
                namedExport.exportedName === '*'
                    ? ({
                          type: 'ExportAllDeclaration',
                      } as InternalModuleExports)
                    : ({
                          type: 'ExportNamedDeclaration',
                          value: namedExport.exportedName,
                      } as InternalModuleExports),
            );
        } else if (lwcExport.defaultExport) {
            return {
                type: 'ExportDefaultDeclaration',
            } as InternalModuleExports;
        } else {
            throw new Error('Unimplemented: no support for ExportAllDeclaration');
        }
    });

/**
 * This function accepts metadata produced by @lwc/metadata's `collectBundleMetadata`
 * function, and returns metadata in a format equivalent to that provided by
 * ancient versions of the LWC compiler. That ancient metadata is used by the
 * LWC language server to analyze code in a user's IDE.
 */
export const mapLwcMetadataToInternal = (lwcMeta: ScriptFile): InternalMetadata => {
    let mainClassObj;
    if (lwcMeta.mainClass) {
        mainClassObj = lwcMeta.classes.find((classObj) => classObj.id === lwcMeta.mainClass.refId);
    } else if (lwcMeta.classes.length === 1) {
        mainClassObj = lwcMeta.classes[0];
    }

    // If we are unable to identify the main class object from the provided metadata,
    // it will not be possible calculate decorators, members, etc.
    if (!mainClassObj) {
        return {
            decorators: [],
            classMembers: [],
            exports: [],
        };
    }

    const defaultExport = lwcMeta.exports.find((exp) => exp.defaultExport);
    const declarationLoc = externalToInternalLoc(defaultExport?.location ?? mainClassObj.location);

    const internalMeta: InternalMetadata = {
        decorators: getDecorators(mainClassObj),
        classMembers: getMembers(mainClassObj),
        declarationLoc,
        doc: (mainClassObj?.__internal__doc ?? '').trim(),
        exports: getExports(lwcMeta.exports),
    };

    return internalMeta;
};
