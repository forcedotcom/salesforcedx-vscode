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
 * @class Aura
 * @classdesc The Aura framework. Default global instance name is $A.
 * @constructor
 * @platform
 * @namespace
 * @alias $A
 *
 * @borrows AuraClientService#enqueueAction as enqueueAction
 * @borrows AuraComponentService#createComponent as createComponent
 * @borrows AuraComponentService#createComponents as createComponents
 * @borrows AuraComponentService#getComponent as getComponent
 */
function AuraInstance () {
    this.globalValueProviders = {};
    this.deprecationUsages    = {};
    this.displayErrors        = true;
    this.initializers         = {};

    this.logger               = new Aura.Utils.Logger();

    /**
     * Collection of basic utility methods to operate on the DOM and Aura Components. <br/>
     * See the documentation for <a href="#reference?topic=api:Util">Util</a> for the members.
     *
     * @type $A.ns.Util
     * @platform
     */
    this.util                 = new Aura.Utils.Util();
    this["util"]              = this.util; //Move this? (check prod mangling)

    this.auraError            = Aura.Errors.AuraError;
    this.auraFriendlyError    = Aura.Errors.AuraFriendlyError;

    /**
     * Error severity for categorizing errors
     *
     * ALERT [default error severity level if error thrower doesn’t explicitly specify a severity level] -
     * the current page has issues and we need to alert the user that an error has occurred.  The error(s) could potentially be corrected by a page reload
     *
     * FATAL - the user’s session is now completely broken and cannot continue being used.
     * The user should logout and contact Salesforce support or their administrator.
     *
     * QUIET - An error has occurred but it won’t affect the user/page.
     * This is likely something unexpected that a lower level component can just quietly log for later diagnostics by Salesforce (e.g. a perf issue or something else).
     *
     * @public
     */
    this.severity = {
        ALERT: "ALERT",
        FATAL: "FATAL",
        QUIET: "QUIET"
    };

    this.lastKnownError = null;

    /**
     * Instance of the AuraLocalizationService which provides utility methods for localizing data or getting formatters for numbers, currencies, dates, etc.<br/>
     * See the documentation for <a href="#reference?topic=api:AuraLocalizationService">AuraLocalizationService</a> for the members.
     *
     * @type AuraLocalizationService
     * @platform
     */
    this.localizationService  = new Aura.Services.AuraLocalizationService();
    this.clientService        = new Aura.Services.AuraClientService(this.util);
    this.componentService     = new Aura.Services.AuraComponentService();
    this.renderingService     = new Aura.Services.AuraRenderingService();
    this.expressionService    = new Aura.Services.AuraExpressionService();
    this.historyService       = new Aura.Services.AuraHistoryService();
    this.eventService         = new Aura.Services.AuraEventService();
    this.storageService       = new Aura.Services.AuraStorageService();
    this.styleService         = new Aura.Services.AuraStyleService();
    this.metricsService       = new Aura.Services.MetricsService();
    this.lockerService        = new Aura.Services.LockerService();

    //#if {"excludeModes" : ["PRODUCTION", "PRODUCTIONDEBUG", "PERFORMANCEDEBUG"]}
    this.devToolService = new AuraDevToolService();
    //#end

    this.injectedServices={
        "localization":this.localizationService,
        "metrics":this.metricsService
    };

    /** @field */
    this.services = {
        /**
         * Rendering Service
         *
         * @public
         * @type AuraRenderingService
         * @memberOf Aura.Services
         */
        rendering : this.renderingService,
        /**
         * Event Service
         *
         * @public
         * @type AuraEventService
         * @memberOf Aura.Services
         */
        event : this.eventService,
        /**
         * Component Service
         *
         * @public
         * @type AuraComponentService
         * @memberOf Aura.Services
         */
        component : this.componentService,
        /**
         * Client Service
         *
         * @public
         * @type AuraClientService
         * @memberOf AuraInstance.prototype
         */
        client : this.clientService,

        /**
         * History Service
         *
         * @public
         * @type AuraHistoryService
         * @memberOf AuraInstance.prototype
         */
        history : this.historyService,

        /**
         * Storage Service
         *
         * @public
         * @type AuraStorageService
         * @memberOf AuraInstance.prototype
         */
        storage : this.storageService,

        /**
         * Alias of Component Service
         *
         * @public
         * @type AuraComponentService
         * @memberOf AuraInstance.prototype
         * @see Aura#services.component
         */
        cmp : this.componentService,

        /**
         * Alias of Event Service
         *
         * @public
         * @type AuraEventService
         * @memberOf AuraInstance.prototype
         * @see Aura#services.event
         */
        e : this.eventService,

        /**
         * Style Service
         *
         * @public
         * @type AuraStyleService
         * @memberOf AuraInstance.prototype
         */
        style: this.styleService,

        /**
         * Metrics Service
         *
         * @public
         * @type AuraMetricsService
         * @memberOf AuraInstance.prototype
         */
        metrics: this.metricsService,

        /**
         * Locker Service
         *
         * @public
         * @type AuraLockerService
         * @memberOf AuraInstance.prototype
         */
        locker: this.lockerService,

        get : function(key) {
            var ret = $A.services[key];
            if (!ret && key === "root") {
                return $A.getRoot();
            }
            return ret;
        }
    };


    // Doced at the source by the @borrows statements on the Aura class
    this.Component                 = Component;

    this.enqueueAction             = this.clientService.enqueueAction.bind(this.clientService);
    this.deferPendingActions       = this.clientService.deferPendingActions.bind(this.clientService);
    this.runAfterInit              = this.clientService.runAfterInitDefs.bind(this.clientService);

    this.render                    = this.renderingService.render.bind(this.renderingService);
    this.rerender                  = this.renderingService.rerender.bind(this.renderingService);
    this.unrender                  = this.renderingService.unrender.bind(this.renderingService);
    this.afterRender               = this.renderingService.afterRender.bind(this.renderingService);

    this.getCmp                    = this.componentService.get.bind(this.componentService);
    this.getComponent              = this.componentService.getComponent.bind(this.componentService);
    this.createComponent           = this.componentService["createComponent"].bind(this.componentService);
    this.createComponents          = this.componentService["createComponents"].bind(this.componentService);
    this.createComponentFromConfig = this.componentService.createComponentFromConfig.bind(this.componentService);

    this.getEvt                    = this.eventService.newEvent.bind(this.eventService);

    // DEPRECATED
    this.newCmp                    = this.componentService["newComponentDeprecated"].bind(this.componentService);
    this.newCmpDeprecated          = this.componentService["newComponentDeprecated"].bind(this.componentService);
    this.newCmpAsync               = this.componentService["newComponentAsync"].bind(this.componentService);
    // END DEPRECATED

    /**
     * Pushes current portion of attribute's creationPath onto stack
     * @param {String} creationPath
     *
     * @public
     */
    this.pushCreationPath = function(creationPath) {
        var ctx = this.getContext();
        if (!ctx) {
            return;
        }
        var act = ctx.getCurrentAction();
        if (!act) {
            return;
        }
        act.pushCreationPath(creationPath);
    };


    /**
     * pops current portion of attribute's creationPath from stack
     * @param {String} creationPath
     *
     * @public
     */
    this.popCreationPath = function(creationPath) {
        var ctx = this.getContext();
        if (!ctx) {
            return;
        }
        var act = ctx.getCurrentAction();
        if (!act) {
            return;
        }
        act.popCreationPath(creationPath);
    };

    /**
     * sets pathIndex for the current attribute on creationPath's stack
     * @param {String} creationPath
     *
     * @public
     */
    this.setCreationPathIndex = function(idx) {
        var ctx = this.getContext();
        if (!ctx) {
            return;
        }
        var act = ctx.getCurrentAction();
        if (!act) {
            return;
        }
        act.setCreationPathIndex(idx);
    };

    //  Google Closure Compiler Symbol Exports
    this["runAfterInit"] = this.runAfterInit;
    this["clientService"] = this.clientService;
    this["componentService"] = this.componentService;
    this["renderingService"] = this.renderingService;
    this["expressionService"] = this.expressionService;
    this["historyService"] = this.historyService;
    this["localizationService"] = this.localizationService;
    this["eventService"] = this.eventService;
    this["layoutService"] = this.layoutService;
    this["metricsService"] = this.metricsService;
    this["lockerService"] = this.lockerService;
    this["storageService"] = this.storageService;
    this["styleService"] = this.styleService;
    this["services"] = this.services;
    this["enqueueAction"] = this.enqueueAction;
    this["deferPendingActions"] = this.deferPendingActions;
    this["render"] = this.render;
    this["rerender"] = this.rerender;
    this["unrender"] = this.unrender;
    this["afterRender"] = this.afterRender;
    this["logger"] = this.logger;
    this["getCmp"] = this.getCmp;
    this["getComponent"] = this.getComponent;
    this["pushCreationPath"] = this.pushCreationPath;
    this["popCreationPath"] = this.popCreationPath;
    this["setCreationPathIndex"] = this.setCreationPathIndex;

    //#if {"excludeModes" : ["PRODUCTION", "PRODUCTIONDEBUG", "PERFORMANCEDEBUG"]}
    this["devToolService"] = this.devToolService;
    this["getQueryStatement"] = this.devToolService.newStatement;
    //#end

    this["createComponent"] = this.createComponent;
    this["createComponents"] = this.createComponents;
    this["createComponentFromConfig"] = this.createComponentFromConfig;
    this["getEvt"] = this.getEvt;
    this["Component"] = this.Component;

    this["auraFriendlyError"] = this.auraFriendlyError;
    this["severity"] = this.severity;
    this["severity"]["ALERT"] = this.severity.ALERT;
    this["severity"]["FATAL"] = this.severity.FATAL;
    this["severity"]["QUIET"] = this.severity.QUIET;

    // work around closure compiler
    this["severity"] = Object.freeze(this["severity"]);

    this["hasDefinition"] = this.hasDefinition;
    this["getDefinition"] = this.getDefinition;
    this["getDefinitions"] = this.getDefinitions;

    // DEPRECATED
    this["newCmp"] = this.newCmp;
    this["newCmpDeprecated"] = this.newCmpDeprecated;
    this["newCmpAsync"] = this.newCmpAsync;
    //#if {"excludeModes" : ["PRODUCTION", "PRODUCTIONDEBUG", "PERFORMANCEDEBUG"]}
    this["qhelp"] = function() { return this.devToolService.help();};
    //#end

    // END DEPRECATED

    var services = this.services;

    // TODO: convert to //#exportSymbols when available

    services["rendering"] = services.rendering;
    services["event"] = services.event;
    services["component"] = services.component;
    services["client"] = services.client;
    services["history"] = services.history;
    services["storage"] = services.storage;
    services["metrics"] = services.metrics;
    services["cmp"] = services.cmp;
    services["e"] = services.e;
    services["c"] = {
        get: function(name) {
            var path = (name||'').split('.');
            var controllerDef = path.shift();
            var action = path.shift();
            return services.component.getControllerDef(controllerDef).get(action);
        }
    };

}

/**
 * Initializes Aura with context info about the app that should be loaded.
 * @param {Object} config
 *
 * {
 *      <code>config.descriptor</code> : The descriptor of the application or component that should be loaded as the root. For example, <code>"markup://foo:bar"</code><br />
 *      <code>config.attributes</code> : The attributes that should be passed into the root component when it is constructed. For example, <code>{at1 : 1, at2 : "asdf"}</code><br />
 *      <code>config.defType</code> : The defType of the descriptor.  For example, <code>"DEFINITION"</code> or <code>"APPLICATION"</code><br />
 *      <code>config.lastmod</code> : The timestamp, in millis of the latest changes to the preloaded metadata associated with this application.
 * }
 * @public
 */

/*
 * Execute all the functions that have been injected before the framework is initialized
 * An example of injection is the code that a user can write in the template as part of the preInitBlock
 */
AuraInstance.prototype.beforeInitHooks = function () {
    var fncs = Aura["beforeFrameworkInit"];
    if (fncs && fncs.length) {
        for (var i = 0; i < fncs.length; i++) {
            fncs[i]();
        }
    }
};

/*
 * Execute all the functions that have been injected after the framework is initialized
 * (the app component tree has been created and rendered)
 */
AuraInstance.prototype.afterInitHooks = function () {
    var fncs = Aura["afterFrameworkInit"];
    if (fncs && fncs.length) {
        for (var i = 0; i < fncs.length; i++) {
            fncs[i]();
        }
    }
};

AuraInstance.prototype.initAsync = function(config) {
    Aura.bootstrapMark("runInitAsync");
    this.beforeInitHooks();
    this.clientService.setNamespacePrivileges(config["ns"]);
    this.clientService.setQueueSize(config["MaxParallelXHRCount"]);
    this.clientService.setXHRExclusivity(config["XHRExclusivity"]);
    this.clientService.setBootstrapInlined(config["bootstrapInlined"]);
    this.clientService.setCssVars(config["cssVariables"]);
    this.initializers = config["initializers"];

    // Context is created async because of the GVPs go though async storage checks
    $A.context = new Aura.Context.AuraContext(config["context"], function(context) {
        //
        // This hook is to allow for reloading after aura is initialized, including
        // any storage setup, as we may well have to clear persistent storage.
        //
        $A.context = context;
        $A.clientService.reloadPointPassed = true;
        if ($A.clientService.reloadFunction) {
            $A.clientService.reloadFunction();
            return;
        }

        if (context.uriAddressableDefsEnabled) {
            Aura.Component.ComponentDefStorage.prototype.useDefStore = false;
        }

        $A.clientService.initHost(config["host"]);
        $A.clientService.setToken(config["token"]);
        $A.metricsService.initialize();

        function reportError (e) {
            $A.reportError("Error initializing the application", e);
        }

        function initializeApp () {
            return $A.clientService.initializeApplication()["then"](function (bootConfig) {
                $A.run(function () {
                    $A.initPriv(bootConfig);
                });
            }, reportError);
        }

        // before rendering the app, we need to ensure the app.css has been loaded
        // many applications depend upon the css existing before initialization takes place.
        function ensureCssLoaded(){
            return new Promise(function(resolve) {
                if (Aura["bootstrap"]["appCssLoading"]) {
                    //record the callback for the css loaded event to handle
                    Aura["bootstrap"]["appCssLoadedCallback"] = resolve;
                } else {
                    //immediately resolve since we are not currently loading css
                    resolve();
                }
            });
        }

        // When bootstrap is inlined, bootstrap.js won't be stored in action storage.
        function bootstrapLoadPromise() {
            return config["bootstrapInlined"]
                ? Promise["resolve"]()
                : $A.clientService.loadBootstrapFromStorage();
        }

        // Actions depend on defs depend on GVP (labels). so load them in dependency order and skip
        // loading depending items if anything fails to load.
        function gvpLoadPromise () {
            if (context.uriAddressableDefsEnabled) {
                return Promise["resolve"]();
            } else {
                return context.globalValueProviders.loadFromStorage();
            }
        }

        gvpLoadPromise()["then"](function() {
            //  do not modify - used by bootstrapRobustness() and instrumentation
            $A.clientService.gvpsFromStorage = context.globalValueProviders.LOADED_FROM_PERSISTENT_STORAGE;

            if (!$A.clientService.gvpsFromStorage) {
                $A.log("Aura.initAsync: GVP not loaded from storage so not loading defs or actions either");
                ensureCssLoaded()["then"](initializeApp)["then"](undefined, reportError);
            } else {
            Promise["all"]([
                bootstrapLoadPromise(),
                $A.componentService.restoreDefsFromStorage(context),
                $A.clientService.populateActionsFilter(),
                ensureCssLoaded()
            ])
                    ["then"](initializeApp, function (err) {
                    $A.log("Aura.initAsync: failed to load defs, get bootstrap or actions from storage", err);
                    $A.clientService.clearActionsFilter();
                    return initializeApp();
                })
                    ["then"](undefined, reportError);
            }
        });
    });

    this.clientService.initDefs();
    $A.executeExternalLibraries();
};

/**
 * This function initializes external libraries that were appended on aura.js
 * An example of library is moment.js
 */
AuraInstance.prototype.executeExternalLibraries = function () {
    if (Aura["externalLibraries"]) {
        Aura["externalLibraries"].call(window);
    }
};

/**
 * Initializes Aura with context info but without retrieving component from server. Used for synchronous initialization.
 *
 * Whoever named this function should be shot, but I won't rename for now. Eventually we want to use
 * startApplication, and make it either auto-require app.js or have the caller load app.js and then invoke
 * startApplication with the data.
 *
 * @param {Object} config The configuration attributes
 * @param {Boolean} useExisting
 * @param {Boolean} doNotInitializeServices Set to true if the History service should not be initialized, or false if
 *   it should. Defaults to true for Aura Integration Service.
 * @public
 */
AuraInstance.prototype.initConfig = function(config, useExisting, doNotInitializeServices) {
    this.clientService.setNamespacePrivileges(config["ns"]);
    this.clientService.setQueueSize(config["MaxParallelXHRCount"]);
    this.clientService.setXHRExclusivity(config["XHRExclusivity"]);
    this.initializers = config["initializers"];
    this.beforeInitHooks();

    $A.executeExternalLibraries();

    if (!useExisting || $A.util.isUndefined($A.getContext())) {
        $A.clientService.initHost(config["host"], config["sid"]);
        // creating context.
        $A.context = new Aura.Context.AuraContext(config["context"], function(context) {
            $A.context = context;
            if (context.uriAddressableDefsEnabled) {
                Aura.Component.ComponentDefStorage.prototype.useDefStore = false;
            }
            $A.clientService.initDefs();
            $A.metricsService.initialize();
            $A.initPriv(config["instance"], config["token"], null, doNotInitializeServices);
            $A.context.clearComponentConfigs($A.context.getCurrentAction().getId());
            $A.context.setCurrentAction(null);
        });
    } else {
        // Use the existing context and just join the new context into it
        // FIXME: This is used by integration service, and will not work correctly with components.
        $A.getContext()['merge'](config["context"]);
    }
};

/**
 * Initializes Aura in debug environment.
 *
 * @param {Object} config The descriptor ("markup://foo:bar"), attributes, defType ("APPLICATION" or "COMPONENT"), and
 *        timestamp of last modified change
 * @param {String} token
 * @param {Object} container Sets the container for the component.
 * @param {Boolean=} doNotInitializeServices True if the History service should not be initialized, or false if
 *        it should. Defaults to true for Aura Integration Service.
 * @private
 */
AuraInstance.prototype.initPriv = function(config, token, container, doNotInitializeServices) {
    Aura.bootstrapMark("AuraFrameworkEPT");
    if (!$A["hasErrors"]) {
        $A.addTearDownHandler();
        $A.clientService.initializeClientLibraries();
        $A.clientService.initializeInjectedServices($A.context.moduleServices);
        $A.localizationService.init();

        var app = $A.clientService["init"](config, token, $A.util.getElement(container));
        // Set the top level element as the root
        $A.setRoot(app);

        if (!$A.initialized) {
            $A.initialized = true;
            $A.addDefaultEventHandlers(app);
            $A.afterInitHooks();
            $A.finishInit(doNotInitializeServices);
        }
    }
};

/**
 * Add default handler to aura:systemError event
 * @private
 */
AuraInstance.prototype.addTearDownHandler = function () {
    window.addEventListener('unload', $A.getCallback($A.clientService.tearDown.bind($A.clientService)));
};

/**
 * Add default handler to aura:systemError event
 * @private
 */
AuraInstance.prototype.addDefaultEventHandlers = function (app) {
    // Add default XSS navigation handler
    app.addEventHandler("aura:clientRedirect",$A.defaultRedirectHandler);

    // Add default error handlers
    app.addEventHandler("aura:systemError",$A.defaultErrorHandler);
    app.addEventHandler("aura:customerError",$A.defaultErrorHandler);
};

/*
*  Default Error handler
*  @private
* */
AuraInstance.prototype.defaultErrorHandler=function(event) {
    if (event["handled"]){
        return;
    }
    $A.message(event.getParam("message"), event.getParam("auraError"));
    event["handled"] = true;
};

/*
 * Default XSS controlled location redirect event handler
 * @private
 * */
AuraInstance.prototype.defaultRedirectHandler=function(evt) {
    var url = evt.getParam('url');
    if (url != null) {
        // XSS protection: don't allow javascript or data url
        var protocolBlocklist = ['javascript', 'data'];
        var doc = document.implementation.createDocument('http://www.w3.org/1999/xhtml', 'html', null);
        var testXSSLink = doc.createElement('a');
        testXSSLink.setAttribute('href', url);
        if (testXSSLink.protocol != null){
            for(var i = 0; i < protocolBlocklist.length; i++){
                if(testXSSLink.protocol.indexOf(protocolBlocklist[i]) === 0){
                    url = encodeURIComponent(url);
                    break;
                }
            }
        }
        window.location = url;
    }
};


/**
 * Signals that initialization has completed.
 * @private
 */
AuraInstance.prototype.finishInit = function(doNotInitializeServices) {
    if (!this["finishedInit"]) {
        $A.util.removeClass(document.body, "loading");
        delete $A.globalValueProviders;
        this["finishedInit"] = true;
        $A.metricsService.applicationReady();

        $A.eventService.getNewEvent("markup://aura:initialized").fire();
        $A.clientService.checkBootstrapUpgrade();
        $A.clientService.clearReloadCount();
    }

    // Unless we are in IntegrationServices, dispatch location hash change.
    if (!doNotInitializeServices && !Aura["disableHistoryService"]) {
        $A.historyService.init();
    }

    // Notify handlers () we are done
    var readyCallbacks = Aura["afterAppReady"];
    for (var i in readyCallbacks) {
        readyCallbacks[i]();
    }

    delete Aura["afterAppReady"];
    Aura["applicationReady"] = true;
};

/**
 * Deprecated. Use the standard JavaScript throw new Error(msg) instead for a serious error
 * that has no recovery path.
 *
 * If this occurs during a test, the test will be stopped unless you add calls to '$A.test.expectAuraError' for
 * each error that occurs. <code>auraErrorsExpectedDuringInit</code> allows server side errors to not stop the
 * test as well.
 *
 *
 * @public
 * @param {String} msg The error message to be displayed to the user.
 * @param {Error} [e] The error object to be displayed to the user.
 * @platform
 * @deprecated throw new Error(msg) instead
 */
AuraInstance.prototype.error = function(msg, e){
    this.logger.logError(msg, e);
};

/**
 * Optionally sets and returns whether to display error dialog
 *
 * @private
 * @param {Boolean} [toggle] toggles display of error dialog
 * @returns {Boolean} whether to display error dialog
 */
AuraInstance.prototype.showErrors = function(toggle){
    if (toggle !== undefined) {
        this.displayErrors = !!toggle;
    }
    return this.displayErrors;
};

/**
 * @private
 */
AuraInstance.prototype.handleError = function(message, e) {
    //#if {"excludeModes" : ["PRODUCTION", "PRODUCTIONDEBUG", "PERFORMANCEDEBUG"]}
    $A.logger.devDebugConsoleLog("ERROR", message, e);
    //#end
    var dispMsg = message;
    var evtArgs = {"message":dispMsg,"error":null,"auraError":null};
    if (e) {
        if (e["handled"]) {
            return;
        } else {
            e["handled"] = true;
        }

        if (e instanceof $A.auraFriendlyError) {
            e.severity = e.severity || this.severity.QUIET;
            evtArgs = {"message":e["message"],"error":e["name"],"auraError":e};
        } else if (e instanceof $A.auraError) {
            var format = "This page has an error. You might just need to refresh it.\n{0}";
            e.severity = e.severity || this.severity["ALERT"];
            var displayMessage = e.message || e.name;
            displayMessage += "\n" + (e["component"] ? "Failing descriptor: {" + e["component"] + "}" : "");
            dispMsg = $A.util.format(format, displayMessage);
            // use null error string to specify non auraFriendlyError type.
            evtArgs = {"message":dispMsg,"error":null,"auraError":e};
        } else {
            // wrap the error with auraError so that systemError event handlers can get it
            e = new $A.auraError(null, e);
            var component = e.findComponentFromStackTrace();
            e.setComponent(component);
            evtArgs = {"message":dispMsg,"error":null,"auraError":e};
        }
    }

    if ($A.initialized) {
        // fire the event later so the current handleError could return even if an error occurs in the event handler.
        window.setTimeout(function() {
            // Determine if error pertains to customer component and fire the appropriate error event
            if ($A.isCustomerError(e)) {
                $A.eventService.getNewEvent('markup://aura:customerError').fire(evtArgs);
            } else {
                $A.eventService.getNewEvent('markup://aura:systemError').fire(evtArgs);
            }
        }, 0);
    } else {
        if ($A.showErrors()) {
            $A.message(dispMsg, e);
        }
    }
};

/**
 * @private
 */
AuraInstance.prototype.isCustomerError = function(e) {
    if (e && e instanceof $A.auraError) {
        if (e["component"]) {
            if ($A.isCustomerComponent(e["component"])) {
                return true;
            } else if (e["componentStack"]) {
                if($A.isCustomerComponentStack(e["componentStack"])) {
                    return true;
                }
            }
        }
        
        // If the stacktraceIdGen includes tracking from a customer file, return true.
        // We assume its a customer file, when the /c/ namespace is included. 
        // Expected matching stacktraceIdGen is ns:component$method$/c/filename.js
        if(e["stacktraceIdGen"] && (/\$\/c\/./g).test(e["stacktraceIdGen"])) {
            return true;
        }
    }
    return false;
};

/**
 * @private
 */
AuraInstance.prototype.isCustomerComponent = function(cmp) {
    if (!$A.util.isEmpty(cmp)) {
        var descriptor = cmp.split("$",1);
        var componentDef = $A.componentService.getComponentDef($A.componentService.createDescriptorConfig(descriptor[0]));
        if (!$A.util.isUndefinedOrNull(componentDef)) {
            var namespace = componentDef.getDescriptor().getNamespace();
            var internal = $A.clientService.isInternalNamespace(namespace);
            var privileged = $A.clientService.isPrivilegedNamespace(namespace);
            if (!$A.util.isEmpty(namespace) && !internal && !privileged) {
                return true;
            }
        }
    }
    return false;
};

/**
 * @private
 */
AuraInstance.prototype.isCustomerComponentStack = function(cmpStack) {
    if (!$A.util.isEmpty(cmpStack)) {
        var stack = cmpStack.split(">");
        // Traverse stack (top down) looking for a customer component
        for (var i = stack.length - 1; i >= 0; i--) {
            var cmp = stack[i];
            if (!$A.util.isUndefinedOrNull(cmp)) {
                // Remove leading/trailing brackets from component descriptor
                cmp = cmp.trim().replace(new RegExp("^\\[|\\]$","g"), "");
                // Check each stack component to determine if it belongs to customer namespace
                if ($A.isCustomerComponent(cmp)) {
                    return true;
                }
            }
        }
    }
    return false;
};

/**
 * Report error to the server after handling it.
 * Note that the method should only be used if try-catch mechanism
 * of error handling is not desired or not functional (ex: in nested promises)
 * @public
 * @param {String} message - The message to display.
 * @param {Error} error - An error object to be included in handling and reporting.
 * @platform
 */
AuraInstance.prototype.reportError = function(message, error) {
    // ignore external errors
    if ($A.logger.isExternalError(error)) {
        return false;
    }

    // for browsers that doesn't have 5th argument (error object) passed in the onerror handler,
    // we use our bookkeeping object this.lastKnownError
    // when there is still no error object, we create a dummy to have client error id.
    error = error ||
        ((this.lastKnownError && message && message.indexOf(this.lastKnownError.message) > -1) ? this.lastKnownError : null) ||
        new $A.auraError("[NoErrorObjectAvailable] " + message);

    $A.handleError(message, error);

    // only report the error to the server if sourceURL is supported
    if ($A.initialized && $A.util.hasSourceURL()) {
        $A.getCallback(function() {
            if (error && message) {
                // if there's extra info in the message that's not in error.message, include it for report.
                if (message !== error.message && message.indexOf(error.message) > -1) {
                    error.message = message + ". Caused by: " + error.message;
                }
            }
            // if error is raised from external code, logging only
            var reportingLevel = $A.logger.isExternalRaisedError(error) ? "WARNING" : "ERROR";
            $A.logger.reportError(error, null, reportingLevel);
        })();
        $A.clientService.postProcess();
    }

    this.lastKnownError = null;
    return true;
};

/**
 * <code>$A.warning()</code> should be used in the case where poor programming practices have been used.
 *
 * These warnings will not, in general, be displayed to the user, but they will appear in the console (if
 * available), and in the aura debug window.
 *
 * @public
 * @param {String} w - The message to display.
 * @param {Error} e - an error, if any.
 * @platform
 */
AuraInstance.prototype.warning = function(w, e) {
    this.logger.warning(w, e);
};

/**
 * Displays an error message to the user. Currently used for displaying errors that do not cause the application to
 * stop completely.
 *
 * @public
 * @param {String} msg The message to display.
 * @param {Error} error object
 * @param {Boolean} showReload whether to show reload button in dialog
 */
AuraInstance.prototype.message = function(msg, error, showReload) {
    if (!this.displayErrors) {
        return;
    }

    var message = $A.util.getElement("auraErrorMessage");
    message.innerHTML = "";
    message.appendChild(document.createTextNode(msg));

    //#if {"excludeModes" : ["PRODUCTION", "PRODUCTIONDEBUG", "PERFORMANCEDEBUG"]}
    if (error && error.stackTrace) {
        var auraErrorStack = $A.util.getElement("auraErrorStack");
        auraErrorStack.innerHTML = "";
        var stack = error.stackTrace;

        if (stack.trim) {
            stack = stack.trim();
        } else if ($A.util.isArray(stack)) {
            for (var i = 0; i < stack.length; i++) {
                stack[i] = stack[i].trim();
            }
            stack = stack.join("\n");
        }
        auraErrorStack.appendChild(document.createTextNode(stack));
    }
    //#end

    $A.util.removeClass(document.body, "loading");

    if (showReload) {
        $A.util.addClass($A.util.getElement("auraErrorReload"), "show");
    }

    $A.util.addClass($A.util.getElement("auraErrorMask"), "auraForcedErrorBox");
};

/**
 * Returns a callback which is safe to invoke from outside Aura, e.g. as an event handler or in a setTimeout.
 * The $A.getCallback() call ensures that the framework rerenders the modified component
 * and processes any enqueued actions.
 * @public
 * @function
 * @param {Function} callback - The method to call after reestablishing Aura context.
 * @platform
 */
AuraInstance.prototype.getCallback = function(callback) {
    $A.assert($A.util.isFunction(callback),"$A.getCallback(): 'callback' must be a valid Function");
    var context=$A.clientService.currentAccess;
    function callbackWrapper(){
        $A.clientService.setCurrentAccess(context);
        $A.clientService.pushStack("$A.getCallback()");
        try {
            return callback.apply(this,Array.prototype.slice.call(arguments));
        } catch (e) {
            // no need to wrap AFE with auraError as
            // customers who throw AFE would want to handle it with their own custom experience.
            if (e instanceof $A.auraError) {
                throw e;
            } else {
                // create a synthetic stack frame for errors from callback wrapped in $A.getCallback called by Action.finishAction
                // because Safari 10/iOS Webview doesn't provide function name in stack.
                var syntheticStackFrame = "";
                if (arguments.length === 2) {
                    var action = arguments[0];
                    if ($A.util.isAction(action)) {
                        var actionDef = action.getDef();
                        if (actionDef) {
                            syntheticStackFrame = actionDef.getDescriptor().toString();
                        }
                    }
                    var actionComponent = arguments[1];
                    var actionComponentDefDescriptor = null;
                    if ($A.util.isComponent(actionComponent)) {
                        var actionComponentDef = actionComponent.getDef();
                        if (actionComponentDef) {
                            actionComponentDefDescriptor = actionComponentDef.getDescriptor().toString();
                        }
                    }

                    if (syntheticStackFrame) {
                        syntheticStackFrame = syntheticStackFrame + (actionComponentDefDescriptor ? ("@" + actionComponentDefDescriptor) : "") + "\n";
                    }
                }

                var errorWrapper = new $A.auraError("Error in $A.getCallback()", e);
                if (syntheticStackFrame) {
                    errorWrapper.setStackTrace(syntheticStackFrame + errorWrapper.stackTrace);
                }
                $A.lastKnownError = errorWrapper;
                throw errorWrapper;
            }
        } finally {
            $A.clientService.popStack("$A.getCallback()");
            $A.clientService.releaseCurrentAccess();
        }
    }
    if(callback.reference&&callback.toString()===callbackWrapper.toString()){ // don't double-wrap
        return callback;
    }
    callbackWrapper.reference=callback;
    return callbackWrapper;
};

/*
* Allows for non-blocking action dispatch while executing cpu-bound code.
* Synchronous code run in the callback passed to this method will allow server actions to
* be dispatched immediately, without waiting for a boxcar at the end of the thread.
*
* @function
* @param {Function} callback The method to invoke while allowing actions to flow out as they occur.
* @export
* @experimental
* */
AuraInstance.prototype.executeHotspot=function(callback){
    if(!$A.util.isFunction(callback)){
        throw new Error("$A.executeHotspot: 'callback' must be a valid Function.");
    }
    this.clientService.allowFlowthrough=true;
    try {
        callback();
    }finally{
        this.clientService.allowFlowthrough=false;
    }
};

/**
 * Returns the application configuration token referenced by name.
 * A tokens file is configured with the tokens attribute in the aura:application tag.
 *
 * @function
 * @param {String} token - The name of the application configuration token to retrieve, for example, <code>$A.getToken("section.configuration")</code>.
 *
 * @platform
 */
AuraInstance.prototype.getToken = function(token){
    var context=$A.getContext();
    var tokens=context&&context.getTokens();
    if(tokens){
        if(tokens.hasOwnProperty(token)){
            return tokens[token];
        }
        throw new $A.auraError("Unknown token: '"+token+"'. Are you missing a tokens file or declaration?");
    }
};

/**
 * Returns a service registered by the application.
 *
 * @function
 * @param {String} name - The name of the service registered during application startup, for example, <code>$A.getService("metrics")</code>.
 *
 * @export
 */
AuraInstance.prototype.getService = function(name) {
    return this.injectedServices[name];
};

/**
 * Returns the value referenced using property syntax. Gets the value from the specified global value provider.
 * @public
 * @function
 * @param {String} key - The data key to look up on element, for example, <code>$A.get("$Label.section.key")</code>.
 * @param {Function} [callback] - The method to call with the result if a server trip is expected.
 * @platform
 */
AuraInstance.prototype.get = function(key, callback) {
// JBUCH: TODO: FIXME
//    if(callback){
//        throw new Error("Remove Me!");
//    }
    key = $A.expressionService.normalize(key);
    var path = key.split('.');
    var root = path.shift();
    var valueProvider = $A.services[root] || $A.getValueProvider(root);
    if (valueProvider) {
        if (path.length) {
            if (valueProvider.get) {
                return valueProvider.get(path.join('.'), callback);
            } else {
                return $A.expressionService.resolve(path, valueProvider);
            }
        }
        return valueProvider.getValues ? valueProvider.getValues() : valueProvider;
    }

};

/**
 * Sets the value referenced using property syntax on the specified global value provider.
 * @public
 * @function
 * @param {String} key - The data key we want to change on the global value provider, for example, <code>$A.set("$Custom.something","new value")</code>.
 * @param {Object} value - The value to set the key location to. If the global value provider does not implement .set(), this method will throw an exception.</code>.
 * @platform
 */
AuraInstance.prototype.set = function(key, value) {
    key = $A.expressionService.normalize(key);
    var path = key.split('.');
    var root = path.shift();
    var valueProvider = $A.getValueProvider(root);
    if(!valueProvider){
        $A.assert(false, "Unable to set value for key '" + key + "'. No value provider was found for '" + root + "'.");
    }
    if(!valueProvider["set"]){
        $A.assert(false, "Unable to set value for key '" + key + "'. Value provider does not implement 'set(key, value)'.");
    }
    var oldValue=$A.get(key);
    var result=valueProvider["set"](path.join('.'), value);
    $A.expressionService.updateGlobalReference(key,oldValue,value);
    return result;
};


/**
 * Returns a live reference to the global value indicated using property syntax.
 *
 * @param {String} key - The data key for which to return a reference.
 * @return {PropertyReferenceValue}
 * @public
 * @platform
 * @export
 */
AuraInstance.prototype.getReference = function(key) {
    return $A.expressionService.getReference(key);
};

Aura.OverrideMap$Instance = undefined;

/**
 * Override a function in aura.
 *
 * This should only be available to plugins, and only works on functions designed for this purpose.
 *
 * @param {string} name the name of the override point
 * @param {Function} fn the function to insert in the chain.
 * @param {Object} scope a scope for invoking the function.
 * @param {number} priority a priority for the function (0 = highest -> first, 100 = lowest ->last, default 50)
 * @public
 */
AuraInstance.prototype.installOverride = function(name, fn, scope, priority) {
    if (Aura.OverrideMap$Instance === undefined) {
        Aura.OverrideMap$Instance = new Aura.OverrideMap();
    }
    if (priority === undefined) {
        priority = 50;
    }
    var override = Aura.OverrideMap$Instance.map[name];
    if (!override) {
        throw new $A.auraError("$A.installOverride: Invalid name: "+name, null, $A.severity.QUIET);
    }
    $A.assert(fn && $A.util.isFunction(fn), "Function must be a defined function");
    override.install(fn, scope, priority);
};

/**
 * Remove an override in aura.
 *
 * @public
 */
AuraInstance.prototype.uninstallOverride = function(name, fn) {
    if (Aura.OverrideMap$Instance === undefined) {
        Aura.OverrideMap$Instance = new Aura.OverrideMap();
    }
    var override = Aura.OverrideMap$Instance.map[name];
    if (!override) {
        throw new $A.auraError("$A.uninstallOverride: Invalid name: "+name, null, $A.severity.QUIET);
    }
    override.uninstall(fn);
};

/**
 * Gets the root component or application. For example, <code>$A.getRoot().get("v.attrName");</code> returns the attribute from the root component.
 * @public
 * @function
 * @platform
 * @export
 */
AuraInstance.prototype.getRoot = function() {
    return this.root;
};

/**
 * @private
 */
AuraInstance.prototype.setRoot = function(root) {
    this.root = root;
};

/**
 * Gets the current <code>AuraContext</code>. The context consists of the mode, descriptor, and namespaces to be loaded.
 *
 * @public
 * @function
 * @return {AuraContext} current context
 */
AuraInstance.prototype.getContext = function() {
    return this.context;
};

/**
 * Deprecated. Use <code>getCallback()</code> instead.
 * Runs a function within the standard Aura lifecycle.
 *
 * This ensures that <code>enqueueAction</code> methods and rerendering are handled properly
 * from JavaScript outside of controllers, renderers, providers.
 * @param {Function} func The function to run.
 * @param {String} name an optional name for the stack.
 * @public
 * @platform
 * @deprecated Use <code>getCallback()</code> instead.
 */
AuraInstance.prototype.run = function(func, name) {
    $A.assert(func && $A.util.isFunction(func), "The parameter 'func' for $A.run() must be a function!");
    if (name === undefined) {
        name = "$A.run()";
    }
    var nested = $A.clientService.inAuraLoop();

    $A.clientService.pushStack(name);
    try {
        return func();
    } catch (e) {
        // no need to wrap AFE with auraError as customers who throw AFE would want to handle it with their own custom experience.
        if (nested || e instanceof $A.auraFriendlyError) {
            throw e;
        } else {
            throw (e instanceof $A.auraError) ? e : new $A.auraError("Uncaught error in "+name, e);
        }
    } finally {
        $A.clientService.popStack(name);
    }

    return undefined;
};

/**
 * Checks the condition and if the condition is false, displays an error message.
 *
 * Displays an error message if condition is false, runs <code>trace()</code> and stops JS execution. The
 * app will cease to function until reloaded if this is called, and errors are not caught.
 * Internal assertion, should never happen
 * <p>For example, <code>$A.assert(cmp.get("v.name") , "The name attribute is required.");</code> checks for the name attribute.
 *
 * This is protected as it is an internal assertion, should never happen.
 *
 * @param {Boolean} condition True prevents the error message from being displayed, or false otherwise.
 * @param {String} assertMessage A message to be displayed when condition is false
 */
AuraInstance.prototype.assert = function(condition, assertMessage) {
    this.logger.logAssert(condition, assertMessage);
};

/**
 * Checks for a specified user condition, only to be used for fatal errors!. Displays an error message if condition is
 * false, and stops JS execution. The app will cease to function until reloaded if this is called.
 *
 * @param {Boolean} condition The conditional expression to be evaluated.
 * @param {String} msg The message to be displayed when the condition is false.
 * @public
 */
AuraInstance.prototype.userAssert = function(condition, msg) {
    // For now use the same method
    $A.assert(condition, msg);
};

/**
 *  Logs to the browser's JavaScript console if it is available.
 *  This method doesn't log in PROD or PRODDEBUG modes.
 *  If both value and error are passed in, value shows up in the console as a group with value logged within the group.
 *  If only value is passed in, value is logged without grouping.
 *  <p>For example, <code>$A.log(action.getError());</code> logs the error from an action.</p>
 *
 * @public
 * @param {Object} value - The object to log.
 * @param {Object} error - The error messages to be logged in the stack trace.
 * @platform
 */
AuraInstance.prototype.log = function(value, error) {
    this.logger.info(value, error);
};

/**
 * Logs a stack trace. Trace calls using <code>console.trace()</code> if defined on the console implementation.
 * @public
 */
AuraInstance.prototype.trace = function() {
    if (window["console"] && window["console"]["trace"]) {
        window["console"]["trace"]();
    }
};

/*
 * Called from methods that have entered or are entering the deprecation pipeline. Provides first warnings, then errors to developers.
 * When possible, includes a workaround for the behavior or method being deprecated.
 *
 * It reports the deprecation usages to server if reportSignature is provided.
 *
 * @param {String} message - The message to provide the developer indicating the method or behavior which has been or is being deprecated.
 * @param {String} workaround - Any known or suggested workaround to accomplish the behavior being deprecated.
 * @param {String} reportSignature - The deprecated function name if deprecating an API, or function signature if deprecating a function signature.
 *
 * @private
 * */
AuraInstance.prototype.deprecated = function(message, workaround, reportSignature) {

    // JBUCH: TEMPORARILY IGNORE CALLS BY ui: and aura: NAMESPACES.
    // REMOVE WHEN VIEW LOGIC IS COMPILED WITH FRAMEWORK.
    var callingCmp = $A.clientService.getCurrentAccessName();
    if (/^(ui|aura):\w+$/.test(callingCmp)) {
        return;
    }

    // JBUCH: TEMPORARILY IGNORE CALLS BY FRAMEWORK.
    // REMOVE WHEN ALL @public METHODS HAVE BEEN ADDRESSED.
    var callStack = new Error().stack;
    // skip if no stack info, due to perf. (IE)
    if (!callStack) {
        return;
    }

    // TODO: This filter may have false positive when a function is installed a override
    // In most cases, the stack strace is formatted as:
    //      Error: error message
    //          at AuraInstance.$deprecated$
    //          at [The Deprecated API]
    //          at [The Caller]
    var frames = callStack.split('\n', 5);
    var caller = frames[3];
    if (!caller) {
        return;
    }
    // if the caller is wrapped by locker
    if (caller.indexOf("Proxy.SecureFunction") > -1) {
        caller = frames[4];
    }

    if (caller.indexOf("/aura_") > -1) {
        return;
    }

    //#if {"excludeModes" : ["PRODUCTION"]}
    if (workaround) {
        message += ". Workaround: " + workaround;
    }
    $A.warning("Deprecation warning: " + message);
    //#end


    //#if {modes: ["PRODUCTION", "PRODUCTIONDEBUG", "PERFORMANCEDEBUG"]}
    // skip reporting, if there's no reporting signature.
    if (reportSignature) {
        var reporting = false;
        var callers = this.deprecationUsages[reportSignature];
        if (callers === undefined) {
            callers = [];
            this.deprecationUsages[reportSignature] = callers;
            // reporting when the deprecated API gets called for the first time
            reporting = true;
        }

        // caller component will be missing if the caller is not in Aura loop
        callers.push(callingCmp || caller.trim() || "UNKNOWN");

        // reporting when a deprecated API gets called 5 times
        if (reporting || callers.length === 5) {
            // Caboose action
            var reportAction = $A.get("c.aura://ComponentController.reportDeprecationUsages");
            reportAction.setParams({
                "usages": $A.util.apply({}, this.deprecationUsages)
            });
            reportAction.setCaboose();

            $A.clientService.enqueueAction(reportAction);

            for (var api in this.deprecationUsages) {
                this.deprecationUsages[api] = [];
            }
        }
    }
    //#end
};

/**
 * Sets mode to production (default), development, or testing.
 *
 * @param {String} mode Possible values are production "PROD", development "DEV", or testing "PTEST".
 * @private
 */
AuraInstance.prototype.setMode = function(mode) {
    this.mode = mode;
    this.enableAssertions = (mode !== 'PROD' && mode !== 'PTEST');
};

/**
 * Get GVP directly.
 * @param {String} type The type of global value provider to retrieve.
 * @return {GlobalValueProvider} The global value provider, such as $Label, $Browser, $Locale, etc.
 *
 * @private
 */
AuraInstance.prototype.getValueProvider = function(type) {
    return this.getContext().getGlobalValueProvider(type);
};

/**
 * Add a new Global Value Provider.
 * @param {String} type The type of global value provider to add. Types must start with a '$', and may not use reserved
 *                      types, such as '$Label', '$Browser', or '$Locale'
 * @param {ValueProvider} The global value provider. This can either implement a '.get(expression)' and
 *                               optional '.set(expression, value)' method, or simply be an instance of an Object.
 *
 * @public
 */
AuraInstance.prototype.addValueProvider=function(type,valueProvider){
    $A.assert($A.util.isString(type),"$A.addValueProvider(): 'type' must be a valid String.");
    $A.assert(type.charAt(0)==='$',"$A.addValueProvider(): 'type' must start with '$'.");
    $A.assert(",$browser,$label,$locale,".indexOf(","+type.toLowerCase()+",")===-1,"$A.addValueProvider(): '"+type+"' is a reserved valueProvider.");
    $A.assert(!$A.util.isUndefinedOrNull(valueProvider),"$A.addValueProvider(): 'valueProvider' is required.");
    var context=this.getContext();
    if(context){
        $A.assert(this.getValueProvider(type)==null,"$A.addValueProvider(): '"+type+"' has already been registered.");
        context.addGlobalValueProvider(type,valueProvider);
    }else{
        $A.assert(this.globalValueProviders[type]==null,"$A.addValueProvider(): '"+type+"' has already been registered.");
        this.globalValueProviders[type]=valueProvider;
    }
};

/**
 * Gets the event or component definition. If it is not currently on the client, we will access the server to attempt to retrieve it.
 *
 * @public
 *
 * @param  {String}   descriptor Descriptor in the pattern prefix:name or markup://prefix:name. Use e.prefix:name, or markup://e.prefix:name for an event definition.
 * @param  {Function} callback   Function whos first parameter is the requested definition if it exists. Otherwise the first parameter is null.
 * @return undefined
 */
AuraInstance.prototype.getDefinition = function(descriptor, callback) {
    $A.assert($A.util.isString(descriptor), "'descriptor' must be an event or component descriptor such as 'prefix:name' or 'e.prefix:name'.");
    $A.assert($A.util.isFunction(callback), "'callback' must be a valid function.");

    if (this.getContext().uriAddressableDefsEnabled) {
        $A.getDefinitions([descriptor], function unpackDefinition(defs){
            callback(defs[0]);
        });
        return;
    }

    if(descriptor.indexOf("e.") !== -1) {
        this.eventService.getDefinition(descriptor, callback);
        return;
    }
    this.componentService.getDefinition(descriptor, callback);
};

/**
 * Similar to $A.getDefinition() will retrieve an array of definitions at one time. Optimal if you expect them not to be available on the client.
 * @public
 * @param  {Array}   descriptors An Array of Descriptors in the format expected by $A.getDefinition() can be a mix of events and component descriptors.
 * @param  {Function} callback   Function whos first parameter is an array of the definitions requested. Some definitions may be null, which are those definitions you don't have access to or did not exist.
 * @return undefined             Always use the callback to access the definitions you requested.
 */
AuraInstance.prototype.getDefinitions = function(descriptors, callback) {
    $A.assert($A.util.isArray(descriptors), "'descriptors' must be an array of definition descriptors to retrieve.");
    $A.assert($A.util.isFunction(callback), "'callback' must be a valid function.");

    if (this.getContext().uriAddressableDefsEnabled) {
        var that = this;
        var idx;
        var descriptorMap = {};
        for (idx=0; idx < descriptors.length; idx++) {
            var desc = descriptors[idx];
            if(desc) {
                var eventIndex = desc.indexOf("e.");
                if (eventIndex !== -1) {
                    desc = desc.substr(eventIndex + 2);
                    descriptors[idx] = desc;
                }
                descriptorMap[desc] = undefined;
            }
        }
        this.componentService.loadComponentDefs(descriptorMap, $A.getCallback(function collectDefinitions(){
            var definitions = [];
            for (idx=0; idx < descriptors.length; idx++) {
                definitions.push(that.componentService.getDefinitionOfAnyType(descriptors[idx]));
            }
            callback(definitions);
        }));
        return;
    }

    var pendingMap = {};
    var returnDefinitions = [];
    var requestDefinitions = [];
    var descriptor;
    var def;
    var isEvent;
    for(var c=0,length=descriptors.length;c<length;c++) {
        descriptor = descriptors[c];
        if(descriptor && descriptor.indexOf("e.") !== -1) {
            descriptor = descriptor.replace("e.", "");
            isEvent = true;
            def =this.eventService.getDef(descriptor);
        } else {
            def = this.componentService.getDef(descriptor);
            isEvent = false;
        }
        if(def) {
            returnDefinitions[c] = def;
        } else {
            // detect without access checks
            if((isEvent && !this.eventService.getEventDef(descriptor)) ||
                (!isEvent && !this.componentService.getComponentDef(this.componentService.createDescriptorConfig(descriptor)))) {

                requestDefinitions.push(descriptors[c]);
                pendingMap[descriptor] = {
                    "position": c,
                    "isEvent": isEvent
                };
            } else {
                returnDefinitions[c] = null;
            }
        }
    }

    if(!requestDefinitions.length) {
        callback(returnDefinitions);
    } else {
        var action = $A.get("c.aura://ComponentController.getDefinitions");
        action.setParams({
            "names": requestDefinitions
        });
        action.setCallback(this, function getDefintions$callback() {
            //$A.assert(action.getState() === 'SUCCESS', "Definition '" + descriptor + "' was not found on the client or the server.");
            // We use getDef at the moment so we do the access check.
            //executeCallbackcallback(this.getDef(descriptor));
            //var returnValue = action.getReturnValue();
            var pendingInfo;
            for(var requestedDescriptor in pendingMap) {
                if(pendingMap.hasOwnProperty(requestedDescriptor)) {
                    pendingInfo = pendingMap[requestedDescriptor];
                    if(pendingInfo["isEvent"]) {
                        returnDefinitions[pendingInfo["position"]] = this.eventService.getDef(requestedDescriptor) || null;
                    } else {
                        returnDefinitions[pendingInfo["position"]] = this.componentService.getDef(requestedDescriptor) || null;
                    }
                }
            }
            callback(returnDefinitions);
        });

        $A.enqueueAction(action);
    }
};

/**
 * Detect if a definition is present on the client. May still exist on the server.
 * @public
 * @param  {String}   descriptor Descriptor in the pattern prefix:name. Use e.prefix:name for an event definition.
 * @return {Boolean}             True if the definition is present on the client.
 */
AuraInstance.prototype.hasDefinition = function(descriptor) {
    $A.assert($A.util.isString(descriptor), "'descriptor' must be an event or component descriptor such as 'prefix:name' or 'e.prefix:name'.");

    if(descriptor.indexOf("e.") !== -1) {
        return this.eventService.hasDefinition(descriptor.replace("e.", ""));
    }
    return this.componentService.hasDefinition(descriptor);
};

// #include aura.util.PerfShim
AuraInstance.prototype.Perf = window['Perf'] || PerfShim;

// #include aura.Aura_export
