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
 * @private
 * @function Test#putMessage
 */
TestInstance.prototype.putMessage = function(pre, expected, msg) {
    if (typeof msg !== "string") {
        msg = "" + msg;
    }
    for (var i = 0; i < expected.length; i++) {
        if (expected[i] === undefined) {
            continue;
        }
        if (msg.indexOf(expected[i]) !== -1) {
            expected[i] = undefined;
            return true;
        }
    }
    if (pre !== null) {
        pre.push(msg);
        return true;
    }
    return false;
};

/**
 * @private
 * @function Test#expectMessage
 */
TestInstance.prototype.expectMessage = function(pre, expected, msg) {
    if (pre !== null) {
        for (var i = 0; i < pre.length; i++) {
            if (pre[i] === undefined) {
                continue;
            }
            if (pre[i].indexOf(msg) === 0) {
                pre[i] = undefined;
                return;
            }
        }
    }
    expected.push(msg);
};

/**
 * Set any common entries in the two arrays to undefined.
 *
 * This is used to compare two arrays of error messages, leaving only unexpected errors received (in the pre array) and
 * expected errors not received (in the expected array).
 *
 * @private
 * @function Test#clearExpected
 */
TestInstance.prototype.clearExpected = function(pre, expected) {
    for (var i = 0; i < pre.length; i++) {
        for (var j = 0; j < expected.length; j++) {
            if (expected[j] !== undefined && pre[i].indexOf(expected[j]) !== -1) {
                pre[i] = undefined;
                expected[j] = undefined;
                break;
            }
        }
    }
};

/**
 * Used to keep track of errors happening in test modes.
 *
 * @private
 * @function Test#logError
 */
TestInstance.prototype.logError = function(msg, e) {
    var errors = TestInstance.prototype.errors;
    var err;
    var p, i;

    err = {
            "message" : msg
    };

    if (e) {
        err["message"] += ": " + e.toString();

        for (p in e) {
            if (p === "message") {
                continue;
            }
            err[p] = "" + e[p];
        }
    }

    // Don't add duplicate entries
    for (i = 0; i < errors.length; i++) {
        var existing = errors[i]["message"];
        var newMsg = err["message"];
        if (newMsg.indexOf(existing) > -1) {
            errors[i] = err;
            return;
        }
    }

    // Add current test state to all errors
    err["testState"] = this.getDump();
    errors.push(err);
};

/**
 * Tear down a test.
 *
 * @private
 * @function Test#doTearDown
 */
TestInstance.prototype.doTearDown = function() {
    var i;
    var that = this;

    // check if already tearing down
    if (this.inProgress > 1) {
        this.inProgress = 1;
    } else {
        /*
         * We may be here because tearDown is failing to complete and the global error handler tries to tearDown
         * again. Err on the safe side and make sure the test completes so the whole suite isn't hung.
         */
        $A.warning("Test tried calling tearDown multiple times, please verify no errors thrown in tearDown method");
        endTest();
        return;
    }

    function endTest() {
        setTimeout(function() {
            that.inProgress = 0;
            that.elapsedTime = new Date().getTime() - that.initTime;
        }, 100);
    }

    function tearDown() {
        try {
            if (that.suite && that.suite["tearDown"]) {
                if (that.doNotWrapInAuraRun) {
                    that.suite["tearDown"].call(that.suite, that.cmp);
                    endTest();
                } else {
                    $A.run(function() {
                        var ret = that.suite["tearDown"].call(that.suite, that.cmp);
                        if (ret && typeof ret.then === 'function') {
                            ret.then(
                                undefined,
                                function(err) {
                                    that.logError("Error during teardown", err);
                                }
                            ).then(
                                function() {
                                    endTest();
                                }
                            );
                        } else {
                            endTest();
                        }
                    });
                }
            } else {
                endTest();
            }
        } catch (e) {
            that.logError("Error during tearDown", e);
            endTest();
        }
    }

    var promiseResults = [];
    try {
        for (i = 0; i < this.cleanups.length; i++) {
            var result = this.cleanups[i]();
            if (result && typeof result.then === 'function') {
                promiseResults.push(result);
            }
        }
    } catch (err) {
        this.logError("Error during cleanup", err);
    }

    if(promiseResults.length !== 0) {
        Promise["all"](promiseResults)
            .then(
                undefined,
                function(err) {
                    that.logError("Error during cleanup", err);
                }
            ).then(
                function() {
                    tearDown();
                }
            );
    } else {
        tearDown();
    }
};

/**
 * @private
 * @function Test#logErrors
 */
TestInstance.prototype.logErrors = function(error, label, errorArray) {
    var i;

    if (errorArray !== null && errorArray.length > 0) {
        for (i = 0; i < errorArray.length; i++) {
            if (errorArray[i] !== undefined) {
                if (error) {
                    this.logError(label + errorArray[i]);
                } else {
                    $A.log(label + errorArray[i]);
                }
            }
        }
    }
};

/**
 * Periodic callback to handle continuing operations.
 *
 * @private
 * @function Test#continueWhenReady
 */
TestInstance.prototype.continueWhenReady = function() {
    var that = this;
    var internalCWR = function() {
        that.continueWhenReady();
    };
    if (this.inProgress < 2) {
        return;
    }
    var errors = TestInstance.prototype.errors;
    if (errors.length > 0) {
        this.doTearDown();
        return;
    }
    try {
        if (this.inProgress > 2) {
            setTimeout(internalCWR, 50);
            return;
        }
        if (!this.currentWait) {
            this.currentWait = this.waits.shift();
        }
        if (this.currentWait) {
            var exp = this.currentWait.expected;
            if ($A.util.isFunction(exp)) {
                exp = exp();
            }
            var act = this.currentWait.actual;
            if ($A.util.isFunction(act)) {
                act = act();
            }
            if (exp === act) {
                var callback = this.currentWait.callback;
                this.currentWait = undefined;
                if (callback) {
                    // Set the suite as scope for callback function.
                    // Helpful to expose test suite as 'this' in callbacks for addWaitFor
                    if (this.doNotWrapInAuraRun) {
                        callback.call(this.suite, this.cmp);
                    } else {
                        $A.run(function() {
                            callback.call(that.suite, that.cmp);
                        });
                    }
                }
                setTimeout(internalCWR, 1);
                return;
            } else {
                setTimeout(internalCWR, 50);
                return;
            }
        } else {
            this.logErrors(true, "Did not receive expected error: ", this.expectedErrors);
            this.expectedErrors = [];

            this.logErrors(true, "Did not receive expected warning: ", this.expectedWarnings);
            this.expectedWarnings = [];

            if (this.stages.length === 0) {
                this.doTearDown();
            } else {
                this.lastStage = this.stages.shift();
                if (this.doNotWrapInAuraRun) {
                    this.lastStage.call(that.suite, that.cmp);
                    setTimeout(internalCWR, 1);
                } else {
                    $A.run(function() {
                        var result = that.lastStage.call(that.suite, that.cmp);
                        if (result && typeof result.then === 'function') {
                            result.then(function() {
                                setTimeout(internalCWR, 1);
                            },
                            function(err) {
                                that.logError("Test error", err);
                                setTimeout(internalCWR, 1);
                            });
                        } else {
                            setTimeout(internalCWR, 1);
                        }
                    });
                }
            }
        }
    } catch (e) {
        if (e instanceof $A.auraError) {
            throw e;
        } else {
            this.logError("Test error", e);
            this.doTearDown();
        }
    }
};

/**
 * Times out the test with an error.
 *
 * @private
 */
TestInstance.prototype.timeoutTest = function() {
    if (this.timedOut || this.inProgress < 2) {
        return;
    }
    this.timedOut = true;

    this.logError("Test timed out");
    this.doTearDown();
};

/**
 * Attempts to time out the test after the previously set timeout period.
 *
 * @private
 */
TestInstance.prototype.startTimer = function() {
    var that = this;
    clearTimeout(this.timer);
    this.timer = setTimeout(function() {
        that.timeoutTest();
    }, this.timeoutTime);
};

/**
 * Provide some information about the current state of the test.
 *
 * This is used by webdriver to get information to display.
 *
 * @export
 * @function Test#getDump
 */
TestInstance.prototype.getDump = function(clearSessionStorage) {
    try {
    	var status = '';
    	
    	if(window.sessionStorage) {
    		status += "From sessionStorage:\n";
    		status+= 'frameworkReadyWhenCreateTestInstance:'+sessionStorage.getItem('frameworkReadyWhenCreateTestInstance')+';\n';
    		status+= 'frameworkJsReadyWhenCreateTestInstance:'+sessionStorage.getItem('frameworkJsReadyWhenCreateTestInstance')+';\n';
    		status+= 'timeStampOfTestInstanceCreation:'+sessionStorage.getItem('timeStampOfTestInstanceCreation')+';\n';
    		status+= 'TestRunStatus:'+sessionStorage.getItem('TestRunStatus')+';\n';
    		
    		if(clearSessionStorage === true) {
    			sessionStorage.removeItem('frameworkReadyWhenCreateTestInstance');
    			sessionStorage.removeItem('frameworkJsReadyWhenCreateTestInstance');
    			sessionStorage.removeItem('timeStampOfTestInstanceCreation');
    			sessionStorage.removeItem('TestRunStatus');
    		}
    	}    	
    	    	
    	if(!Aura) {
    		status += "Aura framework not ready !!!\n";
    	}
    		
        status += "URL: " + window.location +  "\n";

        status += "Test status: ";
        if (this.inProgress === -1) {
            status += "did not start\n";
        } else if (this.inProgress === 0) {
            status += "completed\n";
        } else if (this.inProgress === 1) {
            status += "tearing down\n";
        } else if (this.inProgress >= 2) {
            status += "running\n";
        }
        status += "Elapsed time: ";
        status += this.elapsedTime || (new Date().getTime() - this.initTime);
        status += "ms\n";

        var errors = TestInstance.prototype.errors;
        if (errors.length > 0) {
            status += "Errors: {" + this.print(this.getErrors()) + "}\n";
        }
        if (this.preErrors && this.preErrors.length > 0) {
            status += "Errors during init: {" + this.print(this.preErrors)
                    + "}\n";
        }
        if (this.currentWait) {
            var actual = this.currentWait.actual;
            if ($A.util.isFunction(actual)) {
                try {
                    actual = actual();
                } catch (e) {
                    actual = [ "<error evaluating>" ];
                }
            }
            if (!$A.util.isUndefinedOrNull(this.currentWait.failureMessage)) {
                status += "Wait failure: {" + this.currentWait.failureMessage
                        + "}\n";
            }
            status += "Waiting for: {" + this.print(this.currentWait.expected)
                    + "} currently {" + this.print(actual) + "}\n";
            status += "Wait function: " + this.print(this.currentWait.actual)
                    + "\n";
        }
        if (!$A.util.isUndefinedOrNull(this.lastStage)) {
            status += "Last function: " + this.print(this.lastStage) + "\n";
        }
        return status;
    } catch (e) {
        // Just in case
        return "Unhandled error retrieving dump:" + e.toString();
    }
};
