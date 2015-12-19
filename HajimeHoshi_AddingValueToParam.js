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
 * @plugindesc Adds value to param like mhp
 * @author Hajime Hoshi
 *
 * @help
 *
 * Actor/Class/Weapon/Armor/State Note:
 *   <add_value_to_param:mhp,+2> # Add +2 value to the parameter mhp.
 *                               # The first argument must be mhp, mmp, atk, def,
 *                               # mat, mdf, agi or luk.
 *                               # The second argument must be an integer value
 *                               # including a negative value.
 */

(function() {
    'use strict';

    var paramNameToParamId = {
        'mhp': 0,
        'mmp': 1,
        'atk': 2,
        'def': 3,
        'mat': 4,
        'mdf': 5,
        'agi': 6,
        'luk': 7
    };

    Game_BattlerBase.prototype.paramDelta = function(paramId) {
        var delta = 0;
        this.traitObjects().forEach(function(obj) {
            if (!obj.meta.add_value_to_param) {
                return;
            }
            var arr = obj.meta.add_value_to_param.split(',');
            if (arr.length !== 2) {
                return;
            }
            if (paramNameToParamId[arr[0]] !== paramId) {
                return;
            }
            delta += Math.floor(Number(arr[1])) || 0;
        });
        return delta;
    };

    var _Game_BattlerBase_param = Game_BattlerBase.prototype.param;
    Game_BattlerBase.prototype.param = function(paramId) {
        var value = _Game_BattlerBase_param.call(this, paramId);
        value += this.paramDelta(paramId);
        var maxValue = this.paramMax(paramId);
        var minValue = this.paramMin(paramId);
        return Math.round(value.clamp(minValue, maxValue));
    };

})();
