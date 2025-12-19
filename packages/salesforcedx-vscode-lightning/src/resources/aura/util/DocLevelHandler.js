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
 * Constructor for a doc level handler.
 *
 * @param {String}
 *            eventName the name of the event (must be valid dom event)
 * @param {Function}
 *            callback the callback function for the event (will be wrapped)
 * @param {Component}
 *            component the component attached to the handler.
 *
 * @constructor
 * @private
 * @export
 */
Aura.Utils.DocLevelHandler = function DocLevelHandler(eventName, callback, component) {
    this.eventName = eventName;
    this.component = component;
    this.enabled = false;
    var that = this;
    this.callback = function(eventObj) {
        if (that.component.isValid()&&that.component.isRendered()) {
            callback(eventObj);
        }
    };
};

/**
 * Set whether the handler is enabled.
 *
 * This function will enable or disable the handler as necessary. Note that the
 * callback will be called only if the component is rendered.
 *
 * @param {Boolean} enable if truthy, the handler is enabled, otherwise disabled.
 * @export
 */
Aura.Utils.DocLevelHandler.prototype.setEnabled = function(enable) {
    if (enable) {
        if (!this.enabled) {
            this.enabled = true;
            $A.util.on(document.body, this.eventName, this.callback);
        }
    } else {
        if (this.enabled) {
            this.enabled = false;
            $A.util.removeOn(document.body, this.eventName, this.callback);
        }
    }
};