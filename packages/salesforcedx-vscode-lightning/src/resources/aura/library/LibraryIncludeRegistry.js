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
 * A registry of library includes.
 * Includes are similar to RequireJS's modules. The difference is their comsumption:
 * in Aura, those are exported as items on library s instead of inside a require callback.
 * We delay the creation of the instance of a library include untill it's requested.
 * @constructor
 */
function LibraryIncludeRegistry() {
    // A map of Function that holds a preproccessed (commented) instance.
    this.libExporter = {};
    // A map of Function[] that each return a library include instance.
    this.exporter = {};

    // A map of String[] that define the library include dependencies.
    this.dependencies = {};

    // A map of Object[] that define the library include dependencies (the resolved dependencies).
    this.dependenciesInstances = {};

    // A maps of Object that contain the library include instances.
    this.instance = {};

    // A String[] that contains dependencied currently being processed.
    this.dependencyQueue = [];

    // Boolean to indicate if the queue has changed during an iteration.
    this.dependencyQueueChanged = false;
}

/**
 * Detects if the library include exists without actually defining it.
 * @param {String} descriptor The qualified name of the library include in the form markup://namespace:include
 */
LibraryIncludeRegistry.prototype.hasLibraryInclude = function(descriptor) {
    return descriptor in this.exporter || descriptor in this.instance;
};

/**
 * The function that handles definitions of library includes. This works like a simplfied version of
 * RequireJS's "define" function with a fixed set of arguments.
 * @param {String} descriptor name of the include.
 * @param {Array} dependencies The list of dependencies (other includes).
 * @param {Function} exporter A function that when executed will return the include object.
 */
 LibraryIncludeRegistry.prototype.addLibraryInclude = function(descriptor, dependencies, exporter) {
    $A.assert($A.util.isString(descriptor), "Include descriptor is invalid: " + descriptor);
    $A.assert($A.util.isFunction(exporter), "Include exporter is not a function: " + descriptor);
    if (!this.hasLibraryInclude(descriptor)) {
        this.exporter[descriptor] = exporter;
        this.dependencies[descriptor] = dependencies;
        this.dependenciesInstances[descriptor] = [];
    }
};

/**
 * The function that handles definitions of library includes.
 * @param {String} descriptor name of the include.
 * @param {Function} exporter A function that when executed will return the include object.
 */
LibraryIncludeRegistry.prototype.addLibraryExporter = function(descriptor, exporter) {
    this.libExporter[descriptor] = exporter;
};


/**
 * Get or build the instance for the specified library include. his works like a simplfied version of
 * RequireJS's "require" function, without a callback.
 * @param {String} descriptor in the form markup://namespace:include.
 * @returns Either the instance of the include you are requesting, or undefined if not found.
 * @export
 */
LibraryIncludeRegistry.prototype.getLibraryInclude = function(descriptor) {
    var instance;

    if (descriptor in this.instance) {
        instance = this.instance[descriptor];
    } else {
        // Reset the queue from any previous failed runs.
        this.clearDependencyQueue();

        // If we don't have an instance, schedule it for addition.
        this.enqueueDependency(descriptor);

        while(this.hasDependencyQueue()) {
            // Clone the array so we can add & delete at will.
            var queue = this.cloneDependencyQueue();

            for (var i = 0; i < queue.length; i++) {
                var dependency = queue[i];

                // If the instance doesn't exit, try to build it.
                instance = this.buildLibraryInclude(dependency);
            }

            if (!this.hasDependencyQueueChanged()) {
                throw new Error("Cannot solve library include dependencies: " + descriptor);
            }
        }

    }

    return instance;
};

LibraryIncludeRegistry.prototype.hydrateLibrary = function(descriptor, exporter) {

    var script = $A.clientService.uncommentExporter(exporter);
    exporter = $A.clientService.evalExporter(script, descriptor, 'lib');

    if(!exporter) {
        var defDescriptor = new Aura.System.DefDescriptor(descriptor);
        var includeComponentSource = $A.clientService.isInternalNamespace(defDescriptor.getNamespace());
        var errorMessage = (!includeComponentSource) ?
            "Hydrating the component" + descriptor + " failed." :
            "Hydrating the component" + descriptor + " failed.\n Exporter code: " + script;
        var auraError = new $A.auraError(errorMessage, null, $A.severity.QUIET);
        auraError.setComponent(descriptor);
        throw auraError;
    }

    return exporter();
};

/**
 * Try to build an instance for the specified library include.
 * @param {Array} dependencies The list of descriptors markup://namespace:include.
 * @returns {Array} the list of instances or undefined.
 */
LibraryIncludeRegistry.prototype.buildLibraryInclude = function(descriptor) {
    if (this.libExporter[descriptor]) {
        this.hydrateLibrary(descriptor, this.libExporter[descriptor]);
        delete this.libExporter[descriptor];
    }

    var resolved = true;
    // Attempt to resolve missing dependencies for the requested descriptor.
    var dependencies = this.dependencies[descriptor] || [];
    var dependenciesInstances = this.dependenciesInstances[descriptor] || [];
    for (var i = 0; i < dependencies.length; i++) {

        // If we don't have the instance
        if (!dependenciesInstances.hasOwnProperty(i)) {

            // If the include instance exists, update the dependency instances with it.
            var dependency = dependencies[i];
            if (this.instance.hasOwnProperty(dependency)) {
                dependenciesInstances[i] = this.instance[dependency];
            }

            // Dependecies is missing, schedule it for addition.
            else {
                this.enqueueDependency(dependency);
                resolved = false;
            }
        }
    }

    // build the include.
    if (resolved) {
        var exporter = this.exporter[descriptor];
        if (!$A.util.isFunction(exporter)) {
            throw new Error("Library include not defined: " + descriptor);
        }

        // Store the created include instance and mark it resolved.
        var instance = exporter.apply({}, dependenciesInstances);
        this.instance[descriptor] = instance;
        this.dequeueDependency(descriptor);

        // Remove the exporter from memory.
        delete this.exporter[descriptor];

        return instance;
    }
};

/**
 * Reset the queue.
 */
LibraryIncludeRegistry.prototype.clearDependencyQueue = function() {
    this.dependencyQueue = [];
};

/**
 * Add a dependcy to the processing queue.
 * @param {String} descriptor The qualified name of the library include in the form markup://namespace:include
 */
LibraryIncludeRegistry.prototype.enqueueDependency = function(descriptor) {
    var index = this.dependencyQueue.indexOf(descriptor);
    if (index < 0) {
        this.dependencyQueue.unshift(descriptor);
        this.dependencyQueueChanged = true;
    }
};

/**
 * Remove a dependcy from the processing queue.
 * @param {String} descriptor The qualified name of the library include in the form markup://namespace:include
 */
LibraryIncludeRegistry.prototype.dequeueDependency = function(descriptor) {
    var index = this.dependencyQueue.indexOf(descriptor);
    if (index >= 0) {
        this.dependencyQueue.splice(index, 1);
        this.dependencyQueueChanged = true;
    }
};

/**
 * Clone the array of dependencies and reset the changed flag.
 * @return {Array} The cloned array of dependecies.
 */
LibraryIncludeRegistry.prototype.cloneDependencyQueue = function() {
    var queue = this.dependencyQueue.slice(0);
    this.dependencyQueueChanged = false;
    return queue;
};

/**
 * Return the modified status of the dependency queue.
 * @return {Boolean} True if the dependency queue has changed.
 */
LibraryIncludeRegistry.prototype.hasDependencyQueue = function() {
    return this.dependencyQueue.length > 0;
};

/**
 * Return the modified status of the dependency queue.
 * @return {Boolean} True if the dependency queue has changed.
 */
LibraryIncludeRegistry.prototype.hasDependencyQueueChanged = function() {
    return this.dependencyQueueChanged;
};

Aura.Library.LibraryIncludeRegistry = LibraryIncludeRegistry;
