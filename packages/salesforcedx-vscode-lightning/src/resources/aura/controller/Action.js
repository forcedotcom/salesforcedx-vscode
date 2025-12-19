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
 * A base class for an Aura Action to be passed to an associated component. An Action is created in a client-side or
 * server-side controller. Invoke an Action in a controller by declaring cmp.get("c.actionName"). Call a server-side
 * Action from a client-side controller.
 *
 * @constructor
 * @class
 * @param {Object}
 *            def The definition of the Action.
 * @param {string}
 *            suffix A suffix to distinguish components.
 * @param {function}
 *            method The method for the Action. For client-side Action only. A function to serialize the Action as a
 *            String in the JSON representation.
 * @param {Object}
 *            paramDefs The parameter definitions for the Action.
 * @param {boolean}
 *            background is the action defined as a background action?
 * @param {Component}
 *            cmp The component associated with the Action.
 * @param {boolean}
 *            caboose should this action wait for the next non boxcar action?
 * @platform
 * @export
 */
function Action(def, suffix, method, paramDefs, background, cmp, caboose) {
    this.def = def;
    this.meth = method;
    this.paramDefs = paramDefs;
    this.background = background;
    this.cmp = cmp;
    this.params = {};
    this.responseState = null;
    this.state = "NEW";
    this.callbacks = {};
    this.events = [];
    this.components = null;
    this.actionId = Action.prototype.nextActionId++;
    this.id = this.actionId > 0 ? this.actionId + ";" + suffix : suffix;
    this.originalResponse = undefined;
    this.storable = (def && def.isStorable());
    this.caboose = caboose;
    this.allAboardCallback = undefined;
    this.abortable = false;
    this.deferred = false;
    this.defDependencies = undefined;

    this.returnValue = undefined;
    this.returnValueUserland = undefined;

    // FIXME: creation path
    this.pathStack = [];
    this.canCreate = true;
    // start with a body
    this.pushCreationPath("body");
    this.setCreationPathIndex(0);

    // FIXME: need to expose for plugins
    this.refreshAction = undefined;

    this.callingCmp = $A.clientService.currentAccess;

    this.retryCount = 0;

    // propagating locker key when possible
    $A.lockerService.trust(cmp, this);
}

// Static methods:

Action.getStorageKey = function(descriptor, params) {
    return descriptor + ":" + $A.util["json"].orderedEncode(params);
};

// Instance methods:

Action.prototype.nextActionId = 0;

/**
 * Gets the Action Id.
 *
 * @returns {string}
 * @private
 * @export
 */
Action.prototype.getId = function() {
    return this.id;
};

/**
 * Sets the action id
 *
 * @returns {string}
 * @private
 */

 Action.prototype.setId = function (id) {
    this.id = id;
 };

/**
 * Gets the next action scoped Id.
 *
 * @returns {string}
 * @private
 */
Action.prototype.getNextGlobalId = function() {
    if (!this.nextGlobalId) {
        this.nextGlobalId = 1;
    }
    return this.nextGlobalId++;
};

/**
 *  If a component is replacing the same-named component at the same level (e.g. provider),
 *  this reactivates the path's error detection, so that is can request its location again without
 *  reporting an error.
 *
 *  @private
 */
Action.prototype.reactivatePath = function() {
    this.canCreate = true;
};

/**
 * Forces the creation path to match a given value.
 *
 * This checks to see if the path matches, otherwise, it forces the path
 * to the one supplied. A warning is emitted if the path mismatches but only
 * if it is not the top level.
 *
 * @param {string} path the path to force
 * @private
 */
Action.prototype.forceCreationPath = function(path) {
    var absPath = "(empty)";
    //
    // We add the id, since our server path is bare.
    //
    var newAbsPath = this.getId()+path;
    if (this.pathStack.length > 0) {
        var top = this.pathStack[this.pathStack.length - 1];
        if (top.absPath === newAbsPath) {
            // We are ok, the creation path is actually the correct one, ignore it.
            return undefined;
        }
        absPath = top.absPath;
    }
    if (this.topPath() !== newAbsPath && (path.length < 2 || path.indexOf("/", 1) !== -1)) {
        //
        // Only warn if this is not a top level path, to save developers from having
        // to know the internal implementation of aura (or deal with warnings)
        //
        // Top level should index the first index or /+[0] will fail as its expecting /+
        //
        $A.warning("force path of "+newAbsPath+" from "+absPath
            +" likely a use of returned component array without changing index");
    }
    var pathEntry = { relPath: "~FORCED~", absPath:newAbsPath, idx: undefined, startIdx: undefined };
    this.pathStack.push(pathEntry);
    return newAbsPath;
};

/**
 * Mark an action as deferred if it is abortable.
 *
 * This is used to side-track actions that are queued when the primary display is refreshed. Since it
 * is a heuristic, it has a few problems in that it may defer actions that should really not be.
 *
 * @private
 */
Action.prototype.setDeferred = function() {
    this.deferred = this.abortable;
};

/**
 * Check to see if an action has been deferred.
 *
 * @private
 * @returns {Boolean} true if the action was marked deferred.
 */
Action.prototype.isDeferred = function() {
    return this.deferred;
};

/**
 * Releases a creation path that was previously forced.
 *
 * This is the mirrored call to 'forceCreationPath' that releases the 'force'.
 * The path must match the call to forceCreationPath, and the path must have
 * been forced.
 *
 * @param {string} path the path to release.
 * @private
 */
Action.prototype.releaseCreationPath = function(path) {
    var last;
    if (this.pathStack.length > 0) {
        last = this.pathStack[this.pathStack.length - 1];
    }
    if (!last || last.absPath !== path) {
        $A.warning("unexpected unwinding of pathStack.  found "
            + (last ? (last.absPath + " idx " + last.idx  ) : "empty") + " expected "  + path);
    }
    if (last && last.relPath === "~FORCED~") {
        // This is the case where we forced in the path.
        this.pathStack.pop();
    }
};

/**
 * Pushes a new part on the creation path.
 *
 * @param {string} pathPart the new path part to insert.
 * @private
 */
Action.prototype.pushCreationPath = function(pathPart) {
    this.canCreate = true;

    switch (pathPart) {
        case "body" : pathPart = "*"; break;
        case "super" : pathPart = "$"; break;
    }

    var addedPath = "/" + pathPart;
    var newPath = this.topPath() + addedPath;
    var pathEntry = { relPath: addedPath, absPath:newPath, idx: undefined, startIdx: undefined };
    this.pathStack.push(pathEntry);
};

/**
 * Pops off the path part that was previously pushed.
 *
 * @param {string} pathPart the path part previously pushed.
 * @private
 */
Action.prototype.popCreationPath = function(pathPart) {
    var addedPath;
    this.canCreate = false;
    switch (pathPart) {
    case "body" : pathPart = "*"; break;
    case "super" : pathPart = "$"; break;
    }
    addedPath = "/"+pathPart;
    var last = this.pathStack.pop();
    if (!last || last.relPath !== addedPath /*|| last.idx !== undefined*/) {
        $A.warning("unexpected unwinding of pathStack.  found "
            + (last ? (last.relPath + " idx " + last.idx  ) : "empty") + " expected "  + addedPath);
    }
    return last;
};

/**
 * Gets the path for the top entry of the path stack.
 *
 * @return {string} the top level path.
 * @private
 */
Action.prototype.topPath = function() {
    if (this.pathStack.length === 0) {
        return this.getId();
    }
    var top = this.pathStack[this.pathStack.length - 1];
    return (top.absPath + (top.idx !== undefined ? ("[" + top.idx + "]") : ""  ));
};

/**
 * Sets the path index.
 *
 * @param {number} the index to set.
 * @private
 */
Action.prototype.setCreationPathIndex = function(idx) {
    this.canCreate = true;
    if (this.pathStack.length < 1) {
        $A.warning("Attempting to increment index on empty stack");
    }
    var top = this.pathStack[this.pathStack.length - 1];
    // establish starting index
    if (top.idx === undefined) {
        top.startIdx = idx;
        top.idx = idx;
    }
    else if (idx !== 0 && idx !== top.idx + 1) {
        // Warning if not next index and not resetting index
        $A.warning("Improper index increment. Expected: " + (top.idx + 1) + ", Actual: " + idx);
    } else {
        top.idx = idx;
    }
};

/**
 * Gets the current creatorPath from the top of the pathStack
 *
 * @returns {String}
 * @private
 */
Action.prototype.getCurrentPath = function() {
    if (!this.canCreate) {
        //$A.warning("Not ready to create. path: " + this.topPath());
    }
    this.canCreate = false; // this will cause next call to getCurrentPath to fail if not popped
    return this.topPath();
};

/**
 * Gets the <code>ActionDef</code> object. Shorthand: <code>get("def")</code>
 * <p>
 * See Also: <a href="#reference?topic=api:ActionDef">ActionDef</a>
 * </p>
 *
 * @public
 * @returns {ActionDef} The action definition, including its name, origin, and descriptor.
 * @export
 */
Action.prototype.getDef = function() {
    return this.def;
};

/**
 * Gets name of the Action.
 *
 * @platform
 * @returns {String} Name of the Action.
 * @export
 */
Action.prototype.getName = function() {
    return this.def.getName();
};

/**
 * Sets parameters for the Action.
 *
 * @public
 * @param {Object}
 *            config - The key/value pairs for action parameters.
 *             For example, <code>serverAction.setParams({ "record": id });</code> sets a parameter on <code>serverAction</code>.
 * @platform
 * @export
 */
Action.prototype.setParams = function(config) {
    $A.assert($A.util.isObject(config), "setParams() must be passed an object.");
    var paramDefs = this.paramDefs;
    for ( var key in paramDefs) {
        this.params[key] = config[key];
    }
};

/**
 * Sets a single parameter for the Action.
 *
 * @public
 * @param {string}
 *            key - The name of the parameter to set.
 * @param {Object}
 *            value - the value to set for the parameter.
 * @platform
 * @export
 */
Action.prototype.setParam = function(key, value) {
    var paramDef = this.paramDefs[key];

    if (paramDef) {
        this.params[key] = value;
    }
};

/**
 * Gets an action parameter value for a parameter name.
 *
 * @public
 * @param {string}
 *            name - The name of the parameter.
 * @returns {Object} The parameter value
 * @platform
 * @export
 */
Action.prototype.getParam = function(name) {
    return this.params[name];
};

/**
 * Gets the collection of parameters for this Action.
 *
 * @public
 * @returns {Object} The key/value pairs that specify the action parameters.
 * @platform
 * @export
 */
Action.prototype.getParams = function() {
    return this.params;
};

/**
 * Gets the collection of loggable parameters for this Action.
 *
 * @returns {Object} The key/value pairs that specify the loggable action parameters.
 */
Action.prototype.getLoggableParams = function() {
    var loggableParams = {};
    var loggableParamsKeys = this.def.getLoggableParams();
    for ( var key = 0; key < loggableParamsKeys.length; ++key) {
        var paramsValue = this.params[loggableParamsKeys[key]];
        loggableParams[loggableParamsKeys[key]] = typeof paramsValue === "object" ? JSON.stringify(paramsValue) : paramsValue;
    }
    return loggableParams;
};

/**
 * Gets the component for this Action.
 *
 * @returns {Component} the component, if any.
 * @private
 */
Action.prototype.getComponent = function() {
    return this.cmp;
};

/**
 * Sets the callback function that is executed after the server-side action returns. Call a server-side action from a
 * client-side controller using <code>callback</code>.
 *
 * Note that you can register a callback for an explicit state, or you can use 'ALL' which registers callbacks for
 * "SUCCESS", "ERROR", and "INCOMPLETE" (but not "ABORTED" for historical compatibility). It is recommended that you
 * use an explicit name, and not the default 'undefined' to signify 'ALL'.
 *
 * The valid names are:
 *  * SUCCESS: if the action successfully completes.
 *  * ERROR: if the action has an error (including javascript errors for client side actions)
 *  * INCOMPLETE: if a server side action failed to complete because there is no connection
 *  * ABORTED: if the action is aborted via abort()
 *  * REFRESH: for server side storable actions, this will be called instead of the SUCCESS action when the storage is refreshed.
 *
 * @example
 *
 * action.setCallback(this, function(response) {
 *     var state = response.getState();
 *     // This callback doesn’t reference cmp. If it did,
 *     // you should run an isValid() check
 *     //if (cmp.isValid() && state === "SUCCESS") {
 *     if (state === "SUCCESS") {
 *         // Alert the user with the value returned
 *         // from the server
 *         alert("From server: " + response.getReturnValue());
 *
 *         // do something
 *     }
 *     //else if (cmp.isValid() && state === "INCOMPLETE") {
 *     else if (state === "INCOMPLETE") {
 *         // do something
 *     }
 *     //else if (cmp.isValid() && state === "ERROR") {
 *     else if (state === "ERROR") {
 *         var errors = response.getError();
 *         if (errors) {
 *             if (errors[0] && errors[0].message) {
 *                 console.log("Error message: " +
 *                          errors[0].message);
 *             }
 *         } else {
 *             console.log("Unknown error");
 *         }
 *     }
 * });
 *
 * @public
 * @param {Object}
 *            scope - The scope in which the function is executed. You almost always want to set scope to the keyword this.
 * @param {function}
 *            callback - The callback function to run when the server-side action completes.
 * @param {String}
 *            name - The action state that the callback is associated with.
 * @platform
 * @export
 */
Action.prototype.setCallback = function(scope, callback, name) {
    $A.assert($A.util.isFunction(callback), "Action.setCallback(): callback for '"+name+"' must be a function");
    if (name !== undefined && name !== "ALL" && name !== "SUCCESS" && name !== "ERROR" && name !== "INCOMPLETE"
            && name !== "ABORTED") {
        throw new $A.auraError("Action.setCallback(): Invalid callback name '" + name + "'");
    }
    if($A.clientService.currentAccess&&$A.clientService.inAuraLoop()) {
        callback = $A.getCallback(callback);
    }
    // If name is undefined or specified as "ALL", then apply same callback in all cases
    if (name === undefined || name === "ALL") {
        this.callbacks["SUCCESS"] = {
            "fn" : callback,
            "s" : scope
        };
        this.callbacks["ERROR"] = {
            "fn" : callback,
            "s" : scope
        };
        this.callbacks["INCOMPLETE"] = {
            "fn" : callback,
            "s" : scope
        };
    } else {
        this.callbacks[name] = {
            "fn" : callback,
            "s" : scope
        };
    }
};


/**
 * Gets current callback for a give action Type
 *
 * @private
 * @returns {Object} the callback scope and function that was set for this action.
 * @export
 */
 Action.prototype.getCallback = function (type) {
    return this.callbacks[type];
 };

/**
 * Set an 'all aboard' callback, called just before the action is sent.
 *
 * This can be used in conjunction with 'caboose' to implement a log+flush pattern.
 * Intended to be called as the 'train' leaves the 'station'. Note that setParam should
 * be used to set additional parameters at this point.
 *
 * @public
 * @param {Object}
 *      scope The scope for the callback function.
 * @param {Function}
 *      callback the function to call.
 *
 * @export
 */
Action.prototype.setAllAboardCallback = function(scope, callback) {
    $A.assert($A.util.isFunction(callback), "Action 'All Aboard' callback should be a function");
    var that = this;

    /**
     * @private
     */
    this.allAboardCallback = function() { callback.call(scope, that); };
};

/**
 * Call the 'all aboard' callback.
 *
 * This should only be called internally just before an action is sent to the server.
 *
 * @private
 * @return false if the callback failed.
 */
Action.prototype.callAllAboardCallback = function (context) {
    if (this.allAboardCallback) {
        var previous = context.setCurrentAction(this);
        $A.clientService.setCurrentAccess(this.cmp);
        try {
            this.allAboardCallback();
        } catch (e) {
            this.markException(e);
            return false;
        } finally {
            context.setCurrentAction(previous);
            $A.clientService.releaseCurrentAccess();
        }
    }
    return true;
};

/**
 * Wrap the current action callbacks to ensure that they get called before a given function.
 *
 * This can be used to add additional functionality to the already existing callbacks, allowing the user to effectively
 * 'append' a function to the current one.
 *
 * @param {Object}
 *            scope the scope in which the new function should be called.
 * @param {Function}
 *            callback the callback to call after the current callback is executed.
 * @private
 */
Action.prototype.wrapCallback = function(scope, callback) {
    var nestedCallbacks = this.callbacks;
    var outerCallback = callback;
    var outerScope = scope;
    this.callbacks = {};

    this.setCallback(this, function(action, cmp) {
        var cb = nestedCallbacks[this.getState()];
        if (cb && cb["fn"]) {
            cb["fn"].call(cb["s"], action, cmp);
        }
        outerCallback.call(outerScope, this, cmp);
        this.callbacks = nestedCallbacks;
    });
};

/**
 * Deprecated. Note: This method is deprecated and should not be used. Instead, use the <code>enqueueAction</code>
 * method on $A. For example, <code>$A.enqueueAction(action)</code>.
 *
 * The deprecated run method runs client-side actions. Do not use it for running server-side actions.
 *
 * If you must have synchronous execution, you can temporarily use runDeprecated.
 *
 * @deprecated
 * @public
 * @param {Event}
 *            evt The event that calls the Action.
 * @export
 */
Action.prototype.run = function(evt) {
    this.runDeprecated(evt);
};

/**
 * Deprecated. Run an action immediately.
 *
 * This function should only be used for old code that requires inline execution of actions. Note that the code then
 * must know if the action is client side or server side, since server side actions cannot be executed inline.
 *
 * @deprecated
 * @public
 * @param {Event}
 *            evt The event that calls the Action.
 * @export
 */
Action.prototype.runDeprecated = function(evt) {
    $A.assert(this.def && this.def.isClientAction(),
             "run() cannot be called on a server action. Use $A.enqueueAction() instead.");

    if(this.cmp.destroyed===1) {
        return;
    }

    this.state = "RUNNING";
    $A.clientService.setCurrentAccess(this.cmp);
    try {
        var secureCmp = $A.lockerService.wrapComponent(this.cmp);
        var secureEvt = $A.lockerService.wrapComponentEvent(secureCmp, evt);

        this.returnValue = this.meth.call(undefined, secureCmp, secureEvt, this.cmp["helper"]);

    	// TODO W-3199680 Locker Service - Action.runDeprecated() is not unfiltering/writing back expandos of secure event params

        this.state = "SUCCESS";
    } catch (e) {
        this.markException(e);
    } finally {
        $A.clientService.releaseCurrentAccess();
    }
};

/**
 * Gets the current state of the Action. You should check the state of the action
 * in the callback after the server-side action completes.
 *
 * @public
 * @returns {string} The possible action states are:
 *   "NEW": The action was created but is not in progress yet
 *   "RUNNING": The action is in progress
 *   "SUCCESS": The action executed successfully
 *   "FAILURE": Deprecated. ERROR is returned instead. The action failed. This state is only valid for client-side actions.
 *   "ERROR": The server returned an error
 *   "INCOMPLETE": The server didn't return a response. The server might be down or the client might be offline.
 *   "ABORTED": The action was aborted. You can register a callback for this explicitly in setCallback().
 * @platform
 * @export
 */
Action.prototype.getState = function() {
    return this.state;
};

/**
 * Gets the return value of the Action. A server-side Action can return any object containing serializable JSON data.
 *
 * @public
 * @platform
 * @export
 */
Action.prototype.getReturnValue = function() {
    if (this.returnValueUserland !== undefined) {
        return this.returnValueUserland;
    }

    // make deep copies to prevent userland code from changing values.
    // optimization: only need to keep the original value if the action is storable
    // and a success because it's a) return value is put into storage, and b) action
    // deduping is possible.
    if (this.storable && this.responseState === "SUCCESS") {
        // deep copy only for objects and arrays
        if ($A.util.isArray(this.returnValue)) {
            this.returnValueUserland = $A.util.apply([], this.returnValue, true, true);
        } else if ($A.util.isObject(this.returnValue)) {
            this.returnValueUserland = $A.util.apply({}, this.returnValue, true, true);
        } else {
            this.returnValueUserland = this.returnValue;
        }
    } else {
        this.returnValueUserland = this.returnValue;
    }


    return this.returnValueUserland;
};

/**
 * Returns an array of error objects only for server-side actions.
 * Each error object has a message field.
 * In any mode except PROD mode, each object also has a stack field, which is a list
 * describing the execution stack when the error occurred.
 *
 * @public
 * @returns {Object[]} An array of error objects. Each error object has a message field.
 * @platform
 * @export
 */
Action.prototype.getError = function() {
    return this.error;
};

/**
 * Returns true if the actions should be enqueued in the background, false if it should be run in the foreground.
 *
 * @public
 * @platform
 * @export
 */
Action.prototype.isBackground = function() {
    return this.background === true;
};

/**
 * Sets the action to run as a background action. This cannot be unset. Background actions are usually long running and
 * lower priority actions. A background action is useful when you want your app to remain responsive to a user while it
 * executes a low priority, long-running action. A rough guideline is to use a background action if it takes more than
 * five seconds for the response to return from the server.
 *
 * @public
 * @platform
 * @export
 */
Action.prototype.setBackground = function() {
    this.background = true;
};

/**
 * Updates the fields from a response.
 *
 * @param {Object} response The response from the server.
 * @return {Boolean} Returns true if the response differs from the original response
 * @private
 */
Action.prototype.updateFromResponse = function(response) {
    this.state = response["state"];
    this.responseState = response["state"];

    this.returnValue = response["returnValue"];
    // TODO W-3455588 - in the future prevent "used" actions from being re-enqueued.
    // for now force re-deep-copying the return value.
    this.returnValueUserland = undefined;

    this.error = response["error"];
    this.storage = response["storage"];
    this.components = response["components"];
    if (response["defDependencies"]) {
        this.defDependencies = response["defDependencies"];
    }
    if (this.state === "ERROR") {
        //
        // Careful now. If we get back an event from the server as part of the error,
        // we want to fire off the event. Note that this will also remove it from the
        // list of errors, and this may leave us with an empty error list. In that case
        // we toss in a message of 'event fired' to prevent confusion from having an
        // error state, but no error.
        //
        // This code is perhaps a bit tenuous, as it attempts to reverse the mapping from
        // event descriptor to event name in the component, giving back the first one that
        // it finds (deep down in code). This almost violates encapsulation, but, well,
        // not badly enough to remove it.
        //
        var i;
        var newErrors = [];
        var fired = false;
        for (i = 0; i < response["error"].length; i++) {
            var err = response["error"][i];
            if (err["exceptionEvent"]) {
                // default server action error handling, ignore action callback
                if (err["useDefault"]) {
                    // Get error attribute for systemError event.
                    var error = err["event"]["attributes"]["values"]["error"];
                    error.severity = $A.severity.ALERT;

                    var evtArgs = {"message":error["message"],"error":null,"auraError":error};
                    // fire the event later so the function could return even if an error occurs in the event handler.
                    window.setTimeout(function() {  //eslint-disable-line no-loop-func
                        $A.eventService.getNewEvent('markup://aura:systemError').fire(evtArgs);
                    }, 0);

                    // should not invoke the callback
                    return false;
                }

                // returning COOS in AuraEnabled controller would go here
                var eventObj = err["event"];
                if (eventObj["descriptor"]) {
                    var eventDescriptor = new DefDescriptor(eventObj["descriptor"]);
                    var eventName = eventDescriptor.getName();
                    var eventNamespace = eventDescriptor.getNamespace();
                    if (eventNamespace === "aura") {
                        if (eventName === "clientOutOfSync" || eventName === "invalidSession") {
                            $A.clientService.throwExceptionEvent(err);
                            // should not invoke the callback for system level exception events
                            return false;
                        }
                        if (eventName === "serverActionError") {
                            this.error = [eventObj["attributes"]["values"]["error"]];
                            // should only invoke client action callback for serverActionError for custom handling
                            return true;
                        }
                    }
                }

                fired = true;
                this.events.push(err["event"]);
            } else {
                newErrors.push(err);
            }
        }
        if (fired === true && newErrors.length === 0) {
            newErrors.push({
                "message" : "Event fired" // DO NOT CHANGE: Event fired message carries special meaning and will bypass client callback to display this error
            });
        }
        this.error = newErrors;
    } else if (this.originalResponse && this.state === "SUCCESS") {
        // Compare the refresh response with the original response and return false if they are equal (no update)
        var originalValue = $A.util.json.orderedEncode(this.originalReturnValue);
        var refreshedValue = $A.util.json.orderedEncode(this.returnValue);
        if (refreshedValue === originalValue) {
            var originalComponents = $A.util.json.orderedEncode(this.originalResponse["components"]);
            var refreshedComponents = $A.util.json.orderedEncode(response["components"]);
            if (refreshedComponents === originalComponents) {
                $A.log("Action.updateFromResponse(): skipping duplicate response: " + this.getStorageKey() + ", " + this.getId());
                return false;
            }
        }
    }

    // INCOMPLETE refresh does not have a changed response so should not invoke the callback
    if (this.originalResponse && this.state === "INCOMPLETE") {
        return false;
    }

    return true;
};

/**
 * Gets a storable response from this action.
 *
 * WARNING: must use after finishAction() which updates <code>this.components</code>.
 *
 * @private
 */
Action.prototype.getStored = function() {
    if (this.storable && this.responseState === "SUCCESS") {
        return {
            "returnValue" : this.returnValue,
            "components" : this.components,
            "defDependencies" : this.defDependencies,
            "state" : "SUCCESS",
            "storage" : {
                "created" : new Date().getTime()
            }
        };
    }

    return null;
};

/**
 * Returns the json representation of the action
 * If the action is publicly cacheable, the ID is stripped out
 * @private
 */
Action.prototype.prepareToSend = function() {
    var json = this.toJSON();

    // publicly cacheable actions need to have their IDs stripped out before sending
    if (this.isPubliclyCacheable()) {
        delete json.id;
    }

    return json;
};

/**
 * Calls callbacks and fires events upon completion of the action.
 *
 * @param {AuraContext} context the context for pushing and popping the current action.
 * @private
 */
Action.prototype.finishAction = function(context) {
    var previous = context.setCurrentAction(this);
    var clearComponents = false;
    var id = this.getId(context);
    var error = undefined;
    var oldDisplayFlag = $A.showErrors();
    $A.clientService.setCurrentAccess(this.cmp);
    try {
        if (this.isFromStorage()) {
            // suppress errors dialogs while performing cached actions.
            // allows retry without the error dialog.
            $A.showErrors(false);
        }
        try {
            if (this.cmp === undefined || this.cmp.destroyed!==1) {
                // Add in any Action scoped components /or partial configs
                if (this.components) {
                    context.joinComponentConfigs(this.components, id);
                    clearComponents = true;
                }

                if (this.events.length > 0) {
                    for (var x = 0; x < this.events.length; x++) {
                        try {
                            this.parseAndFireEvent(this.events[x]);
                        } catch (e) {
                            error = this.processFinishActionException(e, "Events failed: ");
                        }
                    }
                }

                // If there is a callback for the action's current state, invoke that too
                var cb = this.callbacks[this.getState()];

                try {
                    if (cb) {
                        if (this.defDependencies && $A.getContext().uriAddressableDefsEnabled) {
                            var that = this;
                            clearComponents = false;
                            var componentsToFinish = this.components;
                            this.components = undefined;
                            var access = $A.clientService.currentAccess;
                            $A.componentService.loadComponentDefs(this.defDependencies, function(err) {
                                var previousAction = context.setCurrentAction(that);
                                $A.clientService.setCurrentAccess(access);
                                if (componentsToFinish) {
                                    that.components = componentsToFinish;
                                }
                                if (err) {
                                    that.state = "ERROR";
                                    that.message = err.message;
                                }
                                try {
                                    cb["fn"].call(cb["s"], that, that.cmp);
                                } catch (e) {
                                    that.processFinishActionException(e, "Callback failed: ", err, true);
                                } finally {
                                    $A.clientService.releaseCurrentAccess();
                                    if (componentsToFinish) {
                                        context.clearComponentConfigs(id);
                                    }
                                    context.setCurrentAction(previousAction);
                                }
                                if (err) {
                                    throw err;
                                }
                            });
                        } else {
                            cb["fn"].call(cb["s"], this, this.cmp);
                        }
                    } else if (this.defDependencies) {
                        $A.componentService.loadComponentDefs(this.defDependencies, function(err) {
                            if (err) {
                                throw err;
                            }
                        });
                    }
                } catch (e) {
                    if (!error) {
                        error = this.processFinishActionException(e, "Callback failed: ");
                    }
                }

                if (this.components && (cb || !this.storable || !$A.clientService.getActionStorage().isStorageEnabled())) {
                    context.clearComponentConfigs(id);
                    clearComponents = false;
                }
            } else {
                this.abort();
            }
        } catch (e) {
            if (!error) {
                error = this.processFinishActionException(e, "Action failed: ");
            }

            clearComponents = true;
        }
    } finally {
        $A.clientService.releaseCurrentAccess();
    }
    context.setCurrentAction(previous);
    if (clearComponents) {
        context.clearComponentConfigs(id);
    }
    // reset before potential throw
    $A.showErrors(oldDisplayFlag);
    if (error) {
        // no need to wrap AFE with auraError as customers who throw AFE would want to handle it with their own custom experience.
        if ($A.clientService.inAuraLoop() || error instanceof $A.auraFriendlyError) {
            throw error;
        } else {
            throw new $A.auraError("Action.prototype.finishAction Error ", error);
        }
    }
};

/**
 *
 * @param e - the exception to handle
 * @param err - additional error
 * @param raise - boolean flag to tell it to throw now
 * @private
 */
Action.prototype.processFinishActionException = function(e, message, err, raise) {
    var failedMessage = message + (this.def?this.def.toString():"");
    if (err) {
        failedMessage += "\nAdditionally, Component Definition loader failure: " + JSON.stringify(err);
    }
    $A.warning(failedMessage, e);
    e.message = e.message ? (e.message + '\n' + failedMessage) : failedMessage;

    if (raise) {
        if ($A.clientService.inAuraLoop() || e instanceof $A.auraFriendlyError) {
            throw e;
        } else {
            throw new $A.auraError("Action.prototype.finishAction Error ", e);
        }
    }
    return e;
};

/**
 * Abort an action if the component is not valid.
 *
 * @param {Boolean} beforeSend Have we sent the action to the server yet?
 * @return {Boolean} true if the action was aborted.
 * @private
 */
Action.prototype.abortIfComponentInvalid = function(beforeSend) {
    if ((!beforeSend || this.abortable) && this.cmp !== undefined && this.cmp.destroyed===1) {
        this.abort();
        return true;
    }
    return false;
};

/**
 * Mark this action as aborted.
 *
 * @private
 */
Action.prototype.abort = function() {
    this.state = "ABORTED";
    var cb = this.callbacks[this.state];
    try {
        if (cb) {
            cb["fn"].call(cb["s"], this, this.cmp);
        }
    } catch (e) {
        if ($A.clientService.inAuraLoop()) {
            throw e;
        } else {
            throw new $A.auraError("Failed during aborted callback", e);
        }
    } finally {
        $A.log("ABORTED: "+this.getStorageKey());
    }
};

/**
 * Set the action as abortable. Abortable actions are not sent to the server if the component is not valid.
 * A component is automatically destroyed and marked invalid by the framework when it is unrendered.
 *
 * Actions not marked abortable are always sent to the server regardless of the validity of the component.
 * For example, a save/modify action should not be set abortable to ensure it's always sent to the server
 * even if the component is deleted.
 *
 * Setting an action as abortable cannot be undone
 *
 * @platform
 * @export
 */
Action.prototype.setAbortable = function() {
    this.abortable = true;
};

/**
 * Checks if this action is a refresh.
 * @export
 */
Action.prototype.isRefreshAction = function() {
    return this.originalResponse !== undefined;
};

/**
 * Returns the current state of the abortable flag.
 *
 * @public
 * @returns {Boolean} the abortable flag
 * @export
 */
Action.prototype.isAbortable = function() {
    return this.abortable;
};

/**
 * Marks the Action as storable. For server-side Actions only.
 * Mark an action as storable to have its response stored in the client-side cache by the framework. Caching can be useful
 * if you want your app to be functional for devices that temporarily don’t have a network connection.
 *
 * @public
 * @param {Object}
 *            config - Optional. A set of key/value pairs that specify the storage options to set. You can set the
 *            following option:
 *            <code>ignoreExisting</code>: Set to <code>true</code> to refresh the stored item with a newly retrieved value,
 *              regardless of whether the item has expired or not. The default value is <code>false</code>.
 * @platform
 * @export
 */
Action.prototype.setStorable = function(config) {
    $A.assert(this.def && this.def.isServerAction(),
              "setStorable() cannot be called on a client action.");
    this.storable = true;
    this.storableConfig = config;
    this.abortable = true;
};


/**
 * Returns true if the function is storable, or false otherwise. For server-side Actions only.
 *
 * @public
 * @returns {Boolean}
 * @export
 */
Action.prototype.isStorable = function() {
    var ignoreExisting = this.storableConfig && this.storableConfig["ignoreExisting"];
    return this._isStorable() && !ignoreExisting;
};

/**
 * Sets this action as a 'caboose'.
 *
 * This is only relevant for server side actions.
 * This action will not be sent to the server until there is some other action
 * that would cause a server round-trip or after 60s since last send.
 *
 * @public
 * @export
 */
Action.prototype.setCaboose = function() {
    this.caboose = true;
};


/**
 * Returns true if the function should not create an XHR request.
 *
 * @public
 * @returns {boolean}
 * @export
 */
Action.prototype.isCaboose = function() {
    return this.caboose;
};

/**
 * @private
 */
Action.prototype._isStorable = function() {
    return this.storable || false;
};

/**
 * Gets the storage key in name-value pairs.
 *
 * @private
 * @export
 */
Action.prototype.getStorageKey = function() {
    return Action.getStorageKey(
        this.def ? this.def.getDescriptor().toString() : "",
        this.params
    );
};

/**
 * Returns true if a given function is from the current storage, or false otherwise.
 *
 * @public
 * @returns {Boolean}
 * @export
 */
Action.prototype.isFromStorage = function() {
    return !$A.util.isUndefinedOrNull(this.storage);
};

/**
 * Chains a function to run after the current Action. For server-side Actions only.
 *
 * @public
 * @export
 */
Action.prototype.setChained = function() {
    this.chained = true;
    $A.enqueueAction(this);
};

/**
 * Returns true if a given function is chained, or false otherwise. For server-side Actions only.
 *
 * @returns {Boolean}
 * @private
 */
Action.prototype.isChained = function() {
    return this.chained || false;
};

/**
 * Returns the number of times this action has been retried
 * @returns {number}
 */
Action.prototype.getRetryCount = function() {
    return this.retryCount;
};

/**
 * Increment the retry counter on this action
 */
Action.prototype.incrementRetryCount = function() {
    this.retryCount++;
};

/**
 * Returns the key/value pairs of the Action id, descriptor, and parameters in JSON format.
 *
 * @public
 * @export
 */
Action.prototype.toJSON = function() {
    var callingComponentDef = this.callingCmp ? this.callingCmp.getDef() : null;
    var requiredVersionDefs = callingComponentDef ? callingComponentDef.getRequiredVersionDefs() : null;
    var version = this.cmp ? this.cmp.getVersion() : null;

    // calling component has requiredVersionDefs or component is versioned.
    var isVersioned = (requiredVersionDefs && requiredVersionDefs.values) || version;

    var json = {
        "id" : this.getId(),
        "descriptor" : (this.def?this.def.getDescriptor():"UNKNOWN"),
        "callingDescriptor" : isVersioned ? (callingComponentDef ? callingComponentDef.getDescriptor().getQualifiedName() : "UNKNOWN") : "UNKNOWN",
        "params" : this.params
    };

    if (isVersioned) {
        json["version"] = version;
    }
    
    if (this.storable) {
        json["storable"] = this.storable;
    }

    return json;
};

/**
 * Mark an action as having an error.
 *
 * @param e the exception with which we want to mark the action.
 */
Action.prototype.markException = function(e) {
    var descriptor = this.def ? this.def.toString() : "";

    if (e instanceof $A.auraError || e instanceof $A.auraFriendlyError) {
        // keep the root cause failing descriptor
        e.setComponent(e["component"] || descriptor);
    }

    // if the error doesn't have id, we wrap it with auraError so that when displaying UI, it will have an id
    if (!e.id) {
        e = new $A.auraError(descriptor ? "Action failed: " + descriptor : "", e);
        // id is set when a component is set to error
        e.setComponent(descriptor);
    }

    if (!e['componentStack']) {
        e['componentStack'] = $A.util.getComponentHierarchy(this.cmp);
    }

    this.state = "ERROR";
    this.error = e;
    if ($A.clientService.inAuraLoop()) {
        $A.lastKnownError = e;
        throw e;
    }
};

/**
 * Mark the current action as having an error and finish the Action.
 *
 * @param context The current context.
 * @param e The error with which we want to mark the action.
 * @private
 */
Action.prototype.markError = function(context, e) {
    this.state = "ERROR";
    this.error = e;
    this.finishAction(context);
};

/**
 * Mark the current action as incomplete.
 *
 * @private
 */
Action.prototype.incomplete = function(context) {
    this.state = "INCOMPLETE";
    if (!this.error || !(this.error instanceof Array)) {
        this.error = [ { message : "Disconnected or Canceled" } ];
    }
    // Do not invoke callback on refresh action since response will not have changed
    if (!this.isRefreshAction()) {
        this.finishAction(context);
    }
};

/**
 * Internal routine to do the basic copy to a new refresh action.
 */
Action.prototype.copyToRefresh = function() {
    var refreshAction = this.def.newInstance(this.cmp);
    refreshAction.setParams(this.params);
    refreshAction.setStorable({"ignoreExisting" : true});
    refreshAction.background = this.background;
    refreshAction.abortable = this.abortable;

    this.refreshAction = refreshAction;

    return refreshAction;
};

/**
 * Gets a new action instance that can be used to refresh this storable action.
 * @return {Action} a new instance of this action.
 * @private
 */
Action.prototype.getRefreshAction = function(originalResponse) {
    var storage = originalResponse["storage"];
    var actionStorage = $A.clientService.getActionStorage().getStorage();
    var autoRefreshInterval =
            (this.storableConfig && !$A.util.isUndefined(this.storableConfig["refresh"])
             && $A.util.isNumber(this.storableConfig["refresh"]))
                    ? this.storableConfig["refresh"] * 1000
                    : actionStorage.getDefaultAutoRefreshInterval();

    // only refresh the action if it is sufficiently old
    var now = new Date().getTime();
    if ((now - storage["created"]) >= autoRefreshInterval && this.def) {
        var refreshAction = this.copyToRefresh();
        $A.log("Action.refresh(): auto refresh begin: " + this.getId() + " to " + refreshAction.getId());
        refreshAction.originalResponse = originalResponse;
        refreshAction.originalReturnValue = this.returnValue;

        // TODO W-2835710 - remove support for supressing callbacks
        var executeCallbackIfUpdated = (this.storableConfig && !$A.util.isUndefined(this.storableConfig["executeCallbackIfUpdated"]))
                ? this.storableConfig["executeCallbackIfUpdated"] : true;
        if (executeCallbackIfUpdated !== false) {
            refreshAction.callbacks = this.callbacks;
        }

        return refreshAction;
    }
    return null;
};

/**
 * Returns an action that retries this action from storage with the server or null if the action wasn't from storage
 *
 * @private
 * @returns {Action}
 */
Action.prototype.getRetryFromStorageAction = function() {
    if(this.isFromStorage()) {
        var retryAction = this.copyToRefresh();
        retryAction.callbacks = this.callbacks;
        return retryAction;
    }
    return null;
};

/**
 * Gets the Action storage.
 *
 * @returns {Storage}
 * @deprecated
 * @export
 */
Action.prototype.getStorage = function() {
    return $A.clientService.getActionStorage().getStorage();
};

/**
 * Uses the event object in the action's response and fires the event.
 *
 * @private
 */
Action.prototype.parseAndFireEvent = function(evtObj) {
    var descriptor = evtObj["descriptor"];

    // If the current component has registered to fire the event,
    // then create the event object and associate it with this component(make it the source)
    var evt = null;
    var comp = this.getComponent();
    if (comp) {
        evt = comp.getEventByDescriptor(descriptor);
    }
    if (evt !== null) {
        if (evtObj["attributes"]) {
            evt.setParams(evtObj["attributes"]["values"]);
        }
        evt.fire();
    } else {
        // Else create the event using ClientService and fire it. Usually the case for APPLICATION events.
        // If the event is a COMPONENT event, it is fired anyway but has no effect because its an orphan(without source)
        $A.clientService.parseAndFireEvent(evtObj);
    }
};

/**
 * Fire off a refresh event if there is a valid component listener.
 *
 * @private
 */
Action.prototype.fireRefreshEvent = function(event, responseUpdated) {
    if (this.cmp && this.cmp.isValid()) {
        var isRefreshObserver = this.cmp.isInstanceOf("auraStorage:refreshObserver");
        if (isRefreshObserver) {
            this.cmp.getEvent(event).setParams({
                    "action" : this,
                    "responseUpdated": responseUpdated
            }).fire();
        }
    }
};

/**
 * Returns true if public caching is enabled and the current action is publicly cacheable (based on the definition).
 *
 * For server-side Actions only.
 *
 * @returns {Boolean}
 * @private
 */
Action.prototype.isPubliclyCacheable = function() {
    return $A.getContext().isActionPublicCachingEnabled() && this.def.isPublicCachingEnabled() && this.def.getPublicCachingExpiration() > 0;
};

Aura.Controller.Action = Action;
