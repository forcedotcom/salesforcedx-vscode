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
 * @description We use an `Aura.Event.Event`-like instance instead of Aura.Event.Event
 *              itself because we need to pass `event.target` and `event.currentTarget`
 *              in some cases for backwards-compatibility, and locker does not allow
 *              expandos on instances of `Aura.Event.Event`.
 *
 * @constructor InteropEvent
 *
 * @param {Component} component - Required. The return value of `event.getSource()`.
 * @param {Object} config
 * @param {boolean} config.isEvent - The native event associated with this
 * @param {Object} config.params - If config.isEvent: The native event associated with this AuraEvent,
 *                                 otherwise the params of the AuraEvent.
 * @param {Object} config.exposeNativeAPI - If config.isEvent then it exposes the native event API
 *                                          for backwards-compatibility. Should not be used for new components.
 *
 * @private
 * @export
 */
Aura.Event.InteropEvent = function (component, config) {
    $A.assert(component, 'InteropEvent constructor requires the `component` argument.');

    var _config = config || {};
    var nativeEvent = _config['isEvent'] && _config['params'];

    // [W-4712124] Non-bubbling native events whose API we need to
    // expose are smuggled into the interop layer via the custom event.
    if (nativeEvent && _config['exposeNativeAPI'] &&
        nativeEvent['detail'] && nativeEvent['detail']['_originalEvent']) {
        nativeEvent = nativeEvent['detail']['_originalEvent'];
    }
    var event = nativeEvent || {};

    this._name = event.type || _config['name'] || '';
    this._source = component;
    this._params = _config['isEvent']
        ? this.buildEventParams($A.componentService.moduleEngine['unwrap'](event.detail) || {})
        : _config['params'] || {};

    // The following three attributes are initialized to fulfill the locker
    // duck test for native event objects
    this['target'] = null;
    this['currentTarget'] = null;
    this['initEvent'] = null;

    if (nativeEvent) {
        if (nativeEvent.preventDefault) {
            this['preventDefault'] = nativeEvent.preventDefault.bind(nativeEvent);
        }
        if (nativeEvent.stopPropagation) {
            this['stopPropagation'] = nativeEvent.stopPropagation.bind(nativeEvent);
        }

        // Expose the full native event API when requested; should only be
        // used for legacy event objects that existed before lightning
        // components implemented the Aura.Event API.
        if (_config['exposeNativeAPI']) {
            this['target'] = event.target;
            this['currentTarget'] = event.currentTarget;
            this.exposeNativeEventAPI(this, nativeEvent);
        }
    }
};

/**
 * Needed to unwrap Proxies that might come as part of the event.details and wont work on Compat mode.
 * @private
 * @param eventDetails
 */
Aura.Event.InteropEvent.prototype.buildEventParams = function (eventDetails) {
    var unwrap = $A.componentService.moduleEngine['unwrap'];
    var evtDetails = {};
    var objKeys = Object.keys(eventDetails);
    var key;

    for (var i = 0, n = objKeys.length; i < n; i++) {
        key = objKeys[i];
        evtDetails[key] = unwrap(eventDetails[key]);
    }

    return evtDetails;
};

/**
 * @private
 * @param auraEvent
 * @param nativeEvent
 */
Aura.Event.InteropEvent.prototype.exposeNativeEventAPI = function (auraEvent, nativeEvent) {
    var createGetter = function (_nativeEvent, _attrName) {
        return function () {
            $A.warning(
                'Avoid relying on the native event attribute `' + _attrName +
                '` as it is only included for backwards-compatibility. It ' +
                'will eventually be deprecated. Use the aura event API ' +
                '(e.g., getSource(), getParams(), etc) instead.'
            );
            var value = _nativeEvent[_attrName];
            if (typeof value === 'function') {
                value = value.bind(_nativeEvent);
            }
            return value;
        };
    };

    for (var attrName in nativeEvent) {
        if (!(attrName in auraEvent)) {
            // TODO: These would ideally be non-enumerable but locker completely filters out
            // non-enumerable properties.
            Object.defineProperty(auraEvent, attrName, {
                enumerable: true,
                get: createGetter(nativeEvent, attrName)
            });
        }
    }
};

/**
 * @export
 */
Aura.Event.InteropEvent.prototype.fire = function () {
    this.raiseInvalidInteropApi('fire', arguments);
};

/**
 * @export
 */
Aura.Event.InteropEvent.prototype.getName = function () {
    return this._name;
};

/**
 * @export
 */
Aura.Event.InteropEvent.prototype.getParam = function (name) {
    return this._params[name];
};

/**
 * @export
 */
Aura.Event.InteropEvent.prototype.getParams = function () {
    return this._params;
};

/**
 * @export
 */
Aura.Event.InteropEvent.prototype.getPhase = function () {
    this.raiseInvalidInteropApi('getPhase', arguments);
};

/**
 * @export
 */
Aura.Event.InteropEvent.prototype.getSource = function () {
    return this._source;
};

/**
 * @export
 */
Aura.Event.InteropEvent.prototype.pause = function () {
    this.raiseInvalidInteropApi('pause', arguments);
};

/**
 * @export
 */
Aura.Event.InteropEvent.prototype.preventDefault = function () {};

/**
 * @export
 */
Aura.Event.InteropEvent.prototype.resume = function () {
    this.raiseInvalidInteropApi('resume', arguments);
};

/**
 * @export
 */
Aura.Event.InteropEvent.prototype.setParam = function () {};

/**
 * @export
 */
Aura.Event.InteropEvent.prototype.setParams = function () {};

/**
 * @export
 */
Aura.Event.InteropEvent.prototype.stopPropagation = function () {};

/**
 * @private
 */
Aura.Event.InteropEvent.prototype.raiseInvalidInteropApi = function(func, args) {
    var error = 'Interop event tried calling function [' + func + ']';
    var argsArr = Array.prototype.slice.call(args);
    if (argsArr.length) {
        error += ' with arguments [' + argsArr.join(',') + ']';
    }

    if (this._source && this._source.globalId) {
        error += ', ' + this._source + ' [' + this._source.globalId + ']';
    }

    var ae = new $A.auraError(error, null, $A.severity.QUIET);
    ae.component = this._source.toString();
    throw ae;
};