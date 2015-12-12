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

// TODO: An enemy should be able to switch targets when it uses a skill.

(function() {
    'use strict';

    var parameters = PluginManager.parameters('HajimeHoshi_SwitchingOneOrAllTargets');
    var listItemForAll = String(parameters['List Item For All'] || '(All)');

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

    // TODO: This value is already used at forceAction. Is this OK?
    var TARGET_ALL = -2;

    // TODO: Create ACTOR_ALL
    var ENEMY_ALL = new Object();

    var _Window_BattleEnemy_maxItems = Window_BattleEnemy.prototype.maxItems;
    Window_BattleEnemy.prototype.maxItems = function() {
        if (!BattleManager.inputtingAction()) {
            // Initial state of the battle.
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
            return ENEMY_ALL;
        }
        return null;
    };

    var _Window_BattleEnemy_enemyIndex = Window_BattleEnemy.prototype.enemyIndex;
    Window_BattleEnemy.prototype.enemyIndex = function() {
        if (this.index() === this._enemies.length) {
            return TARGET_ALL;
        }
        return _Window_BattleEnemy_enemyIndex.call(this);
    };

    var _Game_Action_setTarget = Game_Action.prototype.setTarget;
    Game_Action.prototype.setTarget = function(targetIndex) {
        _Game_Action_setTarget.call(this, targetIndex);
        if (targetIndex === TARGET_ALL) {
            this.enlargeTargets();
        }
    };

    var _Window_BattleEnemy_drawItem = Window_BattleEnemy.prototype.drawItem;
    Window_BattleEnemy.prototype.drawItem = function(index) {
        if (index === this._enemies.length) {
            this.resetTextColor();
            var name = listItemForAll;
            var rect = this.itemRectForText(index);
            this.drawText(name, rect.x, rect.y, rect.width);
            return;
        }
        _Window_BattleEnemy_drawItem.call(this, index);
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
        if (activeMember === ENEMY_ALL) {
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
