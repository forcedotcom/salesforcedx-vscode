/*
 * Copyright (C) 2013 salesforce.com, inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// This class is responsible for creating and returning the
// instance of LockerService. It hides the mechanism used to
// select the implementaion to the rest of Aura client code.
function LockerService() {
    "use strict";

    var isInitialized = false;

    var createDescriptor = function(moduleDefinitionEntry) {
        var DESCRIPTOR = Json.ApplicationKey.DESCRIPTOR;
        var REQUIRELOCKER = Json.ApplicationKey.REQUIRELOCKER;
        var LOCKER_REFERENCE_INFO = Json.ApplicationKey.LOCKER_REFERENCE_INFO;
        
        var descriptor = new DefDescriptor(moduleDefinitionEntry[DESCRIPTOR] || moduleDefinitionEntry.descriptor);
        descriptor['requireLocker'] = moduleDefinitionEntry[REQUIRELOCKER];
        descriptor['depList'] = moduleDefinitionEntry[LOCKER_REFERENCE_INFO];
        return descriptor;
    };
    var service = {};

    function selectLib(lib) {
        // API For Aura Framework (will be obfuscated by Closure Compiler).

        service.create                = lib["create"];
        service.createForDef          = lib["createForDef"];
        service.createForModule       = lib["createForModule"];
        service.getEnv                = lib["getEnv"];
        service.getEnvForSecureObject = lib["getEnvForSecureObject"];
        service.getKeyForNamespace    = lib["getKeyForNamespace"];
        service.getRaw                = lib["getRaw"];
        service.isEnabled             = lib["isEnabled"];
        service.instanceOf            = lib["instanceOf"];
        service.runScript             = lib["runScript"];
        service.trust                 = lib["trust"];
        service.unwrap                = lib["unwrap"];
        service.wrapComponent         = lib["wrapComponent"];
        service.wrapComponentEvent    = lib["wrapComponentEvent"];
        service.wrap                  = lib["wrap"];
        service.sanitize              = lib["sanitize"];
        service.isAllowedSvgTag       = lib["isAllowedSvgTag"];
        service.sanitizeSvgElement    = lib["sanitizeSvgElement"];
        service.sanitizeElement       = lib["sanitizeElement"];
        service.createDescriptor      = createDescriptor;

        // API for file-based components (will not be obfuscated by Closure Compiler).

        service["create"]                = service.create;
        service["createForDef"]          = service.createForDef;
        service["getEnv"]                = service.getEnv;
        service["getEnvForSecureObject"] = service.getEnvForSecureObject;
        service["getKeyForNamespace"]    = service.getKeyForNamespace;
        service["runScript"]             = service.runScript;
        service["trust"]                 = service.trust;
        service["wrapComponent"]         = service.wrapComponent;
    }

    function requireLocker(component) {
        var def = component.getDef();
        var descriptor = def.getDescriptor();
        var namespace = descriptor.getNamespace();
        var isInternal = $A.clientService.isInternalNamespace(namespace);

        // Lockerize if either of the following is true:
        // 1. If component belongs to internal namespace and
        //      implements the aura:requireLocker interface
        // 2. If component does not belong to internal namespace and
        //      API Version of component is API version v40 or after (Summer '17 release)
        //      (file based components used for testing won't have an API version, so default it to 40 and lockerize)
        if (isInternal) {
            return def.isInstanceOf('aura:requireLocker');
        }
        return parseInt(def.getApiVersion() || 40) >= 40;
    }

    function getPublicMethodNames(component) {
        var methodsNames = [];
        if (component instanceof Aura.Component.InteropComponent) {
            methodsNames = component.getPublicMethodNames();
        } else {
            var defs = component.getDef().methodDefs;
            if (defs && defs.length) {
                methodsNames = defs.map(function(method) {
                    var descriptor = new DefDescriptor(method.name);
                    return descriptor.getName();
                });
            }
        }
        return methodsNames;
    }

    function warn(message) {
        $A.warning(message);
    }

    // App.js is built with two versions of AuraLocker, and we select at
    // runtime. In the future, we could move this to
    // initializeInjectedServices.
    function initialize(context) {
        if (isInitialized) { return; }

        context = context || {};
        var isEnabled = !!context["ls"];
        var isStrictCSP = !!context["csp"];
        var isFrozenRealm = !!context["fr"];

        if (isEnabled && !!window["AuraLocker"]) {
            var types = {
                "Action": Aura.Controller.Action,
                "Component": Aura.Component.Component,
                "Event": Aura.Event.Event,
                "PropertyReferenceValue": Aura.Value.PropertyReferenceValue
            };

            // We expose a custom API to Locker with methods that aren't
            // avaiable with the current API on Aura Objects. This reduces the
            // complexity of what is passed to Aura.
            var api = {

                // #if {"modes" : ["DOC","TESTING","AUTOTESTING", "TESTINGDEBUG", "AUTOTESTINGDEBUG"]}
                "notFrozenIntrinsicNames" : ["Date", "DatePrototype", "Promise", "PromisePrototype", "JSON"],
                // #end

                "getPublicMethodNames": getPublicMethodNames,
                "requireLocker": requireLocker,
                "isStrictCSP": isStrictCSP,
                "isFrozenRealm": isFrozenRealm,
                "warn": warn,
                "error": $A.auraError,
                "severity": $A.severity
            };
            if ($A.componentService.moduleEngine) {
                var lwcApi = {
                    // TODO: Remove 'unwrap' after changes on LockerService-Core side!
                    "unwrap": $A.componentService.moduleEngine["unwrap"],
                    "lwcIsNodeFromTemplate": $A.componentService.moduleEngine["isNodeFromTemplate"],
                    "lwcUnwrap": $A.componentService.moduleEngine["unwrap"],
                    "lwcGetComponentDef": $A.componentService.moduleEngine["getComponentDef"],
                    "lwcGetComponentConstructor": $A.componentService.moduleEngine["getComponentConstructor"]
                };
                Object.assign(api, lwcApi);
            }

            var lib = window["AuraLocker"];
            selectLib(lib);
            lib["initialize"](types, api);
        }

        Object.freeze(service);

        isInitialized = true;
    }

    // TODO: LockerService methods are invoked before initialization, in
    // particular when we have async events registered. For that reason, we
    // have to create dummy methods. This legacy behavior should be
    // investigated.
    selectLib(window["AuraLockerDisabled"]);

    // initial minimalist API
    service.initialize               = initialize;
    service["initialize"]            = service.initialize;

    return service;
}

Aura.Services.LockerService = LockerService;