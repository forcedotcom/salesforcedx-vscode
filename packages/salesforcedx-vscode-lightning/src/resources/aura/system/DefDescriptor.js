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
 * @description Creates a new DefDescriptor (definition descriptor) instance, including the prefix and namespace.
 * @constructor
 * @param {Object} descriptor Throws an error if descriptor is null or undefined.
 * @export
 */
function DefDescriptor(descriptor){
    var prefix=DefDescriptor.normalize(descriptor).split("://");
    var namespace=prefix[1].split(/[:.]/);
    var hasNamespace=namespace.length>1;
    var separator=hasNamespace?prefix[1].indexOf(':')>-1?':':'.':'';

    this.prefix=prefix[0];
    this.namespace=hasNamespace?namespace[0]:'';
    this.name=namespace[hasNamespace?1:0];
    //this.qualifiedName=$A.util.format("{0}://{1}{2}{3}",this.prefix,this.namespace,separator,this.name);
    this.fullName = this.namespace+separator+this.name;
    this.qualifiedName = this.prefix+"://"+this.fullName;
}

// Static Members
DefDescriptor.DESCRIPTOR="descriptor";

DefDescriptor.normalize=function(descriptor){
    if(descriptor&&descriptor.hasOwnProperty(DefDescriptor.DESCRIPTOR)){
        descriptor=descriptor[DefDescriptor.DESCRIPTOR];
    }
    if(!descriptor){
        throw new $A.auraError("DefDescriptor.normalize(): 'descriptor' must be a valid config Object or String.", null, $A.severity.QUIET);
    }
    if((descriptor+'').indexOf("://")<0){
        descriptor="markup://"+descriptor;
    }
    return descriptor;
};

/**
 * Gets the qualified name.
 * @returns {String}
 * @export
 */
DefDescriptor.prototype.getQualifiedName = function(){
    return this.qualifiedName;
};

/**
 * Gets the full name.
 * @returns {String}
 * @export
 */
DefDescriptor.prototype.getFullName = function(){
    return this.fullName;
};

/**
 * Gets the namespace.
 * @returns {String} namespace
 * @export
 */
DefDescriptor.prototype.getNamespace = function(){
    return this.namespace;
};

/**
 * Gets the name part of the qualified name.
 * @returns {String}
 * @export
 */
DefDescriptor.prototype.getName = function(){
    return this.name;
};

/**
 * Gets the prefix of the DefDescriptor.
 * @returns {String}
 * @export
 */
DefDescriptor.prototype.getPrefix = function(){
    return this.prefix;
};

/**
 * Returns the qualified name in string format.
 * @returns {String}
 * @export
 */
DefDescriptor.prototype.toString = function(){
    return this.getQualifiedName();
};

Aura.System.DefDescriptor = DefDescriptor;
