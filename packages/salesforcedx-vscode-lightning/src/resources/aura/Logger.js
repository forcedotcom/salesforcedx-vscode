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

/*eslint-disable no-console */

/**
 * Logger implementation providing log messages to subscribers
 *
 * Subscriptions are made individually to each log level
 *
 * @namespace
 * @constructor
 * @export
 */
function Logger() {
    this.subscribers = [];
    this.INFO = "INFO";
    this.WARNING = "WARNING";
    this.ASSERT = "ASSERT";
    this.ERROR = "ERROR";

    this.subscriptions = {};
    this.subscriptions[this.INFO] = 0;
    this.subscriptions[this.WARNING] = 0;
    this.subscriptions[this.ASSERT] = 0;
    this.subscriptions[this.ERROR] = 0;
}

/**
 * Info log
 *
 * @param {String} info message
 * @param {Error} [error] error
 * @export
 */
Logger.prototype.info = function(info, error) {
    this.log(this.INFO, info, error);
};

/**
 * Warning log
 *
 * @param {String} warning message
 * @param {Error} [error] error
 * @export
 */
Logger.prototype.warning = function(warning, error) {
    this.log(this.WARNING, warning, error);
};

/**
 * Checks condition and logs message when condition is falsy
 *
 * @param {Boolean} condition check
 * @param {String} assertMessage message when assertion fails
 */
Logger.prototype.logAssert = function(condition, assertMessage) {
    if (!condition) {
        var message = "Assertion Failed!: " + assertMessage + " : " + condition;
        this.log(this.ASSERT, message);
    }
};

/**
 * Error log and shows dialog window with error message. Also displays stack unless in production
 *
 * @param {String} msg error message
 * @param {Error} [e] error
 */
Logger.prototype.logError = function(msg, e) {
    var logMsg = msg || "";

    if (!e) {
        e = undefined;
    } else if (!(e instanceof Error) && !$A.util.isError(e)) {
        // Somebody has thrown something bogus, or we're on IE (else block, old IE does not implement .message),
        // but either way we should do what we can...
        if ($A.util.isObject(e) && e.message) {
            var stk = e.stack;
            e = new Error("caught " + e.message);
            if (stk) {
                e.stack = stk;
            }
        } else {
            e = new Error("caught " + $A.util.json.encode(e));
        }
    }

    if (e && !$A.util.isUndefinedOrNull(e.message) && e.message !== "") {
        if (logMsg.length) {
            logMsg = logMsg + " : " + e.message;
        } else {
            logMsg = e.message;
        }
    }

    // remove the 1st line because it's basically $A.error
    var stack = this.getStackTrace(e, 1);
    if (stack && !e) {
        // create a dummy error object to keep the stacktrace
        e = new $A.auraError(msg);
        e.name = Error.prototype.name;
        e.stack = stack;
        e.stackTrace = e.stack;
    }

    if (!$A.initialized) {
        $A["hasErrors"] = true;
    }

    this.log(this.ERROR, logMsg, e);
};

/**
 * Report an error to the server to be logged.
 *
 * @param {AuraError} e exception to report upon.
 * @param {Action} [action] the action being performed when the exception occurred.
 * @param {string} [level] error reporting level. The default value is "ERROR". Options: ["INFO", "WARNING", "ERROR"]
 * @param {boolean} [foreground] don't set the report action as a caboose, should only be used for catastrophic failures where no futher actions will be called.
 * @private
 */
Logger.prototype.reportError = function(e, action, level, foreground) {
    if (!e || e["reported"]) {
        return;
    }

    if (!level || !this.isValidLevel(level)) {
        level = this.ERROR;
    }

    // get action from AuraError
    var errorAction = action || e.action;
    var actionDescriptor = undefined;
    if (errorAction && errorAction.getDef) {
        var actionDef = errorAction.getDef();
        if (actionDef) {
            actionDescriptor = actionDef.getDescriptor();
        }
    }

    // wrapping non aura error, so that required info can be set to the error
    if (!(e instanceof $A.auraError)) {
        e = new $A.auraError(null, e);
    }

    if (!e["component"] || !e["stacktraceIdGen"]) {
        var component = e["component"] || e.findComponentFromStackTrace();
        e.setComponent(component);
    }

    // Post the action failure to the server, where we can keep track of it for bad client code.
    // But don't keep re-posting if the report of failure fails.  Do we want this to be production
    // mode only or similar?
    var reportAction = $A.get("c.aura://ComponentController.reportFailedAction");
    if (!foreground) {
        reportAction.setCaboose();
    }
    reportAction.setParams({
        "failedAction": actionDescriptor || e["component"],
        "failedId": e.id && e.id.toString(),
        "clientError": e.toString(),
        // Note that stack is non-standard, and even if present, may be obfuscated
        // Also we only take the first 25k characters because stacks can get very large
        // and our parser on the server will gack on more than a million characters
        // for the entire json package.
        "clientStack": (e.stackTrace || e.stack || "").toString().substr(0, Aura.Utils.Logger.MAX_STACKTRACE_SIZE),
        "componentStack": e["componentStack"] || "",
        "stacktraceIdGen": e["stacktraceIdGen"],
        "level": level
    });
    reportAction.setCallback(this, function() { /* do nothing */ });
    $A.clientService.enqueueAction(reportAction);
    e["reported"] = true;
};

/**
 * Check if an error is external. 'external' means every stackframe isn't from framework nor framework consumers.
 *
 * @param {Error} e - The error object to check
 */
Logger.prototype.isExternalError = function(e) {
    if (!e) {
        return false;
    }

    var errorframes = this.generateStackFrames(e);
    for (var i = 0; i < errorframes.length; i++) {
        var fileName = errorframes[i].fileName;
        if (!fileName) {
            continue;
        }

        // if the caller is from chrome extension code
        if (fileName.indexOf("chrome-extension://") > -1) {
            return true;
        }

        if (this.isAuraFile(fileName)) {
            return false;
        }
    }

    return true;
};

/**
 * Check if an error is raised from external code
 *
 * @param {Error} e - The error object to check
 */
Logger.prototype.isExternalRaisedError = function(e) {
    if (!e) {
        return false;
    }

    var errorframes = this.generateStackFrames(e);
    var fileName = errorframes[0] && errorframes[0].fileName;

    return !this.isAuraFile(fileName);
};

/**
 * Generate stack frames from an error.
 *
 * @private
 */
Logger.prototype.generateStackFrames = function(e) {
    if (e instanceof $A.auraError) {
        return e.stackFrames;
    }

    return Aura.Errors.StackParser.parse(e);
};

/**
 * Check if a file belongs to Aura file. The file name string needs to be full path.
 *
 * @private
 */
Logger.prototype.isAuraFile = function(fileName) {
    if (!fileName) {
        return false;
    }

    return fileName.match(/aura_[^\.]+\.js$/gi) ||         // includes aura
           fileName.indexOf("engine.js") > -1 ||           // includes module engine
           fileName.indexOf("engine.min.js") > -1 ||       // includes module engine PROD
           fileName.indexOf('/components/') > -1  ||       // includes components
           fileName.indexOf('/libraries/') > -1 ||         // includes libraries
           fileName.indexOf('/jslibrary/') > -1 ||         // includes client libraries
           fileName.indexOf('/auraFW/resources/') > -1 ||  // includes client libraries
           fileName.indexOf("bootstrap.js") > -1 ||        // includes bootstrap.js
           fileName.indexOf("appcore.js") > -1 ||          // includes appcore.js
           fileName.indexOf("app.js") > -1;
};

/**
 * Checks for subscribers and notifies
 *
 * @param {String} level log level
 * @param {String} message log message
 * @param {Error} [error]
 */
Logger.prototype.log = function(level, message, error) {
    if (this.hasSubscriptions(level)) {
        this.notify(level, message, error);
    }
};

/**
 * Loops through subscribers and applies arguments to provider callback
 *
 * @param {String} level log level
 * @param {String} message log message
 * @param {Error} [error]
 */
Logger.prototype.notify = function(level, msg, error) {
    var subsLength = this.subscribers.length;
    for (var i = 0; i < subsLength; i++) {
        var sub = this.subscribers[i];
        if (sub.level === level) {
            sub.fn.apply(undefined, [level, msg, error]);
        }
    }
};

/**
 * Returns the stack trace, including the functions on the stack if available (Error object varies across browsers).
 * Values are not logged.
 *
 * @param {Error} e error
 * @param {Number} [remove]
 * @returns {String|null} stack
 */
Logger.prototype.getStackTrace = function(e, remove) {
    // instances of $A.auraError keep stack in stackTrace property.
    if (e && e instanceof $A.auraError) {
        return e.stackTrace;
    }

    var stack = undefined;

    if (!remove) {
        remove = 0;
    }
    if (!e || !e.stack) {
        try {
            throw new Error("foo");
        } catch (f) {
            e = f;
            remove += 2;
        }
    }
    if (e) {
        stack = e.stack;
    }

    // Chrome adds the error message to the beginning of the stacktrace. Strip that we only want the the actual stack.
    var chromeStart = "Error: " + e.message;
    if (stack && stack.indexOf(chromeStart) === 0) {
        stack = stack.substring(chromeStart.length + 1);
    }
    if (stack) {
        var ret = stack.replace(/(?:\n@:0)?\s+$/m, '');
        ret = ret.replace(new RegExp('^\\(', 'gm'), '{anonymous}(');
        ret = ret.split("\n");
        if (remove !== 0) {
            ret.splice(0,remove);
        }
        return ret.join('\n');
    }
    return null;
};

/**
 * Stringify a log message.
 *
 * @param {String} logMsg message
 * @param {Error} error
 * @param {Array} trace
 * @returns {String} string log
 */
Logger.prototype.stringVersion = function(logMsg, error, trace) {
    var stringVersion = !$A.util.isUndefinedOrNull(logMsg) ? logMsg : "" ;
    if (!$A.util.isUndefinedOrNull(error) && !$A.util.isUndefinedOrNull(error.message)) {
        stringVersion += " : " + error.message;
    }
    if (!$A.util.isUndefinedOrNull(trace)) {
        stringVersion += "\nStack: " + trace.join("\n");
    }
    return stringVersion;
};

/**
 * Adds subscriber. Callback function will be called when log of level specified occurs.
 * Each level requires a subscription.
 *
 * @param {String} level log level
 * @param {Function} callback function
 * @export
 */
Logger.prototype.subscribe = function(level, callback) {
    level = level.toUpperCase();
    this.validateSubscriber(level, callback);

    this.subscribers.push({
        level: level,
        fn: callback
    });
    this.subscriptions[level] += 1;
};

/**
 * Removes subscription. Each level needs to be unsubscribed separately
 *
 * @param {String} level log level
 * @param {Function} callback function
 * @export
 */
Logger.prototype.unsubscribe = function(level, callback) {
    level = level.toUpperCase();
    this.validateSubscriber(level, callback);

    var subsLength = this.subscribers.length;
    for (var i = subsLength - 1; i >= 0; i--) {
        var sub = this.subscribers[i];
        if (sub.level === level && sub.fn === callback) {
            this.subscribers.splice(i, 1);
            this.subscriptions[level] -= 1;
        }
    }
};

/**
 * Checks whether level is valid
 * @param {String} level log level
 * @returns {boolean}
 */
Logger.prototype.isValidLevel = function(level) {
    return level === this.INFO ||
           level === this.WARNING ||
           level === this.ASSERT ||
           level === this.ERROR;
};

/**
 * Checks and throws Error if not valid subscriber
 *
 * @param {String} level log level
 * @param {Function} callback function
 * @throws Throws an error if the level is not valid or callback is not a function.
 */
Logger.prototype.validateSubscriber = function(level, callback) {
    if (!this.isValidLevel(level)) {
        throw new Error("Please specify valid log level: 'INFO', 'WARNING', 'ASSERT', 'ERROR'");
    }

    if (typeof callback !== "function") {
        throw new Error("Logging callback must be a function");
    }
};

/**
 * Returns number of subscriptions for given level
 *
 * @param {String} level
 * @returns {boolean} Whether there are subscriptions to given level
 */
Logger.prototype.hasSubscriptions = function(level) {
    level = level.toUpperCase();
    return this.isValidLevel(level) && this.subscriptions[level] > 0;
};

//#if {"excludeModes" : ["PRODUCTION", "PRODUCTIONDEBUG", "PERFORMANCEDEBUG"]}
/**
 * Prints log to the console (if available).
 * @private
 */
Logger.prototype.devDebugConsoleLog = function(level, message, error) {
    var stringVersion = null;
    var trace;
    var logMsg = level + ": " + (message || "");

    if (message) {
        stringVersion = level + ": " + message;
    }

    if (error && error.message) {
        stringVersion += " : " + error.message;
    }

    if (error || level === "ERROR") {
        trace = $A.logger.getStackTrace(error);
    }

    if (window["console"]) {
        var console = window["console"];
        var filter = level === "WARNING" ? "warn" : level.toLowerCase();
        if (console[filter]) {
            console[filter]("%s", message);
            if (error) {
                if (error["component"]) {
                    console[filter]("%s", "Failing component: " + error["component"]);
                }
                if (error["componentStack"]) {
                    console[filter]("%s", "Failing component stack: " + error["componentStack"]);
                }
                console[filter]("%o", error);
            }
            if ((filter === "error" || filter === "warn") && trace) {
                if ($A.util.isString(trace)) {
                    console[filter]("%s", trace);
                } else {
                    for (var j = 0; j < trace.length; j++) {
                        console[filter]("%s", trace[j]);
                    }
                }
            }
        } else if (console["group"]) {
            console["group"](logMsg);
            console["debug"](message);
            if (error) {
                console["debug"](error);
            }
            if (trace) {
                console["group"]("stack");
                for (var i = 0; i < trace.length; i++) {
                    console["debug"](trace[i]);
                }
                console["groupEnd"]();
            }
            console["groupEnd"]();
        } else {
            stringVersion = $A.logger.stringVersion(logMsg, error, trace);
            if (console["debug"]) {
                console["debug"](stringVersion);
            } else if (console["log"]) {
                console["log"](stringVersion);
            }
        }
    }
};
//#end

Aura.Utils.Logger = Logger;

/**
 * Maximum size for a stacktrace to be logged.
 *
 * @private
 */
Aura.Utils.Logger.MAX_STACKTRACE_SIZE = 25000;
