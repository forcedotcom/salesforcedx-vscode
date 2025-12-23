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
 * @description The Aura Expression Service, accessible using <code>$A.expressionService</code>.
 * Processes expressions.
 * @constructor
 * @export
 */
function AuraExpressionService() {
    this.references={};
}

AuraExpressionService.PRIMITIVE_SEPARATOR = "__";
AuraExpressionService.AURA_IF = "aura:if";
AuraExpressionService.AURA_ITERATION = "aura:iteration";

AuraExpressionService.prototype.getReference = function (expression, valueProvider) {
    expression = $A.expressionService.normalize(expression);
    var isGlobal=expression.charAt(0)==='$';
    var target = null;
    if (isGlobal) {
        target = this.references;
    }else{
        var id = valueProvider.getGlobalId();
        if (!this.references.hasOwnProperty(id)) {
            this.references[id] = {};
        }
        target = this.references[id];
    }
    if (!target.hasOwnProperty(expression)) {
        target[expression] = {reference:new PropertyReferenceValue(expression, isGlobal?null:valueProvider),consumers:{}};
    }
    return target[expression].reference;
};

AuraExpressionService.prototype.clearReferences=function(valueProvider){
    if($A.util.isComponent(valueProvider)){
        var globalId=valueProvider.getGlobalId();
        var target=this.references[globalId];
        if(target){
            for(var expression in target){
                var reference=target[expression];
                if(reference&&reference.consumers){
                    for(var consumer in reference.consumers){
                        var component=$A.getComponent(consumer);
                        for(var targetExpression in reference.consumers[consumer]){
                            component.clearReference(targetExpression);
                        }
                    }
                }
            }
        }
        delete this.references[globalId];
    }
};

// JBUCH: TODO: THIS WAS FIRST ATTEMPT AT UNIFYING PRVs
//AuraExpressionService.prototype.updateReference = function (expression, valueProvider) {
//    expression = $A.expressionService.normalize(expression);
//    var reference=null;
//    if($A.util.isComponent(valueProvider)){
//        var target=this.references[valueProvider.getGlobalId()];
//        reference=target&&target[expression];
//    }else{
//        reference=this.references[expression];
//    }
//    if(reference){
//        for(var consumer in reference.consumers){
//            var component=$A.getComponent(consumer);
//            for(var targetExpression in reference.consumers[consumer]){
//                component.markDirty(targetExpression);
//            }
//        }
//    }
//};
//
//AuraExpressionService.prototype.updateReferences = function (expression, valueProvider) {
//    expression = $A.expressionService.normalize(expression);
//    var reference=null;
//    if($A.util.isComponent(valueProvider)){
//        var target=this.references[valueProvider.getGlobalId()];
//        reference=target&&target[expression];
//    }else{
//        reference=this.references[expression];
//    }
//    if(reference){
//        for(var consumer in reference.consumers){
//            var component=$A.getComponent(consumer);
//            for(var targetExpression in reference.consumers[consumer]){
//                component.markDirty(targetExpression);
//            }
//        }
//    }
//};

//JBUCH: TODO: FIXME: HACK
AuraExpressionService.prototype.updateGlobalReference = function (expression, oldValue, value) {
    expression = $A.expressionService.normalize(expression);
    var reference=this.references[expression];
    if(reference&&reference.consumers&&reference.reference&&reference.reference.lastResult!==value){
        reference.reference.evaluate();
        for(var consumer in reference.consumers){
            var component=$A.getComponent(consumer);
            if (component) {
                for(var targetExpression in reference.consumers[consumer]){
                    component.markDirty(targetExpression);
                    component.fireChangeEvent(targetExpression,reference.reference.lastResult||oldValue,value);
                }
            }
        }
    }
};

AuraExpressionService.prototype.updateGlobalReferences = function (type, newValues) {
    var gvpValues = $A.get(type);

    function updateNestedValue(expression, values, newValuesInside){
        if(!values) {
            values = {};
        }

        for(var value in newValuesInside){
            var targetExpression=expression+'.'+value;
            $A.expressionService.updateGlobalReference(targetExpression,values[value],newValuesInside[value]);
            if($A.util.isObject(newValuesInside[value])){
                updateNestedValue(targetExpression, values[value], newValuesInside[value]);
            }
        }
    }

    updateNestedValue(type, gvpValues, newValues);
};

AuraExpressionService.prototype.addExpressionListener = function (reference, expression, valueProvider) {
    expression = $A.expressionService.normalize(expression);
    var consumers=null;
    if(reference.valueProvider){
        consumers=this.references[reference.valueProvider.getGlobalId()][reference.expression].consumers;
    }else{
        consumers=this.references[reference.expression].consumers;
    }
    var globalId=valueProvider.getGlobalId();
    if(!consumers.hasOwnProperty(globalId)){
        consumers[globalId]={};
    }
    consumers[globalId][expression]=true;
};

AuraExpressionService.prototype.removeExpressionListener = function (reference, expression, valueProvider) {
    expression = $A.expressionService.normalize(expression);
    var consumers = null;
    if (reference.valueProvider) {
        consumers = this.references[reference.valueProvider.getGlobalId()][reference.expression].consumers;
    } else {
        consumers = this.references[reference.expression].consumers;
    }
    var globalId = valueProvider.getGlobalId();
    if (consumers.hasOwnProperty(globalId)) {
        delete consumers[globalId][expression];
        if(!Object.keys(consumers[globalId]).length){
            delete consumers[globalId];
        }
    }
};
/**
 * @export
 */
AuraExpressionService.prototype.create = function(valueProvider, config) {
    return valueFactory.create(config, valueProvider);
};

/**
 * @deprecated Use <code>component.addValueProvider(String key, Object valueProvider)</code> instead.
 * @export
 */
    // TODO: unify with above create method
AuraExpressionService.prototype.createPassthroughValue = function(primaryProviders, cmp) {
    return new PassthroughValue(primaryProviders, cmp);
};


/**
 * Trims markup syntax off a given string expression, removing
 * expression notation, and array notation.
 *
 * @param {Object}
 *            expression The expression to be normalized.
 * @returns {Object} The normalized string, or the input parameter, if
 *          it was not a string.
 * @export
 */
AuraExpressionService.prototype.normalize = function(expression) {

    if (typeof expression === "string") {

        expression = expression.trim();

        // Remove leading {! and {# as well as trailing } notation.
        if (expression.charAt(0) === "{" && expression.charAt(expression.length - 1) === "}" &&
            (expression.charAt(1) === "!" || expression.charAt(1) === "#")) {

            expression = expression.slice(2, -1).trim();
        }

        // Convert array notation from "attribute[index]" to "attribute.index".
        var startBrace = expression.indexOf('[');
        while(startBrace > -1){
            var endBrace = expression.indexOf(']', startBrace + 1);
            if (endBrace > -1) {
                expression = expression.substring(0, startBrace) +
                    '.' + expression.substring(startBrace + 1, endBrace) +
                    expression.substring(endBrace + 1);
                startBrace = expression.indexOf('[', endBrace - 1);
            } else {
                startBrace = -1;
            }
        }
    }

    return expression;
};

/**
 * Resolves a hierarchical dot expression in string form against the
 * provided object if possible.
 *
 * @param {String}
 *            expression The string expression to be resolved.
 * @param {Object}
 *            container The object against which to resolve the
 *            expression.
 * @param {Boolean}
 *            rawValue Whether or not to evaluate expressions.
 * @returns {Object} The target of the expression, or undefined.
 * @export
 */
AuraExpressionService.prototype.resolve = function(expression, container, rawValue) {
    var target = container;
    var path = expression;
    if(!$A.util.isArray(path)) {
        path = path.split('.');
    }
    var segment;
    while (!$A.util.isUndefinedOrNull(target) && path.length) {
        segment = path.shift();
        //#if {"modes" : ["DEVELOPMENT"]}
        if(!target["hasOwnProperty"](segment)) {
            var searchkey = segment.toLowerCase();
            for(var key in target){
                if(target.hasOwnProperty(key) && key.toLowerCase() === searchkey) {
                    // You can't include container and target in the error, as it will json serialize it and causes a max iteration exception.
                    throw new $A.auraError("Possible Case Sensitivity Issue: Expression '" + expression + "' on segment '" + segment + "'. Possible you meant '" + key + "'");
                }
            }
        }
        //#end

        target = target[segment];

        if (!rawValue&&$A.util.isExpression(target)) {
            target = target.evaluate();
        }
    }
    return target;
};

/**
 * @param cmp - component
 * @param locatorDef - LocatorDef defined in cmp
 *
 * Resolves values within a locatorContext inside a locatorDef.
 * @private
 */
AuraExpressionService.prototype.resolveLocatorContext = function (cmp, locatorDef) {
    if (!locatorDef) {
        return undefined;
    }

    var contextDefs = locatorDef["context"];
    if (!contextDefs) {
        return undefined;
    }

    var context = {};
    if (cmp.isValid()) {
        try {
            $A.clientService.setCurrentAccess(cmp);
            for (var key in contextDefs) {
                var expression = this.create(cmp, contextDefs[key]);
                if (expression) {
                    context[key] = typeof expression === "string" ? expression : expression.evaluate();
                }
            }
        } finally {
            $A.clientService.releaseCurrentAccess();
        }
    }
    return context;
};

/**
 * Returns the component that cmp is contained in
 * @param cmp - component
 *
 * @returns The component that contains cmp, bypassing if/iteration in the chain
 */
AuraExpressionService.prototype.getContainer = function (cmp) {
    if (!cmp) {
        return undefined;
    }

    // TODO mrafique: Manually checking for aura:iteration or aura:if is a hack. Ideally, getOwner()
    //    or another API would always return the proper container.
    //    based on advice from jbuch
    var owner = cmp.getOwner();
    var ownerName = owner.getType();
    var prevOwner = undefined;
    while ( ownerName === AuraExpressionService.AURA_ITERATION ||
            ownerName === AuraExpressionService.AURA_IF ||
            owner.isInstanceOf('ui:virtualComponent') ||
            owner.isInstanceOf('ui:abstractList') ||
            owner.isInstanceOf('ui:abstractDataGrid')) {
        owner = owner.getOwner();
        ownerName = owner.getType();
        if (owner === prevOwner) {
            break;
        }
        prevOwner = owner;
    }
    
    return owner;
};

/**
 * Returns a locatorDef targeting targetId inside cmp or it's super chain
 * @param cmp - component
 * @param targetId - targetId of locator def
 *
 * @returns Any locator definition found in the super chain of a component
 * @private
 */
AuraExpressionService.prototype.findLocatorDefInSuperChain = function (cmp, targetId) {
    var locatorDefs;
    var locatorDef;
    while (!locatorDef && cmp) {
        locatorDefs = cmp.getDef().getLocatorDefs();
        locatorDef = locatorDefs && (locatorDefs[targetId] || locatorDefs["*"]);
        if (!locatorDef) {
            cmp = cmp.getSuper();
        }
    }
    return locatorDef;
};

/**
 * @param component The component that contains the locator targeting root
 * @param root Starting point of component hierarchy that requires resolving
 * @param includeMetadata Log additional metadata about the component name
 * @param primitiveFound The ID of the primitive if any that's been found
 * @returns This will produce a locator that combines information as such:
 *          + root localId as target with context provided by parent->root locator
 *          + parent localId as scope with context provided by grandparent->parent locator
 */
AuraExpressionService.prototype.resolveLocator = function (parent, root, includeMetadata, primitiveFound) {
    var locator;
    var parentId = parent && parent.getLocalId();
    var rootId = root && root.getLocalId();

    if (!rootId) {
        return locator;
    }

    // We need to look at the linkage via super-chain in case the parent is extended
    var rootLocatorDef = this.findLocatorDefInSuperChain(parent, rootId);

    // figure out if we need to jump another level for locators marked as primitive
    if (!primitiveFound && rootLocatorDef && rootLocatorDef["isPrimitive"]) {
        primitiveFound =  {};
        primitiveFound["target"] = rootLocatorDef["alias"] || rootId;
        primitiveFound["resolvedContext"] = this.resolveLocatorContext(parent, rootLocatorDef);
        root = parent;
        parent = this.getContainer(parent).getConcreteComponent();
        return this.resolveLocator(parent, root, includeMetadata, primitiveFound);
    }

    var grandparent = this.getContainer(parent).getConcreteComponent();

    var parentLocatorDef = this.findLocatorDefInSuperChain(grandparent, parentId);

    if (!rootLocatorDef || !parentLocatorDef) {
        return locator;
    }

    locator = {};

    var rootContext = this.resolveLocatorContext(parent, rootLocatorDef);
    var parentContext = this.resolveLocatorContext(grandparent, parentLocatorDef);
    var primitiveContext = primitiveFound && primitiveFound["resolvedContext"];

    var context = $A.util.apply(parentContext || {}, rootContext);
    // any keys in primitiveContext will get overridden by higher levels
    context = $A.util.apply(context, primitiveContext);

    if (!$A.util.isEmpty(context)) {
        locator["context"] = context;
    }

    // Apply aliases from target and scope as needed
    locator["target"] = rootLocatorDef["alias"] || rootId;
    locator["scope"] = parentLocatorDef["alias"] || parentId;

    if (primitiveFound) {
        locator["target"] = locator["target"] + AuraExpressionService.PRIMITIVE_SEPARATOR + primitiveFound["target"];
    }

    // TODO - W-3378426 - put this in javascript directive to block out the if{} block in PROD mode
    if (includeMetadata) {
        locator["metadata"] = {
                "root" : root.getDef().toString(),
                "rootId" : rootId,
                "parent" : parent.getDef().toString(),
                "parentId" : parentId,
                "grandparent" : grandparent.getDef().toString()
        };
        if (rootLocatorDef["description"]) {
            locator["metadata"]["targetDescription"] = rootLocatorDef["description"];
            locator["metadata"]["scopeDescription"] =  parentLocatorDef["description"];
        }
    }
    return locator;
};

Aura.Services.AuraExpressionService = AuraExpressionService;
