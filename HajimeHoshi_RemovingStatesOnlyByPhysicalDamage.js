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
 * @plugindesc Removing states only by physical damage.
 * @author Hajime Hoshi
 * @desc This plugin changes 'remove by damage' states to be removed only by physical damage.
 */

(function() {
    'use strict';

    Game_Action.prototype.executeHpDamage = function(target, value) {
        if (this.isDrain()) {
            value = Math.min(target.hp, value);
        }
        this.makeSuccess(target);
        target.gainHp(-value);
        if (value > 0) {
            target.onDamage(value, this.isPhysical());
        }
        this.gainDrainedHp(value);
    };

    var _Game_Battler_onDamage = Game_Battler.prototype.onDamage;
    Game_Battler.prototype.onDamage = function(value, isPhysicalAttack) {
        if (isPhysicalAttack) {
            _Game_Battler_onDamage.call(this);
            return;
        }
        this.chargeTpByDamage(value / this.mhp);
    };
})();
