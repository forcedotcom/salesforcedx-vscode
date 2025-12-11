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
 *
 * @constructor
 */
function TypeDefRegistry(){
    this.typeDefs = {};
}

TypeDefRegistry.prototype.getDef = function(config) {
    $A.assert(config, "TypeDef Config required for registration");
    // We don't re-register (or modify in any way) once we've registered
    var descriptor = config["descriptor"];
    var ret = this.typeDefs[descriptor];
    if (!ret) {
        ret = new TypeDef(config);
        this.typeDefs[ret.getDescriptor().toString()] = ret;
    }
    return ret;
};
