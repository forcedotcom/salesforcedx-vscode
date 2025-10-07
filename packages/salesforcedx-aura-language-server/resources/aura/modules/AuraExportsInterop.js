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

var INTEROP_FIND_OWNER = "aurainteropfindowner";
Aura.ExportsModule = {
    "dispatchGlobalEvent": function (eventName, eventParams) {
        $A.clientService.setCurrentAccess($A.getRoot());
        try {
            $A.eventService.newEvent(eventName).setParams(eventParams).fire();
        } finally {
            $A.clientService.releaseCurrentAccess();
        }
    },
    "getEventDef": function (eventDef, eventName, sourceCmp) {
        return $A.eventService.newEvent(eventDef, eventName, sourceCmp);
    },

    /**
     * Execute a global controller action.
     * @param {String} endpoint the controller and method to invoke.
     * @param {Object} params parameters to pass to the controller.
     * @return {Promise} promise that resolves when the action completes.
     */
    "executeGlobalController": function (endpoint, params, options) {
        var controller = 'aura://' + endpoint;
        var path = controller.split(".");
        var controllerName = path.shift();
        var actionName = path.shift();

        var controllerDef = $A.componentService.controllerDefRegistry[controllerName];
        if (!controllerDef) {
            return Promise.reject(new Error('Controller for endpoint ' + endpoint + ' does not exist'));
        }

        var action = controllerDef.getActionDef(actionName).newInstance();
        if (!action) {
            return Promise.reject(new Error('Action of endpoint ' + endpoint + ' is not registered'));
        }
        action.setParams(params);

        var hotspot = options && options.hotspot;
        var background = options && options.background;

        return new Promise(function (resolve, reject) {
            if (background) {
                action.setBackground();
            }
            action.setCallback(null, function (response) {
                if (response.getState() !== 'SUCCESS') {
                    var actionErrors = response.getError();
                    if (actionErrors.length > 0) {
                        reject(actionErrors[0]);
                    } else {
                        reject(new Error('Error fetching component'));
                    }

                    return;
                }
                resolve(response.getReturnValue());
            });

            $A.run(function() {
                if (hotspot) {
                    $A.executeHotspot(function() {
                        $A.enqueueAction(action);
                    });
                } else {
                    $A.enqueueAction(action);
                }
            });
        });
    },

    "registerModule": function (module) {
        $A.componentService.initModuleDefs([module]);
        return module["descriptor"];
    },
    /**
     * @see {@link AuraComponentService.prototype.hasModuleDefinition}
     */
    "hasModule": function(moduleName) {
        return $A.componentService.hasModuleDefinition(moduleName);
    },
    "getModule": function(moduleName) {
        return $A.componentService.evaluateModuleDef(moduleName);
    },
    "sanitizeDOM": function (dirty, config) {
        return $A.util.sanitizeDOM(dirty, config);
    },

    // -- Interop lifecycle methods --
    "INTEROP_FIND_OWNER": INTEROP_FIND_OWNER,

    "createComponent" : function (componentName, attributes, callback, hotspot) {
        $A.clientService.setCurrentAccess($A.getRoot());
        try {
            $A.run(function() {
                 if (hotspot) {
                    $A.executeHotspot(function() {
                        $A.createComponent(componentName, attributes, $A.getCallback(callback));
                    });
                } else {
                    $A.createComponent(componentName, attributes, $A.getCallback(callback));
                }
            });
        } finally {
            $A.clientService.releaseCurrentAccess();
        }
    },

    "getDefinition": function (definition, callback, hotspot) {
        $A.clientService.setCurrentAccess($A.getRoot());
        try {
            $A.run(function() {
                if (hotspot) {
                    $A.executeHotspot(function() {
                        $A.getDefinition(definition, $A.getCallback(callback));
                    });
                } else {
                    $A.getDefinition(definition, $A.getCallback(callback));
                }
            });
        } finally {
            $A.clientService.releaseCurrentAccess();
        }
    },
    "renderComponent": function (cmp, element) {
        var interopCreateEvent = new CustomEvent(INTEROP_FIND_OWNER, {
            "composed": true,
            "bubbles": true,
            "cancelable": false,
            "detail": {
                "claimOwnership": function (owner) {
                    cmp.setAttributeValueProvider(owner);
                }
            }
        });

        element.dispatchEvent(interopCreateEvent);
        $A.render(cmp, element);
        $A.afterRender(cmp);
    }
};
