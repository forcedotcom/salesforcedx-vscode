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

AuraInstance.prototype["addValueProvider"] = AuraInstance.prototype.addValueProvider;
AuraInstance.prototype["initAsync"] = AuraInstance.prototype.initAsync;
AuraInstance.prototype["initConfig"] = AuraInstance.prototype.initConfig;
AuraInstance.prototype["error"] = AuraInstance.prototype.error;
AuraInstance.prototype["warning"] = AuraInstance.prototype.warning;
AuraInstance.prototype["message"] = AuraInstance.prototype.message;
AuraInstance.prototype["enqueueAction"] = AuraInstance.prototype.enqueueAction;
AuraInstance.prototype["executeHotspot"] = AuraInstance.prototype.executeHotspot;
AuraInstance.prototype["get"] = AuraInstance.prototype.get;
AuraInstance.prototype["getReference"] = AuraInstance.prototype.getReference;
AuraInstance.prototype["getRoot"] = AuraInstance.prototype.getRoot;
AuraInstance.prototype["getCallback"] = AuraInstance.prototype.getCallback;
AuraInstance.prototype["getContext"] = AuraInstance.prototype.getContext;
AuraInstance.prototype["getToken"] = AuraInstance.prototype.getToken;
AuraInstance.prototype["getService"] = AuraInstance.prototype.getService;
AuraInstance.prototype["run"] = AuraInstance.prototype.run;
AuraInstance.prototype["set"] = AuraInstance.prototype.set;
AuraInstance.prototype["assert"] = AuraInstance.prototype.assert;
AuraInstance.prototype["userAssert"] = AuraInstance.prototype.userAssert;
AuraInstance.prototype["log"] = AuraInstance.prototype.log;
AuraInstance.prototype["trace"] = AuraInstance.prototype.trace;
AuraInstance.prototype["reportError"] = AuraInstance.prototype.reportError;

// JBUCH: TODO: DEPRECATED - REMOVE ALL
// Perf
AuraInstance.prototype["Perf"] = AuraInstance.prototype.Perf;
AuraInstance.prototype["mark"] = AuraInstance.prototype.Perf.mark;
AuraInstance.prototype["endMark"] = AuraInstance.prototype.Perf.endMark;
AuraInstance.prototype["startTransaction"] = AuraInstance.prototype.Perf.startTransaction;
AuraInstance.prototype["endTransaction"] = AuraInstance.prototype.Perf.endTransaction;
AuraInstance.prototype["updateTransaction"] = AuraInstance.prototype.Perf.updateTransaction;
AuraInstance.prototype["toJson"] = AuraInstance.prototype.Perf.toJson;
AuraInstance.prototype["setBeaconData"] = AuraInstance.prototype.Perf.setBeaconData;
AuraInstance.prototype["getBeaconData"] = AuraInstance.prototype.Perf.getBeaconData;
AuraInstance.prototype["clearBeaconData"] = AuraInstance.prototype.Perf.clearBeaconData;
AuraInstance.prototype["removeStats"] = AuraInstance.prototype.Perf.removeStats;
AuraInstance.prototype["isLoadFired"] = AuraInstance.prototype.Perf.isLoadFired;

AuraInstance.prototype["installOverride"] = AuraInstance.prototype.installOverride;
AuraInstance.prototype["uninstallOverride"] = AuraInstance.prototype.uninstallOverride;

// //#end

//#if {"excludeModes" : ["PRODUCTION", "PRODUCTIONDEBUG", "PERFORMANCEDEBUG"]}
AuraInstance.prototype["devToolService"] = AuraInstance.prototype.devToolService;
AuraInstance.prototype["getQueryStatement"] = AuraInstance.prototype.getQueryStatement;
AuraInstance.prototype["qhelp"] = AuraInstance.prototype.qhelp;
//#end

//
// Ideally, this would be done with names and using the closure compiler to generate them. That would make
// this much simpler and cleaner, including allowing us to not have separate functions for replace and restore
// it could all be done with two sets of instance/name pairs (1) plain names, (2) bound names.
//

Aura.OverrideMap = function OverrideMap() {
    this.map = {
        "enqueueAction" : new Aura.Utils.Override($A.clientService, $A.clientService.enqueueAction, false,
            function(bound) {
                $A.enqueueAction = bound;
                $A["enqueueAction"] = bound;
                $A.clientService.enqueueAction = bound;
                $A.clientService["enqueueAction"] = bound;
            },
            function(orig, bound) {
                $A.enqueueAction = bound;
                $A["enqueueAction"] = bound;
                $A.clientService.enqueueAction = orig;
                $A.clientService["enqueueAction"] = orig;
            }
        ),

        "ClientService.decode" : new Aura.Utils.Override($A.clientService, $A.clientService.decode, false,
            function(bound) {
                $A.clientService.decode = bound;
            },
            function(orig) {
                $A.clientService.decode = orig;
            }
        ),

        "ClientService.send" : new Aura.Utils.Override($A.clientService, $A.clientService.send, false,
            function(bound) {
                $A.clientService.send = bound;
            },
            function(orig) {
                $A.clientService.send = orig;
            }
        ),

        "ClientService.collectServerAction" : new Aura.Utils.Override($A.clientService, $A.clientService.collectServerAction, false,
            function(bound) {
                $A.clientService.collectServerAction = bound;
            },
            function(orig) {
                $A.clientService.collectServerAction = orig;
            }
        ),

        "ClientService.receive" : new Aura.Utils.Override($A.clientService, $A.clientService.receive, false,
            function(bound) {
                $A.clientService.receive = bound;
            },
            function(orig) {
                $A.clientService.receive = orig;
            }
        ),
        
        "ClientService.clientLibraryLoadComplete" : new Aura.Utils.Override($A.clientService, $A.clientService.clientLibraryLoadComplete, false,
            function(bound) {
                $A.clientService.clientLibraryLoadComplete = bound;
            },
            function(orig) {
                $A.clientService.clientLibraryLoadComplete = orig;
            }
        ),

        "ComponentService.createComponentPriv" : new Aura.Utils.Override($A.componentService, $A.componentService.createComponentPriv, false,
            function(bound) {
                $A.componentService.createComponentPriv = bound;
            },
            function(orig) {
                $A.componentService.createComponentPriv = orig;
            }
        ),

        "ClientService.processResponses" : new Aura.Utils.Override($A.clientService, $A.clientService.processResponses, false,
            function(bound) {
                $A.clientService.processResponses = bound;
            },
            function(orig) {
                $A.clientService.processResponses = orig;
            }
        ),

        "ClientService.getAvailableXHR" : new Aura.Utils.Override($A.clientService, $A.clientService.getAvailableXHR,
            false,
            function(bound) {
                $A.clientService.getAvailableXHR = bound;
            },
            function(orig) {
                $A.clientService.getAvailableXHR = orig;
            }
        ),

        "Action.finishAction" : new Aura.Utils.Override(null, Aura.Controller.Action.prototype.finishAction, true,
            function(bound) {
                Aura.Controller.Action.prototype.finishAction = bound;
            },
            function(orig) {
                Aura.Controller.Action.prototype.finishAction = orig;
            }
        ),

        "Action.abort" : new Aura.Utils.Override(null, Aura.Controller.Action.prototype.abort, true,
            function(bound) {
                Aura.Controller.Action.prototype.abort = bound;
            },
            function(orig) {
                Aura.Controller.Action.prototype.abort = orig;
            }
        ),

        "Action.runDeprecated" : new Aura.Utils.Override(null, Aura.Controller.Action.prototype.runDeprecated, true,
            function(bound) {
                Aura.Controller.Action.prototype.runDeprecated = bound;
                Aura.Controller.Action.prototype["runDeprecated"] = bound;

                Aura.Controller.Action.prototype["getComponent"] = function() {
                    return this.cmp;
                };
            },
            function(orig) {
                Aura.Controller.Action.prototype.runDeprecated = orig;
                Aura.Controller.Action.prototype["runDeprecated"] = orig;

                // Not exported, so delete the public exposure.
                delete Aura.Controller.Action.prototype["getComponent"];

            }
        ),

        "Event.fire" : new Aura.Utils.Override(null, Aura.Event.Event.prototype.fire, true,
            function(bound) {
                Aura.Event.Event.prototype.fire = bound;
                Aura.Event.Event.prototype["fire"] = bound;

            },
            function(orig) {
                Aura.Event.Event.prototype.fire = orig;
                Aura.Event.Event.prototype["fire"] = orig;
            }
        ),

        "outputComponent" : new Aura.Utils.Override(null, Aura.Component.Component.prototype.toJSON, true,
            function(bound) {
                Aura.Component.Component.prototype.toJSON = bound;
                Aura.Component.Component.prototype["toJSON"] = bound;

                Aura.Component.Component.prototype["_$getSelfGlobalId$"] = function() {
                    return this.globalId;
                };

                Aura.Component.Component.prototype["_$getRawValue$"] = function(key) {
                    return this.attributeSet.values[key];
                };
            },

            function(orig) {
                Aura.Component.Component.prototype.toJSON = orig;
                Aura.Component.Component.prototype["toJSON"] = orig;

                delete Aura.Component.Component.prototype["_$getSelfGlobalId$"];
                delete Aura.Component.Component.prototype["_$getRawValue$"];
            }
		),

        "StorageService.selectAdapter" : new Aura.Utils.Override($A.storageService, $A.storageService.selectAdapter,
            false,
            function(bound) {
                $A.storageService.selectAdapter = bound;
            },
            function(orig) {
                $A.storageService.selectAdapter = orig;
            }
        ),

        "RenderingService.addDirtyValue" : new Aura.Utils.Override($A.renderingService, $A.renderingService.addDirtyValue,
            false,
            function(bound) {
                $A.renderingService.addDirtyValue = bound;
            },
            function(orig) {
                $A.renderingService.addDirtyValue = orig;
            }
        ),

        "MetricsService.transaction" : new Aura.Utils.Override($A.metricsService, $A.metricsService.transaction,
            false,
            function(bound) {
                $A.metricsService.transaction = bound;
            },
            function(orig) {
                $A.metricsService.transaction = orig;
            }
        ),

        "HtmlComopnent.dispatchAction" : new Aura.Utils.Override(null, Aura.Component.HtmlComponent.prototype["helper"].dispatchAction,
            true,
            function(bound) {
                HtmlComponent.prototype["helper"].dispatchAction = bound;
            },
            function(orig) {
                HtmlComponent.prototype["helper"].dispatchAction = orig;
            }
        ),

        "ComponentService.indexComponent" : new Aura.Utils.Override($A.componentService, $A.componentService.indexComponent,
            false,
            function(bound) {
                $A.componentService.indexComponent = bound;
            },
            function(orig) {
                $A.componentService.indexComponent = orig;
            }
        ), 

        "ComponentDefLoader.loadingComplete" : new Aura.Utils.Override(null, 
                                        Aura.Component.ComponentDefLoader.prototype.loadingComplete, true /*isProto*/,
            function(bound) {
                Aura.Component.ComponentDefLoader.prototype.loadingComplete = bound;
            },
            function(orig) {
                Aura.Component.ComponentDefLoader.prototype.loadingComplete = orig;
            }
        ) 

    };
};
