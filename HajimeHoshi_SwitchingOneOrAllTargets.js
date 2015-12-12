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
 * Skill/Item Note:
 *   <selectable_all> # Enable to switch targets to all.
 */

// TODO: An enemy should be able to switch targets when it uses a skill.

(function() {
    'use strict';

    Game_Action.prototype.item = Game_Action.prototype.item || function() {
        return this._item;
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
        var item = BattleManager.inputtingAction().item();
        if (!item) {
            return _Window_BattleEnemy_maxItems.call(this);
        }
        if (!item.meta.selectable_all) {
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

    var _Window_BattleEnemy_drawItem = Window_BattleEnemy.prototype.drawItem;
    Window_BattleEnemy.prototype.drawItem = function(index) {
        if (index === this._enemies.length) {
            this.resetTextColor();
            var name = '(All)';
            var rect = this.itemRectForText(index);
            this.drawText(name, rect.x, rect.y, rect.width);
            return;
        }
        _Window_BattleEnemy_drawItem.call(this, index);
    };

    var _Game_Action_targetsForOpponents = Game_Action.prototype.targetsForOpponents;
    Game_Action.prototype.targetsForOpponents = function() {
        if (this._targetIndex === TARGET_ALL) {
            return this.opponentsUnit().aliveMembers();
        }
        return _Game_Action_targetsForOpponents.call(this);
    };

    var _Game_Action_targetsForFriends = Game_Action.prototype.targetsForFriends;
    Game_Action.prototype.targetsForFriends = function() {
        if (this._targetIndex === TARGET_ALL) {
            return this.friendsUnit().aliveMembers();
        }
        return _Game_Action_targetsForFriends.call(this);
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
})();
