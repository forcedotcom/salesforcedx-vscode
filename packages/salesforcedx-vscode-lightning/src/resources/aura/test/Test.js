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
 * @classdesc Utility functions for component testing, accessible using $A.test.
 * @constructor Test
 * @export
 */
function TestInstance() {
    this.waits = [];
    this.currentWait = undefined;
    this.cleanups = [];
    this.completed = {}; // A map of action name to boolean for 'named' actions that have been queued
    this.inProgress = -1; // -1:uninitialized, 0:complete, 1:tearing down, 2:running, 3+:waiting
    this.preErrors = [];
    this.preWarnings = [];
    this.expectedErrors = [];
    this.expectedWarnings = [];
    this.failOnWarning = false;
    this.initTime = new Date().getTime();
    this.elapsedTime = 0;
    this.timeoutTime = 0;
    this.timedOut = false;
    this.timer = undefined;
    this.suite = undefined;
    this.stages = undefined;
    this.cmp = undefined;
    this.blockForeground = 0;
    this.blockBackground = 0;
    this.sentXHRCount = 0;
    this.prePostSendConfigs = [];
    this.prePostDecodeConfigs = [];
    this.installOverride();
    this.name = undefined;

    //borrow Aura.time if it's there, if not, polyfill
    this.time =
        (window['Aura'] && Aura.time && Aura.time instanceof Function)?
        Aura.time:(
            (window.performance && window.performance.now) ? window.performance.now.bind(performance) : function(){return Date.now();}
        );
    //for debug use only
    if(window.sessionStorage) {
        sessionStorage.setItem('frameworkReadyWhenCreateTestInstance', window['Aura']?true:false);
        sessionStorage.setItem('frameworkJsReadyWhenCreateTestInstance', (window['Aura'] && window['Aura']['frameworkJsReady'])?true:false);
        sessionStorage.setItem('timeStampOfTestInstanceCreation', this.time());
    }
}

/**
 * The set of errors accumulated.
 *
 * Note that this set of errors is 'static', since it can be accessed from window.onerror even before the $A.test
 * instance is initialized. We are careful to update it globally on the prototype instead of in the class.
 *
 * @private
 * @memberof Test
 */
TestInstance.prototype.errors = [];

// #include aura.test.Test_private

/**
 *
 * @description Asynchronously wait for a condition before continuing with the next stage of the test case. The wait
 *              condition is checked after the current test stage is completed but before the next stage is started.
 *
 * @example
 * $A.test.addWaitFor("I was updated.", function(){
 *   return element.textContent;
 *  }, function(){alert("the wait is over"});
 *
 * @param {Object}
 *            expected The value to compare against. If expected is a function, it will evaluate it before comparison.
 * @param {Object}
 *            testFunction A function to evaluate and compare against expected.
 * @param {Function}
 *            callback Invoked after the comparison evaluates to true
 * @export
 * @function Test#addWaitFor
 */
TestInstance.prototype.addWaitFor = function(expected, testFunction, callback) {
    this.addWaitForWithFailureMessage(expected, testFunction, null, callback);
};


/**
 *
 * @description Asynchronously wait for a condition before continuing with the next stage of the test case. The wait
 *              condition is checked after the current test stage is completed but before the next stage is started.
 *
 *  @example
 *  $A.test.addWaitForWithFailureMessage("i was updated", function(){<br/>
 *   return element.textContent;},"Failure Message", function(){alert("the wait is over"});
 *
 * @param {Object}
 *            expected The value to compare against. If expected is a function, it will evaluate it before comparison.
 * @param {Object}
 *            testFunction A function to evaluate and compare against expected.
 * @param {String}
 *            failureMessage The message that is returned if the condition is not true
 * @param {Function}
 *            callback Invoked after the comparison evaluates to true
 * @export
 * @function Test#addWaitForWithFailureMessage
 */
TestInstance.prototype.addWaitForWithFailureMessage = function(expected, testFunction, failureMessage, callback) {
    if (!$A.util.isFunction(testFunction)) {
        this.fail("addWaitFor expects a function to evaluate for comparison, but got: " + testFunction);
    }
    if (callback && !$A.util.isFunction(callback)) {
        this.fail("addWaitFor expects a function for callback, but got: " + callback);
    }
    this.waits.push({
        expected : expected,
        actual : testFunction,
        callback : callback,
        failureMessage : failureMessage
    });
};

/**
 * Block requests from being sent to the server.
 *
 * This routine can be used to artificially force actions to be held on the client to be sent to the server at a later
 * date. It can be used to simulate delays in processing (or rapid action queueing on the client).
 *
 * @export
 * @function Test#blockRequests
 */
TestInstance.prototype.blockRequests = function() {
    this.blockForeground += 1;
    this.blockBackground += 1;
};

/**
 * Block only foreground actions from being sent to the server.
 *
 * @export
 * @function Test#blockForegroundRequests
 */
TestInstance.prototype.blockForegroundRequests = function() {
    this.blockForeground += 1;
};

/**
 * Block only background actions from being sent to the server.
 *
 * @export
 * @function Test#blockBackgroundRequests
 */
TestInstance.prototype.blockBackgroundRequests = function() {
    this.blockBackground += 1;
};

/**
 * Release requests to be sent to the server.
 *
 * This must be called after blockRequests, otherwise it may result in unknown consequences.
 *
 * @export
 * @function Test#releaseRequests
 */
TestInstance.prototype.releaseRequests = function() {
    this.blockForeground -= 1;
    this.blockBackground -= 1;
    $A.clientService.process();
};

/**
 * Release only foreground requests from being sent to the server.
 *
 * Callers must be aware of what requests are currently blocked. Releasing requests that are not blocked will result in
 * unknown consequences.
 *
 * @export
 * @function Test#releaseForegroundRequests
 */
TestInstance.prototype.releaseForegroundRequests = function() {
    this.blockForeground -= 1;
    $A.clientService.process();
};

/**
 * Release only background actions from being sent to the server.
 *
 * Callers must be aware of what requests are currently blocked. Releasing requests that are not blocked will result in
 * unknown consequences.
 *
 * @export
 * @function Test#releaseBackgroundRequests
 */
TestInstance.prototype.releaseBackgroundRequests = function() {
    this.blockBackground -= 1;
    $A.clientService.process();
};

/**
 * Get total count of foreground and background requests sent to the server.
 *
 * This routine can be used to get a before and after count on server requests to attempt to verify we are only sending
 * the necessary amount of requests.
 *
 * @export
 * @function Test#getSentRequestCount
 */
TestInstance.prototype.getSentRequestCount = function() {
    return this.sentXHRCount;
};

/**
 * Get the total number of uri-addressable definitions that have been requested
 * @export
 */
TestInstance.prototype.getRequestedComponentDefCount = function() {
    return $A.componentService.componentDefLoader.counter;
};


/**
 * Check to see if an array of actions have all completed.
 *
 * @export
 * @function Test#areActionsComplete
 */
TestInstance.prototype.areActionsComplete = function(actions) {
    var state;
    var i;

    this.assertTrue($A.util.isArray(actions), "actions must be an array");
    for (i = 0; i < actions.length; i++) {
        state = actions[i].getState();
        if (state === "NEW" || state === "RUNNING") {
            return false;
        }
    }
    return $A.componentService.componentDefLoader.loading === 0;
};

/**
 * Add a cleanup function that is run on teardown.
 *
 * @param {Function}
 *            cleanupFunction the function to run on teardown.
 * @export
 * @function Test#addCleanup
 */
TestInstance.prototype.addCleanup = function(cleanupFunction) {
    this.cleanups.push(cleanupFunction);
};

/**
 * Get an instance of an action based on the specified parameters and callback function.
 *
 * @param {Component}
 *            component The Component on which to search for the action
 * @param {String}
 *            name The name of the action from the component's perspective (e.g. "c.doSomething")
 * @param {Object}
 *            params The parameters to pass to the action
 * @param {Function}
 *            callback The callback function to execute for the action, or if not a function a name for the action
 * @returns {Action} An instance of the action
 * @export
 * @function Test#getAction
 */
TestInstance.prototype.getAction = function(component, name, params, callback) {
    var action = component.get(name);
    if (params) {
        action.setParams(params);
    }
    if (callback) {
        if ($A.util.isFunction(callback)) {
            action.setCallback(component, callback);
        } else {
            $A["test"].fail("getAction: callback must be a function");
        }
    }
    return action;
};

/**
 * Enqueue an action, ensuring that it is safely inside an aura call.
 *
 * @param {Action}
 *            action The action to enqueue.
 * @param {Boolean}
 *            background Set to true to run the action in the background, otherwise the value of action.isBackground()
 *            is used.
 * @export
 * @function Test#enqueueAction
 */
TestInstance.prototype.enqueueAction = function(action, background) {
    $A.run(function() {
        $A.enqueueAction(action, background);
    });
};

/**
 *
 * @description Get an instance of a server action that is not available to the component.
 *
 * @example
 * $A.test.getExternalAction(cmp, "aura://ComponentController/ACTION$getComponent",
 *          {name:"aura:text", attributes:{value:"valuable"}},
 *          "java://org.auraframework.instance.component",
 *          function(action){alert(action.getReturnValue().attributes.values.value)})
 *
 * @param {Component} component
 *            The scope to run the action with, even if the action is not visible to it
 * @param {String} descriptor
 *            The descriptor for the action - e.g. java://my.own.Controller/ACTION$doIt
 * @param {Object} params
 *            The parameters to pass to the action, as a Map (name:value)
 * @param {Object} returnType
 *            The return type descriptor for the action, e.g. java://java.lang.String
 * @param {Function} callback
 *            An optional callback to execute with the component as the scope
 * @returns {Action} an instance of the action
 * @export
 * @function Test#getExternalAction
 */
TestInstance.prototype.getExternalAction = function(component, descriptor, params, returnType, callback) {
    var paramDefs = [];
    for ( var k in params) {
        if (k === 'length' || !params.hasOwnProperty(k)) {
            continue;
        }
        paramDefs.push({
            "name" : k
        });
    }

    var config = {};
    config[Json.ApplicationKey.NAME] = descriptor;
    config[Json.ApplicationKey.DESCRIPTOR] = descriptor;
    config[Json.ApplicationKey.ACTIONTYPE] = "SERVER";
    config[Json.ApplicationKey.RETURNTYPE] = returnType;
    config[Json.ApplicationKey.PARAMS] = paramDefs;

    var def = new ActionDef(config);

    var action = def.newInstance(component);
    action.setParams(params);
    if (callback) {
        action.setCallback(component, callback);
    }
    return action;
};

/**
 * Clear out component configs returned by an action.
 *
 * This must be called within the action callback. It fails if no components are cleared.
 *
 * @param {Action}
 *            action The action to clear.
 * @export
 * @function Test#clearAndAssertComponentConfigs
 */
TestInstance.prototype.clearAndAssertComponentConfigs = function(a) {
    if ($A.getContext().clearComponentConfigs(a.getId()) === 0) {
        this.fail("No component configs were cleared for " + a.getStorageKey());
    }
};

/**
 * Peek if there are any pending server actions.
 *
 * NOTE: this is used as a predicate and does not have access to 'this'. If this function changes to require 'this',
 * either the uses will need to be refactored, or isActionPending will need to be auto-bound.
 *
 * @returns {Boolean} Returns true if there are pending server actions, or false otherwise.
 * @export
 * @function Test#isActionPending
 */
TestInstance.prototype.isActionPending = function() {
    return !$A.clientService.idle() || $A.componentService.componentDefLoader.loading !== 0;
};

/**
 * Peek if there are any queued server actions.
 *
 * NOTE: this is used as a predicate and does not have access to 'this'. If this function changes to require 'this',
 * either the uses will need to be refactored, or isActionQueued will need to be auto-bound.
 *
 * @returns {Boolean} Returns true if there are pending server actions, or false otherwise.
 * @export
 * @function Test#isActionQueued
 */
TestInstance.prototype.isActionQueued = function() {
    return $A.clientService.areActionsWaiting();
};

/**
 * Invoke a server action. At the end of current test case stage, the test will wait for any actions to complete before
 * continuing to the next stage of the test case.
 *
 * @param {Action}
 *            action The action to invoke
 * @param {Boolean}
 *            doImmediate If set to true, the request will be sent immediately, otherwise the action will be handled as
 *            any other Action and may be queued behind prior requests.
 * @export
 * @function Test#callServerAction
 */
TestInstance.prototype.callServerAction = function(action, doImmediate) {
    if (this.inProgress === 0) {
        return;
    }
    var actions = $A.util.isArray(action) ? action : [ action ];
    var that = this;
    var i;
    if (doImmediate) {
        // HACK! This needs to get fixed.
        var auraXHR = $A.clientService.getAvailableXHR(true);
        if (!auraXHR) {
            this.fail("$A.test.callServerAction: Unable to send actions");
        }
        if ($A.clientService.send(auraXHR, actions, "POST")) {
            this.addWaitFor(true, function() {
                return that.areActionsComplete(actions);
            });
        } else {
            // whoops couldn't send
            $A.clientService.releaseXHR(auraXHR);
            this.fail("$A.test.callServerAction: Unable to send actions");
        }
    } else {
        for (i = 0; i < actions.length; i++) {
            $A.enqueueAction(actions[i]);
        }
        this.addWaitFor(true, function() {
            return that.areActionsComplete(actions);
        });
    }
};

/**
 * Set whether the server is reachable, to mimick being offline.
 *
 * Note that this will not work with IE < 10 (see W-2537764).
 *
 * @param {Boolean}
 *            reachable True or absent to make the server reachable; otherwise the server is made unreachable.
 * @export
 * @function Test#setServerReachable
 */
TestInstance.prototype.setServerReachable = function(reachable) {
    if (arguments.length === 0 || reachable) {
        $A.clientService.initHost();
    } else {
        $A.clientService.initHost('//offline');
    }
};

/**
 * @param xhrExclusivity boolean for xhr's to be run exclusively (one at a time)
 * @export
 */
TestInstance.prototype.setXHRExclusivity = function(xhrExclusivity) {
    $A.clientService.setXHRExclusivity(xhrExclusivity);
};

/**
 * Invoke a callback after the provided condition evaluates to truthy, checking on the condition every specified
 * interval. Truthy values can refer to a non-empty String, a non-zero number, a non-empty array, an object, or an
 * expression evaluating to true.
 *
 * @param {Function}
 *            conditionFunction The function to evaluate
 * @param {Function}
 *            callback The callback function to run if conditionFunction evaluates to truthy
 * @param {Number}
 *            intervalInMs The number of milliseconds between each evaluation of conditionFunction
 * @export
 * @function Test#runAfterIf
 */
TestInstance.prototype.runAfterIf = function(conditionFunction, callback, intervalInMs) {
    var that = this;
    if (this.inProgress === 0) {
        return;
    }
    try {
        if (conditionFunction()) {
            if (callback) {
                callback();
            }
        } else {
            this.inProgress++;
            if (!intervalInMs) {
                intervalInMs = 500;
            }
            setTimeout(function() {
                that.runAfterIf(conditionFunction, callback);
                that.inProgress--;
            }, intervalInMs);
            return;
        }
    } catch (e) {
        this.logError("Error in runAfterIf", e);
    }
};

/**
 * Set test to timeout in a period of milliseconds from now, clearing the existing timeout.
 *
 * @param {Number}
 *            timeoutMs The number of milliseconds from now in which the test should timeout
 * @export
 * @function Test#setTestTimeout
 */
TestInstance.prototype.setTestTimeout = function(timeoutMs) {
    this.timeoutTime = timeoutMs;
    this.startTimer();
};

/**
 * Return whether the test is finished.
 *
 * @returns {Boolean} Returns true if the test has completed, or false otherwise.
 * @export
 * @function Test#isComplete
 */
TestInstance.prototype.isComplete = function() {
    return this.inProgress === 0;
};

/**
 * Get the list of errors seen by the test, not including any errors handled explicitly by the framework.
 *
 * @returns {string} Returns an empty string if no errors are seen, else a json encoded list of errors
 * @export
 * @function Test#getErrors
 */
TestInstance.prototype.getErrors = function() {
    var errors = TestInstance.prototype.errors;
    if (errors.length > 0) {
        return $A.util.json.encode(errors);
    } else {
        return "";
    }
};

/**
 * Essentially a toString method, except strings are enclosed with double quotations. Returns a string even for
 * undefined/null value.
 *
 * @param {Object}
 *            value The value that will be converted to a String
 * @returns {String} The value that is returned as a String type
 * @private
 * @function Test#print
 */
TestInstance.prototype.print = function(value) {
    if (value === undefined) {
        return "undefined";
    } else if (value === null) {
        return "null";
    } else if (typeof value === "string") {
        return '"' + value + '"';
    } else {
        return value.toString();
    }
};

/**
 * Internally used error function to log an error for a given test.
 *
 * @param level
 *            ERROR
 * @param msg
 *            message to display this is being called by Logger.prototype.notify
 * @private
 * @function Test#auraError
 */
TestInstance.prototype.auraError = function(level, msg/* , error */) {
    if (!this.putMessage(this.preErrors, this.expectedErrors, msg)) {
        this.fail(msg);
    }
};

/**
 * Warning- use this function with care. Tell the test that we expect an $A.auraError that occurs in a separate thread
 * than the main test thread. Any errors occurring in the main test thread should be caught and verified in the test
 * itself.
 *
 * Test will fail if expected error is not received.
 *
 * @param {string}
 *            e The error message that we expect.
 * @export
 * @function Test#expectAuraError
 */
TestInstance.prototype.expectAuraError = function(e) {
    this.expectMessage(this.preErrors, this.expectedErrors, e);
};

/**
 * Internally used warning function to log a warning for a given test.
 *
 * @param level
 *            WARNING
 * @param msg
 *            message to display this is being called by Logger.prototype.notify
 * @private
 * @function Test#auraWarning
 */
TestInstance.prototype.auraWarning = function(level, msg) {
    if (!this.putMessage(this.preWarnings, this.expectedWarnings, msg)) {
        if (this.failOnWarning) {
            this.fail("Unexpected warning = " + msg);
        }
        $A.log("Unexpected warning = " + msg);
        return false;
    }
    return true;
};

/**
 * Tell the test that we expect a warning. If this function is called and the test does not receive the expected
 * warning, the test will fail.
 *
 * @param {String}
 *            w the warning message that we expect.
 * @export
 * @function Test#expectAuraWarning
 */
TestInstance.prototype.expectAuraWarning = function(w) {
    this.expectMessage(this.preWarnings, this.expectedWarnings, w);
};

/**
 * Assert that the current component HTML is Accessibility compliant.
 *
 * @description Calls the checkAccessibilty method to verify certain tags are accessible.
 *
 * @param {String}
 *            errorMessage The message that is returned if the condition is not false
 * @throws {Error}
 *             Throws Error containing concatenated string representation of all accessibility errors found
 * @export
 * @function Test#assertAccessible
 */
TestInstance.prototype.assertAccessible = function() {
    var res = $A.devToolService.checkAccessibility();
    if (res !== "") {
        this.fail(res);
    }
};

/**
 *
 * @description Assert that if(condition) check evaluates to true.
 * A truthy value refers to an Object, a string, a non-zero number, a non-empty array, or true.
 *
 * @example
 * assertTruthy("helloWorld"); // Positive
 * assertTruthy(null); // Negative
 *
 * @param {Object} condition The condition to evaluate
 * @param {String} assertMessage The message that is returned if the condition is not true
 * @export
 */
TestInstance.prototype.assertTruthy = function(condition, assertMessage) {
    if (!condition) {
        this.fail(assertMessage, "\nExpected: {truthy} but Actual: {" + condition + "}");
    }
};

/**
 * @description A falsey value refers to zero, an empty string, null, undefined, or false.
 * Assert that the if(condition) check evaluates to false.
 *
 * @param {Object} condition The condition to evaluate
 * @param {String} assertMessage The message that is returned if the condition is not false
 *
 * @example
 * assertFalsy("helloWorld"); // Negative
 * assertFalsy(null); // Positive
 *
 * @export
 * @function Test#assertFalsy
 */
TestInstance.prototype.assertFalsy = function(condition, assertMessage) {
    if (condition) {
        this.fail(assertMessage, "\nExpected: {falsy} but Actual: {" + condition + "}");
    }
};

/**
 * @description Assert that if(condition) check evaluates to true.
 *
 * @param {Object} condition The condition to evaluate
 * @param {String} assertMessage The message that is returned if the condition is not true
 *
 *
 * @example
 * assert("helloWorld"); // Positive
 * assert(null); // Negative
 * @export
 */
TestInstance.prototype.assert = function(condition, assertMessage) {
    this.assertTruthy(condition, assertMessage);
};

/**
 * Assert that the two values provided are equal.
 *
 * @param {Object}
 *            arg1 The argument to evaluate against arg2
 * @param {Object}
 *            arg2 The argument to evaluate against arg1
 * @param {String}
 *            assertMessage The message that is returned if the two values are not equal
 * @export
 * @function Test#assertEquals
 */
TestInstance.prototype.assertEquals = function(arg1, arg2, assertMessage) {
    if (arg1 !== arg2) {
        var extraMessage = "\nExpected: {" + arg1 + "} but Actual: {" + arg2 + "}";
        if (typeof arg1 !== typeof arg2) {
            var arg1Type = (arg1 === null) ? "null" : typeof arg1;
            var arg2Type = (arg2 === null) ? "null" : typeof arg2;
            extraMessage += "\nType Mismatch, Expected type: {" + arg1Type + "} but Actual type: {" + arg2Type + "}";
        }
        this.fail(assertMessage, extraMessage);
    }
};

/**
 * Assert that the two string values provided are equal ignoring whitespace.
 *
 * This is important when checking constructed strings, as browsers may handle them differently.
 *
 * @param {string}
 *            arg1 The argument to evaluate against arg2
 * @param {string}
 *            arg2 The argument to evaluate against arg1
 * @param {String}
 *            assertMessage The message that is returned if the two values are not equal
 * @export
 * @function Test#assertEqualsIgnoreWhitespace
 */
TestInstance.prototype.assertEqualsIgnoreWhitespace = function(arg1, arg2, assertMessage) {
    var arg1s = arg1.replace(/\s+/gm, '').replace(/^ | $/gm, '');
    var arg2s = arg2.replace(/\s+/gm, '').replace(/^ | $/gm, '');
    this.assertEquals(arg1s, arg2s, assertMessage);
};

/**
 * Assert that a string starts with another.
 *
 * @param {Object}
 *            start The start string.
 * @param {Object}
 *            full The string that is expected to start with the start string
 * @param {String}
 *            assertMessage The message that is returned if the two values are not equal
 * @export
 * @function Test#assertStartsWith
 */
TestInstance.prototype.assertStartsWith = function(start, full, assertMessage) {
    if (!full || !full.indexOf || full.indexOf(start) !== 0) {
        var fullStart = full;
        if (fullStart.length > start.length + 20) {
            fullStart = fullStart.substring(0, start.length + 20) + "...";
        }
        this.fail(assertMessage, "\nExpected string to start with: {" + start + "} but Actual: {" + fullStart + "}");
    }
};

/**
 * Complement of assertEquals, throws Error if arg1===arg2.
 *
 * @param {Object}
 *            arg1 The argument to evaluate against arg2
 * @param {Object}
 *            arg2 The argument to evaluate against arg1
 * @param {String}
 *            assertMessage The message that is returned if the two values are equal
 * @export
 * @function Test#assertNotEquals
 */
TestInstance.prototype.assertNotEquals = function(arg1, arg2, assertMessage) {
    if (arg1 === arg2) {
        this.fail(assertMessage, "\nExpected values to not be equal but both were: {" + arg1 + "}");
    }
};

/**
 * Assert that the value is not undefined.
 *
 * @param {Object}
 *            condition The argument to evaluate
 * @param {String}
 *            assertMessage The message that is returned if arg1 is undefined
 * @export
 * @function Test#assertDefined
 */
TestInstance.prototype.assertDefined = function(condition, assertMessage) {
    if (condition === undefined) {
        this.fail(assertMessage, "\nExpected: {defined} but Actual: {" + condition + "}");
    }
};

/**
 * Assert that the condition === true.
 *
 * @param {Boolean}
 *            condition The condition to evaluate
 * @param {String}
 *            assertMessage The message that is returned if the condition !==true
 * @export
 * @function Test#assertTrue
 */
TestInstance.prototype.assertTrue = function(condition, assertMessage) {
    if (condition !== true) {
        this.fail(assertMessage, "\nExpected: {true} but Actual: {" + condition + "}");
    }
};

/**
 * Assert that the condition === false.
 *
 * @param {Boolean}
 *            condition The condition to evaluate
 * @param {String}
 *            assertMessage The message that is returned if the condition !==false
 * @export
 * @function Test#assertFalse
 */
TestInstance.prototype.assertFalse = function(condition, assertMessage) {
    if (condition !== false) {
        this.fail(assertMessage, "\nExpected: {false} but Actual: {" + condition + "}");
    }
};

/**
 * Assert that the value passed in is undefined.
 *
 * @param {Object}
 *            condition The argument to evaluate
 * @param {String}
 *            assertMessage The message that is returned if the argument is not undefined
 * @export
 * @function Test#assertUndefined
 */
TestInstance.prototype.assertUndefined = function(condition, assertMessage) {
    if (condition !== undefined) {
        this.fail(assertMessage, "\nExpected: {undefined} but Actual: {" + condition + "}");
    }
};

/**
 * Assert that the value passed in is not undefined or null.
 *
 * @param {Object}
 *            condition The argument to evaluate
 * @param {String}
 *            assertMessage The message that is returned if the argument is not undefined or null
 * @export
 * @function Test#assertNotUndefinedOrNull
 */
TestInstance.prototype.assertNotUndefinedOrNull = function(condition, assertMessage) {
    if ($A.util.isUndefinedOrNull(condition)) {
        this.fail(assertMessage, "\nExpected: {defined or non-null} but Actual: {" + condition + "}");
    }
};

/**
 * Assert that the value passed in is either undefined or null.
 *
 * @param {Object}
 *            condition The argument to evaluate
 * @param {String}
 *            assertMessage The message that is returned if the argument is not undefined or null
 * @export
 * @function Test#assertUndefinedOrNull
 */
TestInstance.prototype.assertUndefinedOrNull = function(condition, assertMessage) {
    if (!$A.util.isUndefinedOrNull(condition)) {
        this.fail(assertMessage, "\nExpected: {undefined or null} but Actual: {" + condition + "}");
    }
};

/**
 * Assert that value === null.
 *
 * @param {Object}
 *            condition The argument to evaluate
 * @param {String}
 *            assertMessage The message that is returned if the value !==null
 * @export
 * @function Test#assertNull
 */
TestInstance.prototype.assertNull = function(condition, assertMessage) {
    if (condition !== null) {
        this.fail(assertMessage, "\nExpected: {null} but Actual: {" + condition + "}");
    }
};

/**
 * Assert that value !== null.
 *
 * @param {Object}
 *            condition The argument to evaluate
 * @param {String}
 *            assertMessage The message that is returned if the value is null
 * @export
 * @function Test#assertNotNull
 */
TestInstance.prototype.assertNotNull = function(condition, assertMessage) {
    if (condition === null) {
        this.fail(assertMessage, "\nExpected: {non-null} but Actual: {" + condition + "}");
    }
};

/**
 * Assert that the value is an instance of the expected type.
 *
 * @param {String}
 *            type The type expected
 * @param {Object}
 *            condition The argument to evaluate
 * @param {String}
 *            assertMessage The message that is returned if the value is null
 * @export
 * @function Test#assertAuraType
 */
TestInstance.prototype.assertAuraType = function(type, condition, assertMessage) {
    switch (type) {
        case "Action": return condition instanceof Action;
        case "ActionDef": return condition instanceof ActionDef;

        case "Event": return condition instanceof Event;
        case "EventDef": return condition instanceof EventDef;

        case "Component": return $A.util.isComponent(condition);
        case "ComponentDef": return condition instanceof ComponentDef;

        case "ControllerDef": return condition instanceof ControllerDef;

        case "ModelDef": return condition instanceof ModelDef;

        case "AuraError": return condition instanceof AuraError;

        case "PropertyReferenceValue": return condition instanceof PropertyReferenceValue;

        default: this.fail(assertMessage, "\nExpected: Aura object of type {" + type + "}");
    }
};


/**
 * Throw an Error, making a test fail with the specified message.
 *
 * @param {String}
 *            assertMessage Defaults to "Assertion failure", if assertMessage is not provided
 * @param {String}
 *            extraInfoMessage
 * @throws {Error}
 *             Throws error with a message
 * @export
 * @function Test#fail
 */
TestInstance.prototype.fail = function(assertMessage, extraInfoMessage) {
    var msg = assertMessage || "Assertion failure. Please provide assertion message.";
    if (extraInfoMessage) {
        msg += extraInfoMessage;
    }
    var error = new Error(msg);
    this.logError(msg);
    throw error;
};

/**
 * Get an object's prototype.
 *
 * @param {Object}
 *            instance The instance of the object
 * @returns {Object} The prototype of the specified object
 * @export
 * @function Test#getPrototype
 */
TestInstance.prototype.getPrototype = function(instance) {
    return (instance && (Object.getPrototypeOf && Object.getPrototypeOf(instance))) || instance.__proto
            || instance.constructor.prototype;
};

/**
 * Replace a function on an object with a restorable override.
 *
 * @param {Object}
 *            instance The instance of the object
 * @param {String}
 *            name The name of the function to be replaced
 * @param {Function}
 *            newFunction The new function that replaces originalFunction
 * @returns {Function} The override (newFunction) with an added "restore" function that, when invoked, will restore
 *          originalFunction on instance
 * @throws {Error}
 *             Throws an error if instance does not have originalFunction as a property
 * @export
 * @function Test#overrideFunction
 */
TestInstance.prototype.overrideFunction = function(instance, name, newFunction) {
    var originalFunction = instance[name];
    if (!originalFunction) {
        this.fail("Did not find the specified function '" + name + "' on the given object!");
    }

    instance[name] = newFunction;

    // Now lets see if there is a corresponding private (obfuscated) version that we also need to mock
    var nonExportedFunctionName;
    for ( var key in instance) {
        var f;
        try {
            f = instance[key];
        } catch (e) {
            // IE: Handle "Unspecified error" for properties like "fileCreatedDate"
            continue;
        }
        if (key !== name && f === originalFunction) {
            nonExportedFunctionName = key;
            instance[key] = newFunction;
            break;
        }
    }

    var override = newFunction;
    override.originalInstance = instance;
    override.originalFunction = originalFunction;
    override.nonExportedFunctionName = nonExportedFunctionName;

    override["restore"] = function() {
        override.originalInstance[name] = override.originalFunction;

        if (override.nonExportedFunctionName) {
            override.originalInstance[override.nonExportedFunctionName] = override.originalFunction;
        }
    };

    // if we're overriding an override, update it's pointer to restore to us
    if (originalFunction.originalInstance) {
        originalFunction.originalInstance = override;
    }

    return override;
};

/**
 * Add a handler function to an existing object's function. The handler may be attached before or after the target
 * function. If attached after (postProcess === true), the handler will be invoked with the original function's return
 * value followed by the original arguments. If attached before (postProcess !== true), the handler will be invoked with
 * just the original arguments.
 *
 * @param {Object}
 *            instance The instance of the object
 * @param {String}
 *            name The name of the function whose arguments are applied to the handler
 * @param {Function}
 *            newFunction The target function to attach the handler to
 * @param {Boolean}
 *            postProcess Set to true if the handler will be called after the target function or false if the handler
 *            will be called before originalFunction
 * @returns {Function} The override of originalFunction, which has a "restore" function that, when invoked, will restore
 *          originalFunction on instance
 * @export
 * @function Test#addFunctionHandler
 */
TestInstance.prototype.addFunctionHandler = function(instance, name, newFunction, postProcess) {
    var handler = newFunction;
    var originalFunction = instance[name];
    return this.overrideFunction(instance, name, postProcess ? function() {
        handler.apply(this, originalFunction.apply(this, arguments), arguments);
    } : function() {
        handler.apply(this, arguments);
        originalFunction.apply(this, arguments);
    });
};

/**
 * Get a DOM node's outerHTML.
 *
 * @param {Node}
 *            node The node to get outer HTML from
 * @returns {String} The outer HTML
 * @export
 * @function Test#getOuterHtml
 */
TestInstance.prototype.getOuterHtml = function(node) {
    return node.outerHTML || (function(n) {
        var div = document.createElement('div');
        div.appendChild(n.cloneNode(true));
        var h = div.innerHTML;
        div = null;
        return h;
    })(node);
};

/**
 * Get the text content of a DOM node. Tries <code>textContent</code> followed by <code>innerText</code>, followed
 * by <code>nodeValue</code> to take browser differences into account.
 *
 * @param {Node} node The node to get the text content from
 * @returns {String} The text content of the specified DOM node or empty string if unable to extract text
 * @export
 * @function Test#getText
 */
TestInstance.prototype.getText = function(node) {
    return $A.util.getText(node);
};

/**
 * Get the textContent of all elements rendered by this component.
 *
 * @param {Component}
 *            component The component to get the text content from
 * @returns {String} The text content of the specified component
 * @export
 * @function Test#getTextByComponent
 */
TestInstance.prototype.getTextByComponent = function(component) {
    var ret = "";
    var i;
    if (component) {
        var elements = component.getElements();
        if (elements) {
            // If the component has an array of elements
            for (i = 0; i < elements.length; i++) {
                if (elements[i].nodeType !== 8/* COMMENT */) {
                    ret += this.getText(elements[i]);
                }
            }
        }
    }
    return ret;
};

/**
 * Get the current value for a style for a DOMElement.
 *
 * @param {DOMElement}
 *            elem The element to get the CSS property value from
 * @param {String}
 *            Style The property name to retrieve
 * @returns {String} The CSS property value of the specified DOMElement
 * @export
 * @function Test#getStyle
 */
TestInstance.prototype.getStyle = function(elem, style) {
    var val = "";
    if (document.defaultView && document.defaultView.getComputedStyle) {
        val = document.defaultView.getComputedStyle(elem, "").getPropertyValue(style);
    } else if (elem.currentStyle) {
        style = style.replace(/\-(\w)/g, function(s, ch) {
            return ch.toUpperCase();
        });
        val = elem.currentStyle[style];
    }
    return val;
};

/**
 * Filter out comment nodes from a list of nodes.
 *
 * @param {Array|Object}
 *            nodes The list of nodes to filter
 * @returns {Array} The list of nodes without comment nodes
 * @export
 * @function Test#getNonCommentNodes
 */
TestInstance.prototype.getNonCommentNodes = function(nodes) {
    var ret = [];
    if ($A.util.isObject(nodes)) {
        for ( var i in nodes) {
            if (nodes[i].nodeType && nodes[i].nodeType !== 8) {
                ret.push(nodes[i]);
            }
        }
    } else {
        for (var j = 0; j < nodes.length; j++) {
            if (nodes[j].nodeType !== 8) {
                ret.push(nodes[j]);
            }
        }
    }
    return ret;
};

/**
 * Check if a node has been "deleted" by Aura.
 *
 * @param {Node}
 *            node The node to check
 * @returns {Boolean} Returns true if the specified node has been deleted, or false otherwise
 * @export
 * @function Test#isNodeDeleted
 */
TestInstance.prototype.isNodeDeleted = function(node) {
    if (!node.parentNode) {
        return true;
    }
    var div = document.createElement("div");
    document.documentElement.appendChild(div);
    $A.util.removeElement(div);
    return node.parentNode === div.parentNode;
};

/**
 * Return a node list and pass each argument as a separate parameter.
 *
 * @returns {Array} The list of nodes contained in the document node
 * @export
 * @function Test#select
 */
TestInstance.prototype.select = function() {
    return document.querySelectorAll.apply(document, arguments);
};

/**
 * Check if a string contains another string.
 *
 * @param {String}
 *            testString The string to check
 * @param {String}
 *            targetString The string to look for within testString
 * @returns {Boolean} Return true if testString contains targetString, or false otherwise
 * @export
 * @function Test#contains
 */
TestInstance.prototype.contains = function(testString, targetString) {
    if (!$A.util.isUndefinedOrNull(testString)) {
        return (testString.indexOf(targetString) !== -1);
    }
    return false;
};

/**
 * Compares values. In the case of an Array or Object, compares first level references only. In the case of a literal,
 * directly compares value and type equality.
 *
 * @param {Object}
 *            expected The source value to compare.
 * @param {Object}
 *            actual The target value to compare.
 * @returns {Object} The result of the comparison, with reasons.
 * @export
 * @function Test#compareValues
 */
TestInstance.prototype.compareValues = function(expected, actual) {
    return $A.util.compareValues(expected, actual);
};

/**
 * Returns a reference to the object that is currently designated as the active element in the document.
 *
 * @returns {DOMElement} The current active element.
 * @export
 * @function Test#getActiveElement
 */
TestInstance.prototype.getActiveElement = function() {
    return document.activeElement;
};

/**
 * Returns the inner text of the current active element in the document.
 *
 * @returns {String} The text of the current active DOM element.
 * @export
 * @function Test#getActiveElementText
 */
TestInstance.prototype.getActiveElementText = function() {
    return this.getText(document.activeElement);
};

/**
 * Used by getElementsByClassNameCustom for IE7
 *
 * @private
 * @function Test#walkTheDOM
 */
TestInstance.prototype.walkTheDOM = function(node, func) {
    func(node);
    node = node.firstChild;
    while (node) {
        this.walkTheDOM(node, func);
        node = node.nextSibling;
    }
};

/**
 * custom util to get element by class name for IE7
 *
 * @private
 * @function Test#getElementsByClassNameCustom
 */
TestInstance.prototype.getElementsByClassNameCustom = function(className, parentElement) {
    var results = [];

    if ($A.util.isUndefinedOrNull(parentElement)) {
        parentElement = document.body;
    }

    this.walkTheDOM(parentElement, function(node) {
        var a, i;
        var c = $A.util.isSVGElement(node)? node.getAttribute("class"): node.className;

        if (c) {
            a = c.split(' ');
            for (i = 0; i < a.length; i++) {
                if (a[i] === className) {
                    results.push(node);
                    break;
                }
            }
        }
    });
    return results;
};

/**
 * Gets the first element on the page starting from parentElement, that has the specified class name.
 *
 * @param {Object}
 *            parentElement DOM element that we want to start at.
 * @param {String}
 *            classname The CSS class name.
 * @returns {Object} The first element denoting the class, or null if none is found.
 * @export
 * @function Test#findChildWithClassName
 */
TestInstance.prototype.findChildWithClassName = function(parentElement, className) {
    var results = this.getElementsByClassNameCustom(className, parentElement);
    if (results && results.length > 0) {
        return results;
    }
    return null;
};

/**
 * Gets the first element on the page that have the specified class name.
 *
 * @param {String}
 *            classname The CSS class name.
 * @returns {Object} The element denoting the class, or null if none is found.
 * @export
 * @function Test#getElementByClass
 */
TestInstance.prototype.getElementByClass = function(classname) {
    var ret;

    if (document.getElementsByClassName) {
        ret = document.getElementsByClassName(classname);
    } else if (document.querySelectorAll) {
        ret = document.querySelectorAll("." + classname);
    } else {
        ret = this.getElementsByClassNameCustom(classname);
    }

    if (ret && ret.length > 0) {
        return ret;
    }
    return null;
};

/**
 * Given an HTML element and an eventName, fire the corresponding DOM event. Code adapted from a stack overflow
 * question's answer.
 *
 * @param {Object}
 *            element The HTML element whose corresponding DOM event is to be fired.
 * @param {String}
 *            eventName Initializes the given event that bubbles up through the event chain.
 * @param {Boolean}
 *            canBubble Optional. True if the event can be bubbled, defaults to true.
 * @param {Boolean}
 *            cancelable Optional. Indicates whether the event is cancelable or not, defaults to true.
 * @export
 * @function Test#fireDomEvent
 */
TestInstance.prototype.fireDomEvent = function(element, eventName, canBubble, cancelable) {
    var event;
    if (document.createEvent) {
        event = document.createEvent("HTMLEvents");

        canBubble = $A.util.isUndefinedOrNull(canBubble) ? true : canBubble;
        cancelable = $A.util.isUndefinedOrNull(cancelable) ? true : cancelable;

        event.initEvent(eventName, canBubble, cancelable);

        element.dispatchEvent(event);
    } else {
        event = document.createEventObject();
        event.eventType = eventName;

        element.fireEvent("on" + event.eventType, event);
    }
};

/**
 * Issue a click on the element.
 *
 * @param {HTMLElement}
 *            element The element to click on.
 * @param {Boolean}
 *            canBubble true to allow bubbling of the click.
 * @param {Boolean}
 *            cancelable Indicates whether the event is cancelable or not.
 * @export
 * @function Test#clickOrTouch
 */
TestInstance.prototype.clickOrTouch = function(element, canBubble, cancelable) {
    if ($A.util.isUndefinedOrNull(element.click)) {
        this.fireDomEvent(element, "click", canBubble, cancelable);
    } else {
        element.click();
    }
};

/**
 * Checks if the specified node is a text node.
 *
 * @param {Node}
 *            node The node to check
 * @returns {Boolean} true if node is text node.
 * @export
 * @function Test#isInstanceOfText
 */
TestInstance.prototype.isInstanceOfText = function(node) {
    if (window.Text) {
        return node instanceof window.Text;
    }
    return node.nodeType === 3;
};

/**
 * Checks if the specified element is an anchor element.
 *
 * @param {HTMLElement}
 *            element The element to check
 * @returns {Boolean} true if element is an anchor element.
 * @export
 * @function Test#isInstanceOfAnchorElement
 */
TestInstance.prototype.isInstanceOfAnchorElement = function(element) {
    return this.isInstanceOf(element, window.HTMLAnchorElement, "a");
};

/**
 * Checks if the specified element is an input element.
 *
 * @param {HTMLElement}
 *            element The element to check
 * @returns {Boolean} true if element is an input element.
 * @export
 * @function Test#isInstanceOfInputElement
 */
TestInstance.prototype.isInstanceOfInputElement = function(element) {
    return this.isInstanceOf(element, window.HTMLInputElement, "input");
};

/**
 * Checks if the specified element is a list element.
 *
 * @param {HTMLElement}
 *            element The element to check
 * @returns {Boolean} true if element is a list element.
 * @export
 * @function Test#isInstanceOfLiElement
 */
TestInstance.prototype.isInstanceOfLiElement = function(element) {
    return this.isInstanceOf(element, window.HTMLLiElement, "li");
};

/**
 * Checks if the specified element is a paragraph element.
 *
 * @param {HTMLElement}
 *            element The element to check
 * @returns {Boolean} true if element is a paragraph element.
 * @export
 * @function Test#isInstanceOfParagraphElement
 */
TestInstance.prototype.isInstanceOfParagraphElement = function(element) {
    return this.isInstanceOf(element, window.HTMLParagraphElement, "p");
};

/**
 * Checks if the specified element is a button element.
 *
 * @param {HTMLElement}
 *            element The element to check
 * @returns {Boolean} true if element is a button element.
 * @export
 * @function Test#isInstanceOfButtonElement
 */
TestInstance.prototype.isInstanceOfButtonElement = function(element) {
    return this.isInstanceOf(element, window.HTMLButtonElement, "button");
};

/**
 * Checks if the specified element is an image element.
 *
 * @param {HTMLElement}
 *            element The element to check
 * @returns {Boolean} true if element is an image element.
 * @export
 * @function Test#isInstanceOfImageElement
 */
TestInstance.prototype.isInstanceOfImageElement = function(element) {
    return this.isInstanceOf(element, window.HTMLImageElement, "img");
};

/**
 * Checks if the specified element is a div element.
 *
 * @param {HTMLElement}
 *            element The element to check
 * @returns {Boolean} true if element is a div element.
 * @export
 * @function Test#isInstanceOfDivElement
 */
TestInstance.prototype.isInstanceOfDivElement = function(element) {
    return this.isInstanceOf(element, window.HTMLDivElement, "div");
};

/**
 * Checks if the specified element is a span element.
 *
 * @param {HTMLElement}
 *            element The element to check
 * @returns {Boolean} true if element is a span element.
 * @export
 * @function Test#isInstanceOfSpanElement
 */
TestInstance.prototype.isInstanceOfSpanElement = function(element) {
    return this.isInstanceOf(element, window.HTMLSpanElement, "span");
};

/**
 * Checks if the specified element is an instance of another element.
 *
 * @param {HTMLElement}
 *            element The element to check
 * @param {HTMLElement}
 *            elementType Checks element against elementType
 * @param {String}
 *            tag Check element.tagName against tag
 * @returns {Boolean} true if element is of type elementType. Or if elementType is undefined, check element is of type
 *          ELEMENT_NODE and it's tagName is equal to tag
 * @export
 * @function Test#isInstanceOf
 */
TestInstance.prototype.isInstanceOf = function(element, elementType, tag) {
    if (elementType) {
        return element instanceof elementType;
    }
    return element.nodeType === 1 && element.tagName.toLowerCase() === tag;
};

/**
 * Return attributeValue of an element
 *
 * @param {HTMLElement}
 *            element The element from which to retrieve data.
 * @param {String}
 *            attributeName The name of attribute to look up on element.
 * @export
 * @function Test#getElementAttributeValue
 */
TestInstance.prototype.getElementAttributeValue = function(element, attributeName) {
    return $A.util.getElementAttributeValue(element, attributeName);
};

/**
 * Add an event handler. If component is specified, the handler will be applied to component events. If component is not
 * specified, the handler will be applied to application events.
 *
 * @param {String}
 *            eventName The registered name, for component events; the descriptor name for application events.
 * @param {Function}
 *            handler The function handler, which should expect the event as input.
 * @param {Component}
 *            component The component to add the handler on.
 * @param {Boolean}
 *            insert For component events only, insert the handler at the front of the list if true, otherwise at the
 *            end
 * @export
 * @function Test#addEventHandler
 */
TestInstance.prototype.addEventHandler = function(eventName, handler, component, insert) {
    if ($A.util.isUndefinedOrNull(component)) {
        // application event handler
        $A.getRoot().addEventHandler(eventName,handler);
    } else {
        // component event handler
        if(insert){
            // DELETE THIS BRANCH ASAP
            // UNCOMMENT TO FAIL BAD USES
            // throw new Error("Test.addEventHandler called with 'insert'. Please update test.");
            component.addHandler(eventName, {
                get: function () {
                    var action=new Action();
                    action.run=action.runDeprecated=handler;
                    return action;
                }
            }, "TESTHANDLER",insert);
        }else{
            component.addEventHandler(eventName, handler);
        }
    }
};

// Used by tests to modify framework source to trigger JS last mod update
/**
 * @export
 * @ignore
 * @function Test#dummyFunction
 */
TestInstance.prototype.dummyFunction = function() {
    return '@@@TOKEN@@@';
};

/**
 * Extract the error message from Aura error div(the grey error message on the page)
 *
 * @returns {String} The text of the Aura error
 * @export
 * @function Test#getAuraErrorMessage
 */
TestInstance.prototype.getAuraErrorMessage = function() {
    return this.getText($A.util.getElement("auraErrorMessage"));
};

/**
 * Assert that the Access check failure message is as expected
 *
 * @param {String}
 *      errorMessage An Aura Error Message
 * @param {String}
 *      delimiter split input error message
 * @param {String}
 *      targetCmp A string containing component being accessed
 * @param {String}
 *      accessingCmp A string containing accessing component details
 *
 * @export
 * @function Test#getPopOverErrorMessage
 */
TestInstance.prototype.getPopOverErrorMessage = function(errorMessage, delimiter, targetCmp, accessingCmp) {
    if (this.contains(errorMessage,delimiter)) {
        var errorMsgACF = errorMessage.split(delimiter);
        if (!(this.contains(errorMsgACF[0],targetCmp) && this.contains(errorMsgACF[1],accessingCmp))) {
            this.fail("Access check error message verification failed. Did not receive expected error");
        }
    } else {
        this.fail("TestInstance:getPopOverErrorMessage  Did not receive expected error");
    }
};

/**
 * Override function for client service get XHR.
 *
 * @private
 * @function Test#getAvailableXHROverride
 */
TestInstance.prototype.getAvailableXHROverride = function(config, isBackground) {
    if (!isBackground && this.blockForeground) {
        return null;
    }
    if (isBackground && this.blockBackground) {
        return null;
    }
    return config["fn"].call(config["scope"], isBackground);
};

/**
 * Override send so that we can account for packets.
 *
 * @private
 * @function Test#sendOverride
 */
TestInstance.prototype.sendOverride = function(config, auraXHR, actions, method, options) {
    var post_callbacks = [];
    var processing = this.prePostSendConfigs;
    var cb_config;
    var i;

    if (this.disconnectedNoSend) {
        return false;
    }
    if(processing) {
        this.prePostSendConfigs = [];
        for (i = 0; i < processing.length; i++) {
            cb_config = processing[i];
            // If this action has been refreshed, track that one instead.
            if (cb_config.action && cb_config.action.refreshAction) {
                cb_config.action = cb_config.action.refreshAction;
            }
            if (cb_config.action && !( actions.indexOf(cb_config.action) >= 0)) {
                if (cb_config.action.getState() === 'NEW') {
                    this.prePostSendConfigs.push(cb_config);//push it back, we will check in the next send
                } else {
                    // whoops, removing without call, warn the user
                    $A.warning("Callback never called for "+config.action.getId()+" in state "+config.action.getState());
                }
                continue;//move on to the next cb_config
            }
            //at this point either we find the action we are watching for, or we are watching _any_ action.
            //if we are watching _any_ action, push it back, user should remove the cb_config in the callback once they are done
            if (!cb_config.action) {
                this.prePostSendConfigs.push(cb_config);
            }
            if (cb_config.preSendCallback) {
                cb_config.preSendCallback(actions, cb_config.action);
            }
            if (cb_config.postSendCallback) {
                post_callbacks.push(cb_config);//save the callback to post_callbacks so we can go through them after the real send call
            }
        }
    }
    var value = config["fn"].call(config["scope"], auraXHR, actions, method, options);
    if (value) {
        this.sentXHRCount += 1;
    }
    for (i = 0; i < post_callbacks.length; i++) {
            post_callbacks[i].postSendCallback(actions, post_callbacks[i].action);
    }
    return value;
};

/**
 * Override decode.
 * The callback before Decode take response in, you can make a copy of it, made some modification, then return your response.
 * The callback after Decode take the result of decode (see AuraClientService.decode for what's inside), at this point, we
 * don't modify response.
 *
 * @private
 * @function Test#decodeOverride
 */
TestInstance.prototype.decodeOverride = function(config, response, timeOut) {
    if (this.disconnected) {
        return { "status": "INCOMPLETE" };
    }
    //run callbacks
    var cb_config;
    var processing = this.prePostDecodeConfigs;
    var post_callbacks = [];
    //we cannot modify the original reponse, however, we can make a copy, modify it, then later feed decode() with that copy
    var oldResponse = response;
    var newResponse; var i;
    if(processing) {
        for (i = 0; i < processing.length; i++) {
            cb_config = processing[i];
            if (cb_config) {
                if(cb_config.preDecodeCallback) {
                    newResponse = cb_config.preDecodeCallback(oldResponse);
                    oldResponse = newResponse;
                }
                if(cb_config.postDecodeCallback) {
                    post_callbacks.push(cb_config);
                }
            }
        }

    }
    //now feed decode() with our copy of response
    var res = config["fn"].call(config["scope"], oldResponse, timeOut);
    for (i = 0; i < post_callbacks.length; i++) {
        post_callbacks[i].postDecodeCallback(res);
    }

    return res;
};

/**
 * A simple structure to hold action and callbacks.
 *
 * @struct
 * @private
 */
TestInstance.prototype.PrePostConfig = function (action, preSendCallback, postSendCallback, preDecodeCallback, postDecodeCallback) {
    this.action = action;
    this.preSendCallback = preSendCallback;
    this.postSendCallback = postSendCallback;
    this.preDecodeCallback = preDecodeCallback;
    this.postDecodeCallback = postDecodeCallback;
};

/**
 * Add a pre/post send callback.
 *
 * This function allows a test to insert a hook either pre or post send of XHR.
 *
 * Note that for the post XHR callback the XHR has actually not been 'sent', but actions are serialized
 * and put in the actual request, so changing actions will have no effect at that point.
 *
 * @param action the action to watch for (undefined/null means any action)
 * @param preSendCallback the hook function for before send.
 * @param postSendCallback the hook function for after send.
 * one of preSendCallback and postSendCallback can be null, but not both of them
 * @return a handle(a PrePostConfig object) to remove the callback later (only needed if the first parameter:action is empty).
 *
 */
TestInstance.prototype.addPrePostSendCallback = function (action, preSendCallback, postSendCallback) {
    if ( (!preSendCallback)&&(!postSendCallback) ) {
        throw new Error("TestInstance.addPrePostSendCallback: one of the callback must be not-null");
    }
    if (preSendCallback !== null && preSendCallback !== undefined) {
        if (!($A.util.isFunction(preSendCallback))) {
            throw new Error("TestInstance.addPrePostSendCallback: preSendCallback must be a function"
                +preSendCallback);
        }
    }
    if (postSendCallback !== null && postSendCallback !== undefined) {
        if (!($A.util.isFunction(postSendCallback))) {
            throw new Error("TestInstance.addPrePostSendCallback: preSendCallback must be a function"
                +postSendCallback);
        }
    }
    if (action && action.getState() !== "NEW") {
        throw new Error("TestInstance.addPrePostSendCallback: action has already been sent/completed "+action.getState());
    }
    var config = new TestInstance.prototype.PrePostConfig(action, preSendCallback, postSendCallback);
    this.prePostSendConfigs.push(config);
    return config;
};

/**
 * Add a pre send callback.
 *
 * This function allows a test to insert a hook pre send of XHR.
 * @param action the action to watch for (undefined/null means any action)
 * @param preSendCallback the hook function for before send.
 * @return a handle to remove the callback (only needed if the first parameter:action is empty).
 *
 * @export
 * @function Test#addPreSendCallback
 */
TestInstance.prototype.addPreSendCallback = function (action, preSendCallback) {
    if (!preSendCallback) {
        throw new Error("TestInstance.addPreSendCallback: callback must be not-null");
    }
    return this.addPrePostSendCallback(action, preSendCallback, null);
};

/**
 * Add a post send callback.
 *
 * This function allows a test to insert a hook post send of XHR.
 *
 * Note that for the post XHR callback the XHR has actually not been 'sent', but actions are serialized
 * and put in the actual request, so changing actions will have no effect at that point.
 *
 * @param action the action to watch for (undefined/null means any action)
 * @param postSendCallback the hook function for after send.
 * @return a handle to remove the callback (only needed if the first parameter:action is empty).
 *
 * @export
 * @function Test#addPostSendCallback
 */
TestInstance.prototype.addPostSendCallback = function (action, postSendCallback) {
    if (!postSendCallback) {
        throw new Error("TestInstance.addPostSendCallback: callback must be not-null");
    }
    return this.addPrePostSendCallback(action, null, postSendCallback);
};

/**
 * Remove a previously added callback.
 *
 *TODO: Lin to remove public access to this api
 * @export
 * @function Test#removePrePostSendCallback
 */
TestInstance.prototype.removePrePostSendCallback = function (handle) {
    var i;

    for (i = 0; i < this.prePostSendConfigs.length; i++) {
        if (this.prePostSendConfigs[i] === handle) {
            this.prePostSendConfigs.splice(i, 1);
            return;
        }
    }
};

/**
 * Remove a previously added callback.
 *
 * @export
 * @function Test#removePreSendCallback
 */
TestInstance.prototype.removePreSendCallback = function (handle) {
    this.removePrePostSendCallback(handle);
};

/**
 * Remove a previously added callback.
 *
 * @export
 * @function Test#removePostSendCallback
 */
TestInstance.prototype.removePostSendCallback = function (handle) {
    this.removePrePostSendCallback(handle);
};


/**
 * Add a callback right before we decode response
 * @export
 * @function Test#addPreDecodeCallback
 */
TestInstance.prototype.addPreDecodeCallback = function (preDecodeCallback) {
    if(!preDecodeCallback) {
        throw new Error("addPreDecodeCallback: callback cannot be null");
    }
    return this.addPrePostDecodeCallback(preDecodeCallback, null);
};

/**
 * Add a callback right after we decode response
 * @export
 * @function Test#addPostDecodeCallback
 */
TestInstance.prototype.addPostDecodeCallback = function (postDecodeCallback) {
    if(!postDecodeCallback) {
        throw new Error("addPostDecodeCallback: callback cannot be null");
    }
    return this.addPrePostDecodeCallback(null, postDecodeCallback);
};


/**
 * Add a callback before/after decode response
 */
TestInstance.prototype.addPrePostDecodeCallback = function (preDecodeCallback, postDecodeCallback) {
    var config = new TestInstance.prototype.PrePostConfig(null, null, null, preDecodeCallback, postDecodeCallback);
    this.prePostDecodeConfigs.push(config);
    return config;
};

/**
 * Remove a previously added callback
 */
TestInstance.prototype.removePrePostDecodeCallback = function (handle) {
    var i;
    for (i = 0; i < this.prePostDecodeConfigs.length; i++) {
        if (this.prePostDecodeConfigs[i] === handle) {
            this.prePostDecodeConfigs.splice(i, 1);
            return;
        }
    }
};

/**
 * Remove a previously added callback
 * @export
 * @function Test#removePostDecodeCallback
 */
TestInstance.prototype.removePostDecodeCallback = function (handle) {
   this.removePrePostDecodeCallback(handle);
};
/**
 * Remove a previously added callback
 * @export
 * @function Test#removePreDecodeCallback
 */
TestInstance.prototype.removePreDecodeCallback = function (handle) {
    this.removePrePostDecodeCallback(handle);
};

/**
 * Install all of the overrides needed.
 *
 * @private
 * @function Test#install
 */
TestInstance.prototype.installOverride = function() {
    // install getAvailableXHR at the end of the chain, since we may not call it.
    $A.installOverride("ClientService.getAvailableXHR", this.getAvailableXHROverride, this, 100);
    $A.installOverride("ClientService.send", this.sendOverride, this, 100);
    $A.installOverride("ClientService.decode", this.decodeOverride, this, 100);
};


/**
 * Run the test
 *
 * @param {String}
 *            name The name of the test in the suite to run
 * @param {String}
 *            code The full test suite code
 * @param {Integer}
 *            timeoutOverride Optional. Use to increase the test timeout by specified time in seconds. If not set the
 *            test will use a default timeout of 10 seconds.
 *
 * @export
 * @function Test#run
 */
TestInstance.prototype.run = function(name, code, timeoutOverride, quickFixException) {
    // check if test has already started running, since frame loads from layouts may trigger multiple runs
    if (this.inProgress >= 0) {
        return;
    }
    this.inProgress = 2;
    this.name = name;

    if (quickFixException) {
        this.logError(quickFixException["message"]);
        this.doTearDown();
        return;
    }

    timeoutOverride = timeoutOverride || 10;
    this.timeoutTime = timeoutOverride * 1000;

    if (typeof code === "string") {
        this.suite = $A.util.json.decode(code);
    } else {
        this.suite = code;
    }

    var continueRun = this.runInternal.bind(this, name);
    setTimeout(this.waitForRoot.bind(this, name, continueRun), 1);
};

/**
 * Get the test name.
 *
 * @export
 */
TestInstance.prototype.getTestName = function () {
    return this.name;
};

/**
 * @private
 */
TestInstance.prototype.waitForRoot = function(testName, callback) {
    var that = this;
    var root = $A.getRoot();
    if (root) {
        if (root.getDef().getDescriptor().getFullName() === "auratest:test") {
            var testCase = this.suite[testName];
            var descriptor = root.get("v.descriptor");
            var attributes = testCase.hasOwnProperty("attributes") ? testCase["attributes"] : {};
            $A.clientService.setCurrentAccess(root);
            $A.createComponent(descriptor, attributes, $A.getCallback(function(newComponent) {
                root.set("v.target", newComponent);
                setTimeout(callback, 1); // give browser a moment to settle down
            }));
        } else {
            setTimeout(callback, 1); // give browser a moment to settle down
        }
        return;
    }
    setTimeout(that.waitForRoot.bind(that, testName, callback), 50);
};

/**
 * @private
 * @function Test#runInternal
 */
TestInstance.prototype.runInternal = function(name) {
    var that = this;

    var testCase = this.suite[name];
    var root = $A.getRoot();
    if (root.getType() === "auratest:test") {
        this.cmp = root.get("v.target");
    } else {
        this.cmp = root;
    }
    $A.clientService.setCurrentAccess(this.cmp);
    var useLabel = function(labelName) {
        var suiteLevel = that.suite[labelName] || false;
        var testLevel = testCase[labelName];
        return (testLevel === undefined) ? suiteLevel : testLevel;
    };

    this.failOnWarning = useLabel("failOnWarning");
    this.doNotWrapInAuraRun = useLabel("doNotWrapInAuraRun");

    this.stages = testCase["test"];
    this.stages = $A.util.isArray(this.stages) ? this.stages : [ this.stages ];

    var auraErrorsExpectedDuringInit = testCase["auraErrorsExpectedDuringInit"] || [];
    var auraWarningsExpectedDuringInit = testCase["auraWarningsExpectedDuringInit"] || [];

    function checkErrors() {
      try {
          // Fail now if we got any unexpected errors or warnings during test initialization/setup
          this.clearExpected(this.preErrors, auraErrorsExpectedDuringInit);

          this.logErrors(true, "Received unexpected error: ", this.preErrors);
          this.logErrors(true, "Did not receive expected error during init: ", auraErrorsExpectedDuringInit);
          this.preErrors = null;

          this.clearExpected(this.preWarnings, auraWarningsExpectedDuringInit);

          this.logErrors(this.failOnWarning, "Received unexpected warning: ", this.preWarnings);
          this.logErrors(this.failOnWarning, "Did not receive expected warning during init: ",
                  auraWarningsExpectedDuringInit);
          this.preWarnings = null;
      } catch (e) {
          this.logError("Error during setUp", e);
          this.doTearDown();
      }
    }

    function startTest() {
        checkErrors.call(this);
        // restart timer before running actual test case
        this.startTimer();
        this.continueWhenReady();
    }

    // start timer to fail tests that hang in setUp
    this.startTimer();
    this.callSetUp(startTest.bind(this));
};

/**
 * Calls user-defined setUp method. Accepts a Promise as a return value and waits for promise to resolve or reject
 * before continuing.
 *
 * @private
 * @function Test#callSetUp
 */
TestInstance.prototype.callSetUp = function(callback) {
    var that = this;

    if (this.suite["setUp"]) {
        if (this.doNotWrapInAuraRun) {
            this.suite["setUp"].call(this.suite, this.cmp);
            callback();
        } else {
            $A.run(function() {
                var result;
                try {
                    result = that.suite["setUp"].call(that.suite, that.cmp);
                } catch (e) {
                    that.logError("Error calling setUp", e);
                    that.doTearDown();
                }
                if (result && typeof result.then === 'function') {
                    result.then(function() {
                        setTimeout(callback, 1);
                    },
                    function(err) {
                        that.logError("Error during setUp", err);
                        setTimeout(callback, 1);
                    });
                } else {
                    callback();
                }
            });
        }
    } else {
        callback();
    }
};

/**
 * @description Asynchronously wait for CKEditor instance in inputRichText component to be ready before continuing to
 *              enter test data.
 *
 * @example <code>$A.test..executeAfterCkEditorIsReady(inputRichTextComponent, function(){<br/>
 *   inputRichTextComponent.set('v.value', 'tab1 content'); });</code>
 *
 * @param {Component}
 *            ui:inputRichText component, or a component that extends it, that you are entering data in.
 * @param {Function}
 *            callback Invoked after the CKEditor is ready for user input
 * @export
 * @function Test#executeAfterCkEditorIsReady
 */
TestInstance.prototype.executeAfterCkEditorIsReady = function(inputRichTextComponent, callback) {
    if (!inputRichTextComponent.isInstanceOf("ui:inputRichText")) {
        this.fail("The component has to be an instance of ui:inputRichText or extend it");
    }

    var editorReady = false;
    var instance = $A.util.lookup(window, "CKEDITOR", "instances", inputRichTextComponent.getGlobalId());

    if (instance === undefined) {
        this.fail("CKEDITOR instance was not found.");
    }

    instance["on"]("instanceReady", function() {
        editorReady = true;
    });

    this.addWaitForWithFailureMessage(true, function() {
        // In case the test missed the instanceReady event, we can check
        // status of the instance.
        return instance.status === "ready" || editorReady;
    }, "Editor was not initialized", callback);
};

/**
 * Gets the Global Value Providers based on type.
 *
 * @param {String}
 *            gvp type to get Global Value Provider
 * @export
 * @function Test#getGlobalValueProviders
 */
TestInstance.prototype.getGlobalValueProvider = function(type) {
    return $A.getContext().getGlobalValueProvider(type);
};

/**
 * Sweeps expired items from an AuraStorage instance. Ignores minimum sweep intervals
 * but does not circumvent other restrictions (eg no concurrent sweeps).
 *
 * @param {AuraStorage} storage the storage to sweep.
 * @export
 * @function Test#storageSweep
 */
TestInstance.prototype.storageSweep = function(storage) {
    return storage.sweep(true);
};

/**
 * Store items to storage through the storage's adapter, bypassing the key prefix and
 * size validation logic AuraStorage performs.
 *
 * @param {StorageAdapter} adapter
 * @param {Array} tuples An array of key-value-size pairs
 * @export
 * @function Test#storageAdapterSetItems
 */
TestInstance.prototype.storageAdapterSetItems = function(storage, tuples) {
    return storage.enqueue(function noop(resolve) {
            resolve();
        })
        .then(function() {
            var adapter = storage.adapter;
            if (storage.getName() === "crypto") {
                adapter = adapter.adapter;
            }
            return adapter.setItems(tuples);
        });
};

/**
 * Gets all definitions from ComponentDefStorage.
 *
 * @export
 * @function Test#getAllComponentDefFromStorage
 */
TestInstance.prototype.getAllComponentDefsFromStorage = function() {
    return $A.componentService.componentDefStorage.getAll();
};

/**
 * @export
 * @function Test#getCreationPath
 */
TestInstance.prototype.getCreationPath = function(cmp) {
    return cmp.creationPath;
};

/**
 * @export
 * @function Test#createHttpRequest
 */
TestInstance.prototype.createHttpRequest = function() {
    if (window.XMLHttpRequest) {
        return new XMLHttpRequest();
    } else if (this.httpType === 'msxml2') {
        return new ActiveXObject("Msxml2.XMLHTTP");
    } else if (this.httpType === 'msxml') {
        return new ActiveXObject("Microsoft.XMLHTTP");
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
        throw new Error("TestInstance.createHttpRequest: Unable to find an appropriate XHR");
    }
};

/**
 * Performs a check if global namespace is polluted with new
 * variables apart from allowlisted ones
 *
 * @export
 * @function Test#checkGlobalNamespacePollution
 */
TestInstance.prototype.checkGlobalNamespacePollution = function(allowlistedPollutants) {
    var that = this,
        pollutants = [],
        initialGlobalState = that.getInitialGlobalState();
    if(!window || !initialGlobalState.length) {
        return pollutants;
    }
    var knownPollutants = initialGlobalState.concat(allowlistedPollutants);
    var currentGlobalState = Object.keys(window);
    for (var i = currentGlobalState.length - 1; i >= 0; i--) {
        var key = currentGlobalState[i];
        if (knownPollutants.indexOf(key) === -1) {
            pollutants.push(key);
        }
    }
    return (pollutants.length ? "New global variables found: " + pollutants.join(",") + "." : "");
};

/**
 * sets the uri addressable definitions state
 * @param newState
 * @return previous state
 * @export
 */
TestInstance.prototype.setURIDefsState = function(newState) {
    var oldState = $A.util.uriDefsState;
    $A.util.uriDefsState = newState;
    $A.getContext().uriAddressableDefsEnabled = !!newState;
    return oldState;
};

/**
 * allows one to inject their own script loader for URI definitions
 * @param method - function that is called with URI, onload, onerror that is a replacement for creating a script dom element
 * @export
 */
TestInstance.prototype.replaceComponentDefLoader = function(method) {
    Aura.ServiceApi["replaceComponentDefLoader"](method);
};

/**
 * Calls into componentService loadComponentDefs
 * @param descriptors - map of descriptors to uid (or definition)
 * @param callback - method called after components are loaded
 * @export
 */
TestInstance.prototype.loadComponentDefs = function(descriptors, callback) {
    $A.componentService.loadComponentDefs(descriptors, callback);
};

/**
 * Json instance for test. Used to export Json methods for testing.
 *
 * @export
 * @memberof Test
 */
JsonTestInstance = function() {
};

/**
 * Serializes object in alphabetical asc order. Sorts object keys during serialization.
 *
 * @param {Object}
 *            obj Object to be serialized
 * @returns {String} serialized order object
 * @export
 * @function Test#json.orderedEncode
 */
JsonTestInstance.prototype.orderedEncode = function(obj) {
    return $A.util.json.orderedEncode(obj);
};

/**
 * Passthrough to JSON decode utility for tests.
 * @export
 */
JsonTestInstance.prototype.decode = function(obj, refSupport) {
    return $A.util.json.decode(obj, refSupport);
};

// -- Aura Bootstrap ------------------------------------------------------------

$A["test"] = new TestInstance();
$A["test"]["json"] = new JsonTestInstance();

$A.logger.subscribe("WARNING", $A["test"].auraWarning.bind($A["test"]));
$A.logger.subscribe("ERROR", $A["test"].auraError.bind($A["test"]));

/**
 * Register a global error handler to catch uncaught javascript errors.
 * @export
 * @ignore
 */
window.onerror = (function() {
    var origHandler = window.onerror;
    /** @inner */
    var newHandler = function(msg, url, line, col, e) {
        //not all browsers call window.onerror with e, IEs and safari don't
        if ((e && e["name"] === "AuraError") || msg) {
                try {
                    $A["test"].auraError.call($A["test"], "ERROR", msg);
                } catch(err) {
                    // The error may have broken the test runner loop so tear down to guarantee the test is completed.
                    $A["test"].doTearDown();
                }
                return true;
        } else {
            var error = {
                message : "Uncaught js error: " + msg
            };
            if (url) {
                error["url"] = url;
            }
            if (line) {
                error["line"] = line;
            }
            TestInstance.prototype.errors.push(error);
            $A["test"].doTearDown();
        }
    };

    return function() {
        if (origHandler) {
            origHandler.apply(this, arguments);
        }
        return newHandler.apply(this, arguments);
    };
})();
