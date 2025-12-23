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

/*!
 * @overview JS Object representation of a stack frame
 * @license   Licensed under The Unlicense
 *            See https://github.com/stacktracejs/stackframe
 * @version   1.0.2
 */
/* eslint-disable */
(function(root, factory) {
    'use strict';

    root['StackFrame'] = factory();
}(this, function() {
    'use strict';
    function _isNumber(n) {
        return !isNaN(parseFloat(n)) && isFinite(n);
    }

    function _capitalize(str) {
        return str[0].toUpperCase() + str.substring(1);
    }

    function _getter(p) {
        return function() {
            return this[p];
        };
    }

    var booleanProps = ['isConstructor', 'isEval', 'isNative', 'isToplevel'];
    var numericProps = ['columnNumber', 'lineNumber'];
    var stringProps = ['fileName', 'functionName', 'source'];
    var arrayProps = ['args'];

    var props = booleanProps.concat(numericProps, stringProps, arrayProps);

    function StackFrame(obj) {
        if (obj instanceof Object) {
            for (var i = 0; i < props.length; i++) {
                if (obj.hasOwnProperty(props[i]) && obj[props[i]] !== undefined) {
                    this['set' + _capitalize(props[i])](obj[props[i]]);
                }
            }
        }
    }

    StackFrame.prototype['getArgs'] = function() {
        return this.args;
    };

    StackFrame.prototype['setArgs'] = function(v) {
        if (Object.prototype.toString.call(v) !== '[object Array]') {
            throw new TypeError('Args must be an Array');
        }
        this.args = v;
    };

    StackFrame.prototype['getEvalOrigin'] = function() {
        return this.evalOrigin;
    };

    StackFrame.prototype['setEvalOrigin'] = function(v) {
        if (v instanceof StackFrame) {
            this.evalOrigin = v;
        } else if (v instanceof Object) {
            this.evalOrigin = new StackFrame(v);
        } else {
            throw new TypeError('Eval Origin must be an Object or StackFrame');
        }
    };

    StackFrame.prototype.toString =  function() {
            var functionName = this['getFunctionName']() || '{anonymous}';
            var args = '(' + (this['getArgs']() || []).join(',') + ')';
            var fileName = this['getFileName']() ? ('@' + this['getFileName']()) : '';
            var lineNumber = _isNumber(this['getLineNumber']()) ? (':' + this['getLineNumber']()) : '';
            var columnNumber = _isNumber(this['getColumnNumber']()) ? (':' + this['getColumnNumber']()) : '';
            return functionName + args + fileName + lineNumber + columnNumber;
    };

    for (var i = 0; i < booleanProps.length; i++) {
        StackFrame.prototype['get' + _capitalize(booleanProps[i])] = _getter(booleanProps[i]);
        StackFrame.prototype['set' + _capitalize(booleanProps[i])] = (function(p) {
            return function(v) {
                this[p] = Boolean(v);
            };
        })(booleanProps[i]);
    }

    for (var j = 0; j < numericProps.length; j++) {
        StackFrame.prototype['get' + _capitalize(numericProps[j])] = _getter(numericProps[j]);
        StackFrame.prototype['set' + _capitalize(numericProps[j])] = (function(p) {
            return function(v) {
                if (!_isNumber(v)) {
                    throw new TypeError(p + ' must be a Number');
                }
                this[p] = Number(v);
            };
        })(numericProps[j]);
    }

    for (var k = 0; k < stringProps.length; k++) {
        StackFrame.prototype['get' + _capitalize(stringProps[k])] = _getter(stringProps[k]);
        StackFrame.prototype['set' + _capitalize(stringProps[k])] = (function(p) {
            return function(v) {
                this[p] = String(v);
            };
        })(stringProps[k]);
    }

    return StackFrame;
}));

Aura.Errors.StackFrame = this['StackFrame'];