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
/**
 * DomHandlersPlugin
 * =================
 * This plugin hooks into the definition of aura:html component.
 * In particular the following methods:
 * dispatchAction(): Tracks all interactions (click, mouseovers, any DOM handlers) 
 * handled by any active component
 *
 * @description DomHandlersPlugin
 * @constructor
 * @export
 */
var DomHandlersPlugin = function DomHandlersPlugin(config) {
    this.config = config;
    this["enabled"] = true;
};

DomHandlersPlugin.NAME = "domHandlers";
DomHandlersPlugin.DEFAULT_INTERACTION_TYPE = "user";
DomHandlersPlugin.ALLOWLISTEVENTS = { 
    "click"  : true,
    "change" : true
};

/** @export */
DomHandlersPlugin.prototype.initialize = function (metricsService) {
    this.metricsService = metricsService;

    if (this["enabled"]) {
        this.bind();
    }
};

/** @export */
DomHandlersPlugin.prototype.enable = function () {
    if (!this["enabled"]) {
        this["enabled"] = true;
        this.bind();
    }
};

/** @export */
DomHandlersPlugin.prototype.disable = function () {
    if (this["enabled"]) {
        this["enabled"] = false;
        this.unbind(this.metricsService);
    }
};

/*
// We might need this method somewhere in the future

DomHandlersPlugin.prototype.stringifyLocator = function (locator) {
    var ordered = { 
        target  : locator.target, 
        scope   : locator.scope, 
        context : locator.context && Object.keys(locator.context).sort().reduce(function (r, k) { r[k] = locator.context[k]; return r; }, {}) 
    };

    if (!locator.context) {
        delete locator.context;
    }
    
    return JSON.stringify(ordered);
};
*/

/**
 * Logs LightningInteraction transactions if the html event handled is in the allowlist
 * 
 * @param action - This is unused
 * @param event - The DOM Event
 * @param root - The aura:html component that is handling the event
 */
DomHandlersPlugin.prototype.dispatchActionHook = function (action, event, root) {
    if (!(event.type in DomHandlersPlugin.ALLOWLISTEVENTS)) {
        return;
    }
    
    var parent = $A.expressionService.getContainer(root).getConcreteComponent();

    var locator = parent.getLocator(root, false /*includeMetadata*/);

    // Only if we have a unique, identifier send the interaction
    if (locator) { 
        var target = root["getElement"]();
        var meta = target && target.getAttribute("data-refid"); // optional metadata

        var context = {
            "locator"     : locator,
            "eventType"   : DomHandlersPlugin.DEFAULT_INTERACTION_TYPE,
            "eventSource" : event.type // type of event (click, hover, scroll)
        };
        
        if (meta) {
            locator["context"] = locator["context"] || {};
            if (!locator["context"][meta]) {
                locator["context"][meta] = target.getAttribute("data-" + meta);
            }
        }

        $A.metricsService.transaction("aura", "interaction", { "context": context });
    } 
    //#if {"excludeModes" : ["PRODUCTION", "PRODUCTIONDEBUG", "PERFORMANCEDEBUG"]}
    else if (event.type === "click") {
        this.logUnInstrumentedClick(parent, root);
    }
    //#end

};

//#if {"excludeModes" : ["PRODUCTION", "PRODUCTIONDEBUG", "PERFORMANCEDEBUG"]}
DomHandlersPlugin.prototype.logUnInstrumentedClick = function (parent, root) {
    var es = $A.expressionService;
    var grandparent = es.getContainer(parent).getConcreteComponent();
    var grandparentContainer = es.getContainer(grandparent).getConcreteComponent();
    // root will always be an aura:html component. It's the root of all our click handlers
    var hierarchy = {
            "rootHtmlTag": root.get("v.tag"),
            "rootId" : root.getLocalId(),
            "parent": parent.getDef().toString(),
            "parentId": parent.getLocalId(),
            "grandparent": grandparent.getDef().toString(),
            "grandparentId": grandparent.getLocalId(),
            "grandparentContainer": grandparentContainer.getDef().toString()
    };
    $A.metricsService.transaction("ltng", "performance:missingLocator", { "context": {
        "attributes": hierarchy
    }});
    $A.log("WARNING: **** Un-Instrumented click logged. Details: " + JSON.stringify(hierarchy));
};
//#end

DomHandlersPlugin.prototype.bindToMetricsService = function (jsObject, method) {
    var self = this;
    if (jsObject) {
        this.metricsService.instrument(
            jsObject, 
            method, 
            DomHandlersPlugin.NAME,
            false/*async*/,
            null, 
            null,
            function (original) {
                var xargs = Array.prototype.slice.call(arguments, 1);
                self.dispatchActionHook.apply(self, xargs);
                return original.apply(this, xargs);
            }
        );
    }    
};

DomHandlersPlugin.prototype.bindToHelper = function (descriptor, helperMethod) {
    var defConfig  = $A.componentService.createDescriptorConfig(descriptor);
    var def        = $A.componentService.getComponentDef(defConfig);
    var defHelper  = def && def.getHelper();

    this.bindToMetricsService(defHelper, helperMethod);
};

DomHandlersPlugin.prototype.bindToLib = function (lib, jsFile) {
    var fileObject = $A.componentService.hasLibrary(lib) &&
                        $A.componentService.getLibraryInclude(jsFile);

    if (fileObject) {
        this.bindToMetricsService(fileObject, "_dispatchAction");
    }
};

DomHandlersPlugin.prototype.bind = function () {
    var self = this;
    $A.clientService.runAfterInitDefs(function () {
        $A.installOverride("HtmlComopnent.dispatchAction", self.instrumentCallback, self);
        self.bindToHelper("markup://ui:virtualList", "_dispatchAction");
        self.bindToHelper("markup://ui:virtualDataGrid", "_dispatchAction");
        self.bindToHelper("markup://ui:virtualDataTable", "_dispatchAction");
        
        // This is for input* components
        self.bindToLib("markup://ui:eventLib","js://ui.eventLib.interactive");

        //This is for virtualTreeGrid component
        self.bindToLib("markup://force:virtualGridLib","js://force.virtualGridLib.gridHelper");
    });
};

DomHandlersPlugin.prototype.instrumentCallback = function (/*original*/) {
    var xargs = Array.prototype.slice.call(arguments, 1);
    // this.dispatchActionHook.apply(this, xargs);
    // return original.apply(this, xargs);
    var config = Array.prototype.shift.apply(arguments);
    this.dispatchActionHook.apply(this, xargs);
    return config["fn"].apply(config["scope"], arguments);
};

//#if {"excludeModes" : ["PRODUCTION"]}
/** @export */
DomHandlersPlugin.prototype.postProcess = function (transportMarks) {
    return transportMarks;
};
//#end

DomHandlersPlugin.prototype.unbind = function () {
    $A.uninstallOverride("HtmlComopnent.dispatchAction", this.instrumentCallback, this);
};

$A.metricsService.registerPlugin({
    "name"   : DomHandlersPlugin.NAME,
    "plugin" : DomHandlersPlugin
});
