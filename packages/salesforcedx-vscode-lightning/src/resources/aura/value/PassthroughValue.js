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
 * @description A value provider that resolves against a few primary providers first, then falls back on a component.
 * @constructor
 * @protected
 * @export
 */
function PassthroughValue(primaryProviders, component) {
    this.primaryProviders = primaryProviders;
    this.component = component;
    this.references={};
    this.handlers={};
}

/**
 * Since PassthroughValue can have its own set of values that can be listen for changes,
 * it needs it's own value change handler logic. Essentially you should be able to treat
 * it like a component for change events. It does not mark dirty though, since a passthrough
 * does have anything to rerender, marking dirty is the responsibility of the referencing components.
 * @export
 */
PassthroughValue.prototype.addValueHandler = function(config) {
    // KRIS: HALO:
    // Only add value handlers for our values, everything else
    // gets passed to the component we are wrapping.
    // v.items.0.label
    var path = config.value.split(".");
    if(!this.primaryProviders.hasOwnProperty(path[0])) {
        // not this.component
        this.component.addValueHandler(config);
        return;
    }
    this.addChangeHandler(config);
};

PassthroughValue.prototype.addChangeHandler=function(config){
    var path = config.value.split(".");
    if(!this.primaryProviders.hasOwnProperty(path[0])) {
        this.component.addChangeHandler(config);
        return;
    }

    var provider = this.primaryProviders[path[0]];

    if($A.util.isExpression(provider)) {
        // If the provider is a reference to another value, then we need to go into that reference, and
        // then get the value we actually want.
        // Think v.items in iteration, we want item.label to become v.items.0.label
        var reference = path.length > 1 ? provider.getReference(path.slice(1).join('.')) : provider;
        if(reference) {
            reference.addChangeHandler(config["cmp"], reference.getExpression(), config["method"]);
            return;
        }
    }

    var event = config["event"];
    var handlers = this.handlers[event];
    if (!handlers) {
        handlers = this.handlers[event] = {};
    }

    var expression = config["value"];
    if($A.util.isExpression(expression)) {
        expression = expression.getExpression();
    }
    if (!handlers[expression]) {
        handlers[expression] = [];
    }

    for(var i=0;i<handlers[expression].length;i++){
        if (handlers[expression][i]===config["method"] || (config["id"] && config["key"] && handlers[expression][i]["id"] === config["id"] && handlers[expression][i]["key"] === config["key"])) {
            return;
        }
    }
    handlers[expression].push(config["method"]);
};


/**
 * Delegates de-indexing logic to the wrapped value provider.
 * Likely delegating to a wrapped component.
 * @export
 */
PassthroughValue.prototype.deIndex = function () {
    var valueProvider = this.getComponent();

    // Potentially nested PassthroughValue objects.
    while (valueProvider instanceof PassthroughValue) {
        valueProvider = valueProvider.getComponent();
    }

    if (!valueProvider) {
        return;
    }

    valueProvider.deIndex.apply(valueProvider, arguments);
};

 /**
 * Fires handlers registered for the specified key when the value changes
 * @export
 */
PassthroughValue.prototype.fireChangeEvent = function(key, oldValue, value, index) {
    var handlers = this.handlers["change"];
    var observers=[];
    var keypath = key+".";
    for(var handler in handlers){
        if(handler === key || handler.indexOf(keypath) === 0 || key.indexOf(handler+".") === 0){
            observers=observers.concat(handlers[handler]);
        }
    }
    if (observers.length) {
        var eventDef = $A.get("e").getEventDef("aura:valueChange");
        var dispatcher = {};
        dispatcher[eventDef.getDescriptor().getQualifiedName()] = {"default":observers};
        var changeEvent = new Aura.Event.Event({
            "eventDef" : eventDef,
            "eventDispatcher" : dispatcher
        });

        changeEvent.setParams({
            "expression" : key,
            "value" : value,
            "oldValue" : oldValue,
            "index" : index
        });
        changeEvent.fire();
    }
};

/**
 * Returns the primary providers associated with the given key or the Component.
 * @param {String} key The data key to look up on the primary providers.
 * @export
 */
PassthroughValue.prototype.get = function(key) {
    if(!$A.util.isString(key)) {
        var msg = "The provided key (" + key + ") is not a string and cannot be used to look up values for the current component.";
        throw new $A.auraError(msg);
    }

    var path = key.split('.');
    if (this.primaryProviders.hasOwnProperty(path[0])){
        var value = null;
        if(path.length>1) {
            value=$A.expressionService.resolve(key, this.primaryProviders);
        }else{
            value=this.primaryProviders[key];
        }
        while($A.util.isExpression(value)){
            value = value.evaluate();
        }
        return value;
    } else {
        return this.component.get(key);
    }
};

/**
 * Returns the Component.
 * @export
 */
PassthroughValue.prototype.getComponent = function() {
    return this.component;
};

/**
 * Gets all the keys for the additional providers specified in the passthrough value.
 * @export
 * @return Array of keys
 */
PassthroughValue.prototype.getPrimaryProviderKeys = function() {
    return Object.keys(this.primaryProviders);
};

/**
 * Get the definition of the valueProvider component.
 * If the immediate value provider for this passthrough value is another passthrough value
 * it will resolve up the chain till it finds a valid component.
 */
PassthroughValue.prototype.getDef=function(){
    var valueProvider=this;
    while (valueProvider instanceof PassthroughValue) {
        valueProvider = valueProvider.getComponent();
    }
    return valueProvider.getDef();
};

/**
 * Passthrough's have extra providers that can reference other items of data.
 * If it's raw data, no problem. If it's another reference, you may want to
 * expand that reference. {row.value} could expand into {v.item.0.value} if row
 * is at index 0.
 * @param {String} expression The key to reference on the component, which will get expanded into the reference you were looking for.
 */
PassthroughValue.prototype.getExpression = function(expression) {
    var path = $A.util.isArray(expression)?expression:expression.split(".");

    if(this.primaryProviders.hasOwnProperty(path[0])){
        var provider = this.primaryProviders[path[0]];
        if(provider instanceof PassthroughValue) {
            return provider.getExpression(path);
        }

        if(provider instanceof PropertyReferenceValue) {
            path.splice(0, 1, provider.getExpression());
            return path.join(".");
        }
    }
    return expression;
};

/**
 * Returns a reference to a key on the the primary provider or the Component.
 * @param {String} key The data key for which to return a reference.
 * @export
 */
PassthroughValue.prototype.getReference = function(key) {
    key = aura.expressionService.normalize(key);
    var path = key.split('.');
    if (this.primaryProviders.hasOwnProperty(path[0])){
        if(!this.references.hasOwnProperty(key)){
            this.references[key]=new PropertyReferenceValue(key, this);
        }
        return this.references[key];
    } else {
        return this.component.getReference(key);
    }
};

/**
 * Delegates indexing logic to the wrapped value provider.
 * Likely delegating to a wrapped component.
 * @export
 */
PassthroughValue.prototype.index = function () {
    var valueProvider = this.getComponent();

    // Potentially nested PassthroughValue objects.
    while (valueProvider instanceof PassthroughValue) {
        valueProvider = valueProvider.getComponent();
    }

    if (!valueProvider) {
        return;
    }

    valueProvider.index.apply(valueProvider, arguments);
};

/**
 * Removes a handler for the specified type of event. Currently only supports
 * 'change'.
 * @export
 */
PassthroughValue.prototype.removeValueHandler = function(config) {
    var path = config.value.split(".");
    // KRIS: HALO:
    // Only value handlers for our values are added, everything else
    // gets passed to the component we are wrapping. So remove it there.
    if(!this.primaryProviders.hasOwnProperty(path[0])) {
        this.component.removeValueHandler(config);
        return;
    }

    var provider = this.primaryProviders[path[0]];
    if($A.util.isExpression(provider)) {
        // If the provider is a reference to another value, then we need to go into that reference, and
        // then get the value we actually want.
        // Think v.items in iteration, we want item.label to become v.items.0.label
        var reference = provider.getReference(path.slice(1).join('.'));
        if(reference) {
            reference.removeChangeHandler($A.getCmp(config["id"]), reference.getExpression());
            return;
        }
    }

    var event = config["event"];
    var handlers = this.handlers[event];
    if (handlers) {
        var expression = config["value"];
        if ($A.util.isExpression(expression)) {
            expression = expression.getExpression();
        }
        if (handlers[expression]) {
            for (var i = 0; i < handlers[expression].length; i++) {
                var method = handlers[expression][i];
                if (method===config["method"] || (config["id"] && config["key"] && method["id"] === config["id"] && method["key"] === config["key"])) {
                    handlers[expression].splice(i--, 1);
                }
            }
        }
    }
};

/**
 * Sets the value of the primary providers associated value.
 * @param {String} key The data key to look up on the primary providers.
 * @param {Object} v The value to be set.
 * @export
 */
PassthroughValue.prototype.set = function(key, value, ignoreChanges) {
    if (typeof key !== "string") {
        throw new $A.auraError("PassthroughValue.set: 'key' must be a string. Found " + key);
    }

    var path = key.split('.');

    if (this.primaryProviders.hasOwnProperty(path[0])){
        var provider = this.primaryProviders[path[0]];

        var fullPath = this.getExpression(key);
        var target=this.primaryProviders;
        var subKey = path.slice(1).join(".");

        key=path[path.length-1];

        if(path.length > 1 && $A.util.isExpression(provider)) {
            var reference = provider.getReference(subKey);
            if(reference) {
                reference.set(value);
                return undefined;
            }
        }


        if (path.length > 1) {
            target = $A.expressionService.resolve(path.slice(0, path.length - 1), target);
        }

        if (!target) {
            return undefined; // If the passthrough value is not set with data, return to avoid errors
        }

        var oldValue=target[key];
        target[key]=value;

        if(!ignoreChanges) {
	        var valueProvider = this.component;
	        while (valueProvider instanceof PassthroughValue) {
	            valueProvider = valueProvider.getComponent();
	        }

	        valueProvider.fireChangeEvent(fullPath,oldValue,value,fullPath);
	        valueProvider.markDirty(fullPath);


	        // KRIS: HALO:
	        // Do we have any change events for the key?
	        // It's possible both we and the component have references that need
	        // to be fired, so I'm firing both here.
	        this.fireChangeEvent(key,oldValue,value,key);
        }

        return value;
    }

    return this.component.set(key,value, ignoreChanges);
};

/**
 * Returns true if the referenced component has not been destroyed.
 */
PassthroughValue.prototype.isValid = function() {

    var valueProvider = this.getComponent();

    // Potentially nested PassthroughValue objects.
    while (valueProvider instanceof PassthroughValue) {
        valueProvider = valueProvider.getComponent();
    }

    if ($A.util.isComponent(valueProvider)) {
        return valueProvider.isValid();
    }

    return false;
};
