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
 * @description A Value wrapper for a function call.
 * @constructor
 */
function FunctionCallValue(config, valueProvider) {
    this.valueProvider = valueProvider;
    this.byValue = config["byValue"];
    if (!(config["code"] instanceof Function)) {
        config["code"] = (0,eval)("(" + config["code"] + ")");
    }
    this.code = config["code"];
    this.context = $A.clientService.currentAccess;

    this.args = [];
    for (var i = 0; i < config["args"].length; i++) {
        this.args.push(valueFactory.create(config["args"][i], valueProvider));
    }

//#if {"modes" : ["STATS"]}
    valueFactory.index(this);
//#end
}

/**
 * Create a local subclass.
 */
FunctionCallValue.prototype.expressionFunctions = new ExpressionFunctions();

/**
 * Sets the isDirty flag to false.
 */
FunctionCallValue.prototype.isDirty = function(){
    for (var i = 0; i < this.args.length; i++) {
        var arg = this.args[i];
        if ($A.util.isExpression(arg) && arg.isDirty()) {
            return true;
        }
    }
    return false;
};

/**
 * Returns the value of function call with the given value provider.
 * Throws an error if vp is not provided.
 * @param {Object} valueProvider The value provider to resolve.
 */
FunctionCallValue.prototype.evaluate = function(valueProvider) {
    $A.clientService.setCurrentAccess(this.context);
    try {
        var result = this.code(valueProvider || this.valueProvider, this.expressionFunctions);
        if (!this.hasOwnProperty("result")) {
            this["result"] = result;
        }
        return result;
    } finally {
        $A.clientService.releaseCurrentAccess();
    }
};

FunctionCallValue.prototype.addChangeHandler = function(cmp, key, fcv) {
    if (this.byValue) {
        return;
    }

    for (var i = 0; i < this.args.length; i++) {
        var arg = this.args[i];
        if ($A.util.isExpression(arg)) {
            if (arg instanceof PropertyReferenceValue) {
                arg.addChangeHandler(cmp, key, fcv ? fcv : this.getChangeHandler(cmp, key, this));
            } else {
                arg.addChangeHandler(cmp, key, fcv || this);
            }
        }
    }
};

FunctionCallValue.prototype.getChangeHandler = function(cmp, key, fcv) {
    return function FunctionCallValue$getChangeHandler() {
        var result = fcv.evaluate();
        if (fcv["result"] !== result) {
            var oldValue = fcv["result"];
            fcv["result"] = result;

            $A.renderingService.addDirtyValue(key, cmp);
            cmp.fireChangeEvent(key, oldValue, result);
        }
    };
};

FunctionCallValue.prototype.removeChangeHandler = function(cmp, key) {
    if (this.byValue) {
        return;
    }

    for (var i = 0; i < this.args.length; i++) {
        var arg = this.args[i];
        if ($A.util.isExpression(arg)) {
            arg.removeChangeHandler(cmp, key);
        }
    }
};

/**
 * Destroys the value wrapper.
 */
FunctionCallValue.prototype.destroy = function(){
//#if {"modes" : ["STATS"]}
    valueFactory.deIndex(this);
//#end
// JBUCH: HALO: TODO: FIXME
//    for(var i=0;i<this.args.length;i++){
//        this.args[i].destroy();
//    }
    this.args=this.code=this.valueProvider=null;
};

/**
 * Returns the JS function code.
 * Helpful for logging/debugging.
 * @returns {string}
 */
FunctionCallValue.prototype.toString = function() {
    return this.code.toString();
};

Aura.Value.FunctionCallValue = FunctionCallValue;
