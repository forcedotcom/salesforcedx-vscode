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
 * @description The Aura History Service, accessible using <code>$A.historyService</code>. Manages browser history.
 * Internet Explorer 7 and 8 are not supported for this service.
 * @constructor
 * @export
 */
function AuraHistoryService() {
    this.history = [];       // tracks url hashes
    this.currentIndex = -1;  // pointer to current hash within history
    this.evt = null;
}

/**
 * Sets the new location. For example, <code>set("search")</code> sets the location to <code>#search</code>.
 *
 * For browsers that don't support pushState (eg native Android browser, iOS7 webview), a manual hash
 * update and firing onhashchange is used.
 *
 * @param {Object} token The provided token set to the current location hash
 * @memberOf AuraHistoryService
 * @public
 * @export
 */
AuraHistoryService.prototype.set = function(token) {
    if (token) {
        // Check for HTML5 window.history.pushState support
        if (this.usePushState()) {
            //
            // Need to pass in the token to the state as
            // windows phone doesn't persist the hash
            // after using the back button.
            //
            window.history.pushState({"hash":token}, null, '#' + token);
            this.changeHandler();
        } else {
            if ($A.util.isIOSWebView()) {
                // roll our own history for IOS UIWebView
                var historyLength = this.history.length;
                if (this.currentIndex < (historyLength - 1)) {
                    // remove forward entries if we moved back and new location is set
                    this.history.splice(this.currentIndex + 1, historyLength - this.currentIndex);
                }
                this.currentIndex++;
                this.history.push(token);
            }
            window.location.hash = "#" + token;
        }
    }
};

/**
 * Replaces the current location with the new location, meaning the current location will not be
 * stored in the browser history. Analogous to window.history.replace().
 * For example, if the last location in history was '#first', the current location is '#second',
 * then <code>replace("third")</code> replaces <code>#second</code> with <code>#third</code>
 * as the current location. Pressing the browser back button would result in location <code>#first</code>
 *
 * For browsers that don't support pushState or location.replace (eg native Android browser, iOS7 webview),
 * workarounds are used.
 *
 * @param {Object} token The provided token set to the current location hash
 * @memberOf AuraHistoryService
 * @public
 * @export
 */
AuraHistoryService.prototype.replace = function(token) {
    if (token) {
        // Check for HTML5 window.history.pushState support
        if (this.usePushState()) {
            //
            // Need to pass in the token to the state as
            // windows phone doesn't persist the hash
            // after using the back button.
            //
            window.history.replaceState({"hash":token}, null, '#' + token);
            this.changeHandler();
        } else {
            if ($A.util.isIOSWebView()) {
                // roll our own history for IOS UIWebView
                var historyLength = this.history.length;
                if (this.currentIndex < (historyLength - 1)) {
                    // remove forward entries if we moved back and new location is set
                    this.history.splice(this.currentIndex + 1, historyLength - this.currentIndex);
                }
                // replace should just update the entry at the existing current index, so we
                // don't modify this.currentIndex
                this.history[this.currentIndex] = token;
            }
            //
            // older browsers, e.g. Android and IE, don't have window.location.replace, so we
            // check for its existence before calling it.
            // If it doesn't exist, we fallback to just set the hash directly, which will add an unwanted entry
            // in the browser history, which isn't what we want, but it's no worse than we have
            // today with only set().
            //
            if(window.location.replace) {
                window.location.replace('#' + token);
            } else {
                window.location.hash = "#" + token;
            }
        }
    }
};

/**
 * Parses the location. A token can be used here.
 * <p>Example:</p>
 * <code>token == "newLayout";<br /> $A.historyService.get().token;</code>
 *
 * @memberOf AuraHistoryService
 * @public
 * @export
 */
AuraHistoryService.prototype.get = function() {
    //
    // Windows phone doesn't save the hash after navigating backwards.
    // So get it from the history state.
    //
    var token = this.getLocationHash() || this.getHistoryState() || "";
    return this.parseLocation(token);
};

/**
 * Loads the previous URL in the history list. Standard JavaScript <code>history.go()</code> method.
 *
 * @memberOf AuraHistoryService
 * @public
 * @export
 */
AuraHistoryService.prototype.back = function() {
    if (!$A.util.isIOSWebView()) {
        //history -> Standard javascript object
        window.history.go(-1);
    } else {
        // IOS7 UIWebView has issues with appcache and history so
        // keep track of history ourselves and change hash instead
        if (this.currentIndex > 0) {
            // move pointer and get previous hash location
            var hash = this.history[--this.currentIndex];
            window.location.hash = "#" + hash;
        } else {
            // in case pointer has moved passed all history then reset to push new history
            this.reset();
            window.location.hash = "";
        }
    }
};

/**
 * Sets the title of the document.
 *
 * @param {String} title The new title
 * @memberOf AuraHistoryService
 * @public
 * @export
 */
AuraHistoryService.prototype.setTitle = function(title) {
    document.title = title;
};

/**
 * Loads the next URL in the history list. Standard JavaScript <code>history.go()</code> method.
 *
 * @memberOf AuraHistoryService
 * @public
 * @export
 */
AuraHistoryService.prototype.forward = function() {
    if (!$A.util.isIOSWebView()) {
        //history -> Standard javascript object
        window.history.go(1);
    } else {
        // IOS7 UIWebView has issues with appcache and history so
        // keep track of history ourselves and change hash instead
        var historyLength = this.history.length;
        if (this.currentIndex < (historyLength - 1)) {
            // if there's forward history, go forward one
            window.location.hash = "#" + this.history[++this.currentIndex];
        }
    }
};

/**
 * Resets history
 *
 * @public
 * @export
 */
AuraHistoryService.prototype.reset = function () {
    this.history = [];
    this.currentIndex = -1;
};

/**
 * Whether to use pushState.
 * Native Android browser has issues with pushState
 * IOS7 UIWebView has issues with pushState and history
 * @returns {boolean} true if pushState should be used
 * @private
 */
AuraHistoryService.prototype.usePushState = function() {
    if (this._usePushState === undefined) {
        var ua = window.navigator.userAgent;
        this._usePushState =
            // browser has pushState
            !!window.history.pushState &&
            // NOT native Android browser
            !(ua.indexOf("Android ") > -1 && ua.indexOf("Mozilla/5.0") > -1 && ua.indexOf("AppleWebKit") > -1 && ua.indexOf("Chrome") === -1) &&
            // NOT IOS7 UIWebView (native app webview)
            !$A.util.isIOSWebView();
    }
    return this._usePushState;
};

/**
 * @private
 */
AuraHistoryService.prototype.init = function() {
    // Check for HTML5 window.history.pushState support
    var that = this;
    if (this.usePushState()) {
        window.addEventListener("popstate", function() {
            that.changeHandler();
        });
    } else {
        var hash = this.getLocationHash();

        this.history.push(hash);
        this.currentIndex++;

        // Checks for existence of event, and also ie8 in ie7 mode (misreports existence)
        var docMode = document["documentMode"];
        var hasOnHashChangeEvent = 'onhashchange' in window && (docMode === undefined || docMode > 7);

        if (hasOnHashChangeEvent) {
            window["onhashchange"] = function(){
                that.changeHandler();
            };
        } else {
            var watch = function(){
                setTimeout(function(){
                    var newHash = that.getLocationHash();
                    if (newHash !== hash) {
                        hash = newHash;
                        that.changeHandler();
                    }
                    watch();
                }, 300);
            };
            watch();
        }
    }
    this.changeHandler();
    delete this.init;
};

/**
 * @private
 */
AuraHistoryService.prototype.getEvent = function(){
    if (!this.evt){
        this.evt = $A.getRoot().getDef().getLocationChangeEvent();
    }
    return this.evt;
};

/**
 * @private
 */
AuraHistoryService.prototype.changeHandler = function(){

    var loc = this.getLocationHash() || this.getHistoryState();

    // The event should be accessible in the context of the application.
    $A.clientService.setCurrentAccess($A.getRoot());
    var event;
    try {
        event = $A.eventService.newEvent(this.getEvent());
    } finally {
        $A.clientService.releaseCurrentAccess();
    }

    if(!event) {
        throw new $A.auraError("The event specified on the app for the locationChange (" + this.getEvent() + ") was not found.", null, $A.severity.QUIET);
    }

    if (loc) {
        //
        // Its possible that more querystring parameters where specified in the hash
        // then are defined on the event. In this case do specify them as parameters
        // of the event.
        //
        var parsedHash = this.parseLocation(loc);
        var parameters = {};
        var attributes = event.getDef().getAttributeDefs().getNames();
        var attribute;
        for(var c=0,length=attributes.length;c<length;c++) {
            attribute = attributes[c];
            if(parsedHash.hasOwnProperty(attribute)) {
                parameters[attribute] = parsedHash[attribute];
            }
        }
        event.setParams(parameters);
    }

    event.fire();
};

/**
 * @private
 * @param {String} location the hash portion of the URL
 */
AuraHistoryService.prototype.parseLocation = function(location) {
    if (location.indexOf("#") === 0) {
        location = location.substring(1);
    }

    if (location.indexOf('=') > -1) {
        var position = location.indexOf("?");
        if(position === -1) {
            return { "token": location, "querystring": ""};
        }

        var token = location.substring(0, position);
        var querystring = location.substring(position+1);
        var decoded = this.parseQueryString(querystring);
            decoded["token"] = token;
            decoded["querystring"] = querystring;
        return decoded;
    } else {
        return {"token" : location, "querystring": "" };
    }
};


/**
 * Parses a query string into an object. It supports values in query string containing '='.
 * @param {String} querystring the query string part of the URL, the portion after '?'.
 * @private
 */
AuraHistoryService.prototype.parseQueryString = function(querystring) {
    var ret = {};
    var pairs = querystring.split("&");
    var position;
    var pair;
    for (var i = 0; i < pairs.length; i++) {
        pair = pairs[i];
        position = pair.indexOf("=");
        if(position === -1) {
            ret[pair] = undefined;
        } else {
            ret[pair.substring(0, position)] = decodeURIComponent(pair.substring(position+1));
        }
    }
    return ret;
};

/**
 * Firefox unescapes location.hash, so the results are inconsistent browser to browser.
 * This method normalizes accessing the hash portion.
 * @private
 */
AuraHistoryService.prototype.getLocationHash = function() {
    var href = window.location["href"];
    var hashPosition = href.indexOf("#");
    if(hashPosition === -1) {
        return "";
    }

    return href.substr(hashPosition);
};

/**
 * @private
 */
AuraHistoryService.prototype.getHistoryState = function(){
	var historyState = null;
	try {
		historyState = window.history["state"] && window.history["state"]["hash"];
	} catch (e) {
		// continue regardless of error
	}
	return historyState;
};

Aura.Services.AuraHistoryService = AuraHistoryService;
