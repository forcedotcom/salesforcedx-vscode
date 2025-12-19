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
 * @description A Value wrapper for a property reference.
 * @constructor
 * @protected
 * @export
 */
function PropertyReferenceValue(path, valueProvider/*, target*/) {
    var isArray=$A.util.isArray(path);
    this.path = isArray?path:path.split('.');
    this.expression = isArray?path.join('.'):path;
    this.isGlobal=this.expression.charAt(0) === '$';
    // if($A.util.isString(target)){
    //     debugger;
    // }
    this.valueProvider=this.isGlobal?null:valueProvider;
    this.context=this.isGlobal?null:((valueProvider instanceof PassthroughValue)?valueProvider:$A.clientService.currentAccess);
    this.lastResult=null;
    this.isValid=true;

    // #if {"modes" : ["STATS"]}
    valueFactory.index(this);
    // #end
}

/**
 * Returns the dereferenced value indicated by the path supplied.
 */
PropertyReferenceValue.prototype.evaluate = function(valueProvider) {
    if(this.isValid) {
        if (this.isGlobal) {
            this.lastResult = aura.get(this.expression);
            return this.lastResult;
        }
        if (!valueProvider) {
            valueProvider = this.valueProvider;
        }
        $A.clientService.setCurrentAccess(this.context);
        try {
            var result = valueProvider.get(this.expression);
            this.lastResult = result;
            return result;
        } finally {
            $A.clientService.releaseCurrentAccess();
        }
    }
};

/**
 * Sets the value indicated by the path
 */
PropertyReferenceValue.prototype.set = function(value) {
    if(this.isValid) {
        if (this.isGlobal) {
            return aura.set(this.expression, value);
        }
        $A.clientService.setCurrentAccess(this.context);
        try {
            var result = this.valueProvider.set(this.expression, value);
            return result;
        } finally {
            $A.clientService.releaseCurrentAccess();
        }
    }
};

/**
 * @export
 */
PropertyReferenceValue.prototype.addChangeHandler=function(cmp, key, method, rebind) {
    if(this.isGlobal){
        $A.expressionService.addExpressionListener(this,key,cmp);
        return;
    }
    var valueProvider=this.valueProvider;
    var expression = this.expression;
    if(valueProvider.addChangeHandler&&(valueProvider!==cmp||expression!==key)) {
        if(!method){
            method=function PropertyReferenceValue$changeHandler(event) {
            	// If not valid, don't fire change events
            	if(!cmp.isValid()) { return; }
                $A.renderingService.addDirtyValue(key, cmp);
                if(rebind){
                    cmp.set(key,event.getParam("value"),true);
                }
                cmp.fireChangeEvent(key, event.getParam("oldValue"), event.getParam("value"), event.getParam("index"));
            };
        }
        method.id=cmp.getGlobalId();
        method.key=key;
        var config={"event": "change", "value": expression, "method": method, "cmp": cmp};
        this.valueProvider.addChangeHandler(config);
    }
};


/**
 * @export
 */
PropertyReferenceValue.prototype.removeChangeHandler=function(cmp, key){
    if(this.isGlobal){
        $A.expressionService.removeExpressionListener(this,key,cmp);
        return;
    }
    var valueProvider=this.valueProvider;
    var expression = this.expression;
    if (!valueProvider) {
        return;
    }

    while(valueProvider instanceof PassthroughValue){
        expression = valueProvider.getExpression(expression);
        valueProvider=valueProvider.getComponent();
    }
    //This is a total hack for aura:iteration
    //This removes the referenced change handler on the parent iteration component
    //that references the child PRV
    var cmpOwner = cmp.getOwner();
    if(expression !== this.expression && cmp.getType() !== "aura:expression" && cmpOwner) {
        var changeHandler = cmpOwner.handlers["change"];
        if(changeHandler && changeHandler[expression]) {
            changeHandler[expression] = null;
        }
    }
    if(valueProvider&&valueProvider.removeValueHandler&&(valueProvider!==cmp||this.expression!==key)) {
        valueProvider.removeValueHandler({"event": "change", "value": this.expression, "id":cmp.getGlobalId(),"key":key});
    }
};

/**
 * Returns the value in the format "v.expression".
 */
PropertyReferenceValue.prototype.getExpression = function() {
    return this.expression;
};

PropertyReferenceValue.prototype.getIsGlobal = function() {
    return this.isGlobal;
};

PropertyReferenceValue.prototype.getReference = function(path) {
    if(!path) {
        return this;
    }

    var valueProvider=this.valueProvider;
    var expression = this.expression;
    while(valueProvider instanceof PassthroughValue){
        expression = valueProvider.getExpression(expression);
        valueProvider=valueProvider.getComponent();
    }
    return valueProvider ? valueProvider.getReference(expression + "." + path) : null;
};

PropertyReferenceValue.prototype.equals = function (target){
    return target instanceof PropertyReferenceValue && target.valueProvider === this.valueProvider && target.expression === this.expression;
};

/**
 * Sets the isDirty flag to false.
 * @export
 */
PropertyReferenceValue.prototype.isDirty = function() {
    var valueProvider = this.valueProvider;
    var expression = this.expression;

    // KRIS: HALO: I'm really unsure if I want this here or not, do we check against the component if it's dirty?
    // Why would we care if the passthrough value is dirty? I would think the
    while(valueProvider instanceof PassthroughValue){
        expression = valueProvider.getExpression(expression);
        valueProvider=valueProvider.getComponent();
    }

    // Check Render service, since the value it could be referencing is dirty.
    return $A.renderingService.isDirtyValue(expression, valueProvider);
};

/**
 * Destroys the path.
 * @export
 */
PropertyReferenceValue.prototype.destroy = function() {
    // #if {"modes" : ["STATS"]}
    valueFactory.deIndex(this);
    // #end
    this.valueProvider=this.context=null;
    this.isValid=false;
};

/**
 * Returns "PropertyReferenceValue" as String.
 * @export
 */
PropertyReferenceValue.prototype.toString = function() {
    return "{!"+this.expression+"}";
};

/**
 * When serializing say an Action, we don't want to serialize the reference elements, but the value under the covers.
 */
PropertyReferenceValue.prototype.toJSON = function() {
    return this.evaluate();
};

Aura.Value.PropertyReferenceValue = PropertyReferenceValue;
