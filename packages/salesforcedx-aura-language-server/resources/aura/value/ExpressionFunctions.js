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
 * @class ExpressionFunctions.
 *
 * client implementations of the expression functions
 *
 * @constructor
 * @protected
 * @export
 */
function ExpressionFunctions() {}

/**
 * Performs a strict comparison while avoiding "null" and "undefined" to be equal.
 *
 * @param {Object} a The first argument.
 * @param {Object} b The second argument.
 * @return {Object} True if both arguments are equal, or if "null" or "undefined".
 * @export
 */
ExpressionFunctions.prototype.eq = function(a, b) {

    if (a === undefined || a === null) {
        return (b === undefined || b === null);
    }

    return a === b;
};

/**
 * Performs a strict negative comparison while avoiding "null" and "undefined" to be equal.
 *
 * @param {Object} a The first argument.
 * @param {Object} b The second argument.
 * @return {Object} True if both arguments are equal, or if "null" or "undefined".
 * @export
 */
ExpressionFunctions.prototype.ne = function(a, b) {

    if (a === undefined || a === null) {
        return (b !== undefined && b !== null);
    }

    return a !== b;
};

/**
 * Performs string concatenations and numeric additions while avoiding concatenating
 * "null" or "undefined" when one or both arguments are undefined or null.
 *
 * @param {Object} a The first argument.
 * @param {Object} b The second argument.
 * @return {Object} The sum (numbers) or the concatenation (string) of the arguments.
 * @export
 */
ExpressionFunctions.prototype.add = function(a, b) {

    if (a === undefined || a === null) {
        if (typeof b === "string") {
            return b;
        } else if (b === undefined || b === null) {
            return "";
        }
    }

    if (b === undefined || b === null) {
        if (typeof a === "string") {
            return a;
        }
    }

    return a + b;
};

/**
 * Passthrough to $A.util.isEmpty
 * @export
 */
ExpressionFunctions.prototype.empty = Aura.Utils.Util.prototype.isEmpty;


/**
 * Preprocess the arguments of format() so they make sense in
 * a UI context, where the expressions are used. Prevent the
 * output of null and undefined but still allow for any missing
 * placeholders to be seen in developement mode.
 * @export
 */
ExpressionFunctions.prototype.format = function() {

    // Guard for missing argument.
    if (arguments.length === 0) {
        return "";
    }

    // Guard for "null" or "undefined", just like we do for add.
    var a0 = arguments[0];
    if (a0 === undefined || a0 === null || !$A.util.isFunction(a0.toString)) {
        return "";
    }

    // With one argument, format returns a string.
    if (arguments.length === 1) {
        return a0 + "";
    }

    var formatArguments = [];
    for (var i = 0; i < arguments.length; i++) {
        var ai = arguments[i];
        formatArguments[i] = (ai === undefined || ai === null) ? "" : ai;
    }

    return $A.util.format.apply($A.util, formatArguments);
};

/**
 * Passthrough to $A.getToken(token);
 * @export
 */
ExpressionFunctions.prototype.token = function(token){
    try{
        return $A.getToken(token);
    }catch(e){
        var message = e["message"] || "ExpressionFunctions token error";
        $A.warning(message, e);
    }
    return '';
};

/**
 * Passthrough to Array.prototype.join(separator);
 * @export
 */
ExpressionFunctions.prototype.join = function(separator /*, param1, param2, paramN */){
    var params=[];
    for(var i=1;i<arguments.length;i++){
        if(!this.empty(arguments[i])){
            params.push(arguments[i]);
        }
    }
    return params.join(separator);
};


Aura.Value.ExpressionFunctions = ExpressionFunctions;