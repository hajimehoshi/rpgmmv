// Copyright 2015 Hajime Hoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/*:
 * @plugindesc Save restriction
 * @author Hajime Hoshi
 *
 * @param Default Value
 * @desc 'Save' is forbidden by default if this value is 0. Otherwise 'save' is admitted by default.
 * @default 1
 *
 * @help This plugin forbids 'save' command in maps those have '<save_disabled>' meta data
 * and admits maps with <save_enabled>.
 * If a map doesn't have neither of meta data, it follows the default value.
 */

(function() {
    var parameters = PluginManager.parameters('HajimeHoshi_SaveRestriction');
    var defaultValue = true;
    if (parameters['Default Value'] !== undefined) {
        defaultValue = Number(parameters['Default Value']) !== 0;
    }

    var _Window_MenuCommand_isSaveEnabled = Window_MenuCommand.prototype.isSaveEnabled;
    Window_MenuCommand.prototype.isSaveEnabled = function() {
        if (!_Window_MenuCommand_isSaveEnabled.call(this)) {
            return false;
        }
        if (!defaultValue) {
            return 'save_enabled' in $dataMap.meta;
        }
        return !('save_disabled' in $dataMap.meta);
    };
})();
