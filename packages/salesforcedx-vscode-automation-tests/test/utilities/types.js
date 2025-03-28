"use strict";
/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectShapeOption = void 0;
var ProjectShapeOption;
(function (ProjectShapeOption) {
    ProjectShapeOption[ProjectShapeOption["NONE"] = 0] = "NONE";
    ProjectShapeOption[ProjectShapeOption["ANY"] = 1] = "ANY";
    ProjectShapeOption[ProjectShapeOption["NEW"] = 2] = "NEW";
    ProjectShapeOption[ProjectShapeOption["NAMED"] = 3] = "NAMED"; // tests will be run on a well-known test project once wdio is initialized
})(ProjectShapeOption || (exports.ProjectShapeOption = ProjectShapeOption = {}));
