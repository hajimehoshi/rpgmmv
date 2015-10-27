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
 * @plugindesc Setting a locale.
 * @author Hajime Hoshi
 *
 * @param Locale
 * @desc The language code like 'en' or 'ja'.
 * @default 
 *
 * @help This plugin overrides a locale defined at $dataSystem.locale.
 */

(function() {
    var parameters = PluginManager.parameters('HajimeHoshi_SettingLocale');
    var locale = (parameters['Locale'] || $dataSytem.locale);

    var _Scene_Boot_start = Scene_Boot.prototype.start;
    Scene_Boot.prototype.start = function() {
        _Scene_Boot_start.call(this);
        $dataSystem.locale = locale;
    };
})();
