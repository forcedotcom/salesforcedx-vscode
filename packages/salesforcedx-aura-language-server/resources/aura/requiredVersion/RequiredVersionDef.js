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
 * Creates a new RequiredVersionDef instance, including the descriptor.
 * @constructor
 * @param {Object} config
 */
function RequiredVersionDef(config){
    this.descriptor = new DefDescriptor(config["namespace"]);
    this.namespace = config["namespace"];
    this.version = config["version"];
}

/**
 * Gets the descriptor. Returns a DefDescriptor object that contains the metadata for the attribute.
 * @returns {DefDescriptor} The qualified name for a DefDescriptor object has the format <code>prefix://namespace:name</code>.
 */
RequiredVersionDef.prototype.getDescriptor = function(){
    return this.descriptor;
};

/**
 * Gets the namespace.
 * @returns {String}
 */
RequiredVersionDef.prototype.getNamespace = function(){
    return $A.util.copy(this.namespace);
};

/**
 * Gets the version.
 * @returns {String}
 */
RequiredVersionDef.prototype.getVersion = function(){
    return $A.util.copy(this.version);
};