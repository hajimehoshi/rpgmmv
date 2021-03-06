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
 * @plugindesc CTB (Count Time Battle) like FF10.
 * @author Hajime Hoshi
 *
 * @param Formula 
 * @desc The formula to calculate the multiplier of the waiting point for a turn.
 * @default a.agi / (battlers.reduce(function(p, b) { return p + b.agi; }, 0) / battlers.length)
 *
 * @help
 *
 * This plugin offers Count Time Battle system.
 * A battler has a 'waiting point' and this increases for each frame.
 * A battler becames actionable when its waiting point reaches maximum (65536).
 * I used EllyeSimpleATB.js as reference (http://pastebin.com/fhGC2Sn7).
 */

(function() {
    'use strict';

    var parameters = PluginManager.parameters('HajimeHoshi_CTB');
    // TODO: Consider traits (see attackSpped()).
    var formula = String(parameters['Formula'] || 'a.agi / (battlers.reduce(function(p, b) { return p + b.agi; }, 0) / battlers.length)');

    var MAX_WP = 65536;
    var AVERAGE_WP_DELTA = MAX_WP / 60;

    //
    // Window_BattleTurns
    //

    function Window_BattleTurns() {
        this.initialize.apply(this, arguments);
    }

    Window_BattleTurns.prototype = Object.create(Window_Command.prototype);
    Window_BattleTurns.prototype.constructor = Window_BattleTurns;

    Window_BattleTurns.prototype.initialize = function() {
        this._battlerNames = [];
        var x = Graphics.boxWidth - this.windowWidth();
        var y = 0;
        Window_Command.prototype.initialize.call(this, x, y);
        this.openness = 0;
        this.deactivate();
        this.setBackgroundType(2);
        this.refresh();
    };

    Window_BattleTurns.prototype.numVisibleRows = function() {
        return 5;
    };

    Window_BattleTurns.prototype.setBattlers = function(battlers) {
        this._battlerNames = battlers.map(function(battler) {
            return battler.name();
        });
    };

    Window_BattleTurns.prototype.makeCommandList = function() {
        for (var i = 0; i < this._battlerNames.length; i++) {
            var name = this._battlerNames[i];
            this.addCommand(name, '');
        }
    };

    //
    // Use Window_BattleTurns
    //

    Scene_Battle.prototype.createTurnsWindow = function() {
        this._turnsWindow = new Window_BattleTurns();
        this.addWindow(this._turnsWindow);
    };

    Window_BattleLog.prototype.windowWidth = function() {
        return Graphics.boxWidth - Window_Command.prototype.windowWidth();
    };

    var _Scene_Battle_createAllWindows = Scene_Battle.prototype.createAllWindows;
    Scene_Battle.prototype.createAllWindows = function() {
        this.createTurnsWindow();
        _Scene_Battle_createAllWindows.call(this);
    };

    var _Scene_Battle_createDisplayObjects = Scene_Battle.prototype.createDisplayObjects;
    Scene_Battle.prototype.createDisplayObjects = function() {
        _Scene_Battle_createDisplayObjects.call(this);
        BattleManager.setTurnsWindow(this._turnsWindow);
    };

    BattleManager.setTurnsWindow = function(turnsWindow) {
        this._turnsWindow = turnsWindow;
    };

    //
    // 'wp' parameter
    //

    Object.defineProperty(Game_BattlerBase.prototype, 'wp', {
        get: function() { return this._wp; },
        configurable: true,
    });

    var _Game_BattlerBase_initMembers = Game_BattlerBase.prototype.initMembers;
    Game_BattlerBase.prototype.initMembers = function() {
        this._wp = 0;
        _Game_BattlerBase_initMembers.call(this);
    };

    Game_BattlerBase.prototype.wpRate = function() {
        return (this.wp / MAX_WP).clamp(0, 1);
    };

    Game_BattlerBase.prototype.setWp = function(wp) {
        this._wp = wp;
        this.refresh();
    };

    var _Game_Battler_onBattleStart = Game_Battler.prototype.onBattleStart;
    Game_Battler.prototype.onBattleStart = function() {
        _Game_Battler_onBattleStart.call(this);
        this.setWp(Math.randomInt(MAX_WP / 2));
    };

    var _Game_BattlerBase_die = Game_BattlerBase.prototype.die;
    Game_BattlerBase.prototype.die = function() {
        this._wp = 0;
        _Game_BattlerBase_die.call(this); // refresh should be called inside.
    };

    //
    // System
    //

    Game_Battler.prototype.onTurnEnd = function() {
        this.clearResult();
        this.updateStateTurns();
        this.updateBuffTurns();
        this.removeStatesAuto(2);
    };

    Game_Battler.prototype.onTurnStart = function() {
        this.clearResult();
        this.regenerateAll();
    };

    var _BattleManager_initMembers = BattleManager.initMembers;
    BattleManager.initMembers = function() {
        _BattleManager_initMembers.call(this);
        this._turnWp = 0;
        this._turnEndSubject = null;
        this._turnsWindow = null;
        this._interruptingBattlers = [];
    };

    BattleManager.addInterruptingBattler = function(battler) {
        this._interruptingBattlers.push(battler);
    };

    var _BattleManager_startBattle = BattleManager.startBattle;
    BattleManager.startBattle = function() {
        _BattleManager_startBattle.call(this);
        if (this._preemptive) {
            $gameParty.members().forEach(function(member) {
                member.setWp(MAX_WP);
            });
        }
        if (this._surprise) {
            $gameTroop.members().forEach(function(member) {
                member.setWp(MAX_WP);
            });
        }
        this._preemptive = false;
        this._surprise = false;
        this._turnWp = 0;
    };

    BattleManager.makeActionOrders = function() {
        this._actionBattlers = [];
        if (this._subject) {
            this._actionBattlers.push(this._subject);
        }
    };

    function evalWpRate(battler, battlers) {
        var a = battler;
        return Math.max(eval(formula), 0);
    }

    function calcTurns(battlers, num) {
        var wps = {};
        for (var i = 0; i < battlers.length; i++) {
            wps[i] = battlers[i].wp;
        }

        var result = [];
        for (;;) {
            for (var i = 0; i < battlers.length; i++) {
                if (wps[i] >= MAX_WP) {
                    result.push(battlers[i]);
                    wps[i] -= MAX_WP;
                }
            }
            if (result.length >= num) {
                break;
            }
            for (var i = 0; i < battlers.length; i++) {
                if (battlers[i].isDead()) {
                    continue;
                }
                var rate = evalWpRate(battlers[i], battlers);
                wps[i] += (AVERAGE_WP_DELTA * rate).clamp(0, MAX_WP)|0;
            }
        }
        result.length = num;
        return result;
    };

    function proceedTilSomeoneHasTurn(battlers) {
        do {
            // TODO: This logic is copied from calcTurns. Refactor this.
            battlers.forEach(function(battler) {
                if (battler.isDead()) {
                    return;
                }
                var rate = evalWpRate(battler, battlers);
                var delta = (AVERAGE_WP_DELTA * rate).clamp(0, MAX_WP)|0;
                battler.setWp(battler.wp + delta);
            });
        } while (battlers.every(function(battler) {
            return battler.wp < MAX_WP;
        }));
    };

    BattleManager.startInput = function() {
        this._turnsWindow.open();

        $gameParty.requestMotionRefresh();

        this._turnEndSubject = null;

        this._turnWp += AVERAGE_WP_DELTA|0;
        if (this._turnWp >= MAX_WP) {
            this._turnWp -= MAX_WP;
            // TODO: Check events work correctly.
            $gameTroop.increaseTurn();
        }
        if ($gameParty.isEmpty() || this.isAborting() ||
            $gameParty.isAllDead() || $gameTroop.isAllDead()) {
            this._phase = 'turnEnd';
            return;
        }

        var allAppearedMembers = this.allBattleMembers().filter(function(battler) {
            return battler.isAppeared();
        });
        // TODO: It would be much better if the turns are updated on selecting a skill of an actor.
        var battlers = calcTurns(allAppearedMembers, this._turnsWindow.numVisibleRows());
        // TODO: What if an interrupting battler is dead?
        battlers = this._interruptingBattlers.concat(battlers);
        battlers.length = this._turnsWindow.numVisibleRows();
        // TODO: Show gray if a battler is inactive?
        // TODO: Better colors
        // TODO: Show arrows for targets
        this._turnsWindow.setBattlers(battlers);
        this._turnsWindow.refresh();

        if (this._interruptingBattlers.length) {
            this._interruptingBattlers.shift();
        } else {
            proceedTilSomeoneHasTurn(allAppearedMembers);
        }

        var battler = battlers[0];
        var wasAlive = battler.isAlive();
        battler.onTurnStart();
        this.refreshStatus();
        this._logWindow.displayAutoAffectedStatus(battler);
        this._logWindow.displayRegeneration(battler);
        if (wasAlive && !battler.isAlive()) {
            for (var i = 0; i < 4; i++) {
                this._logWindow.push('wait');
            }
        }

        // TODO: What if the battler becomes inactive?

        this._subject = battler;
        this._turnEndSubject = battler;
        if (battler.isActor() && battler.canInput()) {
            this._phase = 'input';
        } else {
            this._phase = 'turn';
        }

        $gameParty.clearActions();
        $gameParty.members().forEach(function(actor) {
            actor.setActionState('undecided');
        });
        $gameTroop.clearActions();
        $gameTroop.members().forEach(function(enemy) {
            enemy.setActionState('waiting');
        });
        battler.makeActions();

        if (battler.isActor() && battler.canInput()) {
            if (this.actor()) {
                throw 'invalid state';
            }
            // Since this.actor() is null, the second argument is not used.
            this.changeActor(battler.index(), '');
        } else {
            this.clearActor();
        }

        if (!$gameParty.canInput()) {
            this.startTurn();
        }
    };

    BattleManager.selectNextCommand = function() {
        if (!this.actor().selectNextCommand()) {
            this.startTurn();
        }
    };

    BattleManager.selectPreviousCommand = function() {
        this.actor().selectPreviousCommand();
    };

    BattleManager.endTurn = function() {
        this._phase = 'turnEnd';
        if (this._turnEndSubject) {
            // The current wp might be less than MAX_WP when the actor was intrrupting.
            var nextWp = this._turnEndSubject.wp;
            if (MAX_WP <= nextWp) {
                nextWp -= MAX_WP;
            }
            this._turnEndSubject.setWp(nextWp);
            this._turnEndSubject.onTurnEnd();
            this.refreshStatus();
        }
    };

    BattleManager.startTurn = function() {
        this._phase = 'turn';
        // Do not call clearActor here. clearActor clears the action state
        // of the current actor, which is not good. Clearing the action state
        // forces the actor to go back to the original position.
        this._actorIndex = -1;
        this.makeActionOrders();
        $gameParty.requestMotionRefresh();
        this._logWindow.startTurn();
    };

    var _BattleManager_endBattle = BattleManager.endBattle;
    BattleManager.endBattle = function(result) {
        _BattleManager_endBattle.call(this, result);
        this._turnsWindow.close();
    };

    Sprite_Actor.prototype.updateTargetPosition = function() {
        // Change the order to make retreating higher priority.
        if (this._actor.canMove() && BattleManager.isEscaped()) {
            this.retreat();
        } else if (this._actor.isInputting() || this._actor.isActing()) {
            this.stepForward();
        } else if (!this.inHomePosition()) {
            this.stepBack();
        }
    };

    //
    // Conditions
    //

    var _Game_Enemy_initMembers = Game_Enemy.prototype.initMembers;
    Game_Enemy.prototype.initMembers = function() {
        _Game_Enemy_initMembers.call(this);
        this._turn = 0;
    };

    var _Game_Enemy_onTurnEnd = Game_Enemy.prototype.onTurnEnd;
    Game_Enemy.prototype.onTurnEnd = function() {
        _Game_Enemy_onTurnEnd.call(this);
        this._turn++;
    };

    Game_Enemy.prototype.meetsTurnCondition = function(param1, param2) {
        var n = this._turn;
        if (param2 === 0) {
            return n === param1;
        } else {
            // Consider the case when n === 0.
            return n >= param1 && n % param2 === param1 % param2;
        }
    };

})();
