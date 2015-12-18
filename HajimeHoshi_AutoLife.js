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
 * @plugindesc Enables auto-life state like 'reraise' in Final Fantasy.
 * @author Hajime Hoshi
 *
 * @param Skill ID
 * @desc The skill ID which is executed to the actor when he/she dies.
 * @default 1
 *
 * @help
 *
 * State Note:
 *   <auto_life> # The auto life state
 */

(function() {
    'use strict';

    var parameters = PluginManager.parameters('HajimeHoshi_AutoLife');
    var skillId = Number(parameters['Skill ID'] || 1);

    var anonymousActorId = 0;

    // Create an anonymous actor. This is used as a subject to use the skill
    // to revive dead battlers.
    var _Scene_Boot_start = Scene_Boot.prototype.start;
    Scene_Boot.prototype.start = function() {
        _Scene_Boot_start.call(this);
        var lastActor = $dataActors[$dataActors.length - 1];
        anonymousActorId = lastActor.id + 1;
        var anonymousActor = JSON.parse(JSON.stringify(lastActor));
        anonymousActor.id = anonymousActorId;
        anonymousActor.name = '';
        anonymousActor.nickname = '';
        $dataActors.push(anonymousActor);
    };

    var _Game_BattlerBase_die = Game_BattlerBase.prototype.die;
    Game_BattlerBase.prototype.die = function() {
        var autoLifeStates = this.states().filter(function(state) {
            return state.meta.auto_life;
        });
        _Game_BattlerBase_die.call(this);
        autoLifeStates.forEach(function(state) {
            this.addNewState(state.id);
        }, this);
    };

    // TODO: Override updateTurn

    var _BattleManager_update = BattleManager.update;
    BattleManager.update = function() {
        if (this.isInTurn()) {
            $gameParty.requestMotionRefresh();
            // TODO: How about troop?
            var targets = $gameParty.deadMembers().filter(function(actor) {
                return actor.states().some(function(state) {
                    return state.meta.auto_life;
                });
            });
            if (targets.length) {
                var subject = new Game_Actor(anonymousActorId);
                var action = new Game_Action(subject, true);
                action.setSkill(skillId);
                action.prepare();
                // FIXME: Overriding _subject doesn't work when a battler
                // acts two or more times.
                this._subject = subject;
                this._phase = 'action';
                this._action = action;
                this._targets = targets;
                this._action.applyGlobal();
                this.refreshStatus();
                this._logWindow.startAction(subject, action, targets);
                targets.forEach(function(battler) {
                    battler.states().forEach(function(state) {
                        if (!state.meta.auto_life) {
                            return;
                        }
                        battler.removeState(state.id);
                    });
                });
            }
        }                
        _BattleManager_update.call(this);
    }

})();
