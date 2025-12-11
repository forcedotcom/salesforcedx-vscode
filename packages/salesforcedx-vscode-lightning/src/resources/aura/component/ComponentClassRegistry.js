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
 * A registry of Component classes.
 * @constructor
 */
function ComponentClassRegistry () {
    // We delay the creation of the definition of a class till it's requested.
    // The function that creates the component class is a classExporter.
    this.classExporter = {};

    // Collection of all the component classes we generate for
    // proper stack traces and proper use of prototypical inheritance
    this.classConstructors = {};
}

/**
 * By default all components will use Aura.Component.Component as the constructor.
 * This wires up all the features a component might need.
 * Some rootComponents are moving into the framework with custom Component extensions.
 * This map defines the constructor they use in buildConstructor
 */
ComponentClassRegistry.prototype.customConstructorMap = {
    /*eslint-disable no-undef*/
    "aura$text":TextComponent,
    "aura$html":HtmlComponent,
    "aura$expression": ExpressionComponent,
    "aura$if":IfComponent,
    "aura$iteration":IterationComponent,
    "aura$component":BaseComponent
};

/**
 * Detects if the component class exists without actually defining it.
 * @param {String} descriptor The qualified name of the component in the form markup://namespace:component
 */
ComponentClassRegistry.prototype.hasComponentClass = function(descriptor) {
    return descriptor in this.classExporter || descriptor in this.classConstructors;
};

/**
 * The function that handles definitions of component classes.
 * @param {String} descriptor in the form markup://namespace:component
 * @param {Function} exporter A function that when executed will return the component object litteral.
 * @export
 */
ComponentClassRegistry.prototype.addComponentClass = function(descriptor, exporter){
    $A.assert($A.util.isString(descriptor), "Component class descriptor is invalid: " + descriptor);
    $A.assert($A.util.isFunction(exporter), "Component class exporter is not a function: " + descriptor);
    if (!this.hasComponentClass(descriptor)) {
        this.classExporter[descriptor] = exporter;
    }
};

/**
 * Get or build the class constructor for the specified component.
 * @param {String} descriptor in the form markup://namespace:component
 * @returns Either the class that defines the component you are requesting, or undefined if not found.
 * @export
 */
ComponentClassRegistry.prototype.getComponentClass = function(descriptor, def) {
    var storedConstructor = this.classConstructors[descriptor];
    if (!storedConstructor) {
        var exporter = this.classExporter[descriptor];
        if (exporter) {
            var componentProperties = exporter();
            storedConstructor = this.buildComponentClass(componentProperties);
            this.classConstructors[descriptor] = storedConstructor;
            // No need to keep the exporter in memory.
            this.classExporter[descriptor] = null;
        } else if (def && def.interop) {
            return this.buildInteropComponentClass(descriptor, def);
        }
    }

    return storedConstructor;
};

ComponentClassRegistry.prototype.buildInteropComponentClass = function(descriptor, def) {
    var interopClass = Aura.Component.InteropModule;

    if (def.hasElementConstructor()) {
        // module library is object. component is function
        interopClass = Aura.Component.InteropComponent;
    }

    var interopCmpClass = this.buildConstructor({ "interopClass" : def.interopClass, "interopCtor": def.interopCtor }, def.interopClassName, interopClass);
    this.classConstructors[descriptor] = interopCmpClass;
    return interopCmpClass;
};

/**
 * Build the class for the specified component.
 * This process is broken into subroutines for clarity and maintainabiity,
 * and those are all combined into one single scope by the compiler.
 * @param {Object} componentProperties The pre-built component properties.
 * @returns {Function} The component class.
 */
ComponentClassRegistry.prototype.buildComponentClass = function(componentProperties) {

    this.buildInheritance(componentProperties);
    this.buildLibraries(componentProperties);
    var componentConstructor = this.buildConstructor(componentProperties);

    return componentConstructor;
};


/**
 * Augment the component class properties with their respective inheritance. The
 * inner classes are "static" classes. Currently, only the helper is inherited.
 * @param {Object} componentProperties The pre-built component properties.
 */
ComponentClassRegistry.prototype.buildInheritance = function(componentProperties) {

    var superDescriptor = componentProperties["meta"]["extends"];
    var superConstructor = this.getComponentClass(superDescriptor);

    componentProperties["controller"] = componentProperties["controller"] || {};
    var superController = superConstructor && superConstructor.prototype["controller"];

    if (superController) {
        componentProperties["controller"] = Object.assign(
            Object.create(superController),
            componentProperties["controller"]
        );
    }

    componentProperties["helper"] = componentProperties["helper"] || {};
    var superHelper = superConstructor && superConstructor.prototype["helper"];

    if (superHelper) {
        componentProperties["helper"] = Object.assign(
            Object.create(superHelper),
            componentProperties["helper"]
        );
    }
};

/**
 * Augment the component class properties with the component libraries. This method
 * attached the component imports (a.k.a. "libraries") on the properties.
 * @param {Object} componentProperties The pre-built component properties.
 */
ComponentClassRegistry.prototype.buildLibraries = function(componentProperties) {

    var componentImports = componentProperties["meta"]["imports"];
    if (componentImports) {
        var helper = componentProperties["helper"];
        for (var property in componentImports) {
            var descriptor = componentImports[property];
            var library = $A.componentService.getLibrary(descriptor);
            if (!library) {
                try {
                    library = $A.componentService.evaluateModuleDef(descriptor);
                } catch (e) {
                    // ignore module not found
                }
            }
            helper[property] = library;
        }
        componentProperties["helper"] = helper;
    }
};

/**
 * Build the class constructor for the specified component.
 * @param {Object} componentProperties The pre-built component properties.
 * @returns {Function} The component class.
 */

ComponentClassRegistry.prototype.buildConstructor = function(componentProperties, name, Ctor) {
    // Create a named function dynamically to use as a constructor.
    // TODO: Update to the following line when all browsers have support for dynamic function names.
    // (only supported in IE11+).
    // var componentConstructor = function [className](){ Component.apply(this, arguments); };
    var componentConstructor;
    var className = name || componentProperties["meta"]["name"];
    Ctor = Ctor || this.customConstructorMap[className] || Component;

    //#if {"modes" : ["PRODUCTION", "PRODUCTIONDEBUG", "PERFORMANCEDEBUG"]}
    componentConstructor = function(config) {
        Ctor.call(this, config);
    };
    //#end

    //#if {"excludeModes" : ["PRODUCTION", "PRODUCTIONDEBUG", "PERFORMANCEDEBUG"]}
    var createConstructor = $A.util.globalEval("function(Ctor) {return function " + className + "(config) { Ctor.call(this, config); }}");
    componentConstructor = createConstructor(Ctor);
    //#end

    // Extends from Component (and restore constructor).
    componentConstructor.prototype = Object.create(Ctor.prototype);
    componentConstructor.prototype.constructor = componentConstructor;

    // Mixin inner classes (controller, helper, renderer, provider) and meta properties.
    // Some components will already have this defined in their Component class, so don't overwrite if it is already defined.
    var constructorPrototype = componentConstructor.prototype;
    for(var key in componentProperties) {
        if(constructorPrototype[key] === undefined){
            constructorPrototype[key] = componentProperties[key];
        }
    }

    return componentConstructor;
};

Aura.Component.ComponentClassRegistry = ComponentClassRegistry;
