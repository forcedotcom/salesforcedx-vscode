"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCliCommand = runCliCommand;
exports.deleteScratchOrg = deleteScratchOrg;
exports.orgLoginSfdxUrl = orgLoginSfdxUrl;
exports.orgDisplay = orgDisplay;
exports.orgList = orgList;
exports.aliasList = aliasList;
exports.scratchOrgCreate = scratchOrgCreate;
exports.setAlias = setAlias;
exports.installJestUTToolsForLwc = installJestUTToolsForLwc;
exports.createUser = createUser;
exports.removeEscapedCharacters = removeEscapedCharacters;
exports.generateSfProject = generateSfProject;
var cross_spawn_1 = require("cross-spawn");
var child_process_1 = require("child_process");
var miscellaneous_1 = require("./miscellaneous");
var environmentSettings_1 = require("../environmentSettings");
function runCliCommand(command) {
    var args = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        args[_i - 1] = arguments[_i];
    }
    return __awaiter(this, void 0, void 0, function () {
        var commandArgs, hadJsonFlag, options, message, logLevel;
        var _a;
        return __generator(this, function (_b) {
            commandArgs = args.filter(function (arg) { return typeof arg === 'string'; });
            hadJsonFlag = commandArgs.some(function (arg) { return arg === '--json'; });
            options = args.find(function (arg) { return typeof arg !== 'string'; });
            message = "running CLI command ".concat(command, " ").concat(commandArgs.join(' '));
            if (options) {
                message += "\nspawn options: ".concat(JSON.stringify(options));
            }
            logLevel = environmentSettings_1.EnvironmentSettings.getInstance().logLevel;
            (0, miscellaneous_1.log)(message);
            // add NODE_ENV=production
            options = __assign(__assign({}, (options !== null && options !== void 0 ? options : {})), { env: __assign(__assign(__assign({}, process.env), { NODE_ENV: 'production', SF_LOG_LEVEL: logLevel }), ((_a = options === null || options === void 0 ? void 0 : options.env) !== null && _a !== void 0 ? _a : {}) // Ensure any additional env vars in options are included
                ) });
            return [2 /*return*/, new Promise(function (resolve, reject) {
                    var _a, _b;
                    var sfProcess = (0, cross_spawn_1.default)('sf', __spreadArray([command], commandArgs, true), options);
                    var stdout = '';
                    var stderr = '';
                    (_a = sfProcess.stdout) === null || _a === void 0 ? void 0 : _a.on('data', function (data) {
                        stdout += data.toString();
                    });
                    (_b = sfProcess.stderr) === null || _b === void 0 ? void 0 : _b.on('data', function (data) {
                        stderr += data.toString();
                    });
                    sfProcess.on('close', function (code) {
                        // Post-command processing
                        var result = { stdout: stdout, stderr: stderr, exitCode: code !== null && code !== void 0 ? code : 0 };
                        result.stdout = hadJsonFlag ? removeEscapedCharacters(result.stdout) : result.stdout;
                        // Perform any necessary post-processing here
                        // For example, you can modify the result object or log additional information
                        (0, miscellaneous_1.log)("Command finished with exit code ".concat(result.exitCode));
                        resolve(result);
                    });
                    sfProcess.on('error', function (err) {
                        reject(new Error("Failed to start process: ".concat(err.message)));
                    });
                })];
        });
    });
}
function deleteScratchOrg(orgAliasName) {
    return __awaiter(this, void 0, void 0, function () {
        var sfOrgDeleteResults;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!orgAliasName) return [3 /*break*/, 2];
                    return [4 /*yield*/, runCliCommand('org:delete:scratch', '--target-org', orgAliasName, '--no-prompt')];
                case 1:
                    sfOrgDeleteResults = _a.sent();
                    if (sfOrgDeleteResults.exitCode > 0) {
                        (0, miscellaneous_1.log)("deleteScratchOrg for org ".concat(orgAliasName, " failed with exit code ").concat(sfOrgDeleteResults.exitCode, ".\nRaw stderr ").concat(sfOrgDeleteResults.stderr, "."));
                    }
                    _a.label = 2;
                case 2: return [2 /*return*/];
            }
        });
    });
}
function orgLoginSfdxUrl(authFilePath) {
    return __awaiter(this, void 0, void 0, function () {
        var sfSfdxUrlStoreResult;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, runCliCommand('org:login:sfdx-url', '-d', '-f', authFilePath)];
                case 1:
                    sfSfdxUrlStoreResult = _a.sent();
                    if (sfSfdxUrlStoreResult.exitCode > 0) {
                        (0, miscellaneous_1.debug)('sfSfdxUrlStoreResult.exitCode = ' + sfSfdxUrlStoreResult.exitCode);
                        (0, miscellaneous_1.debug)('sfSfdxUrlStoreResult.stdout = ' + sfSfdxUrlStoreResult.stdout);
                        throw new Error("orgLoginSfdxUrl failed with exit code ".concat(sfSfdxUrlStoreResult.exitCode, "\nRaw stderr: ").concat(sfSfdxUrlStoreResult.stderr, "\nRaw stdout: ").concat(sfSfdxUrlStoreResult.stdout));
                    }
                    (0, miscellaneous_1.debug)("orgLoginSfdxUrl results ".concat(JSON.stringify(sfSfdxUrlStoreResult)));
                    return [2 /*return*/, sfSfdxUrlStoreResult];
            }
        });
    });
}
function orgDisplay(usernameOrAlias) {
    return __awaiter(this, void 0, void 0, function () {
        var sfOrgDisplayResult, message;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, runCliCommand('org:display', '--target-org', usernameOrAlias, '--verbose', '--json')];
                case 1:
                    sfOrgDisplayResult = _a.sent();
                    if (sfOrgDisplayResult.exitCode > 0) {
                        message = "sf org display failed with exit code: ".concat(sfOrgDisplayResult.exitCode, ".\n").concat(sfOrgDisplayResult.stderr);
                        (0, miscellaneous_1.log)(message);
                        throw new Error(message);
                    }
                    (0, miscellaneous_1.debug)("orgDisplay results ".concat(JSON.stringify(sfOrgDisplayResult)));
                    return [2 /*return*/, sfOrgDisplayResult];
            }
        });
    });
}
function orgList() {
    return __awaiter(this, void 0, void 0, function () {
        var sfOrgListResult, message;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, runCliCommand('org:list', '--json')];
                case 1:
                    sfOrgListResult = _a.sent();
                    if (sfOrgListResult.exitCode > 0) {
                        message = "org list failed with exit code ".concat(sfOrgListResult.exitCode, "\n stderr ").concat(sfOrgListResult.stderr);
                        (0, miscellaneous_1.log)(message);
                        throw new Error(message);
                    }
                    (0, miscellaneous_1.debug)("orgList results ".concat(JSON.stringify(sfOrgListResult)));
                    return [2 /*return*/, sfOrgListResult];
            }
        });
    });
}
function aliasList() {
    return __awaiter(this, void 0, void 0, function () {
        var sfAliasListResult, message;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, runCliCommand('alias:list', '--json')];
                case 1:
                    sfAliasListResult = _a.sent();
                    if (sfAliasListResult.exitCode > 0) {
                        message = "alias list failed with exit code ".concat(sfAliasListResult.exitCode, "\n stderr ").concat(sfAliasListResult.stderr);
                        (0, miscellaneous_1.log)(message);
                        throw new Error(message);
                    }
                    (0, miscellaneous_1.debug)("aliasList results ".concat(JSON.stringify(sfAliasListResult)));
                    return [2 /*return*/, sfAliasListResult];
            }
        });
    });
}
function scratchOrgCreate(edition, definitionFileOrNone, scratchOrgAliasName, durationDays) {
    return __awaiter(this, void 0, void 0, function () {
        var args, sfOrgCreateResult;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    (0, miscellaneous_1.log)('calling "sf org:create:scratch"...');
                    args = __spreadArray([
                        '--edition',
                        edition,
                        '--alias',
                        scratchOrgAliasName,
                        '--duration-days',
                        durationDays.toString(),
                        '--set-default',
                        '--json'
                    ], (definitionFileOrNone !== 'NONE' ? ['--definition-file', definitionFileOrNone] : []), true);
                    return [4 /*yield*/, runCliCommand.apply(void 0, __spreadArray(['org:create:scratch'], args, false))];
                case 1:
                    sfOrgCreateResult = _a.sent();
                    if (sfOrgCreateResult.exitCode > 0) {
                        (0, miscellaneous_1.log)("create scratch org failed. Exit code: ".concat(sfOrgCreateResult.exitCode, ". \ncreate scratch org failed. Raw stderr: ").concat(sfOrgCreateResult.stderr));
                        throw new Error(sfOrgCreateResult.stderr);
                    }
                    (0, miscellaneous_1.log)("...\"sf org:create:scratch\" finished");
                    (0, miscellaneous_1.debug)("scratchOrgCreate results ".concat(JSON.stringify(sfOrgCreateResult)));
                    return [2 /*return*/, sfOrgCreateResult];
            }
        });
    });
}
function setAlias(devHubAliasName, devHubUserName) {
    return __awaiter(this, void 0, void 0, function () {
        var setAliasResult;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, runCliCommand('alias:set', "".concat(devHubAliasName, "=").concat(devHubUserName))];
                case 1:
                    setAliasResult = _a.sent();
                    if (setAliasResult.exitCode > 0) {
                        (0, miscellaneous_1.log)("alias failed. Exit code: ".concat(setAliasResult.exitCode, ". \nRaw stderr: ").concat(setAliasResult.stderr));
                        throw new Error(setAliasResult.stderr);
                    }
                    return [2 /*return*/, setAliasResult];
            }
        });
    });
}
function installJestUTToolsForLwc(projectFolder) {
    return __awaiter(this, void 0, void 0, function () {
        var command;
        return __generator(this, function (_a) {
            (0, miscellaneous_1.log)("SetUp - Started Install @salesforce/sfdx-lwc-jest Node module...");
            if (!projectFolder) {
                throw new Error('cannot setup lwc tests without a project folder.');
            }
            command = 'npm install @lwc/eslint-plugin-lwc@^2.0.0 --save-dev && npm install && npm uninstall husky --force && npm install eslint@^8 --save-dev && npm install --save-dev && npm install @salesforce/sfdx-lwc-jest --save-dev';
            return [2 /*return*/, new Promise(function (resolve, reject) {
                    (0, child_process_1.exec)(command, { cwd: projectFolder }, function (error, stdout, stderr) {
                        if (error) {
                            (0, miscellaneous_1.log)("Error with ".concat(command));
                            reject(error);
                            return;
                        }
                        if (stderr) {
                            (0, miscellaneous_1.log)("Error output for ".concat(command));
                        }
                        (0, miscellaneous_1.log)(stdout);
                        (0, miscellaneous_1.log)("...SetUp - Finished Install @salesforce/sfdx-lwc-jest Node module");
                        resolve();
                    });
                })];
        });
    });
}
function createUser(systemAdminUserDefPath, targetOrg) {
    return __awaiter(this, void 0, void 0, function () {
        var sfOrgCreateUserResult;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!targetOrg) {
                        throw new Error('cannot create user with target');
                    }
                    return [4 /*yield*/, runCliCommand('org:create:user', '--definition-file', systemAdminUserDefPath, '--target-org', targetOrg)];
                case 1:
                    sfOrgCreateUserResult = _a.sent();
                    if (sfOrgCreateUserResult.exitCode > 0) {
                        (0, miscellaneous_1.log)("org create user failed Exit code: ".concat(sfOrgCreateUserResult.exitCode, ". \nRaw stderr: ").concat(sfOrgCreateUserResult.stderr));
                        throw new Error(sfOrgCreateUserResult.stderr);
                    }
                    (0, miscellaneous_1.debug)("createUser results ".concat(JSON.stringify(sfOrgCreateUserResult)));
                    return [2 /*return*/, sfOrgCreateUserResult];
            }
        });
    });
}
function removeEscapedCharacters(result) {
    var resultJson = result.replace(/\u001B\[\d\dm/g, '').replace(/\\n/g, '');
    return resultJson;
}
function generateSfProject(name, path, template) {
    return __awaiter(this, void 0, void 0, function () {
        var sfProjectGenerateResult;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, runCliCommand.apply(void 0, __spreadArray(['project:generate',
                        '--name',
                        name,
                        '--template', template !== null && template !== void 0 ? template : 'standard'], (path ? ['-d', path] : []), false))];
                case 1:
                    sfProjectGenerateResult = _a.sent();
                    if (sfProjectGenerateResult.exitCode > 0) {
                        (0, miscellaneous_1.log)("project generate failed Exit code: ".concat(sfProjectGenerateResult.exitCode, ". \nRaw stderr: ").concat(sfProjectGenerateResult.stderr));
                        throw new Error(sfProjectGenerateResult.stderr);
                    }
                    (0, miscellaneous_1.debug)("generateSfProject results ".concat(JSON.stringify(sfProjectGenerateResult)));
                    return [2 /*return*/, sfProjectGenerateResult];
            }
        });
    });
}
