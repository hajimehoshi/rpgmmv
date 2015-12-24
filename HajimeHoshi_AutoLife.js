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
 * @desc The skill ID which is executed to the battler when it dies.
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
    var skillId = Math.floor(Number(parameters['Skill ID'])) || 1;

    var anonymousActorId = 0;

    function AnonymousActor() {
        this.initialize.apply(this, arguments);
    }

    AnonymousActor.prototype = Object.create(Game_Actor.prototype);
    AnonymousActor.prototype.constructor = AnonymousActor;

    AnonymousActor.prototype.makeActions = function() {
        this.clearActions();
        this._actions = [];
        var members = $gameParty.deadMembers().concat($gameTroop.deadMembers());
        members = members.filter(function(member) {
            return member.hasAutoLifeState();
        });
        members.forEach(function(member) {
            var action = new AutoLifeAction(this, true)
            action.setSkill(skillId);
            action.prepare();
            // setTargets is defined in HajimeHoshi_FlexibleTargetSelection.js
            if (action.setTargets) {
                if (member.isActor()) {
                    action.setTargets([member.index()], []);
                } else {
                    action.setTargets([], [member.index()]);
                }
            } else {
                if (member.isActor()) {
                    action.setTarget(member.index());
                } else {
                    throw 'Auto life for enemies is not implemented.';
                }
            }
            this._actions.push(action);
        }, this);
    };

    function AutoLifeAction() {
        this.initialize.apply(this, arguments);
    }

    AutoLifeAction.prototype = Object.create(Game_Action.prototype);
    AutoLifeAction.prototype.constructor = AutoLifeAction;

    var _AutoLifeAction_apply = AutoLifeAction.prototype.apply;
    AutoLifeAction.prototype.apply = function(target) {
        _AutoLifeAction_apply.call(this, target);
        var states = target.states().filter(function(state) {
            return state.meta.auto_life;
        });
        states.forEach(function(state) {
            target.removeState(state.id);
        });
    };

    Game_Battler.prototype.hasAutoLifeState = function() {
        return this.states().some(function(state) {
            return state.meta.auto_life;
        });
    };

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

    var _BattleManager_initMembers = BattleManager.initMembers;
    BattleManager.initMembers = function() {
        _BattleManager_initMembers.call(this);
        this._stashedSubject = null;
    };

    var _BattleManager_checkBattleEnd = BattleManager.checkBattleEnd;
    BattleManager.checkBattleEnd = function() {
        if (this._phase && !this.checkAbort()) {
            if ($gameParty.isAllDead()) {
                if ($gameParty.members().some(function(actor) {
                    return actor.hasAutoLifeState();
                })) {
                    return false;
                }
            }
            if ($gameTroop.isAllDead()) {
                if ($gameTroop.members().some(function(enemy) {
                    return enemy.hasAutoLifeState();
                })) {
                    return false;
                }
            }
        }
        return _BattleManager_checkBattleEnd.call(this);
    };

    var _BattleManager_updateTurn = BattleManager.updateTurn;
    BattleManager.updateTurn = function() {
        if (this._stashedSubject) {
            this._subject = this._stashedSubject;
            this._stashedSubject = null;
        }
        // TODO: How about troop?
        var targets = $gameParty.deadMembers().concat($gameTroop.deadMembers());
        targets = targets.filter(function(battler) {
            return battler.hasAutoLifeState();
        });
        if (targets.length) {
            var subject = new AnonymousActor(anonymousActorId);
            subject.makeActions();
            this._stashedSubject = this._subject;
            this._subject = subject;
            this.processTurn();
            return;
        }
        _BattleManager_updateTurn.call(this);
    };

    var _BattleManager_update = BattleManager.update;
    BattleManager.update = function() {
        _BattleManager_update.call(this);
    }

})();
