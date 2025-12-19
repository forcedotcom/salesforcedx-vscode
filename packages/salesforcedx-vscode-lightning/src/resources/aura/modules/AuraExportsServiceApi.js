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
Aura.ServiceApi = {
    "replaceModule": function (targetCtor, replacementCtor) {
        var targetDef;
        var replacementDef;

        Object.keys($A.componentService.moduleDefRegistry).some(function (key) {
            var def = $A.componentService.moduleDefRegistry[key];
            if (def.ns === targetCtor) {
                targetDef = def;
            } else if (def.ns === replacementCtor) {
                replacementDef = def;
            }
            return targetDef && replacementDef;
        });

        $A.assert(targetDef && replacementDef, 'Definitions could not be found');
        $A.assert(targetDef.access === replacementDef.access, 'Access checks do not match');
        $A.componentService.moduleDefRegistry[targetDef.moduleName] = replacementDef;
    },
    "registerScopedModuleResolver": function(scope, resolver) {
        $A.clientService.addScopedModuleResolver(scope, resolver);
    },
    "reifyActions": function(actions) {
        return $A.clientService.reifyActions(actions);
    },
    "prepareRequest": function (actions) {
        return $A.clientService.prepareRequest(actions);
    },
    "getPathPrefix": function () {
        return $A.getContext().getPathPrefix();
    },
    "getToken": function (name) {
        return $A.getToken(name);
    },
    "getLocale": function () {
        return $A.get('$Locale');
    },
    "getLocalizationService": function () {
        return $A.localizationService;
    },
    "sanitizeDOM": function (dirty, config) {
        return $A.util.sanitizeDOM(dirty, config);
    },
    "getFormFactor": function() {
        return $A.get('$Browser.formFactor');
    },
    "getInitializer": function(name) {
        if ($A.initializers) {
            return $A.initializers[name];
        }
    },
    "getCSSVar": function(cssVarName) {
        return $A.clientService.cssVars[cssVarName];
    },
    "replaceComponentDefLoader": function(method) {
        $A.componentService.componentDefLoader.setScriptGenerator(method);
    }
};
