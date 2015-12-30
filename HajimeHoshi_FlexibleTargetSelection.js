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
 * @plugindesc Flexible target selection like Final Fantasy.
 * @author Hajime Hoshi
 *
 * @param Reflection Animation ID
 * @desc Animation ID for magic reflection instead of SE (if 0, the default SE is used).
 * @default 0
 *
 * @help
 *
 * Skill/Item Note:
 *   <selectable_all> # Enables to switch targets to all.
 */

(function() {
    'use strict';

    var parameters = PluginManager.parameters('HajimeHoshi_FlexibleTargetSelection');
    var reflectionAnimationId = Math.floor(Number(parameters['Reflection Animation ID'])) || 0;

    // TODO: Consider ConfigManager.commandRemember
    // TODO: Touch UI

    var _Scene_Boot_start = Scene_Boot.prototype.start;
    Scene_Boot.prototype.start = function() {
        _Scene_Boot_start.call(this);
        if (!$gameSystem.isSideView()) {
            throw 'This plugin works only with side-view battle';
        }
    };

    Game_Unit.prototype.smoothTargets = function(indices) {
        if (indices.length === 0) {
            return [];
        }
        if (indices.length === 1) {
            return [this.smoothTarget(indices[0])];
        }
        return indices.map(function(index) {
            return this.members()[index];
        }, this).filter(function(member) {
            return member.isAlive();
        });
    };

    Game_Action.prototype.canEnlargeSelection = function() {
        if (!this.item()) {
            return false;
        }
        return this.isForOne() && this.item().meta.selectable_all;
    };

    var _Game_Action_needsSelection = Game_Action.prototype.needsSelection;
    Game_Action.prototype.needsSelection = function() {
        if (_Game_Action_needsSelection.call(this)) {
            return true;
        }
        return this.isForAll();
    };

    var _Game_Action_clear = Game_Action.prototype.clear;
    Game_Action.prototype.clear = function() {
        _Game_Action_clear.call(this);
        this._actorTargetIndices = [];
        this._enemyTargetIndices = [];
        this._isSelectionEnlarged = false;
    };

    Game_Action.prototype.setTargets = function(actorTargetIndices, enemyTargetIndices) {
        this._actorTargetIndices = actorTargetIndices.clone();
        this._enemyTargetIndices = enemyTargetIndices.clone();
    };

    Game_Action.prototype.evaluate = function() {
        var value = 0;
        this.itemTargetCandidates().forEach(function(target) {
            var targetValue = this.evaluateWithTarget(target);
            if (this.isForAll()) {
                value += targetValue;
            } else if (targetValue > value) {
                value = targetValue;
                if (target.isActor()) {
                    this._actorTargetIndices = [target.index()];
                } else {
                    this._enemyTargetIndices = [target.index()];
                }
            }
        }, this);
        value *= this.numRepeats();
        if (value > 0) {
            value += Math.random();
        }
        return value;
    };

    Game_Battler.prototype.forceAction = function(skillId, targetIndex) {
        this.clearActions();
        var action = new Game_Action(this, true);
        action.setSkill(skillId);
        if (targetIndex === -2) {
            throw 'not implemented';
        } else if (targetIndex === -1) {
            // We don't need to call action.decideRandomTarget here.
            // In this case, indices arrays are empty but Game_Action's targets
            // function will decide random targets.
        } else {
            throw 'not implemented.';
        }
        this._actions.push(action);
    };

    Game_Action.prototype.makeTargets = function() {
        var targets = [];
        if (!this._forcing && this.subject().isConfused()) {
            targets = [this.confusionTarget()];
        } else {
            targets = this.targets();
        }
        return this.repeatTargets(targets);
    };

    Game_Action.prototype.targets = function() {
        // Both _actorTargetIndices and _enemyTargetIndices might be empty when
        // 1. the subject is enemy
        // 2. forced action (this case is introduced by this patch)
        var targets = [];
        if (this.isForUser()) {
            return [this.subject()];
        }
        if (this.isForRandom()) {
            if (this.opponentsUnit().tgrSum() === 0) {
                return [];
            }
            for (var i = 0; i < this.numTargets(); i++) {
                targets.push(this.opponentsUnit().randomTarget());
            }
            return targets;
        }
        // TODO: Refactor this
        if (this.isForDeadFriend()) {
            var targets = [];
            // Don't shift the targets
            targets = targets.concat(this._actorTargetIndices.map(function(index) {
                return $gameParty.members()[index];
            }));
            targets = targets.concat(this._enemyTargetIndices.map(function(index) {
                return $gameTroop.members()[index];
            }));
            if (targets.length) {
                if (this.canEnlargeSelection() && 1 < targets.length) {
                    this._isSelectionEnlarged = true;
                }
                return targets;
            }
            if (this._actorTargetIndices.length || this._enemyTargetIndices.length) {
                return [];
            }
            // indices are empty: Let's decide random targets.
            var unit = this.isForFriend() ? this.friendsUnit() : this.opponentsUnit();
            if (this.isForAll()) {
                return unit.deadMembers();
            }
            if (this.canEnlargeSelection() && Math.randomInt(unit.deadMembers().length + 1) === 0) {
                targets = unit.deadMembers();
                if (1 < targets.length) {
                    this._isSelectionEnlarged = true;
                }
                return targets;
            }
            return [unit.randomDeadTarget()];
        }
        var targets = [];
        targets = targets.concat($gameParty.smoothTargets(this._actorTargetIndices));
        targets = targets.concat($gameTroop.smoothTargets(this._enemyTargetIndices));
        if (targets.length) {
            if (this.canEnlargeSelection() && 1 < targets.length) {
                this._isSelectionEnlarged = true;
            }
            return targets;
        }
        if (this._actorTargetIndices.length || this._enemyTargetIndices.length) {
            return [];
        }
        // indices are empty: Let's decide random targets.
        var unit = this.isForFriend() ? this.friendsUnit() : this.opponentsUnit();
        if (this.isForAll()) {
            return unit.aliveMembers();
        }
        if (unit.tgrSum() === 0) {
            return [];
        }
        if (this.canEnlargeSelection() && Math.randomInt(unit.aliveMembers().length + 1) === 0) {
            targets = unit.aliveMembers();
            if (1 < targets.length) {
                this._isSelectionEnlarged = true;
            }
            return targets;
        }
        return [unit.randomTarget()];
    };

    // Half the damage when the targets are switched to all.
    var _Game_Action_makeDamageValue = Game_Action.prototype.makeDamageValue;
    Game_Action.prototype.makeDamageValue = function(target, critical) {
        var damage = _Game_Action_makeDamageValue.call(this, target, critical);
        if (this._isSelectionEnlarged) {
            damage = Math.round(damage / 2);
        }
        return damage;
    };

    // Brighter colors
    Sprite_Battler.prototype.updateSelectionEffect = function() {
        var target = this._effectTarget;
        if (this._battler.isSelected()) {
            this._selectionEffectCount++;
            if (this._selectionEffectCount % 30 < 15) {
                target.setBlendColor([255, 255, 255, 128]);
            } else {
                target.setBlendColor([255, 255, 255, 64]);
            }
        } else if (this._selectionEffectCount > 0) {
            this._selectionEffectCount = 0;
            target.setBlendColor([0, 0, 0, 0]);
        }
    };

    Sprite_Battler.prototype.battler = function() {
        return this._battler;
    };

    //
    // Enemy Name
    //

    var _Sprite_Enemy_initMembers = Sprite_Enemy.prototype.initMembers;
    Sprite_Enemy.prototype.initMembers = function() {
        _Sprite_Enemy_initMembers.call(this);
        this._nameSprite = new Sprite();
        this._nameSprite.bitmap = new Bitmap(240, 48);
        this._nameSprite.visible = false;
        this._nameSprite.anchor.x = 0.5;
        this._nameSprite.anchor.y = 1;
        this.addChild(this._nameSprite);
    };

    var _Sprite_Enemy_setBattler = Sprite_Enemy.prototype.setBattler;
    Sprite_Enemy.prototype.setBattler = function(battler) {
        _Sprite_Enemy_setBattler.call(this, battler);
        var width = this._nameSprite.width;
        var height = this._nameSprite.height;
        this._nameSprite.bitmap.clear();
        this._nameSprite.bitmap.drawText(this._battler.name(), 0, 0, width, height, 'center');
    };

    var _Sprite_Battler_updateSelectionEffect = Sprite_Battler.prototype.updateSelectionEffect;
    Sprite_Battler.prototype.updateSelectionEffect = function() {
        _Sprite_Battler_updateSelectionEffect.call(this);
        if (this._nameSprite) {
            this._nameSprite.visible = this._battler.isSelected();
            this._nameSprite.y = -this.bitmap.height;
        }
    };

    //
    // BattlerSelector
    //

    var SPRITE_MARGIN = 8;

    Spriteset_Battle.prototype.leftmostEnemySprite = function() {
        var enemySprites = this.battlerSprites().filter(function(sprite) {
            if (!sprite.battler()) {
                return false;
            }
            return sprite.battler().isEnemy() && sprite.battler().isAlive();
        });
        var enemySpritesSortedByY = enemySprites.sort(function(a, b) {
            return (a.x + a.width / 2) - (b.x + b.width / 2);
        });
        return enemySpritesSortedByY[0];
    };

    Spriteset_Battle.prototype.nearestBattlerSprite = function(sprite, direction) {
        var enemySprites = this.battlerSprites().filter(function(sprite) {
            // battler() can be undefined for actors.
            if (!sprite.battler()) {
                return false;
            }
            return sprite.battler().isEnemy() && sprite.battler().isAlive();
        });
        var enemySpritesSortedByY = enemySprites.sort(function(a, b) {
            return (a.x + a.width / 2) - (b.x + b.width / 2);
        });
        var rightmostEnemySprite = enemySpritesSortedByY[enemySpritesSortedByY.length - 1];
        var battler = sprite.battler();
        if (battler.isActor()) {
            var nextIndex = battler.index();
            if (direction === 'right' || direction === 'down') {
                nextIndex++;
            }
            if (direction === 'left' || direction === 'up') {
                nextIndex--;
            }
            if (0 <= nextIndex && nextIndex < $gameParty.members().length) {
                return this.battlerSprites().filter(function(sprite) {
                    return sprite.battler() === $gameParty.members()[nextIndex];
                })[0];
            }
            if ($gameParty.members().length <= nextIndex) {
                return null;
            }
            return rightmostEnemySprite;
        }
        if (sprite === rightmostEnemySprite) {
            if (direction === 'right') {
                return this.battlerSprites().filter(function(sprite) {
                    return sprite.battler() === $gameParty.members()[0];
                })[0];
            }
        }
        var x = sprite.x + sprite.width / 2;
        var y = sprite.y + sprite.height / 2;
        var sprites = [];
        if (direction === 'up' || direction === 'down') {
            sprites = enemySprites.sort(function(a, b) {
                var ax = a.x + a.width / 2;
                var ay = a.y + a.height / 2;
                var bx = b.x + b.width / 2;
                var by = b.y + b.height / 2;
                return (Math.abs(x - ax) * 4 + Math.abs(y - ay)) -
                    (Math.abs(x - bx) * 4 + Math.abs(y - by));
            });
        } else if (direction === 'left' || direction === 'right') {
            sprites = enemySprites.sort(function(a, b) {
                var ax = a.x + a.width / 2;
                var ay = a.y + a.height / 2;
                var bx = b.x + b.width / 2;
                var by = b.y + b.height / 2;
                return (Math.abs(x - ax) + Math.abs(y - ay) * 4) -
                    (Math.abs(x - bx) + Math.abs(y - by) * 4);
            });
        }
        switch (direction) {
        case 'up':
            sprites = sprites.filter(function(sprite) {
                var yy = sprite.y + sprite.height / 2;
                return yy <= y - SPRITE_MARGIN;
            });
            break;
        case 'down':
            sprites = sprites.filter(function(sprite) {
                var yy = sprite.y + sprite.height / 2;
                return y + SPRITE_MARGIN <= yy;
            });
            break;
        case 'left':
            sprites = sprites.filter(function(sprite) {
                var xx = sprite.x + sprite.width / 2;
                return xx <= x - SPRITE_MARGIN;
            });
            break;
        case 'right':
            sprites = sprites.filter(function(sprite) {
                var xx = sprite.x + sprite.width / 2;
                return x + SPRITE_MARGIN <= xx;
            });
            break;
        }
        if (sprites.length === 0) {
            return null;
        }
        return sprites[0];
    };

    // TODO: Redefine them like BattlerSelector.TARGET_TYPE_ONE.
    var BATTLER_SELECTOR_TARGET_TYPE_ONE = 0;
    var BATTLER_SELECTOR_TARGET_TYPE_ONE_OR_MULTIPLE = 1;
    var BATTLER_SELECTOR_TARGET_TYPE_MULTIPLE = 2;
    // TODO: Add BATTLER_SELECTOR_TARGET_TYPE_ALL like FF6's 'Crusader'.

    function BattlerSelector(spriteset) {
        this.initialize.apply(this, arguments);
    }

    BattlerSelector.prototype.initialize = function(spriteset) {
        this._spriteset = spriteset;
        this._selectedBattlers = [spriteset.battlerSprites()[0].battler()];
        this._activated = false;
        this._handlers = {};
        this._targetType = BATTLER_SELECTOR_TARGET_TYPE_ONE;
    };

    BattlerSelector.prototype.setTargetType = function(targetType) {
        this._targetType = targetType;
    };

    BattlerSelector.prototype.isActive = function() {
        return this._activated;
    };

    BattlerSelector.prototype.activate = function() {
        this._activated = true;
    };

    BattlerSelector.prototype.deactivate = function() {
        this._activated = false;
    };

    BattlerSelector.prototype.updateInputData = function() {
        Input.update();
        TouchInput.update();
    };

    BattlerSelector.prototype.update = function() {
        if (!this._activated) {
            return;
        }
        // TODO: Reset _selectionEffectCount;
        $gameParty.select(null);
        $gameTroop.select(null);
        this._selectedBattlers.forEach(function(battler) {
            battler.select();
        });
        if (Input.isRepeated('ok')) {
            this.processOk();
            return;
        }
        if (Input.isRepeated('cancel')) {
            this.processCancel();
            return;
        }
        
        var nextBattlers = [];
        if (this._targetType === BATTLER_SELECTOR_TARGET_TYPE_ONE_OR_MULTIPLE ||
            this._targetType === BATTLER_SELECTOR_TARGET_TYPE_MULTIPLE) {
            if (Input.isRepeated('pagedown')) {
                nextBattlers = $gameParty.members().clone();
            }
            if (Input.isRepeated('pageup')) {
                nextBattlers = $gameTroop.aliveMembers().clone();
            }
        }
        if (!nextBattlers.length) {
            if (1 < this._selectedBattlers.length ||
                this._targetType === BATTLER_SELECTOR_TARGET_TYPE_MULTIPLE) {
                switch (this._targetType) {
                case BATTLER_SELECTOR_TARGET_TYPE_ONE:
                    throw 'invalid state';
                    break;
                case BATTLER_SELECTOR_TARGET_TYPE_ONE_OR_MULTIPLE:
                    if (Input.isRepeated('right') && this._selectedBattlers[0].isEnemy()) {
                        nextBattlers = [this._spriteset.leftmostEnemySprite().battler()];
                    }
                    if (Input.isRepeated('left') && this._selectedBattlers[0].isActor()) {
                        nextBattlers = [$gameParty.members()[$gameParty.members().length - 1]];
                    }
                    break;
                case BATTLER_SELECTOR_TARGET_TYPE_MULTIPLE:
                    if (Input.isRepeated('right') && this._selectedBattlers[0].isEnemy()) {
                        nextBattlers = $gameParty.members().clone();
                    }
                    if (Input.isRepeated('left') && this._selectedBattlers[0].isActor()) {
                        nextBattlers = $gameTroop.aliveMembers().clone();
                    }
                    break;
                }
            } else {
                var currentSprite = this._spriteset.battlerSprites().filter(function(sprite) {
                    return sprite.battler() === this._selectedBattlers[0];
                }, this)[0];
                if (Input.isRepeated('down')) {
                    var nextBattlerSprite = this._spriteset.nearestBattlerSprite(currentSprite, 'down');
                    if (nextBattlerSprite) {
                        nextBattlers = [nextBattlerSprite.battler()];
                    }
                }
                if (Input.isRepeated('up')) {
                    var nextBattlerSprite = this._spriteset.nearestBattlerSprite(currentSprite, 'up');
                    if (nextBattlerSprite) {
                        nextBattlers = [nextBattlerSprite.battler()];
                    }
                }
                if (Input.isRepeated('right')) {
                    var nextBattlerSprite = this._spriteset.nearestBattlerSprite(currentSprite, 'right');
                    if (nextBattlerSprite) {
                        nextBattlers = [nextBattlerSprite.battler()];
                    } else if (1 < $gameParty.members().length &&
                               this._targetType === BATTLER_SELECTOR_TARGET_TYPE_ONE_OR_MULTIPLE) {
                        nextBattlers = $gameParty.members().clone();
                    }
                }
                if (Input.isRepeated('left')) {
                    var nextBattlerSprite = this._spriteset.nearestBattlerSprite(currentSprite, 'left');
                    if (nextBattlerSprite) {
                        nextBattlers = [nextBattlerSprite.battler()];
                    } else if (1 < $gameTroop.aliveMembers().length &&
                               this._targetType === BATTLER_SELECTOR_TARGET_TYPE_ONE_OR_MULTIPLE) {
                        nextBattlers = $gameTroop.aliveMembers().clone();
                    }
                }
            }
        }
        if (!nextBattlers.length) {
            return;
        }
        // TODO: Stricter comparison for arrays might be needed.
        if (this._selectedBattlers.length !== nextBattlers.length ||
            this._selectedBattlers[0] !== nextBattlers[0]) {
            SoundManager.playCursor();
        }
        this._selectedBattlers = nextBattlers;
    };

    BattlerSelector.prototype.setHandler = function(symbol, callback) {
        this._handlers[symbol] = callback;
    };

    BattlerSelector.prototype.selectedBattlers = function() {
        return this._selectedBattlers.clone();
    };

    BattlerSelector.prototype.selectActor = function() {
        if (this._targetType === BATTLER_SELECTOR_TARGET_TYPE_MULTIPLE) {
            this._selectedBattlers = $gameParty.members().clone();
            return;
        }
        this._selectedBattlers = [$gameParty.members()[0]];
    };

    BattlerSelector.prototype.selectEnemy = function() {
        if (this._targetType === BATTLER_SELECTOR_TARGET_TYPE_MULTIPLE) {
            this._selectedBattlers = $gameTroop.aliveMembers().clone();
            return;
        }
        this._selectedBattlers = [$gameTroop.aliveMembers()[0]];
    };

    BattlerSelector.prototype.processOk = function() {
        SoundManager.playOk();
        this.updateInputData();
        this.deactivate();
        if (this._handlers['ok']) {
            this._handlers['ok']();
        }
    };

    BattlerSelector.prototype.processCancel = function() {
        SoundManager.playCancel();
        this.updateInputData();
        this.deactivate();
        if (this._handlers['cancel']) {
            this._handlers['cancel']();
        }
    };

    var _Scene_Battle_update = Scene_Battle.prototype.update;
    Scene_Battle.prototype.update = function() {
        _Scene_Battle_update.call(this);
        this._battlerSelector.update();
    };

    Scene_Battle.prototype.isAnyInputWindowActive = function() {
        return (this._partyCommandWindow.active ||
                this._actorCommandWindow.active ||
                this._skillWindow.active ||
                this._itemWindow.active ||
                this._battlerSelector.isActive());
    };

    var _Scene_Battle_createDisplayObjects = Scene_Battle.prototype.createDisplayObjects;
    Scene_Battle.prototype.createDisplayObjects = function() {
        _Scene_Battle_createDisplayObjects.call(this);
        this._battlerSelector = new BattlerSelector(this._spriteset);
        this._battlerSelector.setHandler('ok',     this.onBattlerSelectorOk.bind(this));
        this._battlerSelector.setHandler('cancel', this.onBattlerSelectorCancel.bind(this));
    };

    Scene_Battle.prototype.createActorWindow = function() {
        // Do nothing.
    };

    Scene_Battle.prototype.createEnemyWindow = function() {
        // Do nothing.
    };

    Scene_Battle.prototype.selectActorSelection = function() {
        var action = BattleManager.inputtingAction();
        if (action.isForAll()) {
            this._battlerSelector.setTargetType(BATTLER_SELECTOR_TARGET_TYPE_MULTIPLE);
        } else if (action.canEnlargeSelection()) {
            this._battlerSelector.setTargetType(BATTLER_SELECTOR_TARGET_TYPE_ONE_OR_MULTIPLE);
        } else {
            // TODO: Check isForOne and add TYPE_OTHER for other target type like random targets.
            this._battlerSelector.setTargetType(BATTLER_SELECTOR_TARGET_TYPE_ONE);
        }
        this._battlerSelector.selectActor();
        this._battlerSelector.activate();
    };

    Scene_Battle.prototype.selectEnemySelection = function() {
        var action = BattleManager.inputtingAction();
        if (action.isForAll()) {
            this._battlerSelector.setTargetType(BATTLER_SELECTOR_TARGET_TYPE_MULTIPLE);
        } else if (action.canEnlargeSelection()) {
            this._battlerSelector.setTargetType(BATTLER_SELECTOR_TARGET_TYPE_ONE_OR_MULTIPLE);
        } else {
            this._battlerSelector.setTargetType(BATTLER_SELECTOR_TARGET_TYPE_ONE);
        }
        this._battlerSelector.selectEnemy();
        this._battlerSelector.activate();
    };

    Scene_Battle.prototype.onBattlerSelectorOk = function() {
        $gameParty.select(null);
        $gameTroop.select(null);
        var action = BattleManager.inputtingAction();
        var battlers = this._battlerSelector.selectedBattlers();
        if (battlers.length) {
            // TODO: This logic can be moved to Game_Action.
            var actorIndices = [];
            var enemyIndices = [];
            battlers.forEach(function(battler) {
                if (battler.isActor()) {
                    actorIndices.push(battler.index());
                } else {
                    enemyIndices.push(battler.index());
                }
            });
            action.setTargets(actorIndices, enemyIndices);
        }
        this._skillWindow.hide();
        this._itemWindow.hide();
        this.selectNextCommand();
    };

    Scene_Battle.prototype.onBattlerSelectorCancel = function() {
        $gameParty.select(null);
        $gameTroop.select(null);
        switch (this._actorCommandWindow.currentSymbol()) {
        case 'attack':
            this._actorCommandWindow.activate();
            break;
        case 'skill':
            this._skillWindow.show();
            this._skillWindow.activate();
            break;
        case 'item':
            this._itemWindow.show();
            this._itemWindow.activate();
            break;
        }
    };

    //
    // Window_MenuActor
    //

    var _Window_MenuActor_initialize = Window_MenuActor.prototype.initialize;
    Window_MenuActor.prototype.initialize = function() {
        _Window_MenuActor_initialize.call(this);
        this._item = null;
    };

    Window_MenuActor.prototype.canEnlargeSelection = function() {
        if (!this._item) {
            return false;
        }
        var actor = $gameParty.menuActor();
        var action = new Game_Action(actor);
        action.setItemObject(this._item);
        return 1 < $gameParty.members().length && action.canEnlargeSelection();
    };

    Window_MenuActor.prototype.isSelectionEnlarged = function() {
        return this.canEnlargeSelection() && this.cursorAll();
    };
    
    var _Window_MenuActor_selectForItem = Window_MenuActor.prototype.selectForItem;
    Window_MenuActor.prototype.selectForItem = function(item) {
        _Window_MenuActor_selectForItem.call(this, item);
        this._item = item;
    };

    var _Window_MenuActor_processCursorMove = Window_MenuActor.prototype.processCursorMove;
    Window_MenuActor.prototype.processCursorMove = function() {
        // TODO: What if the party members are more than 4?
        _Window_MenuActor_processCursorMove.call(this);
        if (this.isOpenAndActive() && !this._cursorFixed && this.maxItems() > 0) {
            if (!this.canEnlargeSelection()) {
                return;
            }
            if (!this.cursorAll()) {
                if (Input.isRepeated('right') || Input.isRepeated('pagedown')) {
                    SoundManager.playCursor();
                    this.setCursorAll(true);
                    this.updateCursor();
                }
            } else {
                if (Input.isRepeated('left') || Input.isRepeated('pageup')) {
                    SoundManager.playCursor();
                    this.setCursorAll(false);
                    this.selectLast();
                    this.updateCursor();
                }
            }
        }
    };

    var _Scene_ItemBase_itemTargetActors = Scene_ItemBase.prototype.itemTargetActors
    Scene_ItemBase.prototype.itemTargetActors = function() {
        if (this._actorWindow.isSelectionEnlarged()) {
            return $gameParty.members();
        }
        return _Scene_ItemBase_itemTargetActors.call(this);
    };

    // Drain should always fail for the user.
    var _Game_Action_testApply = Game_Action.prototype.testApply;
    Game_Action.prototype.testApply = function(target) {
        var result = _Game_Action_testApply.call(this, target);
        if (!result) {
            return false;
        }
        if (this.isDrain() && this.subject() === target) {
            return false;
        }
        return true;
    };


    //
    // Magic reflection
    //

    var _Game_Action_itemEva = Game_Action.prototype.itemEva;
    Game_Action.prototype.itemEva = function(target) {
        if (this.isMagical() && this.isRecover()) {
            return 0;
        }
        return _Game_Action_itemEva.call(this, target);
    };

    BattleManager.invokeMagicReflection = function(subject, target) {
        // Reflection is already calculated at startAction.
        this.invokeNormalAction(subject, target);
    };

    var _Game_Battler_performReflection = Game_Battler.prototype.performReflection;
    Game_Battler.prototype.performReflection = function() {
        if (reflectionAnimationId) {
            return;
        }
        _Game_Battler_performReflection.call(this);
    };

    BattleManager.startAction = function() {
        var subject = this._subject;
        var action = subject.currentAction();
        var targets = action.makeTargets();
        // TODO: Use better names
        var normalTargets = [];
        var reflectionTargets = [];
        var reflectedTargets = [];
        targets.forEach(function(target) {
            if (Math.random() < action.itemMrf(target)) {
                reflectionTargets.push(target);
                // Don't use random(Dead)Targets. We want to ignore 'tgr' parameter here.
                var candidates = [];
                if (action.isForDeadFriend()) {
                    candidates = target.isActor() ? $gameTroop.members() : $gameParty.members();
                } else {
                    candidates = target.isActor() ? $gameTroop.aliveMembers() : $gameParty.aliveMembers();
                }
                reflectedTargets.push(candidates[Math.randomInt(candidates.length)]);
                return;
            }
            normalTargets.push(target);
        });
        this._phase = 'action';
        this._action = action;
        this._targets = normalTargets.concat(reflectedTargets);
        subject.useItem(action.item());
        this._action.applyGlobal();
        this.refreshStatus();
        this._logWindow.startActionWithReflection(subject, action, normalTargets, reflectionTargets, reflectedTargets);
        reflectionTargets.forEach(function(target) {
            this._logWindow.displayReflection(target);
        }, this);
    };

    Window_BattleLog.prototype.startActionWithReflection = function(subject, action, targets, reflectionTargets, reflectedTargets) {
        var item = action.item();
        this.push('performActionStart', subject, action);
        this.push('waitForMovement');
        this.push('performAction', subject, action);
        if (reflectionAnimationId) {
            this.push('showAnimation', subject, reflectionTargets.clone(), reflectionAnimationId);
        }
        this.push('showAnimation', subject, targets.clone(), item.animationId);
        this.displayAction(subject, item);
        if (reflectedTargets.length) {
            for (var i = 0; i < 4; i++) {
                this.push('wait');
            }
            this.push('showAnimation', subject, reflectedTargets.clone(), item.animationId);
        }
    };

})();
