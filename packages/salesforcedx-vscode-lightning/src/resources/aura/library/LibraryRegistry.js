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
 * A registry to combine library definitions and library instance.
 * @constructor
 */
function LibraryRegistry() {
    // The map of incudes define each library. A single item is itself a map of exports and include definitions.
    this.libraries = {};

    // The maps of library instances.
    this.instance = {};
}

/**
 * Init library definitions.
 * @param {Array} Library definitions.
 * @export
 */
LibraryRegistry.prototype.initLibraries = function(libraries) {
    $A.assert($A.util.isEmpty(this.libraries), "Library registry already initialized.");
    $A.assert($A.util.isArray(libraries), "Library registry must be initialized with an array.");
    this.libraries = libraries;
};

/**
 * Detects if the library exists without actually defining it.
 * @param {String} descriptor The qualified name of the library in the form markup://namespace:library
 */
LibraryRegistry.prototype.hasLibrary = function(descriptor) {
    return descriptor in this.libraries || descriptor in this.instance;
};

/**
 * Register a library defintion. A library is a collection of includes.
 * @param {String} descriptor The qualified name of the library in the form markup://namespace:library
 * @param {Object} includes Pairs of library export and include definitions.
 */
LibraryRegistry.prototype.addLibrary = function(descriptor, includes) {
    $A.assert($A.util.isString(descriptor), "Library descriptor is invalid: " + descriptor);
    $A.assert($A.util.isObject(includes), "Library includes must be an array: " + descriptor);
    if (!this.hasLibrary(descriptor)) {
        this.libraries[descriptor] = includes;
    }
};

/**
 * Returns a library from the registry. If the library is missing,
 * build the library before returning it.
 * @param {String} descriptor The qualified name of the library in the form markup://namespace:library
 * @returns {Object} library from registry.
 */
LibraryRegistry.prototype.getLibrary = function(descriptor) {

    var instance = this.instance[descriptor];

    if (!instance) {
        var includes = this.libraries[descriptor];
        if (includes) {
            instance = this.buildLibrary(includes);
            this.instance[descriptor] = instance;
            // Register it also as a module
            $A.componentService.addModule(descriptor, descriptor, [], null, instance);
        }
    }

    return instance;
};

/**
 * Returns a library instance which is a map of library include instances.
 * @param {Array} includes The map of incudes, export and descriptor pairs.
 * @returns {Object} new library.
 */
 LibraryRegistry.prototype.buildLibrary = function(includes) {

    var instance = {};

    for (var key in includes) {
        if (includes.hasOwnProperty(key)) {
            var descriptor = includes[key];
            instance[key] = $A.componentService.getLibraryInclude(descriptor);
        }
    }

    return instance;
};

Aura.Library.LibraryRegistry = LibraryRegistry;