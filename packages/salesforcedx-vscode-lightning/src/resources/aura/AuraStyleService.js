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
 * @description The Aura Style Service, accessible using <code>$A.styleService</code>.
 *              Dynamically loads and applies tokenized CSS.
 * @constructor
 * @export
 */
function AuraStyleService() {
    this.styleUtil = new Aura.Utils.Style(); // util for adding and removing <style> elements
    this.added = []; // keep track of <style> elements added to head
}

/**
 * Loads CSS from the server with the given tokens applied.
 * <p>
 * The current application's CSS is loaded from the server and only includes
 * overrides for the CSS that reference tokens from the specified tokens def.
 * This CSS is then placed into a new style element and attached to the DOM.
 * <p>
 * In addition to the application's CSS (as determined by the
 * application's dependency graph), this will also include any client
 * loaded StyleDefs (i.e., any dynamically loaded components with
 * styles, that are not in the application's dependency graph). Client
 * loaded StyleDefs will be appended after the standard application CSS.
 * Note that this may not be adequate with certain usages of providers.
 * See the config options for more details.
 * <p>
 * Extra StyleDefs to load may be specified through the config object,
 * which will be appended last.
 * <p>
 * Multiple calls to this method are cumulative, unless
 * <code>config.replaceExisting</code> is specified as true.
 *
 * @public
 * @memberOf AuraStyleService
 *
 * @param {string} descriptor
 *          The TokensDef descriptor, e.g., <code>"myNamespace:myTokens"</code>.
 * @param {Object=} config
 *          The optional configuration object.
 * @param {boolean} [config.replaceExisting=true]
 *          Specify true to replace all previously applied styles, false to append.
 * @param {string[]} [config.extraStyles]
 *          Specify any extra StyleDef descriptors to include.
 * @param {boolean} [config.storable=true]
 *          Specify whether the server action is storable. If true, the results
 *          may be retrieved from a cache when given the same parameters. You
 *          may want to specify false if applying a <em>MapProvider</em> def.
 * @param {function} [config.callback]
 *          Callback function to invoke once the style element has been appended to the page.
 * @param {function} [config.customHandler]
 *          Callback function that will be invoked with the returned CSS. If this function is
 *          specified, the CSS will not be automatically appended to the page as usual.
 *          Certain other config options may no longer be applicable. If you place the styles
 *          into the DOM, be aware that subsequent calls to this method that do not specify this
 *          option may not properly override everything depending on where in the DOM you placed
 *          the styles. Also note that the <code>replaceExisting</code> param will not handle
 *          any styles you attach to the DOM manually.
 * @export
 */
AuraStyleService.prototype.applyTokens = function(descriptor, config) {
    $A.assert(!$A.util.isUndefinedOrNull(descriptor), "applyTokens() cannot be given a null or undefined descriptor argument");
    this.applyAllTokens([descriptor], config);
};

/**
 * Loads CSS from the server with the given tokens applied.
 * <p>
 * The current application's CSS is loaded from the server and only includes
 * overrides for the CSS that reference tokens from the specified tokens defs.
 * This CSS is then placed into a new style element and attached to the DOM.
 * <p>
 * In addition to the application's CSS (as determined by the
 * application's dependency graph), this will also include any client
 * loaded StyleDefs (i.e., any dynamically loaded components with
 * styles, that are not in the application's dependency graph). Client
 * loaded StyleDefs will be appended after the standard application CSS.
 * Note that this may not be adequate with certain usages of providers.
 * See the config options for more details.
 * <p>
 * Extra StyleDefs to load may be specified through the config object,
 * which will be appended last.
 * <p>
 * Multiple calls to this method are cumulative, unless
 * <code>config.replaceExisting</code> is specified as true.
 *
 * @public
 * @memberOf AuraStyleService
 *
 * @param {string[]} descriptors
 *          The TokensDef descriptors, e.g., <code>["myNamespace:myTokens", "myNamespace:myTokens2"]</code>.
 * @param {Object=} config
 *          The optional configuration object.
 * @param {boolean} [config.replaceExisting=true]
 *          Specify true to replace all previously applied styles, false to append.
 * @param {string[]} [config.extraStyles]
 *          Specify any extra StyleDef descriptors to include.
 * @param {boolean} [config.storable=true]
 *          Specify whether the server action is storable. If true, the results
 *          may be retrieved from a cache when given the same parameters. You
 *          may want to specify false if applying a <em>MapProvider</em> def.
 * @param {function} [config.callback]
 *          Callback function to invoke once the style element has been appended to the page.
 * @param {function} [config.customHandler]
 *          Callback function that will be invoked with the returned CSS. If this function is
 *          specified, the CSS will not be automatically appended to the page as usual.
 *          Certain other config options may no longer be applicable. If you place the styles
 *          into the DOM, be aware that subsequent calls to this method that do not specify this
 *          option may not properly override everything depending on where in the DOM you placed
 *          the styles. Also note that the <code>replaceExisting</code> param will not handle
 *          any styles you attach to the DOM manually.
 * @export
 */
AuraStyleService.prototype.applyAllTokens = function(descriptors, config) {
	$A.assert($A.util.isArray(descriptors), "applyAllTokens() expects the 'descriptors' arg to be an array of strings");
	var that = this;
    config = config || {};

    $A.run(function() {
        var action = $A.get("c.aura://StyleController.applyTokens");

        action.setParams({
            "descriptors": descriptors,
            "extraStyles": config["extraStyles"] || []
        });

        // default storable true
        if ($A.util.isUndefined(config["storable"]) || config["storable"]) {
            action.setStorable();
        }

        action.setCallback(this, function(a) {
            var state = a.getState();
            if (state === "SUCCESS") {
                // if custom handler is specified, give it the CSS and do nothing else
                if ($A.util.isFunction(config["customHandler"])) {
                    config["customHandler"](a.getReturnValue());
                    return;
                }

                var node = that.styleUtil.apply(a.getReturnValue());

                // default is to replace existing unless specified false
                if ($A.util.isUndefinedOrNull(config["replaceExisting"]) || $A.util.getBooleanValue(config["replaceExisting"]) === true) {
                    that.removeTokens();
                    that.added = [node];
                } else {
                    that.added.push(node);
                }
            } else if (state === "INCOMPLETE") {
                var offlineMessageEvt = $A.getEvt('markup://force:showOfflineMessage');
                if (offlineMessageEvt) {
                    offlineMessageEvt.setParams({retryAction: action}).fire();
                }
            } else if (state === "ERROR") {
                var errors = a.getError();
                var e;
                if (errors && errors[0] && errors[0].message) {
                    e = new Error(errors[0].message);
                } else {
                    e = new Error("Unable to apply tokens, action state = " + a.getState());
                }

                e["reported"] = true;
                throw e;
            }

            if ($A.util.isFunction(config["callback"])) {
                config["callback"]();
            }
        });

        $A.clientService.enqueueAction(action);
    }, "applyAllTokens");
};

/**
 * Removes all style elements previously added through this service.
 *
 * @public
 * @memberOf AuraStyleService
 * @export
 */
AuraStyleService.prototype.removeTokens = function() {
    var head = this.styleUtil.getHead();
    for (var i = 0, len = this.added.length; i < len; i++) {
        head.removeChild(this.added[i]);
    }
};

Aura.Services.AuraStyleService = AuraStyleService;
