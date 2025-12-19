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
 * AuraXHR: struct used to represent a connection.
 *
 * @private
 */
Aura.Services.AuraClientServiceMarker = 0;

Aura.Services.AuraClientService$AuraXHR = function AuraXHR() {
    this.allowFlowthrough=false;
    this.length = 0;
    this.marker = 0;
    this.request = undefined;
    this.actions = {};
};

/**
 * Reset the xhr.
 */
Aura.Services.AuraClientService$AuraXHR.prototype.reset = function() {
    this.request = undefined;
    this.actions = {};
};

/**
 * add an action.
 */

Aura.Services.AuraClientService$AuraXHR.prototype.addAction = function(action) {
    if (action) {
        if (this.actions[""+action.getId()]) {
            throw new $A.auraError("Adding duplicate action", null, $A.severity.QUIET);
        }
        this.actions[""+action.getId()] = action;
    }
};

/**
 * get an action for a response.
 */
Aura.Services.AuraClientService$AuraXHR.prototype.getAction = function(id) {
    var action;
    var key = id;

    if (!key) {
        var keys = Object.keys(this.actions);

        $A.assert(keys.length === 1, "When no ID is specified, there should only be one action in the XHR.");

        if (keys.length === 1) {
            key = keys[0];
        }
    }

    action = this.actions[key];

    if (action) {
        this.actions[key] = undefined;
    }

    return action;
};

/**
 * A handy structure to hold data.
 *
 * @private
 */
Aura.Services.AuraClientService$AuraActionCollector = function AuraActionCollector() {
    // Collected client actions for execution.
    this.clientActions = [];
    this.clientIndex = 0;

    // collected server actions to send.
    this.actionsToCollect = 0;
    this.collected = [];
    this.collecting = [];

    // collected server actions to complete (stored)
    this.actionsToComplete = [];
    this.completionIndex = 0;

    this.collectedStorableActions = [];

    // server actions completed.
    this.actionsCompleted = 0;
};


/**
 * @description The Aura Client Service, accessible using <code>$A.clientService</code>.
 *
 * There be dragons here.
 *
 * Manage the queue of actions sent to the server.
 *
 * Queue Processing Notes:
 *  * The queue is processed synchronously, but almost all of the interesting functionality occurs asynchronously.
 *  * client actions are run in a single flow of setTimeout calls.
 *  * storable server actions get processed in the "then" clause of the promise
 *  * non-storable server actions are processed synchronously.
 *
 * Input conditions:
 * We have a queue of actions that are inserted vie enqueueAction.
 *
 * Dangers:
 *  * Race conditions.
 *  * caboose actions.
 *  * problems with storage.
 *  * complexity of code due to asynchronicity.
 *
 * Tradeoffs:
 *  * number of actions boxcarred.
 *  * actions in flight
 *  * sending XHR early vs. late.
 *
 * Processing Loop:
 *  * gather actions into a collector.
 *  * walk each action, queueing up server actions to retrieve from storage and client actions to execute.
 *  * execute client actions with setTimeout(0) to allow server actions to complete.
 *  * As server actions come back from storage, queue up for execution, and queue refresh actions to refresh.
 *  * After all actions collect, check for further actions in the queue, restart loop if there are some.
 *  * Once we have finished processing all actions, check for actions to be put in an XHR.
 *    + All foreground actions go in a single XHR, and are de-duped on send.
 *    + background actions are sent one per XHR, with a de-dupe step during the queue walk.
 *    + deferred actions are sent if we are idle, with a de-dupe step during the queue walk.
 *
 * Queues:
 *  * actionsQueued - queue of actions that have yet to be processed.
 *  * actionsDeferred - actions that have been processed through storage, but need to go to the server.
 *
 * @constructor
 * @export
 */
function AuraClientService (util) {
    this._host = "";
    this._token = null;
    this._isDisconnected = false;
    this._parallelBootstrapLoad = true;
    this.authorizationToken = undefined;
    this.auraStack = [];
    this.actionStorage = new Aura.Controller.ActionStorage();
    this.appcacheDownloadingEventFired = false;
    this.isOutdated = false;
    this.finishedInitDefs = false;
    this.protocols={"layout":true};
    this.lastSendTime = Date.now();

    this.moduleServices = {};
    this.moduleScopedImports = {
        "salesforce": this.defaultSalesforceImportResolver,
        "babel": this.babelHelpersResolver
    };
    this.cssVars = {}; // To support custom variables in IE11 we need to serialized them to the client
    this.moduleScopedImportsCache = {};

    // TODO: @dval We should send this from the server, but for LightningOut apps is a non-trivial change,
    // so for the time being I hard-coded the resource path here to ensure we can lazy fetch them.
    this.clientLibraries = {
        "ckeditor": { resourceUrl : "/auraFW/resources/{fwuid}/ckeditor/ckeditor-4.x/rel/ckeditor.js" },
        "quill": { resourceUrl : "/auraFW/resources/{fwuid}/quill.js" }
    };
    this.clientLibraryLoadsInProgress = 0;

    // Access Control
    this.accessStack=[];
    this.registeredNamespaces={internal:{},privileged:{}};
    this.currentAccess=null;
    this.enableAccessChecks=true;
    this.logAccessFailures= true
                            // Logging off by default in PROD mode
                            // #if {"modes" : ["PRODUCTION"]}
                            && false
                            // #end
                            ;

    // whether an appcache error event has been received
    this.appCacheError = false;

    // This will be only changed after the unload event
    this._appNotTearingDown = true;

    // XHR timeout (milliseconds)
    this.xhrTimeout = undefined;

    // bootstrap.js value used to boot the app. populated after a bootstrap version
    // is successfully loaded, processed, and merged.
    this.appBootstrap;

    // cookie name to force boostrap.js to the server (aka skip cache). done as a cookie so the server
    // can set this flag if ever required.
    this._disableBootstrapCacheCookie = "auraDisableBootstrapCache";

    // appcache progress.
    // = -1 on app cache error state.
    // = 0 on initial page load state or if appcache is not in use.
    // otherwise ranges from 0 to 100.
    this.appCacheProgress = 0;
    this.appCacheUpdateCount = 0;

    this.NOOP = function() {};

    var auraXHR = new Aura.Services.AuraClientService$AuraXHR();
    this.availableXHRs = [ auraXHR ];
    this.allXHRs = [ auraXHR ];
    this.actionStoreMap = {};
    this.collector = undefined;
    // if true will use one XHR to send each action (to be used with HTTP/2)
    this.xhrExclusivity = false;
    this.bootstrapInlined = false;

    this.actionsQueued = [];
    this.actionsDeferred = [];

    // guess at xhr type.
    if (window.XMLHttpRequest) {
        this.httpType = 'generic';
    } else {
        this.httpType = undefined;
    }

    this._disconnected = undefined;

    // queue of functions to run when no XHRs in flight
    this.xhrIdleQueue = [];

    //
    // Run client actions synchronously. This is the previous behaviour.
    //
    this.optionClientSynchronous = true;

    this.reloadFunction = undefined;
    this.reloadPointPassed = false;

    // Shares token data across tabs to prevent unneeded page reloads.
    this.tokenSharing = util && util.isLocalStorageEnabled();
    this.maxActionRetries = 4;

    this.handleAppCache();
    this.setupBootstrapErrorReloadButton();
    this.setupTokenListener();
}

/**
 * Storage key for CSRF token.
 * TODO W-2531907 - Get/set done directly against the adapter because pre-200 non-Aura clients modified this value
 * direclty in SSA prior to Aura booting. Instead Aura should handle CSRF/invalid session issues, then this key/value
 * can operate against AuraStorage.
 * TODO W-2481519 - use a dedicated storage (not actions) for this framework-internal data to avoid eviction blocklists
 * in every adapter.
 */
AuraClientService.TOKEN_KEY = "$AuraClientService.token$";

/**
 * Storage key for bootstrap.js
 * TODO W-2481519 - use a dedicated storage (not actions) for this framework-internal data to avoid eviction blocklists
 * in every adapter.
 */
AuraClientService.BOOTSTRAP_KEY = "$AuraClientService.bootstrap$";

/**
 * Duration (in milliseconds) to check for boot progress. If progress is not seen after
 * this duration then reload the page.
 */
AuraClientService.BOOT_TIMER_DURATION = 30000;

/**
 * Number of consecutive reloads without fwk + app finishing the boot sequence. When this is exceeded
 * the user is notified of an error and prompted to reload.
 */
AuraClientService.INCOMPLETE_BOOT_THRESHOLD = 5;

/**
 * Query parameter to ensure a server trip even with appcache enabled. Servlet performs
 * prerequisite check (eg valid sid) then redirects back to app on success or elsewhere
 * on failure.
 */
AuraClientService.CACHE_BUST_QUERY_PARAM = "nocache";

/**
 * The status to return to action postprocess when receiving a response with system exception event
 */
AuraClientService.SYSTEM_EXCEPTION_EVENT_RETURN_STATUS = "SYSTEMERROR";

/**
 * The status to return to action postprocess when receiving a response with invalid session
 */
AuraClientService.INVALID_SESSION_RETURN_STATUS = "INVALIDSESSION";

/**
 * Reserved token that the server responds with in the case that a new TOKEN
 * cannot be issued.
 */
AuraClientService.INVALID_CSRF = "invalid_csrf";

/**
 * Framework + app reload counter to detect and prevent infinite reloads.
 *
 * Counter is cleared when Aura Framework finishes app instantiation. Counter is
 * tracked in sessionStorage so it's per-tab.
 */
AuraClientService.CONSECUTIVE_RELOAD_COUNTER_KEY = "__RELOAD_COUNT";

/**
 * fwuid used when logging a bootstrap error and context was not initialized
 */
AuraClientService.UNKNOWN_FRAMEWORK_UID = "UNKNOWN";

/**
 * Maximum length for action request query strings.
 */
AuraClientService.MAX_ACTION_QUERY_LENGTH = 1000;

/**
 * set the XHR queue size.
 *
 * This is a one time set for the queue size. Any further attempts will be ignored.
 * This should become a configuration parameter at some point.
 *
 * @private
 */
AuraClientService.prototype.setQueueSize = function(queueSize) {
    var auraXHR;
    if (queueSize === undefined) {
        // use default value if config doesn't specify it, i.e. lightning out
        queueSize = 4;
    }
    if (queueSize < 2) {
        throw new $A.auraError("number of XHRs must be at least 2, is " + queueSize, null, $A.severity.QUIET);
    }
    if (this.allXHRs.length === 1) {
        for (var i = 1; i < queueSize; i+= 1) {
            auraXHR = new Aura.Services.AuraClientService$AuraXHR();
            this.availableXHRs.push(auraXHR);
            this.allXHRs.push(auraXHR);
        }
    }
};

/**
 * set xhrExclusivity, if true will use one XHR to send each action (to be used with HTTP/2)
 *
 * @private
 */
AuraClientService.prototype.setXHRExclusivity = function(xhrExclusivity) {
    if (xhrExclusivity === undefined) {
        // use default value if config doesn't specify it, i.e. lightning out
        xhrExclusivity = false;
    }
    this.xhrExclusivity = xhrExclusivity;
};

/**
 * When bootstrap is inlined, there will not be a separate request to load bootstrap.js instead its content
 *  - will be inlined with inline.js content, which is either part of the app template(if the client supports CSP2) or as an external javascript resource.
 *  - will not be cached in persistent storage such as indexDb.
 *  - will be persisted in app cache(if the app have a manifest) for offline use and gets invalidated when AuraContext changes.
 *
 * @private
 */
AuraClientService.prototype.setBootstrapInlined = function(bootstrapInlined) {
    this.bootstrapInlined = !!bootstrapInlined;
};


/**
 * Mark all currently queued (but not sent) actions as 'deferred'.
 *
 * This is intended for use when components are kept 'alive' after they are no longer on the screen for better
 * performance going back and forth between various displays.
 */
AuraClientService.prototype.deferPendingActions = function() {
    var i;
    var action;

    for (i = 0; i < this.actionsQueued.length; i++) {
        action = this.actionsQueued[i];
        if (action) {
            action.setDeferred();
        }
    }
    for (i = 0; i < this.actionsDeferred.length; i++) {
        action = this.actionsDeferred[i];
        if (action) {
            action.setDeferred();
        }
    }
    if (this.collector) {
        for (i = 0; i < this.collector.collecting.length; i++) {
            action = this.collector.collecting[i];
            if (action) {
                action.setDeferred();
            }
        }
    }
};

AuraClientService.prototype.setCssVars = function (cssVars) {
    if (cssVars) {
        this.cssVars = cssVars;
    }
};

/**
 * @private
 */
AuraClientService.prototype.getSourceMapsUrl = function (descriptor, type) {
    if (window.location) {
        var splitChar = ':';
        var folder = '/components/';

        if (type === 'lib') {
            splitChar = '.';
            folder = '/libraries/';
        }

        var parts = descriptor.split('://').pop().split(splitChar);
        return [window.location.origin, folder, parts.join('/'),'.js'].join('');
    }
};

/**
 * @private
 */
AuraClientService.prototype.uncommentExporter = function (exporter) {
    exporter = exporter.toString();
    var start = exporter.indexOf('/*') + 2;
    var end = exporter.lastIndexOf('*/');
    return start < 0 || end < start ? exporter : exporter.substr(start, end - start);
};

/**
 * @private
 */
AuraClientService.prototype.evalExporter = function(script, descriptor, type) {
    return $A.util.globalEval("function () {" + script + " }", this.getSourceMapsUrl(descriptor, type));
};

/**
 * Take a json (hopefully) response and decode it. If the input is invalid JSON, we try to handle it gracefully.
 *
 * @param {XmlHttpRequest} response the XHR object.
 * @param {Boolean} [timedOut] true if the XHR timed out; false otherwise.
 * @returns {Object} An object with properties 'status', which represents the status of the response, and potentially
 *          'message', which contains the decoded server response or an error message.
 */
AuraClientService.prototype.decode = function(response, timedOut) {
    var ret = {};

    var e;

    // timed out or failure to communicate with server
    if (timedOut || this.isDisconnectedOrCancelled(response)) {
        this.setConnected(false);
        ret["status"] = "INCOMPLETE";
        return ret;
    }

    //
    // If a disconnect event was previously fired, fire a connection
    // restored event
    // now that we have a response from a server.
    //
    if (this._isDisconnected) {
        e = $A.eventService.getNewEvent("markup://aura:connectionResumed");
        if (e) {
            this._isDisconnected = false;
            e.fire();
        }
    }

    var text = response["responseText"];

    if (/^\s*</.test(text)) {
        //
        // This is what happens when someone hands us a pile of HTML
        // instead of JSON. There is no real hope of dealing with it,
        // so just flag an error, and carry on.
        //
        //#if {"excludeModes" : ["PRODUCTION", "PRODUCTIONDEBUG", "PERFORMANCEDEBUG"]}
        ret["message"] = "Communication error, invalid JSON: " + text;
        // #end
        // #if {"modes" : ["PRODUCTION", "PRODUCTIONDEBUG", "PERFORMANCEDEBUG"]}
        ret["message"] = "Communication error, please retry or reload the page";
        // #end
        ret["status"] = "ERROR";
        return ret;
    }

    //
    // server-side explosion. The new message is one where there is an /*ERROR*/ appended.
    // this allows us to deal with the fact that we can get errors after the send has started.
    // Of course, we also have the problem that we might not have valid JSON at all, in which case
    // we have further problems...
    //
    var status = response["status"];
    if ((status !== 200) || $A.util.stringEndsWith(text, "/*ERROR*/")) {
        if (status === 200) {
            // if we encountered an exception once the response was committed
            // strip the malformed JSON
            text = text.substring(text.indexOf("*/")+2,text.lastIndexOf("/*"));
        }

        var resp = $A.util.json.decode(text);

        // if the error on the server is meant to trigger a client-side event...
        if ($A.util.isUndefinedOrNull(resp)) {
            //#if {"excludeModes" : ["PRODUCTION", "PRODUCTIONDEBUG", "PERFORMANCEDEBUG"]}
            ret["message"] = "Communication error, invalid JSON: " + text;
            // #end
            // #if {"modes" : ["PRODUCTION", "PRODUCTIONDEBUG", "PERFORMANCEDEBUG"]}
            ret["message"] = "Communication error, please retry or reload the page";
            // #end
            ret["status"] = "ERROR";

            // in case stale application cache, handling old exception code
            var appCache = window.applicationCache;
            if (appCache && (appCache.status === appCache.IDLE || appCache.status === appCache.UPDATEREADY || appCache.status === appCache.OBSOLETE)) {
                try {
                    $A.log("[AuraClientService.decode]: Communication error, status - " + status + ". Check for app cache updates using applicationCache.update()");
                    appCache.update();
                } catch (ignore) {
                    // appcache quirk: calling update() throws in some environments. we have no recovery
                    // so ignore it.
                }
            }
            return ret;
        } else if (resp["exceptionEvent"] === true) {
            var evtObj = resp["event"];
            var eventName;
            var eventNamespace;
            if (evtObj["descriptor"]) {
                var descriptor = new DefDescriptor(evtObj["descriptor"]);
                eventName = descriptor.getName();
                eventNamespace = descriptor.getNamespace();
            }

            if (eventNamespace === "aura" && eventName === "invalidSession") {
                ret["status"] = AuraClientService.INVALID_SESSION_RETURN_STATUS;
                ret["event"] = evtObj;
                return ret;
            }

            this.throwExceptionEvent(resp);

            // Note that this is for response not 200, so returning COOS in AuraEnabled controller would not go here
            // ideally, we want to break the flow for all exception event, however, that causes regressions.
            // for now, we stop the flow for COOS and invalidSession.
            if (eventNamespace === "aura" && eventName === "clientOutOfSync") {
                // do not return a valid state (SUCCESS, INCOMPLETE, ERROR), we do not want action callback to handle this.
                ret["status"] = AuraClientService.SYSTEM_EXCEPTION_EVENT_RETURN_STATUS;
                return ret;
            }

            ret["status"] = "ERROR";
            // at least output the exception event name so we know where to investigate.
            ret["message"] = "Received exception event" +
                                (eventNamespace ? (" " + eventNamespace + ":") : "") +
                                (eventName ? eventName : "") +
                                " from server";
            return ret;
        } else {
            // !!!!!!!!!!HACK ALERT!!!!!!!!!!
            // The server side actually returns a response with 'message' and 'stack' defined
            // when there was a server side exception. Unfortunately, we don't really know what
            // we have... the code in aura.error has checks for those, but if they are not
            // there the error message will be meaningless. This code thu does much the same
            // thing, but in a different way so that we get a real error message.
            // !!!!!!!!!!HACK ALERT!!!!!!!!!!
            //#if {"excludeModes" : ["PRODUCTION", "PRODUCTIONDEBUG", "PERFORMANCEDEBUG"]}
            if (resp["message"] && resp["stack"]) {
                ret["message"] = resp["message"] + "\n" + resp["stack"];
            } else {
                ret["message"] = "Communication error, invalid JSON: " + text;
            }
            // #end
            // #if {"modes" : ["PRODUCTION", "PRODUCTIONDEBUG", "PERFORMANCEDEBUG"]}
            if (resp["message"]) {
                ret["message"] = resp["message"];
            } else {
                ret["message"] = "Communication error, please retry or reload the page";
            }
            // #end
            ret["status"] = "ERROR";
            return ret;
        }
    }

    var responseMessage = $A.util.json.decode(text);
    if ($A.util.isUndefinedOrNull(responseMessage)) {
        //#if {"excludeModes" : ["PRODUCTION", "PRODUCTIONDEBUG", "PERFORMANCEDEBUG"]}
        ret["message"] = "Communication error, invalid JSON: " + text;
        // #end
        // #if {"modes" : ["PRODUCTION", "PRODUCTIONDEBUG", "PERFORMANCEDEBUG"]}
        ret["message"] = "Communication error, please retry or reload the page";
        // #end
        ret["status"] = "ERROR";
        return ret;
    }

    ret["status"] = "SUCCESS";
    ret["message"] = responseMessage;
    return ret;
};

/**
 * Fire an event exception from the wire.
 *
 * This is published, but only for use in the case of an event exception serialized as JS,
 * not sure if this is important.
 *
 * Exported to be used in ClientSideEventExceptionJSFormatAdapter to serialize JS exception handling code.
 *
 * @param {Object} resp The data for the exception event
 * @memberOf AuraClientService
 * @export
 */
AuraClientService.prototype.throwExceptionEvent = function(resp) {
    var evtObj = resp["event"];
    var descriptor = evtObj["descriptor"];
    var values = evtObj["attributes"] && evtObj["attributes"]["values"];

    if (evtObj["eventDef"]) {
        // register the event with the EventDefRegistry
        $A.eventService.createEventDef(evtObj["eventDef"]);
    }

    if ($A.eventService.hasHandlers(descriptor)) {
        var evt = $A.eventService.getNewEvent(descriptor);
        if (evtObj["attributes"]) {
            evt.setParams(values);
        }

        evt.fire();
    } else {
        switch (descriptor) {
            case "markup://aura:noAccess":
            this.handleNoAccessException(values);
            break;

            case "markup://aura:clientOutOfSync":
            this.handleClientOutOfSyncException();
            break;

            case "markup://aura:invalidSession":
            this.handleInvalidSessionException(values);
            break;

            case "markup://aura:systemError":
            this.handleSystemErrorException();
            break;

            default:
            this.handleGenericEventException();
        }
    }
};

/**
 * Handler for remote NoAccessException
 */
AuraClientService.prototype.handleNoAccessException = function(values) {
    $A.log("[AuraClientService.handleNoAccessException]: Reloading the page.");
    var redirectURL = values["redirectURL"];
    if (redirectURL) {
        window.location = redirectURL;
    } else {
        this.hardRefresh();
    }
};

/**
 * Handler for remote ClientOutOfSyncException
 */
AuraClientService.prototype.handleClientOutOfSyncException = function() {
    $A.log("[AuraClientService.handleClientOutOfSyncException]: Client out of sync.");
    this.setOutdated();
};

/**
 * Handler for remote InvalidSessionException
 */
AuraClientService.prototype.handleInvalidSessionException = function(values) {
    var newToken = values["newToken"];
    try {
        this.invalidSession(newToken);
    } catch (e) {
        $A.log("[AuraClientService.handleInvalidSessionException]: Invalid session, reloading the page.");
        window.location.reload(true);
    }
};

/**
 * Handler for remote SystemErrorException
 */
AuraClientService.prototype.handleSystemErrorException = function() {
    var e = new Error('[SystemErrorException from server] unknown error');
    e.reported=true;
    throw e;
};

/**
 * Handler for remote GenericEventException
 */
 AuraClientService.prototype.handleGenericEventException = function() {
    var e = new Error('[GenericEventException from server] Unable to process event');
    e.reported=true;
    throw e;
};

AuraClientService.prototype.fireDoneWaiting = function() {
    $A.eventService.getNewEvent("markup://aura:doneWaiting").fire();
};

/**
 * This will be called by the unload event
 *
 * @private
 */
AuraClientService.prototype.tearDown = function() {
    this._appNotTearingDown = false;
};


/**
 * Initializes the clientLibraries sent as part of the lazy HTML scripts
 * This will be called before instanciating the app
 * @private
*/
AuraClientService.prototype.initializeClientLibraries = function () {
    // Lazy load data-src scripts
    var scripts = document.getElementsByTagName("script");
    if (scripts) {
        for (var i = 0, len = scripts.length; i < len; i++) {
            var script = scripts[i];
            if (script.getAttribute("data-src") && !script.getAttribute("src")) {
                var source = script.getAttribute("data-src");
                var name = source.split('/').pop().split('.').shift().toLowerCase();

                var lib = this.clientLibraries[name];
                if (lib && lib["loaded"]) {
                    continue;
                }

                this.clientLibraries[name] = $A.util.apply(lib || {}, {
                    script : script,
                    loaded : false,
                    loading : []
                });
            }
        }
    }
};

AuraClientService.prototype.clientLibraryLoadComplete = function() {
    // Empty function. used as instrumentation hook
};

/**
 * Reference an external JavaScript library which is registered on component by aura:clientLibrary.
 * It loads the required client library from the server if needed.
 *
 * @param {String} name - client library name
 * @param {Function} callback - a callback function that is executed if library is loaded
 *
 * @export
 */
AuraClientService.prototype.loadClientLibrary = function(name, callback) {
    $A.assert(typeof name === "string", "AuraClientService.loadClientLibrary(): name must be a String.");

    name = name.toLowerCase();
    var lib = this.clientLibraries[name];
    $A.assert(lib, "AuraClientService.loadClientLibrary(): ClientLibrary has not been registered: " + name);

    if (lib.loaded) {
        return callback();
    }

    if (!lib.script) {
        var script = window.document.createElement("script");
        script.setAttribute("data-src", lib.resourceUrl.replace("{fwuid}", $A.getContext().fwuid));
        window.document.body.appendChild(script);
        lib.script = script;
    }

    lib.loading = lib.loading || [];
    lib.loading.push($A.getCallback(callback));

    if (lib.loading.length === 1) {
        // only increment counter if this is the first attempt to load a client library
        // script tags are not always added for a first time load. They are also set at
        // initializeClientLibraries
        this.clientLibraryLoadsInProgress++;
    }
    var that = this;
    function afterLoad() {
        that.clientLibraryLoadsInProgress--;
        $A.metricsService.transactionEnd("aura", "performance:loadClientLibrary");

        lib.loaded = true;

        for (var i in lib.loading) {
            lib.loading[i]();
        }
        lib.loading = [];
        that.clientLibraryLoadComplete();
    }

    lib.script.onload = afterLoad;
    // this only gets called when script fails to be loaded.
    // errors during script execution are handled by global error handler.
    lib.script.onerror = function(event) {
        var message = "Failed to load client library: " + lib.script.getAttribute("data-src");
        if (event && event.message) {
            message += ". Caused by: " + event.message;
        }

        var error = new $A.auraError(message, event && event.error);
        // stacktrace id is 0 if there's no component
        error.setComponent(name);

        // warning and report the error
        $A.warning(message, error);
        $A.logger.reportError(error);

        afterLoad(error);
    };

    $A.metricsService.transactionStart("aura", "performance:loadClientLibrary", {
            "context": {
                "attributes" : {
                    "library": name
                }
            }
        });
    lib.script.src = lib.script.getAttribute("data-src");
};


/**
 * make the current thread be 'in aura collections'
 *
 * @private
 */
AuraClientService.prototype.setInCollection = function() {
    this.auraStack.push("AuraClientService$collection");
};

/**
 * release the current thread from 'in aura collections'
 *
 * @private
 */
AuraClientService.prototype.clearInCollection = function() {
    var name = this.auraStack.pop();
    $A.assert(name === "AuraClientService$collection");
};

AuraClientService.prototype.isDisconnectedOrCancelled = function(response) {
    if (response && response.status) {
        if (response.status === 0) {
            return true;
        } else if (response.status >= 12000 && response.status < 13000) {
            // WINHTTP CONNECTION ERRORS
            return true;
        }
    } else {
        return true;
    }
    return false;
};

/**
 * Process a single action/response.
 *
 * Note that it does this inside an $A.run to provide protection against error returns, and to notify the user if an
 * error occurs.
 *
 * @param {Action} action the action.
 * @param {Object} actionResponse the server response.
 * @private
 */
AuraClientService.prototype.singleAction = function(action, actionResponse) {
    var needUpdate, needsRefresh;

    // Force the transaction id to 'this' action, so that we maintain chains.
    needUpdate = action.updateFromResponse(actionResponse);
    needsRefresh = action.isRefreshAction();

    if (!action.abortIfComponentInvalid(false)) {
        if (needUpdate) {
            action.finishAction($A.getContext());
        }
        if (needsRefresh) {
            action.fireRefreshEvent("refreshEnd", needUpdate);
        }
    }
};

AuraClientService.prototype.isBB10 = function() {
    var ua = navigator.userAgent;
    return (ua.indexOf("BB10") > 0 && ua.indexOf("AppleWebKit") > 0);
};

AuraClientService.prototype.getManifestURL = function() {
    var htmlNode = document.body.parentNode;
    return htmlNode ? htmlNode.getAttribute("manifest") : null;
};

AuraClientService.prototype.isManifestPresent = function() {
    return !!this.getManifestURL();
};

/**
 * Count the available XHRs.
 */
AuraClientService.prototype.countAvailableXHRs = function(/*isBackground*/) {
    return this.availableXHRs.length;
};

/**
 * Get an available XHR.
 *
 * Used for instrumentation
 *
 * @param {Boolean} isBackground is the XHR for a background action.
 */
AuraClientService.prototype.getAvailableXHR = function(isBackground) {
    if (isBackground && this.availableXHRs.length === 1) {
        // FIXME: this is bogus and will change.
        return null;
    }
    var auraXHR = this.availableXHRs.pop();
    return auraXHR;
};

/**
 * Release an xhr back in to the pool.
 *
 * @export
 */
AuraClientService.prototype.releaseXHR = function(auraXHR) {
    auraXHR.reset();
    this.availableXHRs.push(auraXHR);

    if (this.inFlightXHRs() === 0) {
        this.processXHRIdleQueue();
    }
};

/**
 * Sets up the bootstrap error reload button.
 * @private
 */
AuraClientService.prototype.setupBootstrapErrorReloadButton = function() {
    var reloadButton = document.getElementById("auraErrorReload");
    if (!reloadButton) {
        return;
    }
    reloadButton.href = this.getHardRefreshURL();
};

/**
 * Gets a URL that will trigger a server trip, even with appcache enabled.
 * See important appcahce note on AuraClientService#hardRefresh.
 * @return {String} URL that will trigger a server trip.
 * @private
 */
AuraClientService.prototype.getHardRefreshURL  = function() {
    var url = location.href;

    // if BB10 and using application cache
    if (this.isBB10() && window.applicationCache && window.applicationCache.status !== window.applicationCache.UNCACHED) {
        url = location.protocol + "//" + location.host + location.pathname + "?b=" + Date.now();
    }

    // replace encoding of spaces (%20) with encoding of '+' (%2b) so that when request.getParameter is called on the server, it will decode back to '+'
    var params = "?" + AuraClientService.CACHE_BUST_QUERY_PARAM + "=" + encodeURIComponent(url).replace(/\%20/g,"%2b");

    // cut up the url to remove # and ?
    var hIndex = url.indexOf("#");
    var qIndex = url.indexOf("?");
    var cutIndex = -1;
    if (hIndex > -1 && qIndex > -1) {
        cutIndex = (hIndex < qIndex) ? hIndex : qIndex;
    } else if (hIndex > -1) {
        cutIndex = hIndex;
    } else if (qIndex > -1) {
        cutIndex = qIndex;
    }
    if (cutIndex > -1) {
        url = url.substring(0, cutIndex);
    }
    // cut the appname
    var sIndex = url.lastIndexOf("/");
    var appName = url.substring(sIndex+1, url.length);

    var newUrl = appName + params;
    return newUrl;
};

/**
 * Perform "hard refresh" by forcing a request for the .app to the server.
 *
 * IMPORTANT APPCACHE NOTE: if the .app is requested it'll be served from appcache. To
 * force a trip to the server a cache-busting URL parameter is used. This server trip
 * allows for an HTTP 302 redirect to:
 * 1. An alternate endpoint, like an auth page if the session is invalid.
 * 2. Back to the .app if the session, etc is valid.
 * Redirecting back to the .app will cause the browser to load the .app from appcache.
 * The browser will then start the appcache refresh cycle (by fetching the manifest; see
 * https://www.w3.org/TR/2011/WD-html5-20110525/offline.html#appcacheevents), and we rely
 * on the appcache event handlers (AuraClientService#handleAppCache) to respond.
 *
 * Other reload techniques, like window.location.reload(true), do not force a request to
 * the server.
 *
 * @memberOf AuraClientService
 * @export
 */
AuraClientService.prototype.hardRefresh = function() {
    var cacheBustKey = "?" + AuraClientService.CACHE_BUST_QUERY_PARAM + "=";

    if (this.shouldPreventReload()) {
        var ae = new $A.auraError("We can't load the page. Please click Refresh.");
        ae["reported"] = true;
        this.showErrorDialogWithReload(ae);
        return;
    }

    if (!this.isManifestPresent() || location.href.indexOf(cacheBustKey) > -1) {
        $A.log("[AuraClientService.hardRefresh]: Reloading page - " + location.href);
        window.location.reload(true);
        return;
    }

    var url = this.getHardRefreshURL();

    // use history.pushState to change the url of current page without actually loading it.
    // AuraServlet will force the reload when GET request with current url contains '?nocache=someUrl'
    // after reload, someUrl will become the current url.
    // state is null: don't need to track the state with popstate
    // title is null: don't want to set the page title.
    // also ensures loading a 'nocache' url if the user hits "back" button.
    $A.log("[AuraClientService.hardRefresh]: loading page - " + url);
    history.pushState(null /* state */, null /* title */, url);
    location.href = url;
};

AuraClientService.prototype.isDevMode = function() {
    var context = $A.getContext();
    return !$A.util.isUndefined(context) && context.getMode() === "DEV";
};

/**
 * Clears caches (actions/GVP, ComponentDefStorage) then requests the .app
 * from the server.
 * @param {Object} [metricsPayload] optional payload to send to metrics service.
 * @private
 */
AuraClientService.prototype.actualDumpCachesAndReload = function(metricsPayload) {
    function reload() {
        // use location.reload(true) to clear browser cache.
        // Using hardRefresh() made browser use old versions even though appCache was updated
        $A.log("[AuraClientService:actualDumpCachesAndReload] Reloading the page. Cause - " + JSON.stringify(metricsPayload));
        window.location.reload(true);
    }

    $A.componentService.clearDefsFromStorage(metricsPayload)
        ["then"](reload, reload);
};

/**
 * Queues a request to clear caches (actions/GVP, ComponentDefStorage) then
 * reload the .app from the server.
 *
 * @param {Boolean} force True to force an immediate cache dump and reload. By default the
 * request is enqueued until framework has finished initialization. This should only be
 * used if $A.initAsync() will not be invoked (eg severe bootstrap error).
 * @param {Object} [metricsPayload] optional payload to send to metrics service.
 */
AuraClientService.prototype.dumpCachesAndReload = function(force, metricsPayload) {
    // avoid concurrent dump/reload executions
    if (this.reloadFunction) {
        return;
    }

    this.reloadFunction = this.actualDumpCachesAndReload.bind(this, metricsPayload);

    if (this.reloadPointPassed || force) {
        if (this.shouldPreventReload()) {
            var err = new AuraError("We can't load the page. Please click Refresh.");
            var extraMessage = "Bootstrap state: " + JSON.stringify(this.getBootstrapState()) +
                               "\nMetrics payload: " + JSON.stringify(metricsPayload);
            err["reported"] = true;
            this.showErrorDialogWithReload(err, extraMessage);
        } else {
            this.reloadFunction();
        }
        this.reloadFunction = undefined;
    }
};

/**
 * Tracks consecutive reloads that do not reach $A.finishInit to prevent infinite reloads.
 *
 * AuraClientService#hardRefresh() relies on this function to indicate when too many
 * consecutive reloads have occurred. In that case the caches are cleared and the user
 * is given a prompt indicating the app can't boot.
 *
 * @returns {boolean} true if too many consecutive reloads without the fwk + app booting.
 */
AuraClientService.prototype.shouldPreventReload = function() {
    // if per-tab sessionStorage isn't available then reload detection is disabled
    if (!$A.util.isSessionStorageEnabled()) {
        return false;
    }

    try {
        var count = window.sessionStorage.getItem(AuraClientService.CONSECUTIVE_RELOAD_COUNTER_KEY);
        count = +count; // coerce to number
        count = isFinite(count) ? count : 0;

        if (count >= AuraClientService.INCOMPLETE_BOOT_THRESHOLD) {
            // too many consecutive reloads without successful fwk + app init
            var idb = window.indexedDB;
            if (idb) {
                // if inline.js fails then none of the storages are initialized
                // so must brute force as methods in ComponentDefStorage won't work.
                idb.deleteDatabase(this.getActionStorageName());
                idb.deleteDatabase($A.componentService.getComponentDefStorageName());
            }

            // reset the counter so if user chooses to reload we allow multiple reloads again
            this.clearReloadCount();
            return true;
        }

        window.sessionStorage.setItem(AuraClientService.CONSECUTIVE_RELOAD_COUNTER_KEY, ""+(count+1));
        return false;
    } catch (ignore) {
        // intentional noop
    }
    return false;
};

/**
 * Clears the counter tracking consecutive reloads.
 */
AuraClientService.prototype.clearReloadCount = function() {
    if (!$A.util.isSessionStorageEnabled()) {
        return;
    }
    try {
        window.sessionStorage.removeItem(AuraClientService.CONSECUTIVE_RELOAD_COUNTER_KEY);
    } catch (ignore) {
        // intentional noop
    }
};

/**
 * Shows error dialog with reload button
 *
 * @param {AuraError} e error object
 * @param {String} [additionalLoggedMessage] additional text to log to the server, without being displayed to the user.
 * @private
 */
AuraClientService.prototype.showErrorDialogWithReload = function(e, additionalLoggedMessage) {
    if (e && e.message) {
        $A.message(e.message, e, true);

        // we only want to report/gack this if it is not from AuraClientService.prototype.hardRefresh
        if (e["reported"]) {
            return;
        }

        try {
            // report the error, set foreground to make the action run now, not as a caboose.
            if (additionalLoggedMessage) {
                e.message = e.message + " " + additionalLoggedMessage;
            }
            $A.logger.reportError(e, undefined, "WARNING", true);
        } catch (e2) {
            // we've failed utterly. One possible scenario is if inline.js failed to load, since it defines the context / fwuid, which reportError relies upon
            // Let's try to manually send an XHR down, since we don't care about the response format
            // we can just use XMLHttpRequest which is available in IE too.
            var xhr = this.createXHR();
            xhr.open("POST", "/aura?r=0", true);
            xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=ISO-8859-13');
            var payload = {
                "actions": [
                    {
                        "id": "1;a",
                        "descriptor": "aura://ComponentController/ACTION$reportFailedAction",
                        "callingDescriptor": "UNKNOWN",
                        "params": {
                            "failedId": e.id && e.id.toString() || "",
                            "failedAction": e["component"] || "",
                            "clientError": e.message,
                            "clientStack": (e.stackTrace || e.stack || "").toString().substr(0, Aura.Utils.Logger.MAX_STACKTRACE_SIZE),
                            "componentStack": "",
                            "stacktraceIdGen": e["stacktraceIdGen"],
                            "level": "ERROR"
                        },
                        "version": null
                    }]
            };

            var context;
            try {
                context = $A.getContext().encodeForServer(true);
            } catch (ce) {
                // special "UNKNOWN" case will allow reportFailedAction's to be logged, but nothing else. This will return a COOSE, but we don't check the response here and there's little more we can do about it.
                context = $A.util.json.encode({"fwuid": AuraClientService.UNKNOWN_FRAMEWORK_UID});
            }

            var params = {
                    "message": $A.util.json.encode(payload),
                    "aura.context": context
            };
            var queryString = this.buildParams(params);
            xhr.send(queryString);
        }
    }
};

/**
 * Sets up listeners for appcache.
 */
AuraClientService.prototype.handleAppCache = function() {
    /* You've found dragons.
     *
     * This code is very sensitive due to appcache's specification and browser quirks. It's highly
     * recommended that you:
     * 1. Read the appcache event summary to understand when which events are fired and
     *    in which sequence. https://www.w3.org/TR/2011/WD-html5-20110525/offline.html#appcacheevents
     * 2. Review the history of these functions.
     * 3. Test very, very thoroughly. Browser quirks change with every new release.
     */

    var acs = this;

    /**
     * Update UI appcache progress indicator.
     * @param {Number} progress Percent complete. If < 0 the considered an error;
     *  if >=100 then considered done.
     */
    function showProgress(progress) {
        if (!isFinite(progress)) {
            return;
        }

        acs.appCacheProgress = progress;
        if (!acs.isDevMode()) {
            return;
        }
        var progressContEl = document.getElementById("auraAppcacheProgress");
        if (progressContEl) {
            if (progress > 0 && progress < 100) {
                progressContEl.style.display = "block";
                var progressEl = progressContEl.firstChild;
                progressEl.firstChild.style.width = progress + "%";
            } else if (progress >= 100) {
                progressContEl.style.display = "none";
            } else if (progress < 0) {
                progressContEl.className = "error";
            }
        }
    }

    function handleAppcacheChecking() {
        acs.appcacheDownloadingEventFired = false;
    }

    function handleAppcacheUpdateReady() {
        if (window.applicationCache.swapCache && window.applicationCache.status === window.applicationCache.UPDATEREADY) {
            try {
                // request the new appcache version be used. change isn't realized until the page is reloaded.
                window.applicationCache.swapCache();
            } catch(ignore) {
                // quirk: some browser's incorrectly throw InvalidStateError
            }
            // dump caches due to change in fwk and/or app.
            acs.dumpCachesAndReload(false, {"cause": "applicationCache.updateready: Swap old cache for new one."});
        }
    }

    function handleAppcacheError(e) {
        acs.appCacheError = true;
        if (e.stopImmediatePropagation) {
            e.stopImmediatePropagation();
        }

        // if appcache is in use but obsolete (eg manifest returned 4xx) then ignore all errors. when the
        // obsolete handler is fired it will request the .app from the server.
        // quirk: error events may be fired before and after obsolete event/state fired/set.
        if (window.applicationCache.status === window.applicationCache.OBSOLETE) {
            return;
        }

        // quirk: obsolete appcaches sometimes aren't deleted; instead they're un-obsoleted and used.
        // this happens if obsolete then reload is very quick. it causes stale urls to be used from
        // the obsolete manifest, which fail to download, so the fallback files are used. obsolete
        // event/state may not be fired/set.

        /*
         * BB10 triggers appcache ERROR when the current manifest is a 404.
         * Other browsers triggers OBSOLETE which we handle by hard-refreshing the
         * page to get the new manifest url.
         *
         * For BB10, we append cache busting param to url to force BB10 browser
         * not to use cached HTML via hardRefresh
         */
        if (acs.isBB10()) {
            handleAppcacheObsolete();
            return;
        }

        // appcache must be in one of these states: UNCACHED, IDLE, CHECKING, DOWNLOADING, UPDATEREADY
        //
        // if app calls $A.clientService.setOutdated() (isOutdated===true) then fwk triggers the
        // appcache refresh cycle. when files start downloading the download event is fired
        // (appcacheDownloadingEventFired===true). if we now receive an error event it's because:
        // 1. browser has failed to fetch >=1 files. likely causes:
        // 1a. invalid session so server returns 500
        // 1b. rate limiting or other temporary error returns 500
        // 1c. server is unavailable for extended period
        // 2. browser failed to install, activate, etc the new version of appcache.
        // recovery in both is to dump caches and request .app?t from server. server will either
        // redirect elsewhere (eg to auth) or or back to .app then appcache refresh cycle runs.
        //
        // quirk: spec says if manifest changed during download sequence that it'll fire error event
        // then retry. i've never seen the retry happen.
        if (acs.isOutdated && acs.appcacheDownloadingEventFired) {
            acs.dumpCachesAndReload(false, {"cause": "applicationCache.error: App gets outdated while downloading app cache resources."});
            return;
        }

        showProgress(-1);

        // some type of appcache error has occurred. many possible causes:
        // a. the error is caused by incognito mode. this environment will fire error events even though
        //    the file was successfully downloaded + executed. no harm starting the bootup timers.
        // b. the error indicates a file in the manifest can't be downloaded (server returned a 4xx, 5xx,
        //    network blip, etc), which means the fwk/app won't boot. so start/continue the bootup timers.
        acs.startBootTimers();
        acs.updateAppCacheIfOnlineAndIdle();
    }

    function handleAppcacheDownloading(e) {
        acs.appCacheUpdateCount = 0;
        acs.appcacheDownloadingEventFired = true;
        var progress = Math.round(100 * e.loaded / e.total);
        showProgress(progress + 1);
    }

    function handleAppcacheProgress(e) {
        var progress = Math.round(100 * e.loaded / e.total);
        showProgress(progress);
    }

    function handleAppcacheNoUpdate() {
        acs.appCacheUpdateCount = 0;
        showProgress(100);

        // appcache refresh indicates all files are up to date but the app has indicated the app/fwk
        // is out of date. thus caches must be cleared and .app?t loaded from server.
        if (acs.isOutdated) {
            acs.dumpCachesAndReload(false, {"cause": "applicationCache.noupdate: App gets outdated even if all app cache resources are up to date."});
        }
    }

    function handleAppcacheCached() {
        showProgress(100);
    }

    function handleAppcacheObsolete() {
        acs.appCacheUpdateCount = 0;
        // appcache is in use but obsolete (eg manifest returned 4xx), must request the .app?t from server
        // to allow for auth, etc redirect. if server redirects back to .app then browser starts appcache
        // refresh cycle and fires relevant events.
        // note: error events may be fired before and after obsolete is fired so error handler explicitly
        // noops when obsolete with errors.
        acs.dumpCachesAndReload(false, {"cause": "applicationCache.obsolete: App cache resources are obsolete."});
    }

    if (window.applicationCache && window.applicationCache.addEventListener) {
        window.applicationCache.addEventListener("checking", handleAppcacheChecking, false);
        window.applicationCache.addEventListener("downloading", handleAppcacheDownloading, false);
        window.applicationCache.addEventListener("updateready", handleAppcacheUpdateReady, false);
        window.applicationCache.addEventListener("error", handleAppcacheError, false);
        window.applicationCache.addEventListener("progress", handleAppcacheProgress, false);
        window.applicationCache.addEventListener("noupdate", handleAppcacheNoUpdate, false);
        window.applicationCache.addEventListener("cached", handleAppcacheCached, false);
        window.applicationCache.addEventListener("obsolete", handleAppcacheObsolete, false);
    }
};

/**
 * Gets the framework and app bootstrap state, which indicates execution state of each file.
 * @return {Object} loading state for all bootstrap files.
 * @private
 */
AuraClientService.prototype.getBootstrapState = function() {
    var state = {
        "inline.js": !!Aura["inlineJsLoaded"],
        "aura.js": !!Aura["frameworkJsReady"],
        "appcore.js": !!Aura["appCoreJsReady"],
        "app.js": !!Aura["appJsReady"],
        "bootstrap.js": !!Aura["appBootstrap"] || !!Aura["appBootstrapCache"] || !!this.appBootstrap
    };

    if (this.isManifestPresent()) {
        state["appcache"] = this.appCacheProgress;
    }

    return state;
};

/**
 * Start or extend the boot timers that monitor for progress of the bootup sequence.
 * This is exclusively used in appcache scenarios: when an appcache error is triggered
 * the timer is started.
 */
AuraClientService.prototype.startBootTimers = function() {
    var that = this;


    // determines if progress has been made in booting fwk + app
    function getBootProgressed(state1, state2) {
        var change = Object.keys(state1).reduce(function(prev, curr) {
            return prev || state1[curr] !== state2[curr];
        }, false);
        return change;
    }

    // if a timer is already present then cancel it so we can set a new, extended timer
    if (this._bootTimerId) {
        window.clearTimeout(this._bootTimerId);
    }

    // capture current state
    var oldState = this.getBootstrapState();

    // start the timer.
    // note: start the timer even if all files are loaded. by then measuring success as the app+fwk
    // finishing boot we catch any issues caused during the boot sequence.
    this._bootTimerId = window.setTimeout(function() {
        // if fwk + app have booted then no more checks required
        if ($A["finishedInit"]) {
            return;
        }

        var newState = that.getBootstrapState();
        var progress = getBootProgressed(oldState, newState);

        // if progress made then start a new timer to check again
        if (progress || (window.applicationCache && (window.applicationCache.status === window.applicationCache.CHECKING || window.applicationCache.status === window.applicationCache.DOWNLOADING))) {
            that.startBootTimers();
            return;
        }

        // no progress made so reload the page
        $A.log("[AuraClientService.startBootTimers]: No progress made, reloading the page.");
        window.location.reload(true);
    }, AuraClientService.BOOT_TIMER_DURATION);
};

/**
 * Marks the application as outdated.
 *
 * Applications should call this when they require appcache to be refreshed. This
 * will result in the page being reloaded.
 *
 * @memberOf AuraClientService
 * @export
 */
AuraClientService.prototype.setOutdated = function() {
    this.isOutdated = true;

    var logPrefix = "AuraClientService.setOutdated";
    if (!$A.getContext()) {
        // exception in inline.js does not create aura context and reloadPointPassed is never true
        // so we perform actual dump caches and reload
        this.actualDumpCachesAndReload({"cause": logPrefix + ": Exception in inline.js does not create aura context."});
        return;
    }

    var appCache = window.applicationCache;

    // note: read jsdoc on dumpCachesAndReload() and hardReload() to understand this code and
    // appcache's quirks.

    // if appcache isn't supported then dump caches and reload. the browser will request .app?t then
    // .app from the the server.
    if (!appCache) {
        this.dumpCachesAndReload(false, {"cause": logPrefix + ": App cache not supported."});
    }

    // if appcache isn't activated (eg hasn't successfully downloaded all files, not enabled in the app)
    // then dump caches and reload. the browser will request .app?t then .app from the the server.
    else if (appCache.status === appCache.UNCACHED) {
        this.dumpCachesAndReload(false, {"cause": logPrefix + ": UNCACHED app cache status."});
    }

    // appcache is obsolete (eg manifest returned 4xx) so dump caches and reload. the browser will
    // request .app?t then .app from the the server.
    // NOTE: it has been observed (in chrome) that the .app request may be incorrectly served from
    // appcache. the browser will start the refresh cycle, get a 4xx on the manifest marking it
    // obsolete again, and handleAppCache() is invoked.
    else if (appCache.status === appCache.OBSOLETE) {
        this.dumpCachesAndReload(false, {"cause": logPrefix + ": OBSOLETE app cache status."});
    }

    // appcache is in use. it's idle (eg not checking for an update) so request the browser start the
    // refresh cycle (fetch the manifest). this will trigger appcache events / invoke handleAppCache().
    else if (appCache.status === appCache.IDLE) {
        try {
            $A.log("[" + logPrefix + "]: IDLE app cache status. Check for app cache updates using applicationCache.update()");
            appCache.update();
        } catch (e) {
            // appcache quirk: calling update() throws in some environments. take a more extreme
            // recovery of dumping caches and reloading .app from server to trigger appcache
            // population cycle.
            this.dumpCachesAndReload(false, {"cause": logPrefix + ": IDLE app cache status."});
        }
    }

    // other appcache states:
    // - CHECKING: manifest is being (re)fetched. appcache events will trigger handleAppCache().
    // - DOWNLOADING: appcache contents are being fetched. appcache events will trigger handleAppCache().
    // - UPDATEREADY: a new version of appcache is ready. handleAppCache() will apply the new version and reload.
};

/**
 * Updates appCache if online and status is IDLE
 * @returns {boolean} whether appcache update was performed
 */
AuraClientService.prototype.updateAppCacheIfOnlineAndIdle = function() {
    if ((!("onLine" in window.navigator) || window.navigator.onLine) && window.applicationCache.status === window.applicationCache.IDLE) {
        // perform only when online (OR onLine not supported) and appcache IDLE status
        // break application cache update error loop. eg App cache update that result in manifest 5xx triggers an error which in turn cause an update.
        if(this.appCacheUpdateCount++ > AuraClientService.INCOMPLETE_BOOT_THRESHOLD) {
            $A.log("[AuraClientService.updateAppCacheIfOnlineAndIdle]: Application cache update count passed a given threshold and is ignored.");
            return false;
        }
        try {
            // force browser to keep trying to get updated js resources as manifest should be updated at this point
            $A.log("[AuraClientService.updateAppCacheIfOnlineAndIdle]: Check for app cache updates using applicationCache.update()");
            window.applicationCache.update();
            return true;
        } catch (ignore) {
            // ignore
        }
    }
    return false;
};

/**
 * Inform Aura that the environment is either online or offline.
 *
 * @param {Boolean} isConnected Set to true to run Aura in online mode,
 * or false to run Aura in offline mode.
 * @memberOf AuraClientService
 * @export
 */
AuraClientService.prototype.setConnected = function(isConnected) {
    var isDisconnected = !isConnected;
    if (isDisconnected === this._isDisconnected) {
        // Already in desired state so no work to be done:
        return;
    }

    var e = $A.eventService.getNewEvent(isDisconnected ? "aura:connectionLost" : "aura:connectionResumed");
    if (e) {
        this._isDisconnected = isDisconnected;
        e.fire();
    } else {
        // looks like no definitions loaded yet
        alert(isDisconnected ? "Connection lost" : "Connection resumed");//eslint-disable-line no-alert
    }
};

/**
 * Init host is used to set the host name for communications.
 *
 * It should only be called once during the application life cycle, since it
 * will be deleted in production mode.
 *
 * Note that in testing, this can be used to make the host appear unreachable.
 *
 * @param {string} host the host name of the server.
 * @export
 */
AuraClientService.prototype.initHost = function(host) {
    this._host = host || "";

    //#if {"modes" : ["PRODUCTION", "PRODUCTIONDEBUG", "PERFORMANCEDEBUG"]}
    delete AuraClientService.prototype.initHost;
    delete AuraClientService.prototype["initHost"];
    //#end
};

/**
 * Initialize aura.
 *
 * FIXME: why is this exported
 *
 * This should never be called by client code.
 *
 * @param {Object} config the configuration for aura.
 * @param {string} token the XSS token.
 * @param {function} callback the callback when init is complete.
 * @param {object} container the place to install aura (defaults to document.body).
 * @export
 */
AuraClientService.prototype.init = function(config, token, container) {
    if (token) {
        this._token = token;
    }

    var context=$A.getContext();

    // Load Tokens from Application Def
    var rootDef = $A.componentService.getComponentDef(config["componentDef"]);
    context.setTokens(rootDef.tokens);

    // Create Root (Application) Component
    Aura.bootstrapMark("appCreationStart");
    var component = $A.componentService.createComponentPriv(config);
    Aura.bootstrapMark("appCreationEnd");

    this.setCurrentAccess(component);
    try {
        Aura.bootstrapMark("appRenderingStart");
        $A.renderingService.render(component, container || document.body);
        $A.renderingService.afterRender(component);
    } catch (e) {
        if (e instanceof $A.auraError) {
            throw e;
        } else {
            throw new $A.auraError("Error during rendering in init", e, $A.severity.QUIET);
        }
    } finally {
        this.releaseCurrentAccess();
        Aura.bootstrapMark("appRenderingEnd");
    }

    return component;
};

AuraClientService.prototype.getCurrentAccessName = function() {
    if (!this.currentAccess) {
        return null;
    }

    // current access can be a component or a component def
    if (this.currentAccess.getType) {
        return this.currentAccess.getType();
    } else {
        return this.currentAccess.getDescriptor().getFullName();
    }

};

/**
 * Return the number of inFlightXHRs
 *
 * @export
 */
AuraClientService.prototype.inFlightXHRs = function(excludeBackground) {
    if (excludeBackground) {
        var inFlight = $A.util.filter(this.allXHRs, function (xhr) {
            return this.availableXHRs.indexOf(xhr) === -1 && !xhr.background;
        }, this);

        return inFlight.length;
    }
    return (this.allXHRs.length - this.availableXHRs.length) + this.clientLibraryLoadsInProgress;
};

/**
 * This function is used by the test service to determine if there are outstanding actions.
 *
 * @private
 */
AuraClientService.prototype.idle = function() {
    return (this.actionsQueued.length === 0 && this.actionsDeferred.length === 0
        && this.availableXHRs.length === this.allXHRs.length);
};

/**
 * Enqueues a function to run when no XHRs are in-flight.
 * @param {Function} f the function to execute.
 */
AuraClientService.prototype.runWhenXHRIdle = function(f) {
    // something in flight so enqueue
    this.xhrIdleQueue.push(f);

    if (this.inFlightXHRs() === 0) {
        this.processXHRIdleQueue();
        return;
    }
};

/**
 * Executes the queue of functions to run when no XHRs are in-flight.
 */
AuraClientService.prototype.processXHRIdleQueue = function() {
    $A.assert(this.inFlightXHRs() === 0, "Idle queue should only be processed when no XHRs are in flight");

    // optimization
    if (this.xhrIdleQueue.length === 0) {
        return;
    }

    // process the queue
    var queue = this.xhrIdleQueue;
    this.xhrIdleQueue = [];
    for (var i = 0 ; i < queue.length; i++) {
        try {
            queue[i]();
        } catch (e) {
            $A.log("AuraClientService.processXHRIdleQueue: error thrown by enqueued function", e);
        }
    }
};

/**
 * This function is used by the test service to determine if there are outstanding actions queued.
 *
 * @private
 */
AuraClientService.prototype.areActionsWaiting = function() {
    return !(this.actionsQueued.length === 0 && this.actionsDeferred.length === 0);
};

/**
 * Add privileged namespaces.
 *
 * @param {Array} a list of namespaces to mark privileged
 * @private
 */
AuraClientService.prototype.setNamespacePrivileges = function(sentNs) {
    var namespaces = { "internal" : this.registeredNamespaces.internal, "privileged" : this.registeredNamespaces.privileged };

    if (sentNs) {
        for (var x in namespaces) {
            if (sentNs[x]) {
                for (var i = 0; i < sentNs[x].length; i++) {
                    namespaces[x][sentNs[x][i]] = true;
                }
            }
        }
    }
};

/**
 * Initialize definitions.
 *
 * FIXME: why is this exported
 *
 * This should never be called by client code. It is exposed, but deleted after
 * first use.
 *
 * @param {Object} config the set of definitions to initialize
 * @export
 */

AuraClientService.prototype.initDefs = function() {
    if (!Aura["appCoreJsReady"] || !Aura["appJsReady"]) {
        Aura["appDefsReady"] = this.initDefs.bind(this);
        return;
    }

    var i, config = Aura["ApplicationDefs"];

    if (config) {
        var libraryDefs = config["libExporter"];
        for (i in libraryDefs) {
            $A.componentService.addLibraryExporter(i, libraryDefs[i]);
        }

        var cmpExporter = config["cmpExporter"];
        for (i in cmpExporter) {
            $A.componentService.addComponent(i, cmpExporter[i]);
        }

        $A.componentService.initEventDefs(config["eventDefs"]);
        $A.componentService.initLibraryDefs(config["libraryDefs"]);
        $A.componentService.initControllerDefs(config["controllerDefs"]);
        $A.componentService.initModuleDefs(config["moduleDefs"]);

        delete Aura["ApplicationDefs"];
    }

    this.finishedInitDefs = true;

    if (Aura["afterAppDefsReady"]) {
        Aura["afterAppDefsReady"].forEach(function (fn) { fn();});
    }

    Aura["afterDefsReady"] = true;
    delete Aura["afterAppDefsReady"];
};

/**
 * Gets the bootstrap.js payload, from network or cache.
 * @return {Object} the bootstrap payload and its source, or undefined if it hasn't yet loaded.
 */
AuraClientService.prototype.getAppBootstrap = function() {
    //  network &&  cache -> network
    //  network && !cache -> network
    // ?network &&  cache ->
    //   parallel -> cache
    //   serial   -> wait for network
    // ?network && !cache -> wait for network
    // !network &&  cache -> cache
    // !network && !cache -> perm failure

    if (Aura["appBootstrapStatus"] === "loaded") {
        // loaded bootstrap and CSRF from server so next load can use cached version if enabled
        this.clearDisableParallelBootstrapLoadOnNextLoad();
        return {source:"network", value:Aura["appBootstrap"]};
    }
    else if (Aura["appBootstrapCacheStatus"] === "loaded" && this.getParallelBootstrapLoad()) {
        return {source:"cache", value:Aura["appBootstrapCache"]};
    }
    else if (Aura["appBootstrapStatus"] === "failed" && Aura["appBootstrapCacheStatus"] === "loaded") {
        return {source:"cache", value:Aura["appBootstrapCache"]};
    }
    else if (Aura["appBootstrapStatus"] === "failed" && Aura["appBootstrapCacheStatus"] === "failed") {
        // if bootstrap.js has failed to load from network and storage then the app won't boot.
        // note: if we reload while appcache is updating/downloading then the current version
        // (which may be stale) gets reused, which will cause an infinite reload. therefore only
        // reload the .app?t when appcache is idle or not in use.
        if (!window.applicationCache || window.applicationCache.status === window.applicationCache.UNCACHED || window.applicationCache.status === window.applicationCache.IDLE) {
            this.dumpCachesAndReload(false, {"cause": "AuraClientService.getAppBootstrap: Failed to load bootstrap.js from network or cache."});
        }
    }

    return undefined;
};

/**
 * Sets network bootstrap.js load status. To be invoked only after bootstrap.js &lt;script&gt;
 * has been processed (eg loaded successfully or not).
 *
 * This was historically triggered via the appcache fallback mechanism but with the reduced use
 * of appcache and the absence of a fallback for bootstrap.js, this is now triggered after all
 * bootstrap &lt;script&gt; tags are processed.
 *
 * @private
 */
AuraClientService.prototype.setAppBootstrapStatus = function() {
    if (Aura["appBootstrapStatus"] === "loaded") {
        return;
    }

    // bootstrap.js failed to load from network
    Aura["appBootstrapStatus"] = "failed";

    if (Aura["afterBootstrapReady"] && Aura["afterBootstrapReady"].length){
        var queue = Aura["afterBootstrapReady"];
        Aura["afterBootstrapReady"] = [];
        for (var i = 0; i < queue.length; i++) {
            queue[i]();
        }
    }
};

AuraClientService.prototype.runAfterBootstrapReady = function (callback) {
    Aura["afterBootstrapReady"] = Aura["afterBootstrapReady"] || [];

    // if bootstrap is already processed
    if (this.appBootstrap) {
        callback.call(this, this.appBootstrap["data"]["app"]);
        return;
    }

    // if bootstrap isn't available then enqueue
    var bootstrap = this.getAppBootstrap();
    if (!bootstrap) {
        Aura["afterBootstrapReady"].push(this.runAfterBootstrapReady.bind(this, callback));
        return;
    }

    // bootstrap is available but unprocessed. process it!
    var boot = bootstrap.value;

    if (boot["error"]) {
        if (boot["error"]["exceptionEvent"]) {
            this.throwExceptionEvent(boot["error"]);
            return;
        } else {
            throw new $A.auraError("Aura.loadComponent(): Failed to initialize application.\n" + boot["error"]["message"]);
        }
    }

    if (bootstrap.source === "network") {
        if (boot["token"]) {
            $A.log("AuraClientService.runAfterBootstrapReady(): Received updated token from bootstrap");
            this.setToken(boot["token"]);
        }
        if (this.tokenSharing && this._token) {
            $A.log("AuraClientService.runAfterBootstrapReady(): Broadcasting token received during bootstrap");
            this.broadcastToken(this._token);
        }
        if (!this.bootstrapInlined) {
            this.checkBootstrapUIDs(Aura["appBootstrapCache"]);
            this.saveBootstrapToStorage(boot);
        }
    }

    try {
        // can have a mismatch if we are upgrading framework or mode
        if (boot["data"] && boot["data"]["components"]) {
            // need to use the resolvedRefs for AuraContext components (componentConfigs aka partialConfigs)
            boot["context"]["components"] = boot["data"]["components"];
        }
        if (boot["context"]) {
            $A.getContext()["merge"](boot["context"]);
        }
    } catch(e) {
        if (bootstrap.source === "cache" && this.getParallelBootstrapLoad() && Aura["appBootstrapStatus"] !== "failed") {
            $A.warning("Bootstrap cache merge failed, waiting for bootstrap.js from network");
            Aura["afterBootstrapReady"].push(this.runAfterBootstrapReady.bind(this, callback));
            return;
        } else {
            throw new $A.auraError("AuraClientService.runAfterBootstrapReady: bootstrap from " + bootstrap.source + " failed to merge");
        }
    }

    $A.log("[AuraClientService.runAfterBootstrapReady]: Bootstrap loaded and processed from " + bootstrap.source);
    this.appBootstrap = boot;

    if (bootstrap.source === "cache" && this.getParallelBootstrapLoad() && Aura["appBootstrapStatus"] !== "failed") {
        // in the future when network bootstrap arrives, if the load was successful
        // then perform the freshness check
        Aura["afterBootstrapReady"].push(function () {
            if (Aura["appBootstrapStatus"] === "loaded") {
                if (Aura["appBootstrap"]["error"]) {
                    $A.warning("AuraClientService.runAfterBootstrapReady(): bootstrap from network contained error: " + Aura["appBootstrap"]["error"]["message"]);
                } else {
                    Aura["bootstrapUpgrade"] = this.appBootstrap["md5"] !== Aura["appBootstrap"]["md5"];
                    if (Aura["appBootstrap"]["token"]) {
                        $A.log("AuraClientService.runAfterBootstrapReady(): Received updated token after cached bootstrap");
                        this.setToken(Aura["appBootstrap"]["token"]);
                    }
                    this.checkBootstrapUIDs(Aura["appBootstrap"]);
                    this.checkBootstrapUpgrade();
                }
            }
            // release memory of network bootstrap
            delete Aura["appBootstrap"];
        }.bind(this));
    }

    // release memory
    delete Aura["appBootstrap"];

    callback.call(this, boot["data"]["app"]);
};

/**
 * Checks whether framework or app UID of cached and network has changed.
 * If either differs, dump caches and reload because we should not use stale defs in storage.
 * UIDs check is different from bootstrap md5 check. bootstrap md5 is from application bootstrap and models
 * whereas UIDs are framework code and application defs.
 *
 * @param {Object} boot bootstrap config
 */
AuraClientService.prototype.checkBootstrapUIDs = function(boot) {
    var context = $A.getContext();
    if (boot && boot["context"] && boot["context"]["fwuid"] && boot["context"]["loaded"] && context) {
        var currentAppDesc = "markup://" + context.getApp();

        var currentAppUid = null;
        var bootAppUid = null;
        var currentLoaded = context.findLoaded(currentAppDesc);
        if ($A.util.isObject(currentLoaded)) {
            currentAppUid = currentLoaded["value"];
        }
        var bootLoaded = context.findLoaded(currentAppDesc, boot["context"]["loaded"]);
        if ($A.util.isObject(bootLoaded)) {
            bootAppUid = bootLoaded["value"];
        }

        if (context.fwuid !== boot["context"]["fwuid"] || currentAppUid !== bootAppUid) {
            if (!this.updateAppCacheIfOnlineAndIdle()) {
                this.dumpCachesAndReload(false, {"cause": "AuraClientService.checkBootstrapUIDs: Framework or App UID is different between cached and network version."});
            }
        }
    }
};

/**
 * Fire an aura:applicationRefreshed application level event if bootstrap returned from network differs from bootstrap
 * loaded from cache.
 * @private
 */
AuraClientService.prototype.checkBootstrapUpgrade = function() {
    function fireApplicationRefreshed() {
        $A.eventService.getNewEvent("markup://aura:applicationRefreshed").fire();
    }

    // finishedInit and bootstrapUpgrade are set in async processes: former waits on libs_*.js
    // to arrive, latter waits on network bootstrap.js to arrive. thus global meeting point
    // pattern is required.
    if (Aura["bootstrapUpgrade"] === undefined) {
        // network version hasn't arrived yet
        return;
    }
    $A.log("Checking bootstrap signature: network returned " + (Aura["bootstrapUpgrade"] ? "new" : "same") + " version");
    if ($A["finishedInit"] && Aura["bootstrapUpgrade"]) {
        // save the new version of bootstrap to storage BEFORE notifying the app so that if the app chooses
        // to reload the app then cache contains the latest bootstrap value.
        this.saveBootstrapToStorage(Aura["appBootstrap"])
            ["then"](fireApplicationRefreshed, fireApplicationRefreshed);
    }
};

/**
 * Run a callback after defs are initialized.
 *
 * This is for internal use only. The function is called synchronously if definitions have
 * already been initialized.
 *
 * @param {function} callback the callback that should be invoked after defs are initialized
 * @private
 */
AuraClientService.prototype.runAfterInitDefs = function(callback) {
    if (this.finishedInitDefs) {
        return callback();
    }

    // Add to the list of callbacks waiting until initDefs() is done
    Aura["afterAppDefsReady"] = Aura["afterAppDefsReady"] || [];
    Aura["afterAppDefsReady"].push(callback);

};

/**
 * Run a callback after the application is ready (rendered)
 *
 * This is for internal use only. The function is called synchronously if definitions have
 * already been initialized.
 *
 * @param {function} callback the callback that should be invoked after defs are initialized
 * @private
 */
AuraClientService.prototype.runAfterAppReady = function(callback) {
    if ($A["finishedInit"]) {
        return callback();
    }

    // Add to the list of callbacks waiting until the app is ready (finishInit)
    Aura["afterAppReady"] = Aura["afterAppReady"] || [];
    Aura["afterAppReady"].push(callback);
};

/**
 * Loads bootstrap.js from storage, if it exists, and populates several
 * global variables consumed by runAfterBootstrapReady().
 *
 * Aura["appBootstrapCacheStatus"] must be set at the end of all code paths so
 * bootstrap robustness logic can determine when loading from storage is complete.
 *
 * @return {Promise} a promise that always resolves. Errors are logged
 *  and the promise resolves.
 */
AuraClientService.prototype.loadBootstrapFromStorage = function() {
    // if bootstrap.js from network has loaded then skip loading from cache
    if (Aura["appBootstrap"]) {
        Aura["appBootstrapCacheStatus"] = "failed";
        return Promise["resolve"]();
    }

    // if no storage then no cache hit
    var storage = $A.storageService.getStorage(this.getActionStorageName());
    if (!storage || !storage.isPersistent()) {
        Aura["appBootstrapCacheStatus"] = "failed";
        return Promise["resolve"]();
    }

    // else load from storage
    return storage.get(AuraClientService.BOOTSTRAP_KEY)
        ["then"](
            function(value) {
                if (value) {
                    Aura["appBootstrapCacheStatus"] = "loaded";
                    Aura["appBootstrapCache"] = value;
                } else {
                    Aura["appBootstrapCacheStatus"] = "failed";
                }
            },
            function(err) {
                Aura["appBootstrapCacheStatus"] = "failed";
                $A.warning("AuraClientService.loadBootstrapFromStorage(): failed to load bootstrap from storage: " + err);
                // do not rethrow
            }
        );
};

/**
 * Save bootstrap.js to storage.
 *
 * @param {Object} boot The bootstrap.js payload
 * @return {Promise} promise that resolves when bootstrap is saved to storage.
 *  If a storage error occurs then a flag is set to force bootstrap.js from
 *  network on next app load.
 */
AuraClientService.prototype.saveBootstrapToStorage = function(boot) {
    var storage = $A.storageService.getStorage(this.getActionStorageName());
    if (!storage || !storage.isPersistent()) {
        return Promise["resolve"]();
    }

    var that = this;
    var defsPromise = $A.componentService.saveDefsToStorage(boot["context"], $A.getContext())
        ["then"](
            undefined,
            function(e) {
                $A.warning("AuraClientService.saveBootstrapToStorage(): failed to persist bootstrap.js defs: " + e);
                that.disableParallelBootstrapLoadOnNextLoad();
            }
        );

    var bootstrapPromise = storage.set(AuraClientService.BOOTSTRAP_KEY, boot)
        ["then"](
            undefined,
            function(e) {
                $A.warning("AuraClientService.saveBootstrapToStorage(): failed to persist bootstrap.js: " + e);
                that.disableParallelBootstrapLoadOnNextLoad();
            }
        );

    return Promise["all"]([defsPromise, bootstrapPromise]);
};

/**
 * Initializes app
 *
 * Waits for all the pieces (app.js, bootststrap.js) to init the application
 * @memberOf AuraClientService
 * @private
 */
AuraClientService.prototype.initializeApplication = function() {
    Aura.bootstrapMark("runAfterContextCreated");
    var self = this;

    return new Promise(function(resolve) {
        self.runAfterInitDefs(function() {
            Aura.bootstrapMark("runAfterInitDefsReady");
            self.runAfterBootstrapReady(function (bootConfig) {
                // Ensure bootstrap queues are executed.
                // When 'bootstrapInlined', bootstrap(part of the app html) is executed before tasks that need to run after context and GVP are initialized.
                if (Aura["afterBootstrapReady"] && Aura["afterBootstrapReady"].length){
                    var queue = Aura["afterBootstrapReady"];
                    Aura["afterBootstrapReady"] = [];
                    for (var i = 0; i < queue.length; i++) {
                        queue[i]();
                    }
                }

                Aura.bootstrapMark("runAfterBootstrapReady");
                resolve(bootConfig);
            });
        });
    });
};

/**
 * Initializes injected services defined in the application.
 * @param {String[]} services Service descriptors to initialize.
 * @memberOf AuraClientService
 * @private
 */
AuraClientService.prototype.initializeInjectedServices = function(services) {
    if (services) {
        var serviceRegistry = this.moduleServices;
        services.forEach(function (serviceDefinition) {
            var serviceModule = $A.componentService.evaluateModuleDef(serviceDefinition);
            var serviceConstructor = serviceModule["default"] || serviceModule;
            var service = serviceConstructor(Aura.ServiceApi, $A.componentService.moduleEngine);
            $A.assert(service.name, 'Unknown service name');
            serviceRegistry[service.name] = service;
        });
    }
};

/**
 * Adds a resolver for a scoped module import.
 * 
 * Example: ` import foo from "@salesforce/label/MyLabels.Foo" `
 *
 * @param {String} scope The scope of import. For example, the scope of "@salesforce/label/MyLabels.Foo" would be "salesforce"
 * @param {Function} resolver The function to be invoked when resolving the module import
 * This method needs to be exported (not platform)
 * so it can be invoked before framework initialization
 * @export
 */
AuraClientService.prototype.addScopedModuleResolver = function (scope, resolver) {
    $A.assert(typeof resolver === 'function', 'Scoped module resolver must be a function');
    this.moduleScopedImports[scope] = resolver;
};

/**
 * Resolves the import of a scoped module by invoking a resolver for the given
 * scope if a resolver is registered.
 * 
 * @param {String} fullImport The entire path of the module being imported
 * @param {String} scope The scope of the module import, e.g. "salesforce"
 * @memberOf AuraClientService
 * @private
*/
AuraClientService.prototype.resolveScopedModuleImport = function (scope, fullImport) {
    if (!this.moduleScopedImportsCache[fullImport]) {
        var resolver = this.moduleScopedImports[scope];
        $A.assert(resolver, "No resolver found for scoped module import '" + fullImport + "'.");
        this.moduleScopedImportsCache[fullImport] = resolver(fullImport);
    }

    return this.moduleScopedImportsCache[fullImport];
};

/**
 * Default resolver for the @salesforce scoped module import. This allows off-core projects to  still have access to
 * a sub-set of @salesforce imports in their modules, such as labels, and can be overridden by core to provide the full
 * set of @salesforce imports.
 * 
 * This is registered at the framework level rather than the app level to allow things like component tests that load a
 * cmp file directly in the browser to still function.
 * 
 * W-5187044: Investigate if we can do this injection in the test runner flow instead and if that is a complete and
 * adequete solution.
 * 
 * @param {String} fullImport The entire path of the module being imported
 * @memberOf AuraClientService
 * @private
 */
AuraClientService.prototype.defaultSalesforceImportResolver = function(fullImport) {
    // strip off the "@salesforce/" section of the import
    var path = fullImport.substring(12);
    var parts = path.split('/');
    var key = parts[0];

    switch (key) {
        case 'label': 
            return $A.get("$Label." + parts[1]);
        case 'cssvars':
            return function (cssVar, fallback) {
                return $A.clientService.cssVars[cssVar.slice(2)] || fallback || 'inherit';
            };

        default: 
            return undefined;
    }
};

/**
 * Default resolver for the @babel-helpers for COMPAT mode.
 *
 * @param {String} fullImport The entire path of the module being imported
 * @memberOf AuraClientService
 * @private
 */
AuraClientService.prototype.babelHelpersResolver = function(fullImport) {
    var parts = fullImport.split('/');
    var helperName = parts.pop();
    var type = parts.pop();

    if (type === 'helpers') {
        return Aura["compat"]["babelHelpers"][helperName];
    } else if (helperName === "regenerator") {
        return Aura["compat"]["regenerator"];
    }
};

/**
 * Check to see if we are inside the aura processing 'loop'.
 *
 * @private
 */
AuraClientService.prototype.inAuraLoop = function() {
    return this.auraStack.length > 0;
};

/**
 * Push a new name on the stack.
 *
 * @param {string} name the name of the item to push.
 * @private
 */
AuraClientService.prototype.pushStack = function(name) {
    this.auraStack.push(name);
};

/**
 * Pop an item off the stack.
 *
 * The name of the item must match the previously pushed. If this is the last
 * item on the stack we do post processing, which involves sending actions to
 * the server.
 *
 * @param name the name of the last item pushed.
 * @private
 */
AuraClientService.prototype.popStack = function(name) {
    var lastName;

    if (this.auraStack.length > 0) {
        lastName = this.auraStack.pop();
        $A.assert(lastName === name, "Broken stack: popped "+lastName+" expected "+name+", stack = "+this.auraStack);
    } else {
        $A.warning("Pop from empty stack");
    }

    if (this.auraStack.length === 0) {
        this.auraStack.push("AuraClientService$popStack");
        this.postProcess();
    }
};

/*
 * @private
 */
AuraClientService.prototype.postProcess = function() {
    if (this.auraStack.length === 1 && this.auraStack[0] === "AuraClientService$popStack") {
        try {
            this.process();
        } catch (e) {
            throw (e instanceof $A.auraError) ? e : new $A.auraError("AuraClientService.postProcess: error in processing", e);
        } finally {
            this.auraStack.pop();
        }
 
    }
};

/**
 * Run the collection of actions.
 *
 * Entry point for processing actions. This creates a collector, and parcels out the action handling.
 * After this, server actions will be either getting values from storage, or will be executed, and the
 * client actions will all be queued up to be executed in order via setTimeout, giving server actions
 * entry points to collect.
 */
AuraClientService.prototype.process = function() {
    if (this.collector) {
        return;
    }
    this.collector = new Aura.Services.AuraClientService$AuraActionCollector();
    this.continueProcessing();
};

/**
 * continuation.
 *
 * Setp 2: walk actions setting up collections.
 *
 * We divide into client actions and server actions. Server actions are further
 * divided into stored vs. non-stored.
 */
AuraClientService.prototype.continueProcessing = function() {
    var i;
    var index = 0;
    var action;
    var actionList;
    var isStorageEnabled = this.actionStorage.isStorageEnabled();

    // Protect against server actions collecting early.
    this.collector.actionsToCollect += 1;
    actionList = this.actionsQueued;
    this.actionsQueued = [];
    for (i = 0; i < actionList.length; i++) {
        action = actionList[i];
        try {
            if (action.abortIfComponentInvalid(true)) {
                // action already aborted.
                // this will only occur if the component is no longer valid.
                continue;
            }
            if (action.getDef().isServerAction()) {
                this.collector.actionsToCollect += 1;
                this.collector.collected[index] = undefined;
                this.collector.collecting[index] = action;
                if (!action.isRefreshAction() && action.isStorable() && isStorageEnabled) {
                    this.collectStorableAction(action, index);
                } else {
                    this.collectServerAction(action, index);
                }
                index += 1;
            } else {
                this.collector.clientActions.push(action);
            }
        } catch (e) {
            var errorWrapper = new $A.auraError(null, e);
            errorWrapper.action = action;
            $A.logger.reportError(errorWrapper);
        }
    }

    this.processStorableActions();

    this.collector.actionsToCollect -= 1;
    // Start our index at 0
    this.collector.clientIndex = 0;
    if (this.optionClientSynchronous) {
        this.runClientActions();
    } else {
        this.continueClientActions();
    }
};

/**
 * Collect a storable action for subsequent bulk processing.
 * @param {Action} action The action to collect.
 * @param {Number} index The index of the array in the queue.
 */
AuraClientService.prototype.collectStorableAction = function(action, index) {
    this.collector.collectedStorableActions[index] = action;
};

/**
 * @param actionItem
 * @param response
 * @param callback who's first parameter is a boolean
 * @param callbackArg, to be passed to callback after boolean
 * @private
 */
AuraClientService.prototype.allDefsExistOnClient = function(actionItem, response, callback, callbackArg) {
    var exist = false;
    if (response === undefined) {
        callback(exist, callbackArg);
        return;
    }
    var deps = response["defDependencies"];
    if ($A.util.isObject(deps)) {
        if ($A.getContext().uriAddressableDefsEnabled) {
            for (var dep in deps) {
                // TODO check on this, type safety in JS is no bueno
                if ($A.util.isObject(deps[dep])) {
                    $A.componentService.saveComponentConfig(deps[dep]);
                    // TODO is module?
                    // $A.componentService.initModuleDefs(deps[dep]);
                }
            }
            $A.componentService.loadComponentDefs(deps, function(err){
                callback(!err, callbackArg, err);
            });
            return;
        } else {
            // TODO remove when uriDefs fully enabled
            for (var descriptor in deps) {
                if ($A.componentService.hasCacheableDefinitionOfAnyType(descriptor)) {
                    // we have the definition on the client! Hadanza!
                    continue;
                }  // else
                $A.metricsService.transaction("aura", "performance:stored-action-missing-defs", {
                    "context": {
                        "attributes": {
                            "action": actionItem.action.def.descriptor,
                            "missingDef": descriptor,
                            "requiredDefs": Object.keys(deps)
                        }
                    }
                });
                callback(exist, callbackArg);
                return;
            }
            exist = true;
        }
    } else {
        exist = true;
    }
    callback(exist, callbackArg);
};

/**
 * Bulk process the storable actions collected by AuraClientService#collectStorableAction.
 * - Action storage is bulk queried for cached action results.
 * - If a cached result is found for an action then the action is processed immediately. Otherwise
 *   the action is enqueued for the server.
 * - If an error occurs querying storage then all actions are sent to the server.
 */
AuraClientService.prototype.processStorableActions = function() {
    var arr, i, action;

    // if not storable actions then nothing to do
    if (this.collector.collectedStorableActions.length === 0) {
        return;
    }

    var collectedStorableActions = this.collector.collectedStorableActions;
    this.collector.collectedStorableActions = [];

    // if no storage then all actions go to the server
    if (!this.actionStorage.isStorageEnabled()) {
        for (i = 0; i < collectedStorableActions.length; i++) {
            action = collectedStorableActions[i];
            if (!action) {
                this.collectServerAction(action, i);
            }
        }
        return;
    }

    // map of storage keys to array of action/index
    var keysToActions = {};

    var key;
    for (i = 0; i < collectedStorableActions.length; i++) {
        action = collectedStorableActions[i];
        if (action) {
            key = action.getStorageKey();
            if (this.actionStorage.isStoragePersistent() && this.actionStorage.isKeyAbsentFromCache(key)) {
                this.collectServerAction(action, i);
                continue;
            }

            arr = keysToActions[key];
            if (!arr) {
                arr = [];
                keysToActions[key] = arr;
            }
            arr.push({action:action, index:i});
        }
    }

    if (Object.keys(keysToActions).length === 0) {
        return;
    }

    var that = this;
    this.actionStorage.getAll(Object.keys(keysToActions))
        ["then"](
            function(items) {
                var existsCallback = function(exists, args) {
                    try {
                        if (exists) {
                            that.executeStoredAction(args.actionItem.action, args.value, that.collector.collected, args.actionItem.index);
                            that.collector.actionsToCollect -= 1;
                            that.finishCollection();
                        } else {
                            that.collectServerAction(args.actionItem.action, args.actionItem.index);
                        }
                    } catch (e) {
                        $A.logger.reportError(e);
                    }
                };
                for (var k in keysToActions) {
                    arr = keysToActions[k];
                    var value = items[k];

                    for (var j = 0; j < arr.length; j++) {
                        if (!value) {
                            // it wasn't found in storage, even though we think it should be there.
                            that.collectServerAction(arr[j].action, arr[j].index);
                            continue;
                        }
                        that.allDefsExistOnClient(arr[j], value, existsCallback, {value: value, actionItem:arr[j]});
                    }
                }
                that.finishCollection();
            },
            function(/*error*/) {
                // error fetching from storage so all actions go to the server
                for (var keyToAction in keysToActions) {
                    arr = keysToActions[keyToAction];
                    for (var l = 0; l < arr.length; l++) {
                        that.collectServerAction(arr[l].action, arr[l].index);
                    }
                }
            }
        )
        ["then"](
            undefined,
            function(error) {
                // something is really wrong. no clear way to recover so at least report
                $A.warning(undefined, error);
                $A.logger.reportError(error);
            }
        );
};

/**
 * Bulk persist storable actions to storage.
 * @param {Array} actions An array of storable actions to persist.
 */
AuraClientService.prototype.persistStorableActions = function(actions) {
    var action, key, value;
    var doStore = false;

    var values = {};
    for (var i = 0; i < actions.length; i++) {
        action = actions[i];
        value = action.getStored();
        if (value) {
            try {
                key = action.getStorageKey();
            } catch (e) {
                var message = "AuraClientService.persistStorableActions(): Failed to get action storage key";
                var auraError = new $A.auraError(message, e);
                $A.logger.reportError(auraError, action);
                continue;
            }

            doStore = true;
            values[key] = value;
        }
    }

    if (doStore && this.actionStorage.isStorageEnabled()) {
        return this.actionStorage.setAll(values)
            ["then"](
                undefined,
                function(error){
                    // storage problems should warn rather than the aggressive error.
                    var keys = Object.keys(values);
                    $A.warning("AuraClientService.persistStorableActions, problem storing "+keys.length+" actions:\n"+keys.join("\n")+"\n"+error);
                }
            );
    }
    return Promise["resolve"]();
};

/**
 * Enqueue a stored action for execution after the XHR send.
 */
AuraClientService.prototype.enqueueStoredAction = function(action, response) {
    this.collector.actionsToComplete.push({ "action":action, "response":response});
};

/**
 * Execute a single stored action.
 *
 * This is done in situations when we get a result from the storage service. We also queue up a refresh
 * action if we are due a refresh or we have trouble running the action.
 */
AuraClientService.prototype.executeStoredAction = function(action, response, collected, index) {
    var refreshAction = null;

    this.setInCollection();
    try {
        if (!action.abortIfComponentInvalid(false)) {
            try {
                action.updateFromResponse(response);
                action.finishAction($A.getContext());
            } catch (e) {
                refreshAction = action.getRetryFromStorageAction();
                $A.warning("Finishing cached action failed. Trying to refetch from server: " + refreshAction.getStorageKey(), e);
                // Clear potential leftover configs
                $A.getContext().clearComponentConfigs(action.getId());
            }
            this.collector.actionsCompleted += 1;
            if (!refreshAction) {
                refreshAction = action.getRefreshAction(response);
            }
            if (refreshAction) {
                action.fireRefreshEvent("refreshBegin");
                collected[index] = refreshAction;
            }
        }
    } catch (e) {
        var auraError = new $A.auraError("AuraClientService.executeStoredAction(): error happened when processing stored action", e);
        $A.logger.reportError(auraError, action);
    } finally {
        this.clearInCollection();
    }
};

/**
 * Collect a single action into our list.
 */
AuraClientService.prototype.collectServerAction = function(action, index) {
    this.collector.collected[index] = action;
    this.collector.actionsToCollect -= 1;
    this.finishCollection();
};

/**
 * Run client actions asynchronously.
 */
AuraClientService.prototype.continueClientActions = function() {
    var that = this;

    if (this.collector.clientIndex < this.collector.clientActions.length) {
        setTimeout(function() {
            that.setInCollection();
            that.executeClientAction(that.collector.clientActions[that.collector.clientIndex]);
            that.clearInCollection();
            that.collector.clientIndex += 1;
            that.continueClientActions();
        }, 0);
    } else {
        this.collector.clientActions = [];
        this.finishCollection();
    }
};

/**
 * Run client actions synchronously.
 */
AuraClientService.prototype.runClientActions = function() {
    var i;

    this.setInCollection();
    for (i = 0; i < this.collector.clientActions.length; i++) {
        this.executeClientAction(this.collector.clientActions[i]);
    }
    this.clearInCollection();
    this.collector.clientActions = [];
    this.finishCollection();
};

/**
 * Execute a client action.
 */
AuraClientService.prototype.executeClientAction = function(action) {
    try {
        if (!action.abortIfComponentInvalid(false)) {
            action.runDeprecated();
            action.finishAction($A.getContext());
        }
    } catch (ignore) {
        // already handled in the action.
    }
};

/**
 * Finish the collection process and send XHRs.
 */
AuraClientService.prototype.finishCollection = function() {
    if (!this.collector || this.collector.actionsToCollect !== 0 || this.collector.clientActions.length) {
        return;
    }
    if (this.collector.actionsCompleted) {
        this.fireDoneWaiting();
    }
    //
    // Carefully walk actions here, since we may have undefined actions in our collected set.
    // This way we filter them out, and don't try to process too many things. It also avoids
    // other problems processing the deferred queue.
    //
    var i = 0;
    var length;
    var collected = this.collector.collected;
    this.collector.collected = [];
    for (i = 0, length = collected.length; i < length; i++) {
        if (collected[i]) {
            this.actionsDeferred.push(collected[i]);
        }
    }
    if (this.actionsQueued.length) {
        this.continueProcessing();
        return;
    }
    if (this.actionsDeferred.length) {
        this.sendActionXHRs();
    }

    //
    // This will only be true if we opt for stored actions after send.
    //
    if (this.collector.actionsToComplete.length) {
        for (i = 0; i < this.collector.actionsToComplete.length; i++) {
            this.collector.collected.push(undefined);
        }
        this.continueCompletions();
    } else {
        this.finishProcessing();
    }
};

/**
 * @private
 */
AuraClientService.prototype.shouldSendOutForegroundActions = function( foregroundActions, cabooseCount ) {
    if(foregroundActions.length > cabooseCount ||
        (cabooseCount > 0 && Date.now() - this.lastSendTime > 60000) ) {
        return true;
    } else {
        return false;
    }
};

/**
 * Send actions.
 */
AuraClientService.prototype.sendActionXHRs = function() {
    var processing;
    var foreground = [];
    var background = [];
    var publiclyCacheableAndBackground = [];
    var publiclyCacheable = [];
    var deferred = [];
    var action, auraXHR;
    var caboose = 0;
    var i;

    processing = this.actionsDeferred;
    this.actionsDeferred = [];
    for (i = 0; i < processing.length; i++) {
        action = processing[i];
        if (action.abortIfComponentInvalid(true)) {
            continue;
        }
        if (action.isDeferred()) {
            deferred.push(action);
        } else if (!action.isBackground() && action.isPubliclyCacheable()) {
            publiclyCacheable.push(action);
        } else if (action.isBackground() && action.isPubliclyCacheable()) {
            publiclyCacheableAndBackground.push(action);
        } else if (action.isBackground()) {
            background.push(action);
        } else {
            foreground.push(action);
            if (action.isCaboose()) {
                caboose += 1;
            }
        }
    }

    if (this.xhrExclusivity) {
        this.sendAsSingle(foreground, foreground.length, { background: false });
    } else {
        // either group caboose with at least one non-caboose foreground
        // or send all caboose after 60s since last send
        if( this.shouldSendOutForegroundActions(foreground, caboose) ) {
            auraXHR = this.getAvailableXHR(false);
            if (auraXHR) {
                if (!this.send(auraXHR, foreground, "POST")) {
                    this.releaseXHR(auraXHR);
                }
            }
        }
        // If we don't have an XHR, that means we need to try to send later.
        if (!auraXHR) {
            this.actionsDeferred = this.actionsDeferred.concat(foreground);
        }
    }

    if (publiclyCacheable.length) {
        this.sendAsSingle(publiclyCacheable, publiclyCacheable.length, { background: false });
    }

    if (publiclyCacheableAndBackground.length) {
        this.sendAsSingle(publiclyCacheableAndBackground, publiclyCacheableAndBackground.length, { background: true });
    }

    if (background.length) {
        this.sendAsSingle(background, background.length, { background: true });
    }

    if (deferred.length) {
        if (this.idle()) {
            this.sendAsSingle(deferred, deferred.length, { background: true });
        } else {
            this.actionsDeferred = this.actionsDeferred.concat(deferred);
        }
    }
};

/**
 * Send a group of actions as single action XHRs or re-enqueue them.
 *
 * All actions in the group will either be sent, marked as dupes, or put back in
 * the deferred queue.
 *
 * @private
 * @param {Array} actions the set of actions to send.
 * @param {int} count the number of actions to send.
 * @param {Options} options extra options for the send, allows callers to set headers and background option
 */
AuraClientService.prototype.sendAsSingle = function(actions, count, options) {
    var i;
    var sent = 0;
    var auraXHR;
    var action;
    var background = options && options.background;

    for (i = 0; i < actions.length; i++) {
        action = actions[i];
        // We use 'deDupe' here with sending === false to ensure that we don't put an action
        // in the set of duplicate actions that does not get sent.
        if (this.deDupe(action, false)) {
            continue;
        }
        auraXHR = undefined;
        if (sent < count) {
            sent += 1;
            auraXHR = this.getAvailableXHR(background);
            if (auraXHR) {
                if (!this.send(auraXHR, [ action ], action.isPubliclyCacheable() ? "GET" : "POST", options)) {
                    this.releaseXHR(auraXHR);
                }
            }
        }
        if (!auraXHR) {
            this.actionsDeferred.push(action);
        }
    }
};

/**
 * Continue with completions, running all action callbacks.
 *
 * This is used when the actions are stored, and we wish to run them after the XHRs
 * might have been sent.
 */
AuraClientService.prototype.continueCompletions = function() {
    var that = this;

    if (this.collector.completionIndex < this.collector.actionsToComplete.length) {
        setTimeout(function() {
            var collected = [ null ];
            var completion = that.collector.actionsToComplete[that.collector.completionIndex];
            that.executeStoredAction(completion["action"], completion["response"], collected, 0);
            that.collector.completionIndex += 1;
            if (collected[0]) {
                that.enqueueAction(collected[0]);
            }
            that.continueCompletions();
        }, 0);
    } else {
        if (this.actionsQueued.length) {
            this.continueProcessing();
        } else {
            this.finishProcessing();
        }
    }
};

/**
 * finish up processing, force a rerender.
 */
AuraClientService.prototype.finishProcessing = function() {
    this.setInCollection();
    try {
        $A.renderingService.rerenderDirty();
    } finally {
        this.clearInCollection();
        if (this.actionsQueued.length > 0) {
            this.continueProcessing();
        } else {
            this.collector = undefined;
        }
    }
};

/**
 * Check, and then dedupe actions that are duplicates.
 *
 * @param {Action} action the action to dedupe.
 * @param {Boolean} sending true if we are sending and should create an entry.
 * @return true if the action has been deduped.
 */
AuraClientService.prototype.deDupe = function(action, sending) {
    var key, entry, dupes;

    if (!action.isStorable()) {
        return false;
    }
    try {
        key = action.getStorageKey();
    } catch (e) {
        return false;
    }
    entry = this.actionStoreMap[key];
    if (entry && !(entry.action.getState() === 'NEW' || entry.action.getState() === 'RUNNING')) {
        dupes = entry.dupes;
        $A.warning("Unfinished handling of action for key "+key);
        entry = undefined;
    }
    if (!entry) {
        //
        // If we are not sending the action now, just abort here, it was not a
        // dupe. This allows deDupe to be used on actions that are in a queue instead
        // of being sent.
        //
        if (!sending) {
            return false;
        }
        entry = {};
        entry.action = action;
        if (dupes) {
            entry.dupes = dupes;
        }
        this.actionStoreMap[key] = entry;
        this.actionStoreMap[action.getId()] = key;
        return false;
    } else if (entry.action !== action) {
        if (!entry.dupes) {
            entry.dupes = [ action ];
        } else {
            entry.dupes.push(action);
        }
        return true;
    }
    return false;
};

AuraClientService.prototype.getAndClearDupes = function(key) {
    if (!key || !this.actionStoreMap[key]) {
        return undefined;
    }
    var entry;
    var dupes;

    // we have a mapping.
    entry = this.actionStoreMap[key];
    dupes = entry.dupes;
    delete this.actionStoreMap[entry.action.getId()];
    delete this.actionStoreMap[key];
    return dupes;
};

/**
 * Send an xhr with a set of actions.
 *
 * The only note here is that if we fail to serialize the actions for any reason, we will log an
 * error and error out the actions. This is because we don't have a way of determining which of the
 * actions errored out.
 *
 * Used for instrumentation.
 *
 * @param auraXHR the wrapped XHR.
 * @param actions the set of actions to send.
 * @param method GET or POST. GET method is for publicly cacheable actions.
 * @param options extra options for the send, allows callers to set headers and background option
 * @return true if the XHR was sent, otherwise false.
 */
AuraClientService.prototype.send = function(auraXHR, actions, method, options) {
    options = options || { background: false };
    var actionsToSend = [];
    var actionDefs = [];
    var that = this;
    var action;
    var context = $A.getContext();
    var i;
    var actionDef;

    for (i = 0; i < actions.length; i++) {
        action = actions[i];
        if (!action.callAllAboardCallback(context)) {
            action.finishAction(context);
            continue;
        }
        if (this.deDupe(action, true)) {
            continue;
        }
        auraXHR.addAction(action);
        if (action.isChained()) {
            continue;
        }
        actionsToSend.push(action.prepareToSend());
        actionDef = action.getDef();
        actionDefs.push(actionDef);
    }

    if (actionsToSend.length === 0) {
        return false;
    }

    var processed = false;
    var timedOut = false;
    var timerId = undefined;
    var marker = Aura.Services.AuraClientServiceMarker++;
    var qs, url;
    var loc = window.location;
    try {
        var params = {
            "message"      : $A.util.json.encode({ "actions" : actionsToSend }),
            "aura.context" : context.encodeForServer(method === "POST", method === "GET")
        };

        if (method === "GET") {
            // Indicate the GET request is an action
            params["aura.isAction"] = true;
        } else {
            // Send page URI
            // This is not sent for cacheable GET requests as it will vary the url, we'll fallback to referer header on the server side
            params["aura.pageURI"] = loc.pathname + loc.search + loc.hash;
            params["aura.token"] = this._token;
        }

        qs = this.buildParams(params);
    } catch (e) {
        for (i = 0; i < actions.length; i++) {
            action = actions[i];
            action.markException(e);
            action.finishAction(context);
        }
        $A.error("failed to generate parameters for action xhr for action: " + actionsToSend[0], e);
        return false;
    }

    if (method === "GET") {
        // for cacheable (GET) requests we don't want the marker parameter
        // or the action name list and we want the query string in the URL
        url = this._host + "/aura?" + qs;
    } else {
        url = this._host + "/aura?r=" + marker + "&" + this.buildActionNameList(actionsToSend, actionDefs);
    }

    auraXHR.background = options.background;
    auraXHR.length = qs.length;
    auraXHR.request = this.createXHR();
    auraXHR.request["open"](method, url, this._appNotTearingDown);
    auraXHR.marker = marker;
    auraXHR.url = url;

    if (this._appNotTearingDown && "withCredentials" in auraXHR.request) {
        auraXHR.request["withCredentials"] = true;
    }

    //
    // Careful! On some browsers "onreadystatechange" is a write only property, so make
    // sure that we only write it. And for safety's sake, just write it once.
    //
    var onReady = function() {
        // Ordering is important. auraXHR will no longer be valid after processed.
        if (processed === false && (auraXHR.request["readyState"] === 4 || timedOut)) {
            processed = true;

            if (timerId !== undefined) {
                that.xhrClearTimeout(timerId);
            }

            that.receive(auraXHR, timedOut);
        }
    };

    if(this.currentAccess&&this.inAuraLoop()){
        onReady = $A.getCallback(onReady);
    }

    auraXHR.request["onreadystatechange"] = onReady;

    if (options["headers"]) {
        var key, headers = options["headers"];

        for (key in headers) {
            if (headers.hasOwnProperty(key)) {
                auraXHR.request.setRequestHeader(key, headers[key]);
            }
        }
    }

    if (this.authorizationToken) {
        auraXHR.request.setRequestHeader('Authorization', this.authorizationToken);
    }
    if (qs && method === "POST") {
        auraXHR.request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=ISO-8859-13');
        auraXHR.request["send"](qs);
    } else if (method !== "POST") {
        auraXHR.request["send"]();
    } else {
        return false;
    }

    // start the timer if necessary
    if (this.xhrTimeout !== undefined) {
        timerId = this.xhrSetTimeout(function() {
            timedOut = true;
            timerId = undefined;
            onReady();
        });
    }

    // legacy code, spinner actually relies on the waiting event, need a proper fix
    setTimeout(function() {
        $A.eventService.getNewEvent("markup://aura:waiting").fire();
    }, 1);

    this.lastSendTime = Date.now();
    return true;
};

/**
* Prepares the request
*/
AuraClientService.prototype.prepareRequest = function (actions) {
    var params = {
        "message"      : $A.util.json.encode({ "actions" : actions }),
        "aura.context" : $A.getContext().encodeForServer(true),
        "aura.token"   : this._token
    };

    return this.buildParams(params);
};

/**
 * Send beacon
 *
 * @returns true if payload was successfully sent to the server.
 * sendBeacon will return false if the payload is too large for the browser to queue
 * At the time of this comment, the limit was 64kB, but that can change
 * @export
 */
AuraClientService.prototype.sendBeacon = function(action) {
    if (window.navigator && window.navigator["sendBeacon"] && window.Blob) {
        try {
            var blobObj = new Blob([this.prepareRequest([action])], {
                "type" : "application/x-www-form-urlencoded; charset=ISO-8859-13"
            });
            return window.navigator["sendBeacon"](this._host + "/auraAnalytics", blobObj);
        } catch (e) {
            $A.warning('Unable to parse action payload');
        }
    } else {
        $A.enqueueAction(action);
        // enqueueAction doesn't have the sendBeacon size limit. so this just succeeds
        return true;
    }
};

/**
 * Sets a timeout for use by the XHR timeout mechanism. Hook for testing.
 * @private
 */
AuraClientService.prototype.xhrSetTimeout = function(f) {
    return setTimeout(f, this.xhrTimeout);
};

/**
 * Clears a timeout used by the XHR timeout mechanism. Hook for testing.
 * @private
 */
AuraClientService.prototype.xhrClearTimeout = function(id) {
    return clearTimeout(id);
};



/**
 * @returns {Object} An XHR based on what is available on the current browser.
 * @private
 */
AuraClientService.prototype.createXHR = function() {
    if (this.httpType) {
        if (this.httpType === 'generic') {
            return new XMLHttpRequest();
        } else if (this.httpType === 'msxml2') {
            return new ActiveXObject("Msxml2.XMLHTTP");
        } else {
            return new ActiveXObject("Microsoft.XMLHTTP");
        }
    }
    // UGLY!!!!
    if (window.ActiveXObject) {
        try {
            this.httpType = 'msxml2';
            return new ActiveXObject("Msxml2.XMLHTTP");
        } catch (e) {
            this.httpType = 'msxml';
            // If this throws, we are out of ideas anyway, so just "let it throw, let it throw, let it throw".
            return new ActiveXObject("Microsoft.XMLHTTP");
        }
    } else {
        throw new $A.auraError("AuraClientService.createXHR: Unable to find an appropriate XHR");
    }
};

/**
 * Create an encoded string of parameters.
 *
 * @param {Map} map A map of parameter names and values
 * @returns {String} The encoded parameters
 * @private
 */
AuraClientService.prototype.buildParams = function(map) {
    var arr = [];
    var first = true;
    for (var key in map) {
        if (!first) {
            arr.push("&");
        }
        first = false;
        if ($A.util.isArray(map[key])) {
            var valueArray = map[key];
            if (valueArray.length === 0) {
                arr.push(key);
                arr.push("=");
            } else {
                for ( var i = 0; i < valueArray.length; i++) {
                    if (i > 0) {
                        arr.push("&");
                    }
                    arr.push(key);
                    arr.push("=");
                    arr.push(encodeURIComponent(valueArray[i]));
                }
            }
        } else {
            arr.push(key);
            arr.push("=");
            arr.push(encodeURIComponent(map[key]));
        }
    }
    return arr.join("");
};

/**
 * Create an encoded query string with action names and their occurrence count.
 *
 * @param {Action[]} actions  The list of actions.
 * @returns {String}          The encoded query string.
 * @private
 */
AuraClientService.prototype.buildActionNameList = function(actions, actionDefs) {
    var i, map = {};

    for (i = 0; i < actions.length; i++) {
        var actionDescriptor = actions[i]["descriptor"];
        var parts = actionDescriptor.split('/');
        var controllerMethod = parts.pop().split("$").pop();
        var controllerParts = parts.pop().split(".");
        var controller = controllerParts.pop();
        var index = controller.indexOf("Controller", controller.length - "Controller".length);
        if ( index > 0 ) {
            controller = controller.substring(0, index);
        }
        var pkg;
        if ( controllerParts.length === 0 ) {
            if ( parts[0] === "aura:" ) {
                pkg = "aura";
            } else {
                pkg = "other";
            }
        } else if (actionDefs && actionDefs[i] && actionDefs[i].getActionGroup()) {
            pkg = actionDefs[i].getActionGroup();
        } else {
            pkg = controllerParts.join("-");
        }

        var actionName = pkg + "." + controller + "." + controllerMethod;

        map[actionName] = map[actionName] ? map[actionName] + 1 : 1;
    }

    var arr = [];
    var keys = Object.keys(map).sort();
    for (i = 0; i < keys.length; i++) {
        if ( i > 0 ) {
            arr.push("&");
        }
        var key = keys[i];
        arr.push(key, "=", encodeURIComponent(map[key]));
    }
    var list = arr.join("");
    if (list.length > AuraClientService.MAX_ACTION_QUERY_LENGTH) {
        list = list.substring(0, list.lastIndexOf("&", AuraClientService.MAX_ACTION_QUERY_LENGTH));
    }
    return list;
};

/**
 * This function is only meant to be used for the corner case of preloading actions before Aura is available
 * It gets the actions that were preloaded ahead of time, a map with actionIds, and the prelaod XHR response object
 * Basically is like a regular server action but re-wiring the server results manually
 * @export
 */
AuraClientService.prototype.hydrateActions = function(actions, preloadMapId, response) {
    var i;
    var action;
    var xhr = this.getAvailableXHR(true);

    // If we don't have an XHR, that means we need to try to send later.
    if (!xhr) {
        for (i = 0; i < actions.length; i++) {
            action = actions[i];
            this.actionsDeferred.unshift(action);
        }
        return;
    }

    xhr.request = response;

    for (i = 0; i < actions.length; i++) {
        action = actions[i];
        var id = preloadMapId[action.getId()];
        if (id) {
            action.setId(id);
        }
        xhr.addAction(action);
    }

    this.receive(xhr);
};

/**
 * This function is only meant to be used for the corner case of preloading actions before Aura is available
 * It gets the actions that were preloaded ahead of time, a map with actionIds, and the prelaod XHR response object
 * Basically is like a regular server action but re-wiring the server results manually
 *
 * @param {Object[]} rawResponses - collection of rawResponse objects with shape {{Number}status, {String}responseText}
 * @return {Promise<ReifyResult>} a promise that resolves to the actions contained in the rawResponse
 */
AuraClientService.prototype.reifyActions = function(rawResponses) {
    var context = $A.getContext();
    var actionsToPersist = [], nonStorableActions = [], error = null;
    rawResponses.forEach(function (rawResponse) {
        var response = this.decode(rawResponse);
        if (response["status"] === "SUCCESS") {
            var reponsePayload = response["message"];
            var responseContext = reponsePayload["context"];
            var responseActions = reponsePayload["actions"];

            // Merge Context
            context['merge'](responseContext, true /* ignoreMissmatch */);
            $A.componentService.saveDefsToStorage(responseContext, context);

            responseActions.forEach(function (responseAction) {
                var action = this.buildStorableServerAction(responseAction);
                if (action) {
                    actionsToPersist.push(action);
                } else {
                    nonStorableActions.push(responseAction);
                }
            }, this);
        } else {
            // Send the new token in case of INVALID SESSION so that clients can implement their own retry logic.
            var newToken;
            if(response["status"] === AuraClientService.INVALID_SESSION_RETURN_STATUS) {
                var event = response["event"];
                var data = {};
                if(event) {
                    newToken = event["attributes"] &&
                           event["attributes"]["values"] &&
                           event["attributes"]["values"]["newToken"];

                    if(this.isValidToken(newToken) && newToken !== this._token) {
                        data["newToken"] = newToken;
                    }
                }
            }
            error = {"status": response["status"], "message": response["message"], "data": data};
        }
    }, this);

    return this.persistStorableActions(actionsToPersist)["then"](function () {
        return { "storableActions": actionsToPersist, "nonStorableActions": nonStorableActions, "error": error };
    });
};

/**
 * Callback for an XHR for a set of actions.
 *
 * This function does all of the processing for a set of actions that come back from the server. It correctly deals
 * with the case of interrupted communications, and handles aborts.
 *
 * @param {AuraXHR} auraXHR the xhr container.
 * @param {Boolean} timedOut true if the XHR timed out, false otherwise.
 * @private
 */
AuraClientService.prototype.receive = function(auraXHR, timedOut) {
    var responseMessage;
    this.auraStack.push("AuraClientService$receive");
    try {
        responseMessage = this.decode(auraXHR.request, timedOut);

        if (responseMessage["status"] === "SUCCESS") {
            this.processResponses(auraXHR, responseMessage["message"]);
        } else if (responseMessage["status"] === "INCOMPLETE") {
            this.processIncompletes(auraXHR);
        } else if (responseMessage["status"] === "ERROR") {
            this.processErrors(auraXHR, responseMessage["message"]);
        } else if (responseMessage["status"] === AuraClientService.INVALID_SESSION_RETURN_STATUS) {
            this.retryActions(auraXHR, responseMessage["event"]);
        } else if (responseMessage["status"] === AuraClientService.SYSTEM_EXCEPTION_EVENT_RETURN_STATUS) {
            this.processSystemError(auraXHR);
        }
        this.fireDoneWaiting();
    } catch (e) {
        if (e instanceof $A.auraError) {
            if (e.action) {
                var failingCmp = e.action.getComponent();
                if (failingCmp) {
                    // if error has action, using the component associated with the action
                    var descriptor = failingCmp.getDef().getDescriptor().toString();
                    e.setComponent(descriptor);
                }
            }
            throw e;
        }

        // There might be some handling gap here. We may need action info to report error correctly.
        throw new $A.auraError("AuraClientService.receive action callback failed", e);

    } finally {
        this.auraStack.pop();
        this.releaseXHR(auraXHR);
        this.process();
    }

    return responseMessage;
};

/**
 * Retries in-flight actions on the given XHR due to a failed server response (invalidSession)
 * @param auraXHR originating auraXHR
 * @param event parsed server event in the originating response
 */
AuraClientService.prototype.retryActions = function(auraXHR, event) {
    var newToken = event["attributes"] &&
                   event["attributes"]["values"] &&
                   event["attributes"]["values"]["newToken"];
    if (this.isValidToken(newToken) && newToken !== this._token) {
        this.setToken(newToken, true);

        $A.log("[AuraClientService.retryActions]: New token received, attempting to retry failed actions");
        for (var name in auraXHR.actions) {
            if (auraXHR.actions[name].getRetryCount() < this.maxActionRetries) {
                auraXHR.actions[name].incrementRetryCount();
                this.enqueueAction(auraXHR.actions[name]);
            } else {
                $A.log("[AuraClientService.retryActions]: Exceeded action retry limit");
                this.throwExceptionEvent({event: event});
                this.processSystemError(auraXHR);
                break;
            }
        }
    }
    else {
        $A.log("[AuraClientService.retryActions]: Could not retry actions, no token received.");
        this.throwExceptionEvent({event: event});
        this.processSystemError(auraXHR);
    }
};

/**
 * Returns true if the token is of valid format
 */
AuraClientService.prototype.isValidToken = function(token) {
    return ($A.util.isString(token) && !$A.util.isEmpty(token) && token !== AuraClientService.INVALID_CSRF);
};

/**
 * Mark actions from an XHR response as being in the error state and set the error on the actions.
 *
 * @param {AuraXHR} auraXHR The xhr container.
 * @param {String} errorMessage The error message to associate with the actions.
 * @private
 */
AuraClientService.prototype.processErrors = function(auraXHR, errorMessage) {
    var action;
    var actions = auraXHR.actions;
    for (var id in actions) {
        if (actions.hasOwnProperty(id)) {
            action = actions[id];
            var error = new Error(errorMessage);
            $A.warning("Error in the server action response:" + errorMessage);

            try {
                action.markError($A.getContext(), [error]);
            } catch (e) {
                if (e instanceof $A.auraError) {
                    throw e;
                }

                // if callback is not in aura loop, non AuraError gets caught
                var auraError = new $A.auraError("Error happened when processing action errors", e);
                auraError.action = action;
                throw auraError;
            }
        }
    }
};

/**
 * Remove actions from storeMap when the response is SYSTEMERROR
 *
 * @private
 */
AuraClientService.prototype.processSystemError = function(auraXHR) {
    var action;
    var actions = auraXHR.actions;
    for (var id in actions) {
        if (actions.hasOwnProperty(id)) {
            if (this.actionStoreMap[id]) {
                action = actions[id];
                delete this.actionStoreMap[id];
                delete this.actionStoreMap[action.getStorageKey()];
            }
        }
    }
};

AuraClientService.prototype.addAllDefsToMap = function(defs, map) {
    if ($A.util.isArray(defs)) {
        for (var i=0, length=defs.length; i<length; i++) {
            if (defs[i]["descriptor"]){
                map[defs[i]["descriptor"]] = defs[i];
            }
        }
        return;
    }
    for (var def in defs) {
        map[def] = defs[def];
    }
};

AuraClientService.prototype.extractAllDefs = function(config) {
    var descriptors = {};

    this.addAllDefsToMap(config["componentDefs"], descriptors);
    this.addAllDefsToMap(config["libraryDefs"], descriptors);
    this.addAllDefsToMap(config["eventDefs"], descriptors);
    this.addAllDefsToMap(config["moduleDefs"], descriptors);

    this.addAllDefsToMap(config["descriptorUids"], descriptors);

    // include loaded as actions to the server "safely" assume these already exist on the client
    var loaded = Object.keys($A.getContext().loaded);
    for (var i=0, length=loaded.length; i<length; i++) {
        var def = loaded[i];
        if ($A.util.isString(def)) {
            if (def.indexOf("@") >= 0) {
                // exclude applications from being checked with URI defs.
                // it is never valid to fetch an Application definition
                if (def.indexOf("APPLICATION@") === -1) {
                    descriptors[def.split("@")[1]] = $A.getContext().loaded[def];
                }
            } else {
                descriptors[def] = $A.getContext().loaded[def];
            }
        }
    }

    return descriptors;
};

AuraClientService.prototype.processResponses = function(auraXHR, responseMessage) {
    /// ******* The order of parameters to this method matter. They are used in overrides *******
    var action, actionResponses, response, dupes;
    var token = responseMessage["token"];
    if (token) {
        this.setToken(token);
    }
    var context=$A.getContext();
    var priorAccess=this.currentAccess;
    var allDefsInContextResponse = {};

    if(!priorAccess){
        this.setCurrentAccess($A.getRoot());
    }
    try {
        if ("context" in responseMessage) {
            var responseContext = responseMessage["context"];
            context['merge'](responseContext);
            $A.componentService.saveDefsToStorage(responseContext, context)["then"](undefined,
                // swallow any errors returned
                function(){});
            allDefsInContextResponse = this.extractAllDefs(responseContext);
        }
    } catch (e) {
        $A.logger.reportError(e);
    }finally{
        if(!priorAccess){
            this.releaseCurrentAccess();
        }
    }

    // Look for any Client side event exceptions
    var events = responseMessage["events"];
    if (events) {
        for ( var en = 0, len = events.length; en < len; en++) {
            try {
                this.parseAndFireEvent(events[en]);
            } catch (e) {
                $A.logger.reportError(e);
            }
        }
    }

    actionResponses = responseMessage["actions"];
    if (actionResponses === undefined) {
        // We got an event back, but no actions. This means that the event was
        // catastrophic for the XHR, and we should abort all of them. Note, this
        // is slightly dangerous, since we don't really know what went wrong.
        // It may be that we should flag it as an error instead, but that is less
        // than certain.
        // FIXME(GO): we should be clearing out the actions here, but I'm not sure
        // what the correct thing to do is. The problem with unclear APIs
        // this.processIncompletes(auraXHR);
        return;
    }

    var actionsToPersist = [];

    // Process each action and its response
    for ( var r = 0; r < actionResponses.length; r++) {
        action = null;
        try {
            response = actionResponses[r];

            $A.assert((!response["id"] ? actionResponses.length === 1 : true), "When an action has no ID, there should be only one action in the response.");

            action = auraXHR.getAction(response["id"]);
            if (action) {
                if (response["storable"] && !action.isStorable()) {
                    action.setStorable();
                }
            } else {
                // the client didn't request the action response but the server sent it so
                // a component is priming the actions cache. if the response isn't success
                // (which should never happen) then skip processing the action
                if (response["state"] !== "SUCCESS") {
                    continue;
                }

                action = this.buildStorableServerAction(response);
            }
            if (!action) {
                throw new $A.auraError("Unable to find an action for "+response["id"]+": "+response);
            } else {
                var defDependencies;
                if (Object.keys(allDefsInContextResponse).length > 0) {
                    defDependencies = allDefsInContextResponse;
                    action.defDependencies = defDependencies;
                }

                actionsToPersist.push(action);
                var key = this.actionStoreMap[action.getId()];
                dupes = this.getAndClearDupes(key);
                this.singleAction(action, response);
                if (dupes) {
                    for (var i = 0; i < dupes.length; i++) {
                        dupes[i].defDependencies = defDependencies;
                        this.singleAction(dupes[i], response);
                    }
                }

            }
        } catch (e) {
            if (e instanceof $A.auraError) {
                throw e;
            }

            // if callback is not in aura loop, non AuraError gets caught
            var auraError = new $A.auraError("Error happened when processing action responses", e);
            auraError.action = action;
            throw auraError;
        }
    }

    this.persistStorableActions(actionsToPersist);
};

AuraClientService.prototype.buildStorableServerAction = function(response) {
    var action = null;
    if (response["storable"]) {
        //
        // Hmm, we got a missing action. We allow this in the case that we have
        // a storable action from the server (i.e. we are faking an action from the
        // server to store data on the client. This is only used in priming, and is
        // more than a bit of a hack.
        //
        // Create a client side action instance to go with the server created action response
        //
        var descriptor = response["action"];
        var actionDef = $A.componentService.getActionDef(descriptor);
        if (!actionDef) {
            // No action.
            throw new $A.auraError("Missing action definition for "+descriptor);
        }
        action = actionDef.newInstance();
        action.setStorable();
        if (response["params"]) {
            action.setParams(response["params"]);
        }
        action.updateFromResponse(response);
    }
    return action;
};

AuraClientService.prototype.processIncompletes = function(auraXHR) {
    var actions = auraXHR.actions;
    var id, action, key, dupes;

    for (id in actions) {
        if (actions.hasOwnProperty(id)) {
            try {
                action = actions[id];
                action.incomplete($A.getContext());
                key = this.actionStoreMap[action.getId()];
                dupes = this.getAndClearDupes(key);
                if (dupes) {
                    for (var i = 0; i < dupes.length; i++) {
                        dupes[i].incomplete($A.getContext());
                    }
                }
            } catch (e) {
                if (e instanceof $A.auraError) {
                    throw e;
                }

                // if callback is not in aura loop, non AuraError gets caught
                var auraError = new $A.auraError("Error happened when processing incompleted actions", e);
                auraError.action = action;
                throw auraError;
            }
        }
    }
};

/**
 * A utility to handle events passed back from the server.
 */
AuraClientService.prototype.parseAndFireEvent = function(evtObj) {
    var descriptor = evtObj["descriptor"];

    if (evtObj["eventDef"]) {
        // register the event with the EventDefRegistry
        $A.eventService.createEventDef(evtObj["eventDef"]);
    }

    if ($A.eventService.hasHandlers(descriptor)) {
        var evt = $A.getEvt(descriptor);
        if (evtObj["attributes"]) {
            evt.setParams(evtObj["attributes"]["values"]);
        }

        evt.fire();
    }
};

/**
 * Set the token.
 *
 * @param {String} token The new token.
 * @param {Boolean} saveToStorage True to save the token to storage, false to not save.
 * @param {Boolean} broadcast True to broadcast token to existing windows/tabs
 * @memberOf AuraClientService
 * @private
 */
AuraClientService.prototype.setToken = function(newToken, broadcast) {
    var oldToken = this._token;
    this._token = newToken;

    if (broadcast && this.tokenSharing && (!oldToken || (newToken !== oldToken))) {
        this.broadcastToken(newToken);
    }
};

/**
 * Broadcasts token to other open tabs to prevent stale token usage after a re-issue from the server.
 *
 * @param {String} newToken The new token to broadcast.
 * @private
 */
AuraClientService.prototype.broadcastToken = function(newToken) {
    if (this.tokenSharing) {
        $A.log("[AuraClientService.broadcastToken]: Broadcasting new token.");
        window.localStorage.setItem(AuraClientService.TOKEN_KEY, newToken);
    }
};

/**
 * Establish event listener for receiving broadcasted tokens
 * @private
 */
AuraClientService.prototype.setupTokenListener = function() {
    if (this.tokenSharing) {
        var self = this;
        if (window.addEventListener) {
            window.addEventListener("storage", function(event) {
                if (event.key === AuraClientService.TOKEN_KEY && event.newValue && event.oldValue !== event.newValue) {
                    $A.log("[AuraClientService.tokenListener]: Received new token.");
                    self._token = event.newValue;

                    // local storage is synchronous, other tabs will still receive the updated value before this delete
                    window.localStorage.removeItem(AuraClientService.TOKEN_KEY);
                }
            });
        }
    }
};

/**
 * Set the token.
 *
 * @param {String} token the new token.
 * @memberOf AuraClientService
 * @export
 */
AuraClientService.prototype.resetToken = function(newToken) {
    this.setToken(newToken);
};


/**
 * Inject a component and set up its event handlers. For Integration
 * Service.
 *
 * FIXME: this should be private.
 *
 * @param {Object} rawConfig the config for the component to be injected
 * @param {String} locatorDomId the DOM id where we should place our element.
 * @param {String} localId the local id for the component to be created.
 * @memberOf AuraClientService
 * @export
 */
AuraClientService.prototype.injectComponent = function(config, locatorDomId, localId) {
    // Save off any context global stuff like new labels
    var context = $A.getContext();
    context['merge'](config["context"]);
    var priorAccess = this.currentAccess;

    // workaround for client library. register client libraries on injected component
    this.initializeClientLibraries();

    var actionResult = config["actions"][0];
    var action = $A.get("c.aura://ComponentController.getComponent");
    var self = this;

    action.setCallback(action, function(a) {
        var root = $A.getRoot();
        if(!priorAccess){
            self.setCurrentAccess(root);
        }
        try {
            var element = $A.util.getElement(locatorDomId);

            // Check for bogus locatorDomId
            var errors;
            if (!element) {
                // We have no other place to display this
                // critical failure - fallback to the
                // document.body
                element = document.body;
                errors = [
                        "Invalid locatorDomId specified - no element found in the DOM with id=" + locatorDomId
                ];
            } else {
                errors = a.getState() === "SUCCESS" ? undefined : action.getError();
            }

            var componentConfig;
            if (!errors) {
                componentConfig = a.getReturnValue();
            } else {
                //
                // Make sure we clear any configs associated with the action.
                //
                $A.getContext().clearComponentConfigs(a.getId());
                //
                // Display the errors in a ui:message instead
                //
                componentConfig = self.createIntegrationErrorConfig(errors);
            }

            $A.util.apply(componentConfig, {
                "localId" : localId,
                "attributes" : {
                    "valueProvider" : root
                }
            }, null, true);

            var c = $A.componentService.createComponentPriv(componentConfig);

            if (!errors) {
                // Wire up event handlers
                self.addComponentHandlers(c, config["actionEventHandlers"]);
            }

            var body = root.get("v.body");
            body.push(c);

            // Do not let Aura consider this initial setting into the surrogate app as a candiadate for rerendering
            root.set("v.body", body, true);

            $A.render(c, element);

            $A.afterRender(c);
        } finally {
            if (!priorAccess) {
                self.releaseCurrentAccess();
            }
        }
    });

    action.updateFromResponse(actionResult);
    action.finishAction($A.getContext());
};

/**
 * Create error component config to display integration service errors
 *
 * @param {(String|String[])} errorText
 * @returns {Object} error config for ui:message
 */
AuraClientService.prototype.createIntegrationErrorConfig = function(errorText) {
    return {
        "componentDef" : {
            "descriptor" : "markup://ui:message"
        },

        "attributes" : {
            "valueProvider": $A.getRoot(),
            "values" : {
                "title" : "Aura Integration Service Error",
                "severity" : "error",
                "body" : [
                    {
                        "componentDef" : {
                            "descriptor" : "markup://ui:outputText"
                        },

                        "attributes" : {
                            "values" : {
                                "value" : $A.util.json.encode(errorText)
                            }
                        }
                    }
                ]
            }
        }
    };
};

/**
 * Used within async callback for AIS.
 *
 * @param {Component} component - component
 * @param {String} locator - parent element or the id of the parent element where to inject component
 * @param {Object} [actionEventHandlers] - event handlers
 */
AuraClientService.prototype.renderInjection = function(component, locator, actionEventHandlers) {
    var error = null;

    var stringLocator = $A.util.isString(locator);
    var hostEl = stringLocator ? document.getElementById(locator) : locator;

    if (!hostEl) {
        error = "Invalid locator specified - " + (stringLocator ? "no element found in the DOM with id=" + locator : "locator element not provided");
        hostEl = document.body;
    }

    if (component.isInstanceOf("aura:text")) {
        // check for component creation error
        error = component.get("v.value");
    }

    if (error) {
        // create same messaging as injectComponent
        var errorConfig = this.createIntegrationErrorConfig(error);
        errorConfig["localId"] = component.getLocalId();
        component = $A.componentService.createComponentPriv(errorConfig);
    }

    this.addComponentHandlers(component, actionEventHandlers);
    $A.render(component, hostEl);
    $A.afterRender(component);
};

/**
 * Use async created component for integration service
 *
 * @param {Object} config - component def config
 * @param {String} locator - parent element or the id of the parent element where to inject component
 * @param {Object} [eventHandlers] - handlers of registered event
 * @param {Function} callback The callback to use once the component is successfully created
 * @export
 */
AuraClientService.prototype.injectComponentAsync = function(config, locator, eventHandlers, callback) {
    var self = this;
    var priorAccess = this.currentAccess;
    var root = $A.getRoot();
    if (!priorAccess) {
        self.setCurrentAccess(root);
    }
    try {
        $A.componentService.newComponentAsync(undefined, function(component) {
            if (callback) {
                callback(component);
            }

            self.renderInjection(component, locator, eventHandlers);
        }, config, root, false, false, true);
    } finally {
        if (!priorAccess) {
            self.releaseCurrentAccess();
        }
    }

    // Now we go ahead and stick a label load on the request.
    var labelAction = $A.get("c.aura://ComponentController.loadLabels");
    labelAction.setCallback(this, function() {});
    self.enqueueAction(labelAction);
};

/**
 * Add handlers of registered events for AIS
 *
 * @param {Component} component - component
 * @param {Object} [actionEventHandlers] - handlers of registered events
 */
AuraClientService.prototype.addComponentHandlers = function(component, actionEventHandlers) {
    if (actionEventHandlers) {
        var containerValueProvider = {
            get : function(functionName) {
                var action=new Action();
                action.run=action.runDeprecated=window[functionName];
                return action;
            }
        };

        for (var evt in actionEventHandlers) {
            component.addHandler(evt, containerValueProvider, actionEventHandlers[evt]);
        }
    }
};

/**
 * Return whether Aura believes it is online.
 * Immediate and future communication with the server may fail.
 * @memberOf AuraClientService
 * @return {Boolean} Returns true if Aura believes it is online; false otherwise.
 * @export
 */
AuraClientService.prototype.isConnected = function() {
    return !this._isDisconnected;
};

/**
 * This function must be called from within an event loop.
 *
 * @param {Action} action the action to enqueue
 * @param {Boolean} background Set to true to run the action in the background, otherwise the value of action.isBackground() is used.
 * @export
 * @public
 * @platform
 */
AuraClientService.prototype.enqueueAction = function(action, background) {
    $A.assert($A.util.isAction(action), "Cannot call EnqueueAction() with a non Action parameter.");

    if (background) {
        $A.warning("$A.enqueueAction(): Do not use the deprecated background parameter. The parameter is not used anymore.");
    }

    if (this.allowFlowthrough) {
        // special queue if all criteria are met:
        // - server action
        // - not a refresh action
        // - does not have a cache hit (if storage is persistent but failed to populate stored actions, then assume a cache miss)
        //                             (if actions filter has not been set up yet, assume a cache miss)
        var isServerAction = action.getDef().isServerAction() && !action.isRefreshAction();
        if (isServerAction && !action.isCaboose() && this.isActionAbsentFromStorage(action)) {
            var auraXHR = this.getAvailableXHR(false);
            if (auraXHR) {
                if (!this.send(auraXHR, [action], action.isPubliclyCacheable() ? "GET" : "POST")) {
                    this.releaseXHR(auraXHR);
                }
                return;
            } // no XHR available; fall through to default behavior
        } // not a server action or cache refresh, and no cache hit
    }

    this.actionsQueued.push(action);
};

/**
 * This function is used in enqueueAction when hotspot flow is set.
 *
 * @param {Action} action the action
 * @returns {Boolean} true if the action storage key is guaranteed to not be accessible from storage; false if accessible or unknown.
 * @private
 */
AuraClientService.prototype.isActionAbsentFromStorage = function(action) {
    if (!action || !action.isStorable()) {
        return true;
    }

    // if storage is not persistent, it's a cache miss.
    if (!this.actionStorage.isStoragePersistent()) {
        return true;
    }

    // if actions filter is enabled and has not been set up yet, assume a cache miss
    if (this.actionStorage.isActionsFilterEnabled() && !this.actionStorage.isActionsFilterInitialized()) {
        return true;
    }

    return this.actionStorage.isKeyAbsentFromCache(action.getStorageKey());
};

/**
 * Determines whether an action is stored.
 *
 * @param {String} descriptor - action descriptor.
 * @param {Object} params - map of keys to parameter values.
 * @param {Function} callback - called asynchronously after the action was looked up in the cache. Fired with a
 * single parameter, isInStorge {Boolean} - representing whether the action was found in the cache.
 * @export
 */
AuraClientService.prototype.isActionInStorage = function(descriptor, params, callback) {
    callback = callback || this.NOOP;

    if (!$A.util.isString(descriptor) || !$A.util.isObject(params) || !this.actionStorage.isStorageEnabled()) {
        callback(false);
        return;
    }

    var key = Action.getStorageKey(descriptor, params);
    if (this.actionStorage.isStoragePersistent() && this.actionStorage.isKeyAbsentFromCache(key)) {
        callback(false);
        return;
    }

    this.actionStorage.get(key)["then"](
        function(value) {
            $A.run(function() {
                callback(!!value);
            });
        },
        function(err) {
            // storage.get() errored so assume repeating the request will also fail
            $A.warning("AuraClientService.isActionInStorage(): storage.get() threw " + err);
            callback(false);
        }
    );
};

/**
 * Resets the cache cleanup timer for an action.
 *
 * @param {String} descriptor - action descriptor.
 * @param {Object} params - map of keys to parameter values.
 * @param {Function} callback - called asynchronously after the action was revalidated. Called with a single
 * parameter, wasRevalidated {Boolean} - representing whether the action was found in the cache and
 * successfully revalidated.
 * @export
 */
AuraClientService.prototype.revalidateAction = function(descriptor, params, callback) {
    callback = callback || this.NOOP;

    if (!$A.util.isString(descriptor) || !$A.util.isObject(params) || !this.actionStorage.isStorageEnabled()) {
        callback(false);
        return;
    }

    var key = Action.getStorageKey(descriptor, params);
    if (this.actionStorage.isStoragePersistent() && this.actionStorage.isKeyAbsentFromCache(key)) {
        callback(false);
        return;
    }

    var that = this;
    this.actionStorage.get(key)["then"](
        function(value) {
            if (value) {
                that.actionStorage.set(key, value)["then"](
                    function() { callback(true); },
                    function(/*error*/) { callback(false); }
                );
            } else {
                callback(false);
            }
        },
        function(err) {
            $A.warning("AuraClientService.revalidateAction(): storage.get() threw " + err);
            callback(false);
        }
    );
};

/**
 * Clears an action out of the action cache.
 *
 * @param {String} descriptor action descriptor.
 * @param {Object} params map of keys to parameter values.
 * @param {Function} successCallback called after the action was invalidated. Called with true if the action was
 * successfully invalidated and false if the action was invalid or was not found in the cache.
 * @param {Function} errorCallback called if an error occurred during execution
 * @export
 */
AuraClientService.prototype.invalidateAction = function(descriptor, params, successCallback, errorCallback) {
    successCallback = successCallback || this.NOOP;
    errorCallback = errorCallback || this.NOOP;

    if (!$A.util.isString(descriptor) || !$A.util.isObject(params) || !this.actionStorage.isStorageEnabled()) {
        successCallback(false);
        return;
    }

    var key = Action.getStorageKey(descriptor, params);
    if (this.actionStorage.isStoragePersistent() && this.actionStorage.isKeyAbsentFromCache(key)) {
        successCallback(true);
        return;
    }

    this.actionStorage.remove(key)["then"](
        function() { successCallback(true); },
        errorCallback
    );
};

// ACCESS CONTROL
AuraClientService.prototype.isInternalNamespace = function(namespace) {
    return this.registeredNamespaces.internal.hasOwnProperty(namespace);
};

AuraClientService.prototype.isPrivilegedNamespace = function(namespace) {
    return this.registeredNamespaces.privileged.hasOwnProperty(namespace);
};

AuraClientService.prototype.getAccessStackHierarchy=function(){
    return this.currentAccess ? this.accessStack.map(function(component) {
        return "[" + component.getType() + "]";
    }).join(" > ") : "";
};

AuraClientService.prototype.setCurrentAccess=function(component){
    if(!component){
        component=this.currentAccess;
    }else{
        while(component instanceof PassthroughValue){
            component=component.getComponent();
        }
    }
    if(component){
        this.accessStack.push(component);
        this.currentAccess=component;
    }
};

AuraClientService.prototype.releaseCurrentAccess=function(){
    this.accessStack.pop();
    this.currentAccess=this.accessStack[this.accessStack.length-1];
};

AuraClientService.prototype.getAccessVersion = function(name) {
    var currentAccessCaller = this.accessStack[this.accessStack.length-2];
    var ret = null;
    if (currentAccessCaller) {
        var def = currentAccessCaller.getDef();
        if (def) {
            // return the version of currentAccessCaller if namespaces are the same
            if (def.getDescriptor().getNamespace() === name) {
                ret = currentAccessCaller.get("version");
            }
            else {
                ret = def.getRequiredVersionDefs().getDef(name);
                if (ret) {
                    ret = ret.getVersion();
                }
            }
        }
    }

    return ret;
};

AuraClientService.prototype.allowAccess = function(definition, component) {
    if(definition&&definition.getDescriptor){
        var currentAccess=this.currentAccess;
        if(definition.access==='G'){
            // GLOBAL means accessible from anywhere
            return true;
        }else if(definition.access==='p'){
            // PRIVATE means "same component only".
            return currentAccess&&(currentAccess===component||currentAccess.getComponentValueProvider()===component||currentAccess.getDef()===component);
        }else{
            // Compute PRIVILEGED, INTERNAL, PUBLIC, and default (omitted)
            if(!currentAccess){
                currentAccess=component;
            }
            if(currentAccess){
                var accessDef=null;
                var accessFacetDef=null;
                if(currentAccess.getComponentValueProvider&&currentAccess.getDef){
                    var accessFacetValueProvider = currentAccess.getComponentValueProvider();
                    accessFacetDef=accessFacetValueProvider&&accessFacetValueProvider.getDef();
                    accessDef=currentAccess.getDef();
                }else{
                    accessDef=currentAccess;
                }

                var accessDescriptor=accessDef&&accessDef.getDescriptor();
                var accessFacetDescriptor=accessFacetDef&&accessFacetDef.getDescriptor();
                var accessNamespace=accessDescriptor&&accessDescriptor.getNamespace();
                var accessFacetNamespace=accessFacetDescriptor&&accessFacetDescriptor.getNamespace();

                var allowProtocol=this.protocols.hasOwnProperty(accessDescriptor&&accessDescriptor.getPrefix()) || this.protocols.hasOwnProperty(accessFacetDescriptor&&accessFacetDescriptor.getPrefix());
                var isInternal=allowProtocol || this.registeredNamespaces.internal.hasOwnProperty(accessNamespace) || this.registeredNamespaces.internal.hasOwnProperty(accessFacetNamespace);

                if(definition.access==='PP') {
                    // PRIVILEGED means accessible to namespaces marked PRIVILEGED, as well as to INTERNAL
                    var isPrivileged=this.registeredNamespaces.privileged.hasOwnProperty(accessNamespace) || this.registeredNamespaces.privileged.hasOwnProperty(accessFacetNamespace);
                    if(isPrivileged || isInternal){
                        // Privileged Namespace
                        return true;
                    }
                }

                var effectiveAccess=definition.access||(isInternal?'I':'P');
                if(effectiveAccess==='P') {
                    // PUBLIC means "same namespace only"
                    var targetNamespace = definition.getDescriptor().getNamespace();
                    if (currentAccess === component || accessNamespace === targetNamespace || accessFacetNamespace === targetNamespace) {
                        return true;
                    }
                }

                if(effectiveAccess==="I"){
                    // Internal Namespace
                    return isInternal;
                }

            }
            // JBUCH: HACK: THIS DELIGHTFUL BLOCK IS BECAUSE OF LEGACY UNAUTHENTICATED/AUTHENTICATED ABUSE OF ACCESS ATTRIBUTE. COOL.
            return (definition.isInstanceOf && definition.isInstanceOf("aura:application")) ||
            // #if {"excludeModes" : ["PRODUCTION","PRODUCTIONDEBUG", "PERFORMANCEDEBUG"]}
            // JBUCH: HACK: REMOVE WHEN WE NO LONGER LOAD COMPONENTS DIRECTTLY FOR DEV/TEST
            (!$A.getRoot() || !$A.getRoot().isInstanceOf('aura:application')) && !this.currentAccess ||
            // #end
            false;
        }
    }
    return false;
};

/**
 * Handles invalidSession exception from the server when the CSRF token is invalid.
 * Saves the new token to storage then refreshes page.
 * @export
 */
AuraClientService.prototype.invalidSession = function(newToken) {
    // if new token provided then persist to storage and reload. if persisting
    // fails then we must go to the server for bootstrap.js to get a new token.
    if (this.isValidToken(newToken) && newToken !== this._token) {
        $A.log("[AuraClientService.invalidSession]: New Token provided, replacing existing token.");
        this.setToken(newToken, true);
    } else {
        // refresh (to get a new session id) and force bootstrap.js to the server
        // (to get a new csrf token).
        this.disableParallelBootstrapLoadOnNextLoad();
        $A.log("[AuraClientService.invalidSession]: Reloading the page.");
        this.hardRefresh();
    }
};

/**
 * Sets how Aura loads bootstrap.js: in parallel from network and cache,
 * or serially from network then cache. This must be called from a template's
 * auraPreInitBlock. By default this is enabled.
 * @param {Boolean} parallel if true parallelly load bootstrap.js from
 *  network and cache. If false load from network first (if it fails then
 *  load from cache).
 * @export
 */
AuraClientService.prototype.setParallelBootstrapLoad = function(parallel) {
    this._parallelBootstrapLoad = !!parallel;
};

/**
 * On next load, serially load bootstrap.js from network then cache.
 *
 * If a valid CSRF token is not available then on next load bootstrap.js must
 * go to the server to fetch a new and valid CSRF token.
 * @private
 */
AuraClientService.prototype.disableParallelBootstrapLoadOnNextLoad = function() {
    // can only get a cache hit on bootstrap.js with persistent storage
    if (this.actionStorage.isStoragePersistent()) {
        var duration = 1000*60*60*24*7; // 1 week
        $A.util.setCookie(this._disableBootstrapCacheCookie, "true", duration);
    }
};

/**
 * Clears disabling parallel load of bootstrap.js. See disableParallelBootstrapLoadOnNextLoad.
 * @private
 */
AuraClientService.prototype.clearDisableParallelBootstrapLoadOnNextLoad = function() {
    $A.util.clearCookie(this._disableBootstrapCacheCookie);
};

/**
 * Gets whether to check action cache for bootstrap.js.
 * @return {Boolean} true if the cache should be checked; false to skip the cache.
 */
AuraClientService.prototype.getParallelBootstrapLoad = function() {
    if (!this._parallelBootstrapLoad) {
        return false;
    }

    // check for cookie indicating disablement
    var cookie = $A.util.getCookie(this._disableBootstrapCacheCookie);
    return cookie !== "true";
};

/**
 * This is a temporary API to workaround a broken network stack found on Samsung
 * Galaxy S5/S6 devices on Android 5.x.
 *
 * Sets the timeout for all Aura-initiated XHRs.
 *
 * The timeout applies to each XHR. The timer starts when XHR.send() is invoked
 * and ends when XHR.onreadystatechange (readyState = 4) is fired. If the timeout
 * expires before XHR.onreadystatechange then the actions in the XHR are moved to
 * INCOMPLETE state.
 *
 * @param {Number} timeout The XHR timeout in milliseconds.
 * @memberOf AuraClientService
 * @export
 */
AuraClientService.prototype.setXHRTimeout = function(timeout) {
    $A.assert($A.util.isFiniteNumber(timeout) && timeout > 0, "Timeout must be a positive number");
    this.xhrTimeout = timeout;
};

/**
 * Populates the persisted actions filter if applicable.
 * @return {Promise} a promise that resolves when the action keys are loaded.
 */
AuraClientService.prototype.populateActionsFilter = function() {
    // if GVP didn't load then don't populate the filter, effectively hiding all persisted actions
    var context = $A.getContext();
    if (!context.globalValueProviders.LOADED_FROM_PERSISTENT_STORAGE) {
        return Promise["resolve"]();
    }

    return this.actionStorage.populateActionsFilter()
        ["then"](function(items) {
            $A.log("ActionStorage: restored " + (items ? Object.keys(items).length : 0) + " actions");
        });
};

/**
 * Enables or disables the persisted actions filter, required for multi-tab
 * environments that use storable actions.
 *
 * Actions can depend on defs. Defs are loaded from persistent storage at
 * framework init and so the same must be done for actions: loaded at framework
 * init. Otherwise storable actions may get cache hits that reference defs the
 * current tab does not have.
 *
 * @param {Boolean} enable true to enable the filter, false to disable the filter.
 * @export
 */
AuraClientService.prototype.setPersistedActionsFilter = function(enable) {
    this.actionStorage.enableActionsFilter(enable);
};

AuraClientService.prototype.clearActionsFilter = function () {
    this.actionStorage.clearActionsFilter();
};

/**
 * Returns Action storage
 * @returns {ActionStorage}
 */
AuraClientService.prototype.getActionStorage = function() {
    return this.actionStorage;
};

/**
 * Returns name of Action storage
 * @returns {String} name of Action storage
 */
AuraClientService.prototype.getActionStorageName = function() {
    return this.actionStorage.STORAGE_NAME;
};

/**
 * Returns the globalId for the owner component.
 * Used on component instantiation.
 * @return {String} GlobalId of parent component
 *
 * @private
 */
AuraClientService.prototype.getCurrentAccessGlobalId = function () {
    var owner = null;
    if(!$A.util.isUndefinedOrNull(this.currentAccess)) {
        owner = this.currentAccess.globalId;
    }

    return owner;
};

/**
 * If set, an Authorization header will be set with the value of the given token for every request.
 *
 * @param {String} token value to be set for every request
 * @export
 */
AuraClientService.prototype.setAuthorizationToken = function (token) {
    this.authorizationToken = token;
};

Aura.Services.AuraClientService = AuraClientService;
