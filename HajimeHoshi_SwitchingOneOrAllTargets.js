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
 * @plugindesc Switching one or all targets
 * @author Hajime Hoshi
 * @desc This plugin enables to switch one or all targets.
 *
 * @param List Item For All
 * @desc The list item for selecting all targets.
 * @default (All)
 *
 * @help
 *
 * Skill/Item Note:
 *   <selectable_all> # Enable to switch targets to all.
 */

(function() {
    'use strict';

    var parameters = PluginManager.parameters('HajimeHoshi_SwitchingOneOrAllTargets');
    var listItemForAll = String(parameters['List Item For All'] || '(All)');

    function Game_ActorAll() {
        this.initialize.apply(this, arguments);
    }

    Game_ActorAll.prototype = Object.create(Game_Actor.prototype);
    Game_ActorAll.prototype.constructor = Game_ActorAll;

    Game_ActorAll.prototype.initialize = function() {
        Game_Actor.prototype.initialize.call(this, 0);
    };

    Game_ActorAll.prototype.setup = function(actorId) {
    };

    Game_ActorAll.prototype.name = function() {
        return listItemForAll;
    };

    Game_ActorAll.prototype.isDead = function(actorId) {
        return false;
    };

    Game_ActorAll.prototype.isDying = function(actorId) {
        return false;
    };

    Game_ActorAll.instance = function() {
        if (this._instance) {
            return this._instance;
        }
        return this._instance = new Game_ActorAll();
    };

    function Game_EnemyAll() {
        this.initialize.apply(this, arguments);
    }

    Game_EnemyAll.prototype = Object.create(Game_Enemy.prototype);
    Game_EnemyAll.prototype.constructor = Game_EnemyAll;

    Game_EnemyAll.prototype.setup = function(enemyId) {
    };

    Game_EnemyAll.prototype.name = function() {
        return listItemForAll;
    };

    Game_EnemyAll.prototype.initialize = function() {
        Game_Enemy.prototype.initialize.call(this, 0, 0, 0);
    };

    Game_EnemyAll.instance = function() {
        if (this._instance) {
            return this._instance;
        }
        return this._instance = new Game_EnemyAll();
    };


    Game_Action.prototype.item = Game_Action.prototype.item || function() {
        return this._item;
    };

    Game_Action.prototype.canSelectAll = function() {
        if (!this.item()) {
            return false;
        }
        return this.isForOne() && this.item().meta.selectable_all;
    };

    var _Game_Action_clear = Game_Action.prototype.clear;
    Game_Action.prototype.clear = function() {
        _Game_Action_clear.call(this);
        // Create another flag since _targetIndex doesn't make sense for enemies.
        this._targetsEnlarged = false;
    };

    Game_Action.prototype.enlargeTargets = function() {
        this._targetsEnlarged = true;
    };

    var _Window_BattleActor_maxItems = Window_BattleActor.prototype.maxItems;
    Window_BattleActor.prototype.maxItems = function() {
        if (!BattleManager.inputtingAction()) {
            return _Window_BattleActor_maxItems.call(this);
        }
        if (!BattleManager.inputtingAction().canSelectAll()) {
            return _Window_BattleActor_maxItems.call(this);
        }
        var maxItems = _Window_BattleActor_maxItems.call(this);
        if (maxItems === 1) {
            return 1;
        }
        return maxItems + 1;
    };

    var _Window_BattleActor_actor = Window_BattleActor.prototype.actor;
    Window_BattleActor.prototype.actor = function() {
        var actor = _Window_BattleActor_actor.call(this);
        if (actor) {
            return actor;
        }
        if (this.index() === $gameParty.battleMembers().length) {
            return Game_ActorAll.instance();
        }
        return null;
    };

    var _Window_BattleActor_drawItem = Window_BattleActor.prototype.drawItem;
    Window_BattleActor.prototype.drawItem = function(index) {
        if (index === $gameParty.battleMembers().length) {
            this.drawBasicArea(this.basicAreaRect(index), Game_ActorAll.instance());
            return;
        }
        _Window_BattleActor_drawItem.call(this, index);
    };

    var _Window_BattleEnemy_maxItems = Window_BattleEnemy.prototype.maxItems;
    Window_BattleEnemy.prototype.maxItems = function() {
        if (!BattleManager.inputtingAction()) {
            return _Window_BattleEnemy_maxItems.call(this);
        }
        if (!BattleManager.inputtingAction().canSelectAll()) {
            return _Window_BattleEnemy_maxItems.call(this);
        }
        var maxItems = _Window_BattleEnemy_maxItems.call(this);
        if (maxItems === 1) {
            return 1;
        }
        return maxItems + 1;
    };

    var _Window_BattleEnemy_enemy = Window_BattleEnemy.prototype.enemy;
    Window_BattleEnemy.prototype.enemy = function() {
        var enemy = _Window_BattleEnemy_enemy.call(this);
        if (enemy) {
            return enemy;
        }
        if (this.index() === this._enemies.length) {
            return Game_EnemyAll.instance();
        }
        return null;
    };

    var _Window_BattleEnemy_drawItem = Window_BattleEnemy.prototype.drawItem;
    Window_BattleEnemy.prototype.drawItem = function(index) {
        if (index === this._enemies.length) {
            this.resetTextColor();
            var name = Game_EnemyAll.instance().name();
            var rect = this.itemRectForText(index);
            this.drawText(name, rect.x, rect.y, rect.width);
            return;
        }
        _Window_BattleEnemy_drawItem.call(this, index);
    };

    var _Scene_Battle_onActorOk = Scene_Battle.prototype.onActorOk;
    Scene_Battle.prototype.onActorOk = function() {
        if (this._actorWindow.actor() === Game_ActorAll.instance()) {
            var action = BattleManager.inputtingAction();
            action.enlargeTargets();
        }
        _Scene_Battle_onActorOk.call(this);
    };

    var _Scene_Battle_onEnemyOk = Scene_Battle.prototype.onEnemyOk;
    Scene_Battle.prototype.onEnemyOk = function() {
        if (this._enemyWindow.enemy() === Game_EnemyAll.instance()) {
            var action = BattleManager.inputtingAction();
            action.enlargeTargets();
        }
        _Scene_Battle_onEnemyOk.call(this);
    };


    var _Game_Action_targetsForOpponents = Game_Action.prototype.targetsForOpponents;
    Game_Action.prototype.targetsForOpponents = function() {
        if (this._targetsEnlarged) {
            return this.opponentsUnit().aliveMembers();
        }
        var targets = _Game_Action_targetsForOpponents.call(this);
        if (!this.subject().isEnemy() || !this.canSelectAll()) {
            return targets;
        }
        var unit = this.opponentsUnit();
        if (unit.aliveMembers().length === 1) {
            return targets;
        }
        var num = Math.randomInt(unit.aliveMembers().length + 1);
        if (0 < num) {
            return targets;
        }
        targets = unit.aliveMembers();
        this.enlargeTargets();
        return targets;
    };

    var _Game_Action_targetsForFriends = Game_Action.prototype.targetsForFriends;
    Game_Action.prototype.targetsForFriends = function() {
        if (this._targetsEnlarged) {
            return this.friendsUnit().aliveMembers();
        }
        var targets = _Game_Action_targetsForFriends.call(this);
        if (!this.subject().isEnemy() || !this.canSelectAll()) {
            return targets;
        }
        var unit = this.friendsUnit();
        if (unit.aliveMembers().length === 1) {
            return targets;
        }
        var num = Math.randomInt(unit.aliveMembers().length + 1);
        if (0 < num) {
            return targets;
        }
        targets = unit.aliveMembers();
        this.enlargeTargets();
        return targets;
    };

    var _Game_Unit_select = Game_Unit.prototype.select;
    Game_Unit.prototype.select = function(activeMember) {
        if (activeMember === Game_ActorAll.instance() ||
            activeMember === Game_EnemyAll.instance()) {
            this.members().forEach(function(member) {
                member.select();
            });
            return;
        }
        _Game_Unit_select.call(this, activeMember);
    };

    // Half the damage when the targets are switched to all.
    var _Game_Action_makeDamageValue = Game_Action.prototype.makeDamageValue;
    Game_Action.prototype.makeDamageValue = function(target, critical) {
        var damage = _Game_Action_makeDamageValue.call(this, target, critical);
        if (this._targetsEnlarged) {
            damage = Math.round(damage / 2);
        }
        return damage;
    };
})();
