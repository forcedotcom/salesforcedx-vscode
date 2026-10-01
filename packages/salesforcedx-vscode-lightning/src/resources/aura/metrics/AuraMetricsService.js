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
 * @description The Aura Metrics Service, accessible using <code>$A.metricsService</code>.
 * @constructor
 * @export
**/
Aura.Services.MetricsService = function MetricsService() {
    this.collector                 = { "default": [] };
    this.globalHandlers            = { "transactionEnd": [], "transactionsKilled": [] };
    this.bootstrap                 = { "cache" : {} };
    this.registeredPlugins         = {};
    this.pluginInstances           = {};
    this.beaconProviders           = {};
    this.transactions              = {};
    this.cacheStats                = {};
    this.doneBootstrap             = false;
    this.pluginsInitialized        = false;
    this.clearCompleteTransactions = true; // In PTEST Mode this is set to false (see initialize method)
    this.shouldLogBootstrap         = true;

    this.configurePerformanceAPILogging();
    
    // Public constants used for flagging page transactions
    this["PAGE_IN_DOM"] = "PageInDOM";
    this["PAGE_HAS_ERROR"] = "PageHasError";
    this["PAGE_NOT_LOADED"] = "PageNotLoaded";
    this["PREVIOUS_PAGE_NOT_LOADED"] = "PreviousPageNotLoaded";
    this["INTERACTION_BEFORE_PAGE_LOADED"] = "InteractionBeforePageLoaded";
    this["PAGE_IN_BACKGROUND_BEFORE_LOADED"] = "PageInBackgroundBeforeLoaded";
};

// Version
Aura.Services.MetricsService.VERSION  = '2.2.0';

Aura.Services.MetricsService.PERFTIME      = !!(window.performance && window.performance.now);
Aura.Services.MetricsService.TIMER         = Aura.Services.MetricsService.PERFTIME ? function () { return Math.floor(window.performance.now() * 100) / 100; } : Date.now.bind(Date);
Aura.Services.MetricsService.START         = 'start';
Aura.Services.MetricsService.END           = 'end';
Aura.Services.MetricsService.STAMP         = 'stamp';
Aura.Services.MetricsService.DEFAULT       = 'default';
Aura.Services.MetricsService.MAXTIME       = 30000; // Max time for a transaction to finish
Aura.Services.MetricsService.CUSTOM_MARKS  = 'custom';
Aura.Services.MetricsService.WARM          = 'WARM';
Aura.Services.MetricsService.COLD          = 'COLD';
Aura.Services.MetricsService.WARM_ESTIMATE = 'WARM_ESTIMATE';
Aura.Services.MetricsService.COLD_ESTIMATE = 'COLD_ESTIMATE';
Aura.Services.MetricsService.UNKNOWN       = 'UNKNOWN';
Aura.Services.MetricsService.WARM_SIZE     = 3000;
Aura.Services.MetricsService.HITS          = 'hits';
Aura.Services.MetricsService.MISSES          = 'misses';

/**
 * Initialize function
 *@private
**/
Aura.Services.MetricsService.prototype.initialize = function () {
    // #if {"modes" : ["PTEST"]}
        this.setClearCompletedTransactions(false);
    // #end
    this.getPageStartTime();
    this.transactionStart('aura','bootstrap');
    this.initializePlugins();
    window.addEventListener('load', this.emitBootstrapTransaction.bind(this));
};

/**
 * Initialize function
 *@private
**/
Aura.Services.MetricsService.prototype.configurePerformanceAPILogging = function () {
    var windowPerformance = window.performance || {};
    var noop = function() {};
    this.performance = {
        mark         : (windowPerformance["mark"]          || noop).bind(windowPerformance),
        measure      : (windowPerformance["measure"]       || noop).bind(windowPerformance),
        clearMeasures: (windowPerformance["clearMeasures"] || noop).bind(windowPerformance),
        clearMarks   : (windowPerformance["clearMarks"]    || noop).bind(windowPerformance) 
    };
    
    // override mark & measure so that we can listen to these calls in real time
    // and log corresponding marks at the right time so that they correctly show
    // up in any open transaction
    // 
    // PerformanceObserver batches events and is delayed by a macrotask. This can be 100s of milliseconds
    // We need to be able to insert the marks into the right open transactions so that we can correlate
    // any perf mark/measure activity into the relevant metrics service transactions
    //  
    windowPerformance["mark"] = this.performanceMarkOverride.bind(this);
    windowPerformance["measure"] = this.performanceMeasureOverride.bind(this);
};

/**
 * Instrument a particular method (function) of an object, useful for AOP
 * @param {Object} instance Object that holds the method to hook
 * @param {string} method Method name
 * @param {string} ns Namespace
 * @param {boolean} async
 * @param {function(Object)} before
 * @param {function} after
 * @param {function} override
 * @export
**/
Aura.Services.MetricsService.prototype.instrument = function (instance, method, ns, async, before, after, override) {
    var self     = this,
        original = instance[method],
        beforeFn = typeof before === 'function',
        afterFn  = typeof after === 'function';

    instance[method] = function () {
        var mark = !override && self.markStart(ns, method),
            ret;

        if (beforeFn) {
            Array.prototype.unshift.call(arguments, mark);
            before.apply(this, arguments);
            Array.prototype.shift.call(arguments);
        }

        if (override) {
            var xargs = Array.prototype.slice.call(arguments);
            xargs.unshift(original);
            ret = override.apply(this, xargs);
        } else {
            ret = original.apply(this, arguments);
        }

        if (async) {
            return ret;
        }

        mark = !override && self.markEnd(ns, method);

        if (afterFn) {
            Array.prototype.unshift.call(arguments, mark);
            after.apply(this, arguments);
        }

        return ret;
    };

    instance[method]["__original"] = original;
};

/**
 * UnInstrument a particular method (function) of an object, useful for AOP
 * @param {Object} instance Object that holds the method to hook
 * @param {string} method Method name
 * @export
**/
Aura.Services.MetricsService.prototype.unInstrument = function (instance, method) {
    var original = instance[method]["__original"];
    delete instance[method]["__original"];
    instance[method] = original;
};

/**
 * Initialize registered plugins
 * @private
**/
Aura.Services.MetricsService.prototype.initializePlugins = function () {
    for (var plugin in this.registeredPlugins) {
        this.initializePlugin(plugin, this.registeredPlugins[plugin]);
    }
    this.pluginsInitialized = true;
};

/**
 * Initialize a give plugin
 * @param {string} pluginName Plugin name
 * @param {Object|function} Construtor or Objecct for the plugin
 * @private
**/
Aura.Services.MetricsService.prototype.initializePlugin = function (pluginName, PluginContructor) {
    var pluginInstance = typeof PluginContructor === 'function' ? new PluginContructor() : PluginContructor;
    this.pluginInstances[pluginName] = pluginInstance;
    this.collector[pluginName] = [];
    pluginInstance["initialize"](this);
};

/**
 * Internal method called once the application is ready
 * @private
**/
Aura.Services.MetricsService.prototype.applicationReady = function () {
    Aura.bootstrapMark("bootstrapEPT");
    this.applicationReadyTime = this.time();

    this.emitBootstrapTransaction();

    if (!this.inTransaction()) {
        this.clearMarks();
    }

    // #if {"modes" : ["PRODUCTION"]}
    var beacons = this.beaconProviders;
    if ($A.util.isEmpty(beacons)) {
        this.disablePlugins();
    }
    // #end
};

Aura.Services.MetricsService.prototype.emitBootstrapTransaction = function () {
    var domReady = window.document && window.document.readyState;
    if (!this._emittedBootstrap && this.applicationReadyTime && domReady === "complete") {
        this._emittedBootstrap = true;
        if (!this.shouldLogBootstrap) {
            return;
        }
        // We need a timeout because appCache events only fire after onload event
        setTimeout(function () {
            var bootstrap = this.getBootstrapMetrics();
            var appReady = this.applicationReadyTime;

            this.transactionEnd('aura','bootstrap', function (transaction) {
                // We need to override manually the duration to add the time before aura was initialized
                var bootstrapStart = Aura.Services.MetricsService.PERFTIME ? 0 : transaction["pageStartTime"];

                // Tab visibility at end of boot
                bootstrap["visibilityStateEnd"] = document.visibilityState;

                transaction["context"] = {
                    "eventType"   : "bootstrap",
                    "eventSource" : "framework",
                    "attributes"  : bootstrap
                };

                transaction["ts"] = bootstrapStart;
                transaction["duration"] = parseInt(appReady - bootstrapStart, 10);
            });
        }.bind(this), 0);
    }
};

/**
 * Create a transaction based on a given configuration
 * @param {string} ns Namespace of the transaction
 * @param {string} name Name of the transaction
 * @param {Object} transaction Transaction
 * @public
 * @export
**/
Aura.Services.MetricsService.prototype.syntheticTransactionStart = function (ns, name, config) {
    var trx = this.createTransaction(ns, name, config);
    $A.util.apply(this.transactions[trx], config, true, true);
    return trx;
};


/**
 * Add a callback everytime a transaction ends.
 * @param {function} callback Function to execute for every transaction
 * @public
 * @export
**/
Aura.Services.MetricsService.prototype.onTransactionEnd = function (callback) {
    this.globalHandlers["transactionEnd"].push(callback);
};

/**
 * Unbind a callback everytime a transaction ends.
 * @param {function} callback Function to detach for every transaction
 * @public
 * @export
**/
Aura.Services.MetricsService.prototype.detachOnTransactionEnd = function (callback) {
    this.detachHandlerOfType(callback, "transactionEnd");
};

/**
 * Add a callback everytime a transaction ends.
 * @param {function} callback Function to execute for every transaction
 * @public
 * @export
**/
Aura.Services.MetricsService.prototype.onTransactionsKilled = function (callback) {
    this.globalHandlers["transactionsKilled"].push(callback);
};

/**
 * Unbind a callback everytime a transaction ends.
 * @param {function} callback Function to detach for every transaction
 * @public
 * @export
**/
Aura.Services.MetricsService.prototype.detachOnKilledTransactions = function (callback) {
    this.detachHandlerOfType(callback, "transactionsKilled");
};

/**
 * Unbind a callback for a give action
 * @param {function} callback Function to detach for every transaction
 * @param {name} callback Function to detach for every transaction
**/
Aura.Services.MetricsService.prototype.detachHandlerOfType = function (callback, name) {
    var handlers = this.globalHandlers[name],
        position = handlers.indexOf(callback); // we don't guard, since we control the input name

    if (position > -1) {
        handlers.splice(position, 1);
    }
};


/**
 * Check if we are in a transcation already
 * @return {boolean} Wether we are in a transaction
 * @public
 * @export
**/
Aura.Services.MetricsService.prototype.inTransaction = function (ignorePageTransactions) {
    $A.util.isEmpty(this.transactions);
    if (!ignorePageTransactions) {
        return !$A.util.isEmpty(this.transactions);
    }

    if (this.getCurrentPageTransaction()) {
        return Object.keys(this.transactions).length > 1;
    }
};


/**
 * Create a transaction
 * @param {string} ns Namespace of the transaction
 * @param {string} id Id of the transaction
 * @param {Object} config Configuration and context for the transaction
 * @public
 * @export
**/
Aura.Services.MetricsService.prototype.transaction = function (ns, name, config) {
    config = config || {};
    var postProcess = typeof config === 'function' ? config : config["postProcess"];

    this.createTransaction(ns, name, config);
    this.transactionEnd(ns, name, function (t) {
        t["duration"] = 0; // STAMP so no duration
        if (postProcess) {
            postProcess(t);
        }
    });
};

/**
 * Update a transaction
 * @param {string} ns Namespace of the transaction
 * @param {string} id Id of the transaction
 * @param {Object} config Configuration and context for the transaction
 * @public
 * @export
**/
Aura.Services.MetricsService.prototype.transactionUpdate = function (ns, name, config) {
    config = config || {};
    var id          = (ns || Aura.Services.MetricsService.DEFAULT) + ':' + name,
        transaction = this.transactions[id];
    if (transaction) {
        transaction["config"] = $A.util.apply(transaction["config"], config, true, true);
    }
};

/**
 * Start a transaction
 * @param {string} ns Namespace of the transaction
 * @param {string} id Id of the transaction
 * @param {Object} config Configuration and context for the transaction
 * @public
 * @export
**/
Aura.Services.MetricsService.prototype.transactionStart = function (ns, name, config) {
    return this.createTransaction(ns, name, config);
};

/**
 * Finish a transaction
 * @param {string} ns Namespace of the transaction
 * @param {string} id Id of the transaction
 * @param {Object} config Configuration and context for the transaction
 * @public
 * @export
**/
Aura.Services.MetricsService.prototype.transactionEnd = function (ns, name, config, postProcess) {
    //console.time('>>>> TRANSACTIONPROCESSING > ' + ns + ':' + name);
    var id             = ns + ':' + name,
        transaction    = this.transactions[id],
        transactionCfg = $A.util.apply((transaction && transaction["config"]) || {}, config, true, true),
        beacon         = this.beaconProviders[ns] || this.beaconProviders[Aura.Services.MetricsService.DEFAULT];

    postProcess = typeof config === 'function' ? config : postProcess || transactionCfg["postProcess"];
    if (transaction) {
        this.performance.measure(id, id);
        this.performance.clearMeasures(id);
        this.performance.clearMarks(id);
    }
    if (transaction && (beacon || postProcess || !this.clearCompleteTransactions)) {
        var parsedTransaction = {
                "id"            : id,
                "ts"            : transaction["ts"],
                "duration"      : parseInt(this.time() - transaction["ts"]),
                "pageStartTime" : this.pageStartTime,
                "marks"         : {},
                "context"       : transactionCfg["context"] || {},
                "owner"         : transaction["owner"],
                "unixTS"        : !Aura.Services.MetricsService.PERFTIME // If the browser does not support performance API, all transactions will be Unix Timestamps
            };

        // Walk over the collected marks to scope the ones relevant for this transaction
        // (Between time tart and end)
        for (var plugin in this.collector) {
            var instance = this.pluginInstances[plugin];

            if (this.collector[plugin].length) { // If we have marks for that plugin
                var pluginCollector   = this.collector[plugin],
                    initialOffset     = transaction["offsets"] && (transaction["offsets"][plugin] || 0),
                    tMarks            = pluginCollector.slice(initialOffset),
                    pluginPostProcess = instance && instance.postProcess,
                    parsedMarks       = pluginPostProcess ? instance.postProcess(tMarks, transactionCfg) : tMarks,
                    pluginName        = instance ? plugin : Aura.Services.MetricsService.CUSTOM_MARKS;

                if (!pluginPostProcess && tMarks.length) {
                    parsedMarks = this.defaultPostProcessing(tMarks);
                }

                if (parsedMarks && parsedMarks.length) {
                    parsedTransaction["marks"][pluginName] = parsedTransaction["marks"][pluginName] || [];
                    parsedTransaction["marks"][pluginName].push.apply(parsedTransaction["marks"][pluginName], parsedMarks);
                }
            }
        }

        // 1. postProcess at the transaction level
        if (postProcess) {
            postProcess(parsedTransaction);
        }
        // 2. execute any beacon middleware
        if (beacon && beacon["middleware"]) {
            beacon["middleware"](parsedTransaction, this.resetAllCacheStats.bind(this));
        }
        // 3. Notify all the global transactionEnd handlers
        if (this.globalHandlers["transactionEnd"].length) {
            this.callHandlers("transactionEnd", parsedTransaction);
        }

        // 4. Send to beacon
        if (beacon) {
            beacon["sendData"](parsedTransaction["id"], parsedTransaction);
        }

        // Cleanup transaction
        if (!this.clearCompleteTransactions) {
            // Only for non-prod, to keep the transactions stored
            var newId = id + ':' + parseInt(parsedTransaction["ts"], 10);
            parsedTransaction["config"] = transactionCfg;
            this.transactions[newId] = parsedTransaction;
            parsedTransaction["id"] = newId;
        }
        delete this.transactions[id];

        if (!this.inTransaction()) {
            this.clearMarks();
        } else {
            this.killLongRunningTransactions(); // it will call its handlers internally
        }

    } else {
        // If there is nobody to process the transaction, we just need to clean it up.
        delete this.transactions[id];
    }
    //console.timeEnd('>>>> TRANSACTIONPROCESSING > ' + ns + ':' + name);
};

/**
 * Clear all saved transactions
 * @public
 * @export
**/

Aura.Services.MetricsService.prototype.clearTransactions = function () {
    this.transactions = {};
};

/**
 * Internal method to call globalHandlers attached
 * @private
**/
Aura.Services.MetricsService.prototype.callHandlers = function (type, t) {
    var handlers = this.globalHandlers[type];
    if (handlers) {
        for (var i = 0; i < handlers.length; i++) {
            handlers[i](t);
        }
    }
};

/**
 * Tries to kill transaction than are been in the queue for a long period of time
 * defined via static param on metricsService
 * @private
**/
Aura.Services.MetricsService.prototype.killLongRunningTransactions = function () {
    var now = this.time();
    var transactionsKilled = [];

    for (var i in this.transactions) {
        var transaction = this.transactions[i];
        var isPageTransaction = transaction["config"]["pageTransaction"];
        if (!isPageTransaction && now - transaction["ts"] > Aura.Services.MetricsService.MAXTIME) {
            transactionsKilled.push(transaction);
            delete this.transactions[i];
        }
    }

    if (transactionsKilled.length && this.globalHandlers["transactionsKilled"].length) {
        this.callHandlers("transactionsKilled", transactionsKilled);
    }
};

/**
 * Get the current page transaction
 * has pageTransaction config flag
 * @export
**/
Aura.Services.MetricsService.prototype.getCurrentPageTransaction = function () {
    for (var i in this.transactions) {
        if (this.transactions[i]["config"]["pageTransaction"]) {
            return this.transactions[i];
        }
    }
};

/**
 * Merge the config of the current page transaction
 * @export
**/
Aura.Services.MetricsService.prototype.updateCurrentPageTransaction = function (config) {
    var trx = this.getCurrentPageTransaction();
    if (trx) {
        // i.e. override any values already present on existing config
        trx["config"] = $A.util.apply(trx["config"], config, true /*forceCopy*/, true /*deepCopy*/);
    }
};

/**
 * Returns a clone of the marks currently available on the collector
 * @export
**/
Aura.Services.MetricsService.prototype.getCurrentMarks = function () {
    return $A.util.apply({}, this.collector, true, true);
};

/**
 * Returns the metricsService version
 * @export
**/
Aura.Services.MetricsService.prototype.getVersion = function (includePlugins) {
    var msVersion = Aura.Services.MetricsService.VERSION;
    if (!includePlugins) {
        return msVersion;
    }

    var pluginsVersion = {};
    for (var p in this.registeredPlugins) {
        pluginsVersion[p] = this.registeredPlugins["VERSION"];
    }

    return {
        "metricsService" : msVersion,
        "plugins": pluginsVersion
    };
};

/**
 * Default post processing for marks (only enabled in non production environments)
 * @private
**/
Aura.Services.MetricsService.prototype.defaultPostProcessing = function (customMarks) {
    var procesedMarks = [];
    var queue = {};
    for (var i = 0; i < customMarks.length; i++) {
        var id = customMarks[i]["ns"] + customMarks[i]["name"];
        var phase = customMarks[i]["phase"];
        if (phase === 'stamp') {
            procesedMarks.push(customMarks[i]);
        } else if (phase === 'start') {
            queue[id] = customMarks[i];
        } else if (phase === 'end' && queue[id]) {
            var mark = queue[id];
            mark["context"]  = $A.util.apply(mark["context"] || {}, customMarks[i]["context"] || {});
            mark["duration"] = parseInt(customMarks[i]["ts"] - mark["ts"]);
            procesedMarks.push(mark);
            mark["phase"] = 'stamp';
            queue[id] = null;
        }
    }
    return procesedMarks;
};

//#if {"excludeModes" : ["PRODUCTION"]}

/**
 * Get all internal stored transactions
 * @export
**/
Aura.Services.MetricsService.prototype.getTransactions = function () {
    var transactions = [];
    for (var i in this.transactions) {
        transactions.push(this.transactions[i]);
    }
    return  transactions;
};

/**
 * Get a internal stored transaction by id
 * @param {?string} ns Namespace of the transaction
 * @param {string} id Id of the transaction
 * @export
**/
Aura.Services.MetricsService.prototype.getTransaction = function (ns, id) {
    if (!id) {
        id = ns;
        ns = Aura.Services.MetricsService.DEFAULT; // if no ns is defined -> default
    }
    // Loop, dont do a direct match on the object key.
    // Because we augment the id with the timestamp ex: s1:foo:123
    // so consecuent transactions dont collision
    var key = id.indexOf(':') === -1  ? (ns + ':' + id) : id;
    for (var i in this.transactions) {
        var t = this.transactions[i];
        if (t["id"].indexOf(key) === 0) {
            return t;
        }
    }
};

/**
 * Set the internal storage of transactions
 * @export
**/
Aura.Services.MetricsService.prototype.setClearCompletedTransactions = function (value) {
    this.clearCompleteTransactions = value;
};

//#end

/**
 * Creates a transaction
 * @param {string} ns Namespace of the mark
 * @param {string} name of the mark
 * @param {Object} config Config object
 * @private
**/
Aura.Services.MetricsService.prototype.createTransaction = function (ns, name, config) {
    var id = (ns || Aura.Services.MetricsService.DEFAULT) + ':' + name,
        transaction = {
            "id"            : id,
            "offsets"       : {},
            "ts"            : Math.round(this.time() * 100) / 100,
            "config"        : config || {},
            "owner"        :  $A.clientService.currentAccess ? $A.clientService.currentAccess.type : null
        },
        offsets = transaction["offsets"];

    for (var c in this.collector) {
        offsets[c] = this.collector[c].length;
    }

    this.transactions[id] = transaction;
    this.performance.mark(id);
    return id;
};

/**
 * Creates a mark for a give namespace and key action
 * @param {string} ns Namespace of the mark
 * @param {string} name of the mark
 * @param {Object} context Context Object
 * @export
 * @public
**/
Aura.Services.MetricsService.prototype.mark = function (ns, name, context) {
    if (!name) {name = ns; ns = Aura.Services.MetricsService.DEFAULT;}
    var mark        = this.createMarkNode(ns, name, Aura.Services.MetricsService.STAMP, context),
        nsCollector = this.collector[ns],
        collector   = nsCollector ? nsCollector : (this.collector[ns] = []);

    collector.push(mark);
    return mark;
};

/**
 * Creates a start mark for a give namespace and key action
 * @param {string} ns Namespace of the mark
 * @param {string} name of the mark
 * @param {Object} context Context Object
 * @export
 * @public
**/
Aura.Services.MetricsService.prototype.markStart = function (ns, name, context) {
    if (!name) {name = ns; ns = Aura.Services.MetricsService.DEFAULT;}
    var mark        = this.createMarkNode(ns, name, Aura.Services.MetricsService.START, context),
        nsCollector = this.collector[ns],
        collector   = nsCollector ? nsCollector : (this.collector[ns] = []);
    collector.push(mark);
    return mark;
};

/**
 * Creates a end mark for a give namespace and key action
 * @param {string} ns Namespace of the mark
 * @param {string} name of the mark
 * @param {Object} context Context Object
 * @export
 * @public
**/
Aura.Services.MetricsService.prototype.markEnd = function (ns, name, context) {
    if (!name) {name = ns; ns = Aura.Services.MetricsService.DEFAULT;}
    var mark        = this.createMarkNode(ns, name, Aura.Services.MetricsService.END, context),
        nsCollector = this.collector[ns],
        collector   = nsCollector ? nsCollector : (this.collector[ns] = []);

    collector.push(mark);
    return mark;
};

/**
 * Creates a mark node
 * @param {string} ns Namespace of the mark
 * @param {string} name of the mark
 * @param {string} eventType Type of the mark
 * @param {Object} options Options
 * @private
**/
Aura.Services.MetricsService.prototype.createMarkNode = function (ns, name, eventType, options) {
    var context = options ? (options["context"] || options) : null;
    var logPerfMarks = ns !== Aura.Services.MetricsService.DEFAULT;
    var shouldLogOwner = logPerfMarks && !this.pluginInstances[ns];
    if (logPerfMarks) {
        var id = ns + ":" + name + "|" + eventType;
        this.performance.mark(id);
        this.performance.clearMarks(id);
    }
    var mark = {
        "ns"      : ns,
        "name"    : name,
        "phase"   : eventType,
        "ts"      : Aura.Services.MetricsService.TIMER(),
        "context" : context
    };

    if(shouldLogOwner && $A.clientService.currentAccess){
       mark["owner"] = $A.clientService.currentAccess.type;
    }

    return mark;
};

/**
 * Clear Marks
 * @param {?string=} ns Namespace of the marks to clean
 * @public
 * @export
**/
Aura.Services.MetricsService.prototype.clearMarks = function (ns) {
    if (ns) {
        if (this.collector[ns]) {
            this.collector[ns] = [];
        }
    } else {
        for (var i in this.collector) {
            this.collector[i] = [];
        }
    }
};

/**
 * Get the page firstByte timestamp from either performance API or a mark in the page
 * @private
**/
Aura.Services.MetricsService.prototype.getPageStartTime = function () {
    if (!this.pageStartTime) {
        var p = window.performance;
        var pst;
        if (p && p.timing && p.timing.navigationStart) {
            pst = p.timing.navigationStart;
        } else {
            pst = window["pageStartTime"];
        }
        this.pageStartTime = pst;
    }
    return this.pageStartTime;
};

/**
 * Generates a bootstrap mark
 * @param {string} mark Key of the mark
 * @param {?} value Value of the mark
 * @public
 * @export
**/
Aura.Services.MetricsService.prototype.time = function () {
    return Aura.Services.MetricsService.TIMER();
};

/**
 * Returns if the resolution is microseconds (using the performance API if supported)
 * @public
 * @export
**/
Aura.Services.MetricsService.prototype.microsecondsResolution = function () {
    return Aura.Services.MetricsService.PERFTIME;
};


/**
 * Disable all plugins
 * @public
 * @export
**/
Aura.Services.MetricsService.prototype.disablePlugins = function () {
    for (var p in this.pluginInstances) {
        this.disablePlugin(p);
    }
};

/**
 * Diable a plugin by name
 * @param {string} name Name of the plugin
 * @public
 * @export
**/
Aura.Services.MetricsService.prototype.disablePlugin = function (name) {
    var plugin = this.pluginInstances[name];
    if (plugin && plugin.disable) {
        plugin["disable"]();
    }
};

/**
 * Enable all plugins
 * @public
 * @export
**/
Aura.Services.MetricsService.prototype.enablePlugins = function () {
    for (var p in this.pluginInstances) {
        this.enablePlugin(p);
    }
};

/**
 * Enable plugin by name
 * @param {string} name Name of the plugin
 * @public
 * @export
**/
Aura.Services.MetricsService.prototype.enablePlugin = function (name) {
    var plugin = this.pluginInstances[name];
    if (plugin && plugin.enable) {
        plugin["enable"]();
    }
};

/**
 * Register a plugin for metricsServices
 * @param {Object} pluginConfig A plugin object
 * @public
 * @export
**/
Aura.Services.MetricsService.prototype.registerPlugin = function (pluginConfig) {
    var pluginName       = pluginConfig["name"],
        PluginContructor = pluginConfig["plugin"];
    this.registeredPlugins[pluginName] = PluginContructor;

    if (this.pluginsInitialized) {
        this.initializePlugin(pluginName, PluginContructor);
    }
};

/**
 * Register a beacon (transport layer) on which to send the finishes transactions
 * @param {Object} beacon Beacon object that hold a "sendData" method
 * @public
 * @export
**/
Aura.Services.MetricsService.prototype.registerBeacon = function (beacon) {
    this.beaconProviders[beacon["name"] || Aura.Services.MetricsService.DEFAULT] = beacon["beacon"] || beacon;
};
/**
 * Summarizes perf timing request info
 * @param {PerformanceResourceTiming} r
 * @export
*/
Aura.Services.MetricsService.prototype.summarizeResourcePerfInfo = function (r) {
    var serverTiming = r["serverTiming"];
    if (serverTiming && $A.util.isArray(serverTiming)) {
        var totalTiming = serverTiming.filter(function (t) {
            return t.name.toLowerCase() === "total";
        })[0];
        var serverTime = totalTiming && totalTiming["duration"];
    }
    return {
        "name"            : r.name,
        "initiatorType"   : r.initiatorType,
        "duration"        : parseInt(r.responseEnd - r.startTime, 10),
        "startTime"       : parseInt(r.startTime, 10),
        "fetchStart"      : parseInt(r.fetchStart, 10),
        "requestStart"    : parseInt(r.requestStart, 10),
        "dns"             : parseInt(r.domainLookupEnd - r.domainLookupStart, 10),
        "tcp"             : parseInt(r.connectEnd - r.connectStart, 10),
        "redirect"        : parseInt(r.redirectEnd - r.redirectStart, 10),
        "ttfb"            : parseInt(r.responseStart - r.startTime, 10),
        "transfer"        : parseInt(r.responseEnd - r.responseStart, 10),
        // Note that these additional properties will need to be set using explicit strings
        // the extern used in current version of closure-compiler doesn't list them out: 
        // https://github.com/google/closure-compiler/blob/v20130411/externs/w3c_navigation_timing.js
        "transferSize"    : r["transferSize"] || 0,
        "encodedBodySize" : r["encodedBodySize"] || 0,
        "decodedBodySize" : r["decodedBodySize"] || 0,
        "serverTime"      : serverTime
    };
};

/**
 * Finds a matching entry with a similar uri and between startTime and endTime
 * in the PerformanceResourceTiming buffer
 * @param {string} uri
 * @param {number} startTime
 * @param {number} endTime
 * @export
*/
Aura.Services.MetricsService.prototype.findAndSummarizeResourcePerfInfo = function (uri, startTime, endTime) {
    if (window.performance && window.performance.getEntriesByType) {
        var allResources = window.performance.getEntriesByType("resource");
        var r = allResources.filter(function (res) {
            return res.name.indexOf(uri) !== -1 && 
                   res.startTime >= startTime && res.responseEnd <= endTime; 
        })[0];
        
    } 
    if (r) {
        return this.summarizeResourcePerfInfo(r);
    }
};

/**
 * Prevent the framework from logging the bootstrap transaction
 * This will be handled by the calling app at some point in the future
 * @export
*/
Aura.Services.MetricsService.prototype.skipBootstrapLogging = function () {
    this.shouldLogBootstrap = false;
};

/**
 * Returns a JSON Object which contains the bootstrap metrics of the framework and the application
 * @public
 * @return {Object}
 * @export
**/
Aura.Services.MetricsService.prototype.getBootstrapMetrics = function () {
    var bootstrap = this.bootstrap;
    var pageStartTime = this.getPageStartTime();
    var context = $A.getContext();

    for (var m in Aura["bootstrap"]) {
        bootstrap[m] = parseInt(Aura["bootstrap"][m], 10);
    }

    // allow non-numerics
    bootstrap["visibilityStateStart"] = Aura["bootstrap"]["visibilityStateStart"];
    bootstrap["cdnEnabled"] = context.isCDNEnabled();
    bootstrap["mode"] = context.getMode();

    bootstrap["pageStartTime"] = pageStartTime;

    if (window.performance && performance.timing) {
        // TODO: Eventually make this strings smaller to reduce payload
        var p  = window.performance;
        var pt = p.timing;

        if (!bootstrap["timing"]) {
            bootstrap["timing"] = {
                "navigationStart" : pt.navigationStart,
                "fetchStart"      : pt.fetchStart,

                // Time consumed preparing the new page
                "readyStart"      : pt.fetchStart - pt.navigationStart,

                "dnsStart"        : pt.domainLookupStart,
                "dnsEnd"          : pt.domainLookupEnd,

                // DNS query time
                "lookupDomainTime": pt.domainLookupEnd - pt.domainLookupStart,

                "connectStart"    : pt.connectStart,
                "connectEnd"      : pt.connectEnd,

                // TCP connection time
                "connectTime"     : pt.connectEnd - pt.connectStart,

                "requestStart"    : pt.requestStart,
                "responseStart"   : pt.responseStart,
                "responseEnd"     : pt.responseEnd,

                // Time spent during the request
                "requestTime"     : pt.responseEnd - pt.requestStart,

                "domLoading"      : pt.domLoading,
                "domInteractive"  : pt.domInteractive,

                // Request to completion of the DOM loading
                "initDomTreeTime" : pt.domInteractive - pt.responseEnd,

                "contentLoadStart": pt.domContentLoadedEventStart,
                "contentLoadEnd"  : pt.domContentLoadedEventEnd,
                "domComplete"     : pt.domComplete,

                 // Time spent constructing the DOM tree
                "domReadyTime"    : pt.domComplete - pt.domInteractive,

                "loadEventStart"  : pt.loadEventStart,
                "loadEventEnd"    : pt.loadEventEnd,

                // Load event time
                "loadEventTime"   : pt.loadEventEnd - pt.loadEventStart,

                // Total time from start to load
                "loadTime"        : pt.loadEventEnd - pt.fetchStart,

                "unloadEventStart": pt.unloadEventStart,
                "unloadEventEnd"  : pt.unloadEventEnd,

                // Time spent unloading documents
                "unloadEventTime" : pt.unloadEventEnd - pt.unloadEventStart,

                // AppCache
                "appCacheTime"    : pt.domainLookupStart - pt.fetchStart,

                // Time spent during redirection
                "redirectTime"    : pt.redirectEnd - pt.redirectStart
            };
        }

        bootstrap["cache"]["appCache"] = bootstrap["timing"]["appCache"] === 0 && window.applicationCache && window.applicationCache.status !== window.applicationCache.UNCACHED;
        bootstrap["cache"]["gvps"] = $A.clientService.gvpsFromStorage;

        var frameworkRequests = {
            "requestBootstrapJs" : { name: "bootstrap.js", trackWarmCold: false },
            "requestInlineJs"    : { name: "inline.js",    trackWarmCold: false },
            "requestAppCss"      : { name: "app.css",      trackWarmCold: true  },
            "requestAppCoreJs"   : { name: "appcore.js",   trackWarmCold: true  },
            "requestAppJs"       : { name: "app.js",       trackWarmCold: true  },
            "requestAuraJs"      : { name: "/aura_",       trackWarmCold: true  }
        };

        if (p.getEntries && (!bootstrap["allRequests"] || !bootstrap["allRequests"].length)) {
            bootstrap["type"] = Aura.Services.MetricsService.UNKNOWN;
            var coldResources = 0;
            var totalRequestsToTrackWarmCold = 0;
            var canTrackWarmCold = undefined;
            var canTrackTransferSize = undefined;
            bootstrap["allRequests"] = [];
            $A.util.forEach(p.getEntries(), function (resource) {
                if (resource.responseEnd < bootstrap["bootstrapEPT"]) {
                    var summaryRequest = this.summarizeResourcePerfInfo(resource);
                    bootstrap["allRequests"].push(summaryRequest);
                    for (var i in frameworkRequests) {
                        if (resource.name.indexOf(frameworkRequests[i].name) !== -1) {
                            if (frameworkRequests[i].trackWarmCold){
                                if(canTrackWarmCold === undefined){
                                    canTrackTransferSize = resource["transferSize"] !== undefined;
                                    canTrackWarmCold = canTrackTransferSize || $A.util.isLocalStorageEnabled();
                                }
                                if(canTrackWarmCold){
                                    totalRequestsToTrackWarmCold++;
                                    if (this.wasResourceFetchedFromServer(i, resource)){
                                        coldResources++;
                                    }
                                }
                            }
                            summaryRequest.name = frameworkRequests[i].name; // mutate the processed resource
                            bootstrap[i] = summaryRequest;
                            continue;
                        }
                    }

                }
            }, this);
            if (canTrackWarmCold && coldResources === totalRequestsToTrackWarmCold) {
                bootstrap["type"] = canTrackTransferSize ? Aura.Services.MetricsService.COLD : Aura.Services.MetricsService.COLD_ESTIMATE;
            } else if (canTrackWarmCold && coldResources === 0) {
                bootstrap["type"] = canTrackTransferSize ? Aura.Services.MetricsService.WARM : Aura.Services.MetricsService.WARM_ESTIMATE;
            }
        }
        var navigator = window["navigator"];
        var conn = navigator && navigator["connection"];
        if (conn && !bootstrap["connection"]) {
            bootstrap["connection"] = {
                "rtt": conn["rtt"],
                "downlink": conn["downlink"]
            };
        }
    }

    return bootstrap;
};

Aura.Services.MetricsService.prototype.wasResourceFetchedFromServer = function (key, resource) {
    // In Chrome, we want to use transferSize > 3000 as this is the defined way to determine between Warm and Cold 
    if (resource["transferSize"] !== undefined){
        return resource["transferSize"] > Aura.Services.MetricsService.WARM_SIZE;
    } else {
    // In other browsers we don't currently have access to transferSize, so instead we save the loaded resource url to
    // local storage, and if the file is then loaded from the server again the url will have a different key and therefore
    // register as cold. This is more succeptible to browser differences than transferSize (specifically Safari can sometimes
    // act strangely), but for now it's the best way that we have
        if (localStorage.getItem(key) === resource.name){
            return false;
        } else {
            localStorage.setItem(key, resource.name);
            return true;
        }
    }
};

/**
 * Registers an object to track caches stats for given name.
 * @param {name} Name of the Cache
 * @export
*/
Aura.Services.MetricsService.prototype.registerCacheStats = function(name){
    if (name in this.cacheStats){
        throw Error('Cache name : ' + name + ' is already registered to track cache stats');
    }
    this.cacheStats[name] = this.initCacheStats(name);
    var that = this;
    return {
        "logHits": function(count){
            that.updateCacheStats(name, Aura.Services.MetricsService.HITS, count);
        },
        "logMisses": function(count){
            that.updateCacheStats(name, Aura.Services.MetricsService.MISSES, count);
        },
        "unRegister": function(){
            delete that.cacheStats[name];
        }
    };
};

/**
 * Returns current snapshot of aggregated cache stats after filtering empty stats. 
 * Intented to be called at end of a page transaction to log summary.
 * 
 * @export
*/
Aura.Services.MetricsService.prototype.getAllCacheStats = function(){
    var self = this;
    var filteredStats = {};
    Object.keys(this.cacheStats).forEach(function (key) {
        
        var stats = self.cacheStats[key];
        if (stats[Aura.Services.MetricsService.HITS] > 0 || stats[Aura.Services.MetricsService.MISSES] > 0) {
            filteredStats[key] = $A.util.apply({}, stats);
        }
    });
    return filteredStats;
};

/**
 * Resets all cache stats to zero. Intented be called at begining of a new page transactions.
 * It's a internal only method and should not be exported.
 * 
*/
Aura.Services.MetricsService.prototype.resetAllCacheStats = function(){
    var self = this;
    Object.keys(this.cacheStats).forEach(function (key) {
        self.initCacheStats(key);
    });
    
};

/**
 * Init cache stats to zero. It's a internal only method and should not be exported.
*/
Aura.Services.MetricsService.prototype.initCacheStats = function(key){
    var stats = this.cacheStats[key] || {};
    stats[Aura.Services.MetricsService.HITS] = 0;
    stats[Aura.Services.MetricsService.MISSES] = 0;
    return stats;
};

/**
 * Checks if given key is found in cacheStats map.
*/
Aura.Services.MetricsService.prototype.checkCacheKey = function(key){
    var stats = this.cacheStats[key];
    if (!stats){
        throw Error('Cache name : ' + name + ' is not registered or unregistered');
    }
    return stats;
};

/**
 * Increments given statName with given cacheName in cacheStats map by given count value.
*/
Aura.Services.MetricsService.prototype.updateCacheStats = function(cacheName, statName, count){
    var stats = this.checkCacheKey(cacheName);
    if (typeof count === "number"){
        stats[statName]+= count;
    }else {
        stats[statName]++;
    }
};

/**
 * Override for performance.mark
 * 
 * Logs metrics service markStart into the default namespace
*/
Aura.Services.MetricsService.prototype.performanceMarkOverride = function(name) {
    var ret = this.performance.mark.apply(undefined, arguments);
    this.markStart(name);
    return ret;
};

/**
 * Override for performance.measure
 * 
 * Logs metrics service markEnd with same name as startMark into the default namespace
*/
Aura.Services.MetricsService.prototype.performanceMeasureOverride = function(name, startMark, endMark) {
    var ret = this.performance.measure.apply(undefined, arguments);
    if (endMark !== undefined) {
        // There is no corresponding metrics service mark that can be logged if there is an 
        // endmark defined. They endMark and startMark could be very far away from when measure
        // is called
        return ret;
    }
    if (startMark === undefined) {
        // https://w3c.github.io/user-timing/#dom-performance-measure
        // if startMark is omitted, startime is 0. which is like calling mark
        this.mark(name);
        return ret;
    }
    // there is a startmark and measure is called to effectively end the mark
    this.markEnd(startMark, undefined, {"measure": name});
    return ret;
};