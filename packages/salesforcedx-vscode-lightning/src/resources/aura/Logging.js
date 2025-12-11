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

(function(){
    //#if {"excludeModes" : ["PRODUCTION", "PRODUCTIONDEBUG", "PERFORMANCEDEBUG"]}
    $A.logger.subscribe("INFO", $A.logger.devDebugConsoleLog);
    $A.logger.subscribe("WARNING", $A.logger.devDebugConsoleLog);
    //#end

    //#if {"modes" : ["PRODUCTIONDEBUG", "PERFORMANCEDEBUG"]}
    /**
     * $A.warning() will log to console in proddebug
     */
    $A.logger.subscribe("WARNING", function(level, message, error) {
        if (window["console"]) {
            if (error && error.message) {
                if (message) {
                    message += ". Caused by: " + error.message;
                } else {
                    message = error.message;
                }
            }
            window["console"].warn(level + ": " + message);
        }
    });
    //#end

    $A.logger.subscribe("ASSERT", function(level, message) {
        throw new $A.auraError(message);
    });

    $A.logger.subscribe("ERROR", function(level, message, e) {
        $A.reportError(message, e);
    });


    window.onerror = (function() {
        var existing = window.onerror;
        var newHandler = function(message, url, line, col, err) {
            if (url && line && col) {
                message = message + "\nthrows at " + url + ":" + line + ":" + col;
            }

            if (!$A.reportError(message, err) && !existing) {
                var console_error = (window.console && window.console.error.bind(window.console));
                // if we ignored the error && there is no existing onerror handler, we log to the console.
                if (console_error) {
                    console_error(message, err);
                }
            }
            return true;
        };

        return function() {
            if (existing) {
                try {
                    existing.apply(this, arguments);
                } catch (e) {
                    // ignore errors from external onerror handler
                    $A.warning("error from external onerror handler!", e);
                }
            }

            return newHandler.apply(this, arguments);
        };
    })();

    window.addEventListener("unhandledrejection", function (event) {
        var error = event.reason;
        var validError = false;

        if (error && error.name && error.name.indexOf('Error') !== -1) {
            error = new $A.auraError(null, error);
            validError = true;
        }

        if (!validError || !$A.reportError(null, error)) {
            var console_error = (window.console && window.console.error.bind(window.console));
            if (console_error) {
                console_error(null, event.reason);
            }
        }
    });

})();
