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
 * @plugindesc Enables 'permanent' states which are never removed during a battle.
 * @author Hajime Hoshi
 *
 * @help
 *
 * Actor/Class/Weapon/Armor/State Note:
 *   <permanent_state:2> # Adds state #2 to an actor or an enemy permanently.
 *                       # This state is never removed while this trait is valid during a battle.
 */

(function() {
    'use strict';

    Game_BattlerBase.prototype.isStatePermanent = function(stateId) {
        return this.traitObjects().some(function(obj) {
            return Number(obj.meta.permanent_state) === stateId;
        });
    };

    var _Game_Battler_removeState = Game_Battler.prototype.removeState;
    Game_Battler.prototype.removeState = function(stateId) {
        if (this.isStatePermanent(stateId)) {
            return;
        }
        _Game_Battler_removeState.call(this, stateId);
    };

    var _Game_Battler_onBattleStart = Game_Battler.prototype.onBattleStart;
    Game_Battler.prototype.onBattleStart = function() {
        _Game_Battler_onBattleStart.call(this);
        $dataStates.forEach(function(state) {
            if (!state) {
                return;
            }
            if (this.isStatePermanent(state.id)) {
                this.addState(state.id);
            }
        }, this);
    };

    var _Game_Battler_onBattleEnd = Game_Battler.prototype.onBattleEnd;
    Game_Battler.prototype.onBattleEnd = function() {
        this.states().forEach(function(state) {
            if (this.isStatePermanent(state.id)) {
                if (!state.removeAtBattleEnd) {
                    throw 'not implemented: the state must be removed at the battle end for now';
                }
                _Game_Battler_removeState.call(this, state.id);
            }
        }, this);
        _Game_Battler_onBattleEnd.call(this);
    };

})();
