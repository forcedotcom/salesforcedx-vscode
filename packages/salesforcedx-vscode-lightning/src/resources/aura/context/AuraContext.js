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
 * @description Represents a Aura client-side context, created during HTTP requests for component definitions. A context
 *            can include a mode, such as "DEV" for development mode or "PROD" for production mode.
 * @constructor
 * @protected
 * @class AuraContext
 * @param {Object} config the 'founding' config for the context from the server.
 * @param {Function} initCallback an optional callback invoked after the config has finished its asynchronous initialization.
 * @export
 */
Aura.Context.AuraContext = function AuraContext(config, initCallback) {
    this.mode = config["mode"];
    this.loaded = config["loaded"];
    if (this.loaded === undefined) {
        this.loaded = {};
    }

    // make a shallow-copy to use when the context is reset
    this.loadedOriginal = $A.util.apply({}, this.loaded);

    this.fwuid = config["fwuid"];
    this.pathPrefix = config["pathPrefix"];
    this.moduleServices = config["services"];
    this.num = 0;
    this.scriptNonce = config["scriptNonce"];
    this.styleContext = {};
    this.styleContext.cuid = config["styleContext"] ? config["styleContext"]["cuid"] : undefined;


    // To keep track of re-rendering service call
    this.renderNum = 0;
    this.transaction = 0;
    this.transactionName = "";
    this.lastGlobalId = 0;
    this.componentConfigs = {};
    this.app = config["app"];
    this.cmp = config["cmp"];
    this.test = config["test"];
    this.contextPath = config["contextPath"] || "";
    this.allowedGlobals = config["allowedGlobals"];
    this.globals = config["globals"];
    this.tokens={};
    this.useCompatSource = !!config[Json.ApplicationKey.COMPAT];
    this.shadowDomEnabled = !!config[Json.ApplicationKey.SHADOWDOM];
    this.moduleNamespaceAliases = config[Json.ApplicationKey.MODULENAMESPACEALIASES] || {};
    this.actionPublicCachingEnabled = !!config["apce"];
    if (this.actionPublicCachingEnabled) {
        this.actionPublicCacheKey = config["apck"];
    }
    this.uriAddressableDefsEnabled = !!config[Json.ApplicationKey.URIADDRESSABLEDEFINITIONS];
    this.cdnHost = config[Json.ApplicationKey.CDN_HOST];
    this.uriAddressableDefinitionsParameters = [
        new Aura.Component.ComponentDefLoaderParameter("aura.app", function(){
            return "markup://" + $A.getRoot().getType();
        }),
        new Aura.Component.ComponentDefLoaderParameter("_ff", function(){
            return $A.get("$Browser.formFactor");
        }),
        new Aura.Component.ComponentDefLoaderParameter("_l", function(){
            return $A.lockerService.isEnabled();
        }),
        new Aura.Component.ComponentDefLoaderParameter("_l10n", function(){
            return $A.get("$Locale.langLocale");
        }),
        new Aura.Component.ComponentDefLoaderParameter("_style", function(){
            return $A.getContext().styleContext.cuid;
        })
    ];
    this.appSpecificURIDefinitionsParameters = undefined;
    
    var that = this;

    this.initGlobalValueProviders(config["globalValueProviders"], function(gvps) {
            // Don't ask.... You just kinda have to love this....
            that.globalValueProviders = gvps;
            that.contextGlobals = that.globalValueProviders.getValueProvider("Global");
            // Careful now, the def is null, this fake action sets up our paths.
            that.currentAction = new Action(null, ""+that.num, null, null, false, null, false);

            that.saveDefinitionsToRegistry(config);
            that.joinComponentConfigs(config["components"], that.currentAction.getId());

            if (initCallback) {
                initCallback(that);
            }
        });
};

/**
 * Unique id for the current instance of Aura. In a multi-tab scenario
 * each tab will have a unique id.
 */
Aura.Context.AuraContext.CLIENT_SESSION_ID = [
    window.pageStartTime, // first byte sent
    Math.round(Aura.time() * 1000000), // current time (microseconds)
    Math.random().toString(16).substr(2)
].join('').substring(0, 32);

/**
 * Temporary shim, until W-2812858 is addressed to serialize GVPs as a map and fix $A GVPs.
 * Convert config GVPs from array to map, and merge $A GVPs, and create the context GVPs.
 * @export
 */
Aura.Context.AuraContext.prototype.initGlobalValueProviders = function(gvps, callback) {
    if ($A.util.isArray(gvps)) {
        var map = {};

        for (var i = 0; i < gvps.length; i++) {
            var gvp = gvps[i];
            var type = gvp["type"];
            var values = gvp["values"];
            map[type] = values;
        }

        gvps = map;
    }

    if(!gvps){
        gvps = {};
    }

    this.globalValueProviders = new Aura.Provider.GlobalValueProviders(gvps, callback);
};


/**
 * Returns the mode for the current request. Defaults to "PROD" for production mode and "DEV" for development mode.
 * The HTTP request format is <code>http://<your server>/namespace/component?aura.mode=PROD</code>.
 *
 * @return {string} the mode from the server.
 * @export
 */
Aura.Context.AuraContext.prototype.getMode = function() {
    return this.mode;
};

/**
 * Gets the application configuration tokens allowed to be used in component markup.
 * @private
 */
Aura.Context.AuraContext.prototype.getTokens=function(){
    return this.tokens;
};

/**
 * Sets the application configuration tokens allowed to be used in component markup.
 * @param tokens The object map containing name value pairs of tokens.
 * @private
 */
Aura.Context.AuraContext.prototype.setTokens=function(tokens){
    this.tokens=tokens;
};

/**
 * Adds a new global value provider.
 * @param type The key to identify the valueProvider.
 * @param valueProvider The valueProvider to add.
 * @private
 */
Aura.Context.AuraContext.prototype.addGlobalValueProvider = function(type,valueProvider) {
    this.globalValueProviders.addValueProvider(type,valueProvider);
};

/**
 * Provides access to global value providers.
 * For example, <code>$A.get("$Label.Related_Lists.task_mode_today");</code> gets the label value.
 *
 * @return {GlobalValueProviders}
 * @private
 */
Aura.Context.AuraContext.prototype.getGlobalValueProvider = function(type) {
    return this.globalValueProviders.getValueProvider(type);
};

/**
 * JSON representation of context for server requests.
 *
 * This must remain in sync with AuraTestingUtil so that we can accurately test.
 *
 * @return {String} json representation
 * @private
 */
Aura.Context.AuraContext.prototype.encodeForServer = function(includeDynamic, includeCacheKeyForCacheableXHR) {
    var contextToSend = {
        "mode" : this.mode,
        "fwuid" : this.fwuid
    };
    if (this.app) {
        contextToSend["app"] = this.app;
    } else {
        contextToSend["cmp"] = this.cmp;
    }
    if (this.test) {
        contextToSend["test"] = this.test;
    }
    if (includeDynamic) {
        contextToSend["loaded"] = this.loaded;
        contextToSend["dn"] = $A.services.component.getDynamicNamespaces();
        contextToSend["globals"] = this.globalValueProviders.getValueProvider("$Global").serializeForServer();
    } else {
        contextToSend["loaded"] = this.loadedOriginal;
    }
    if (includeCacheKeyForCacheableXHR) {
        contextToSend["apck"] = this.actionPublicCacheKey;
    }
    if(this.useCompatSource) {
        contextToSend[Json.ApplicationKey.COMPAT] = 1;
    }
    contextToSend[Json.ApplicationKey.URIADDRESSABLEDEFINITIONS] = this.uriAddressableDefsEnabled;
    return $A.util.json.encode(contextToSend);
};

/**
 * @param {Object} otherContext the context from the server to join in to this one.
 * @export
 */
Aura.Context.AuraContext.prototype.merge = function(otherContext, allowMissmatch) {
    if (!allowMissmatch) {

        if ($A.util.isUndefinedOrNull(this.fwuid)) {
            this.fwuid = otherContext["fwuid"];
        }
        if (otherContext["fwuid"] !== this.fwuid) {
            throw new $A.auraError("framework mismatch", null, $A.severity.QUIET);
        }

        $A.clientService.enableAccessChecks = otherContext["enableAccessChecks"];
        this.moduleServices = otherContext["services"];
    }

    try {
        this.globalValueProviders.merge(otherContext["globalValueProviders"]);
    } finally {
        this.saveDefinitionsToRegistry(otherContext);
        this.joinComponentConfigs(otherContext["components"], ""+this.getNum());
        this.joinLoaded(otherContext["loaded"], allowMissmatch);
    }
};

/**
 * @param $Label mapping of additional labels to add
 * @export
 */
Aura.Context.AuraContext.prototype.mergeGVPs = function(gvps) {
    this.globalValueProviders.merge(gvps);
};

/**
 * FIXME: this should return a string, and it should probably not even be here.
 *
 * @return {number} the 'num' for this context
 * @private
 * @export
 */
Aura.Context.AuraContext.prototype.getNum = function() {
    return this.num;
};

/**
 * @private
 */
Aura.Context.AuraContext.prototype.incrementNum = function() {
    this.num = this.num + 1;
    this.lastGlobalId = 0;
    return this.num;
};

/**
 * @private
 */
Aura.Context.AuraContext.prototype.incrementRender = function() {
    this.renderNum = this.renderNum + 1;
    return this.renderNum;
};

/**
 * @return {Number} incremented transaction number
 * @private
 * @export
 */
Aura.Context.AuraContext.prototype.incrementTransaction = function() {
    this.transaction = this.transaction + 1;
    return this.transaction;
};

/**
 * @return {Number} gets the number of the current transaction
 * @private
 */
Aura.Context.AuraContext.prototype.getTransaction = function() {
    return this.transaction;
};

/**
 * @private
 */
Aura.Context.AuraContext.prototype.updateTransactionName = function(_transactionName) {
    if (_transactionName) {
        this.transactionName =  (this.trasactionName !== "") ? (this.transactionName + "-" + _transactionName) : _transactionName;
    }
};

/**
 * @return {String} gets the name of the transaction
 * @private
 */
Aura.Context.AuraContext.prototype.getTransactionName = function() {
    return this.transactionName;
};

/**
 * @private
 */
Aura.Context.AuraContext.prototype.clearTransactionName = function() {
    this.transactionName = "";
};

/**
 * @return {Number} Next global ID
 * @private
 */
Aura.Context.AuraContext.prototype.getNextGlobalId = function() {
    this.lastGlobalId = this.lastGlobalId + 1;
    return this.lastGlobalId;
};

/**
 * Returns components configs object
 * @param {String} creationPath creation path to check
 * @return {Boolean} Whether creation path is in component configs
 * @private
 */
Aura.Context.AuraContext.prototype.containsComponentConfig = function(creationPath) {
    return this.componentConfigs.hasOwnProperty(creationPath);
};

/**
 * @param {string} creationPath the creation path to look up.
 * @private
 */
Aura.Context.AuraContext.prototype.getComponentConfig = function(creationPath) {
    var componentConfigs = this.componentConfigs;
    var ret = componentConfigs[creationPath];
    return ret;
};

/**
 * When we have consumed the component config from the context, its worth removing it to narrow down
 * the list of pending configs left to handle.
 * @param {String} creationPath is the components creationPath that we are operating on.
 * @private
 */
Aura.Context.AuraContext.prototype.removeComponentConfig = function(creationPath) {
    if(creationPath in this.componentConfigs) {
        delete this.componentConfigs[creationPath];
    }
};

/**
 * @param {Object} config the context from the server.
 * @private
 */
Aura.Context.AuraContext.prototype.saveDefinitionsToRegistry = function(config) {
    var i;
    var libraryDefs = config["libraryDefs"];
    var componentDefs = config["componentDefs"];
    var eventDefs = config["eventDefs"];
    var moduleDefs = config["moduleDefs"];

    if (libraryDefs) {
        for (i = 0; i < libraryDefs.length; i++) {
            $A.componentService.saveLibraryConfig(libraryDefs[i]);
        }
    }

    if (componentDefs) {
        for (i = 0; i < componentDefs.length; i++) {
            // there are occasions when componentDefs are just references (descriptor name)
            if (componentDefs[i]["descriptor"]) {
                $A.componentService.saveComponentConfig(componentDefs[i]);
            }
        }
    }

    if (eventDefs) {
        for (i = 0; i < eventDefs.length; i++) {
            $A.eventService.saveEventConfig(eventDefs[i]);
        }
    }

    if (moduleDefs) {
        $A.componentService.initModuleDefs(moduleDefs);
    }
};

/**
 * Returns the app associated with the request.
 * @export
 */
Aura.Context.AuraContext.prototype.getApp = function() {
    return this.app;
};

/**
 * @param {Object}
 *      otherComponentConfigs the component configs from the server to join in.
 * @param {string}
 *      actionId the id of the action that we are joining in (used to amend the creationPath).
 * @private
 */
Aura.Context.AuraContext.prototype.joinComponentConfigs = function(otherComponentConfigs, actionId) {
    var cP, idx, config, def;
    if (otherComponentConfigs) {
        for (idx = 0; idx < otherComponentConfigs.length; idx++) {
            config = otherComponentConfigs[idx];
            def = config["componentDef"];
            if (def && def["descriptor"]) {
                $A.componentService.saveComponentConfig(def);
            }
            cP = config["creationPath"];
            this.componentConfigs[actionId+cP] = config;
        }
    }
};

/**
 * Clear out pending component configs.
 *
 * This routine can be used in error conditions (or in tests) to clear out
 * configs left over by an action. In this case, we remove them, and drop
 * them on the floor to be garbage collected.
 *
 * @public
 * @param {string} actionId the action id that we should clear.
 * @export
 */
Aura.Context.AuraContext.prototype.clearComponentConfigs = function(actionId) {
    var count = 0;
    var removed = 0;
    var error = "";
    var prefix = actionId+"/";
    var len = prefix.length;
    var componentConfigs = this.componentConfigs;

    for ( var config in componentConfigs ) {
        if (componentConfigs.hasOwnProperty(config) && (config === actionId || config.substr(0,len) === prefix)) {
            removed += 1;
            if (error.length > 0) {
                error = error + ", ";
            }
            error = error + config + JSON.stringify(componentConfigs[config]);
            delete componentConfigs[config];
        } else {
            count += 1;
        }
    }
    if (error.length > 0) {
        var warningMessage = "unused configs for " + actionId;
        //#if {"excludeModes" : ["PRODUCTION", "PRODUCTIONDEBUG", "PERFORMANCEDEBUG"]}
        warningMessage = warningMessage + ": " + error;
        //#end
        $A.warning(warningMessage);
    }
    if (count === 0) {
        this.componentConfigs = {};
    }
    return removed;
};

/**
 * @private
 */
Aura.Context.AuraContext.prototype.joinLoaded = function(loaded, dontOverride) {
    if (this.loaded === undefined) {
        this.loaded = {};
    }
    if (loaded) {
        for ( var i in loaded) {
            if (loaded.hasOwnProperty(i) && !dontOverride && !($A.util.isFunction(i))) {
                var newL = loaded[i];
                if (newL === 'deleted') {
                    delete this.loaded[i];
                } else {
                    this.loaded[i] = newL;
                }
            }
        }
    }
};

/**
 * Add back a loaded pair that was extracted using 'findLoaded'.
 *
 * @param {Object} pair the object returned by findLoaded.
 * @private
 */
Aura.Context.AuraContext.prototype.addLoaded = function(pair) {
    // Be safe. But should we go and scream if we get a mismatch?
    if (pair && !this.loaded[pair["key"]]) {
        this.loaded[pair["key"]] = pair["value"];
    }
};

/**
 * Find a 'loaded' pair for a descriptor.
 *
 * @param {String} descriptor the descriptor string.
 * @param {Object=} [loaded] Object to search
 * @returns {Object} an object that can be passed to addloaded.
 * @private
 */
Aura.Context.AuraContext.prototype.findLoaded = function(descriptor, loaded) {
    var cmpDescriptor = "COMPONENT@" + descriptor;
    var appDescriptor = "APPLICATION@" + descriptor;
    loaded = loaded || this.loaded;
    if (loaded[cmpDescriptor]) {
        return { "key": cmpDescriptor, "value": loaded[cmpDescriptor] };
    } else if (loaded[appDescriptor]) {
        return { "key": appDescriptor, "value": loaded[appDescriptor] };
    }
    return null;
};

/**
 * This should be private but is needed for testing... ideas?
 *
 * ... should move to $A.test.
 * @export
 */
Aura.Context.AuraContext.prototype.getLoaded = function() {
    return this.loaded;
};

/**
 * Reset the loaded set to its original value at launch.
 */
Aura.Context.AuraContext.prototype.resetLoaded = function() {
    this.loaded = $A.util.apply({}, this.loadedOriginal);
};

/**
 * DCHASMAN Will be private again soon as part of the second phase of W-1450251
 * @export
 */
Aura.Context.AuraContext.prototype.setCurrentAction = function(action) {
    var previous = this.currentAction;
    this.currentAction = action;
    return previous;
};

/**
 * EBA - temporarily made public for helpers to obtain action - return to private when current visibility is determined
 * @public
 * @return {Action} the current action.
 * @export
 */
Aura.Context.AuraContext.prototype.getCurrentAction = function() {
    return this.currentAction;
};

/**
 * Temporarily made public for Communities - return to private when prefixes are not needed
 * @public
 * @return {String} path prefix.
 * @export
 */
Aura.Context.AuraContext.prototype.getPathPrefix = function () {
    return this.pathPrefix;
};

/**
 * Servlet container context path
 * @return {String} Servlet container context path
 * @private
 * @export
 */
Aura.Context.AuraContext.prototype.getContextPath = function() {
    return this.contextPath;
};

/** @export */
Aura.Context.AuraContext.prototype.setContextPath = function(path) {
    this.contextPath = path;
};

/**
 * @return {boolean} if action public caching is enabled or not
 * @export
 */
Aura.Context.AuraContext.prototype.isActionPublicCachingEnabled = function() {
    return this.actionPublicCachingEnabled;
};

/**
 * @return {String} The action public cache key
 * @export
 */
Aura.Context.AuraContext.prototype.getActionPublicCacheKey = function() {
    return this.actionPublicCacheKey;
};

/**
 * @return {boolean} if URI Addressable Defs enabled or not
 * @export
 */
Aura.Context.AuraContext.prototype.isURIAddressableDefsEnabled = function() {
    return this.uriAddressableDefsEnabled;
};

/**
 * @return {Array} of parameters that will be used in the URI for fetching a component definition
 */
Aura.Context.AuraContext.prototype.getURIComponentDefinitionsParameters = function () {
    if (this.appSpecificURIDefinitionsParameters === undefined) {
        var application = $A.getRoot();
        if (application["getURIComponentDefinitionParameters"]) {
            var params = application["getURIComponentDefinitionParameters"]();
            for (var i=0; i<params.length; i++) {
                var paramName = params[i][0];
                if (paramName[0] !== "_") {
                    paramName = "_" + paramName;
                }
                this.uriAddressableDefinitionsParameters.push(
                    new Aura.Component.ComponentDefLoaderParameter(paramName, params[i][1])
                );
            }
        }
        this.appSpecificURIDefinitionsParameters = true;
    }
    return this.uriAddressableDefinitionsParameters;
};

/**
 * @return {boolean} if CDN is enabled
 * @export
 */
Aura.Context.AuraContext.prototype.isCDNEnabled = function() {
    return !$A.util.isUndefinedOrNull(this.cdnHost);
};

/**
 * Whether compat source is needed.
 * @returns {Boolean} whether compat is enabled
 */
Aura.Context.AuraContext.prototype.isCompat = function() {
    return this.useCompatSource;
};

/**
 * @return {boolean} if shadow dom enabled
 */
Aura.Context.AuraContext.prototype.isShadowDomEnabled = function() {
    return this.shadowDomEnabled;
};
