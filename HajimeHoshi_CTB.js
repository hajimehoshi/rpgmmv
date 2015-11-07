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
 * @help This plugin offers Count Time Battle system.
 * A battler has a 'waiting point' and this increases for each frame.
 * A battler becames actionable when its waiting point reaches maximum (65536).
 * Note that this is not 'ATB' but 'CTB' because time stops for any actions.
 * I used EllyeSimpleATB.js as reference (http://pastebin.com/fhGC2Sn7).
 */

(function() {
    'use strict';

    var parameters = PluginManager.parameters('HajimeHoshi_CTB');
    // TODO: Consider traits (see attackSpped()).
    var formula = String(parameters['Formula'] || 'a.agi / (battlers.reduce(function(p, b) { return p + b.agi; }, 0) / battlers.length)');

    var MAX_WP = 65536;
    var AVERAGE_TIME = 60;

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
        this.setBackgroundType(1);
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
        this._battlerNames.forEach(function(name) {
            this.addCommand(name, '');
        }, this);
    };

    //
    // Use Window_BattleTurns
    //

    Scene_Battle.prototype.createTurnsWindow = function() {
        this._turnsWindow = new Window_BattleTurns();
        this.addWindow(this._turnsWindow);
    };

    var _Scene_Battle_createAllWindows = Scene_Battle.prototype.createAllWindows;
    Scene_Battle.prototype.createAllWindows = function() {
        _Scene_Battle_createAllWindows.call(this);
        this.createTurnsWindow();
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

    // TODO: This affects onTurnEndOnMap. Check that works correctly.
    Game_Battler.prototype.onTurnEnd = function() {
        this.clearResult();
    };

    Game_Battler.prototype.onTurnStart = function() {
        this.clearResult();
        this.regenerateAll();
        this.updateStateTurns();
        this.updateBuffTurns();
        this.removeStatesAuto(2);
    };

    var _BattleManager_initMembers = BattleManager.initMembers;
    BattleManager.initMembers = function() {
        _BattleManager_initMembers.call(this);
        this._turnWp = 0;
        this._turnEndSubject = null;
        this._turnsWindow = null;
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
        this._phase = 'waiting';
        this._turnWp = 0;
    };

    BattleManager.makeActionOrders = function() {
        throw 'not reach';
    };

    var _BattleManager_update = BattleManager.update;
    BattleManager.update = function() {
        _BattleManager_update.call(this);
        if (!this.isBusy() && !this.updateEvent()) {
            switch (this._phase) {
            case 'waiting':
                this.updateWaiting();
                break;
            }
        }
    };

    function evalWpRate(battler, battlers) {
        var a = battler;
        return Math.max(eval(formula), 0);
    }

    function calcTurns(allBattleMembers) {
        var activeBattlers = allBattleMembers.filter(function(battler) {
            return battler.canMove();
        });
        var averageWpDelta = MAX_WP / AVERAGE_TIME;

        var wps = {};
        for (var i = 0; i < activeBattlers.length; i++) {
            wps[i] = activeBattlers[i].wp;
        }

        var battlers = [];
        for (;;) {
            for (var i = 0; i < activeBattlers.length; i++) {
                if (wps[i] >= MAX_WP) {
                    battlers.push(activeBattlers[i]);
                    wps[i] -= MAX_WP;
                }
            }
            if (battlers.length >= 6) {
                break;
            }
            for (var i = 0; i < activeBattlers.length; i++) {
                var rate = evalWpRate(activeBattlers[i], activeBattlers);
                wps[i] += (averageWpDelta * rate).clamp(0, MAX_WP)|0;;
            }
        }
        battlers.length = 6;
        return battlers;
    };

    BattleManager.updateWaiting = function() {
        this._turnsWindow.open();

        $gameParty.requestMotionRefresh();

        var activeBattlers = this.allBattleMembers().filter(function(battler) {
            return battler.canMove();
        });
        var averageWpDelta = MAX_WP / AVERAGE_TIME;

        this._turnEndSubject = null;

        this._turnWp += averageWpDelta.clamp(0, MAX_WP)|0;
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

        var battlers = calcTurns(this.allBattleMembers());
        this._turnsWindow.setBattlers(battlers);
        this._turnsWindow.refresh();

        // Actual updating waiting points.
        do {
            activeBattlers.forEach(function(battler) {
                var rate = evalWpRate(battler, activeBattlers);
                var delta = (averageWpDelta * rate).clamp(0, MAX_WP)|0;
                battler.setWp(battler.wp + delta);
            });
        } while (activeBattlers.every(function(battler) {
            return battler.wp < MAX_WP;
        }));

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
        battler.makeActions();
        if (battler.isActor() && battler.canInput()) {
            battler.setActionState('inputting');
            this._actorIndex = battler.index();
            this._phase = 'input';
            this.refreshStatus();
            return;
        }
        this._phase = 'turn';
        this.refreshStatus();
    };

    // TODO: override processTurn?

    BattleManager.updateTurnEnd = function() {
        this._phase = 'waiting';
    };

    BattleManager.getNextSubject = function() {
        return null;
    };

    BattleManager.selectNextCommand = function() {
        do {
            if (!this.actor().selectNextCommand()) {
                if (!this.isEscaped()) {
                    this._phase = 'turn';
                }
                $gameParty.requestMotionRefresh();
                break;
            }
        } while (!this.actor().canInput());
    };

    BattleManager.selectPreviousCommand = function() {
        do {
            if (!this.actor().selectPreviousCommand()) {
                return;
            }
        } while (!this.actor().canInput());
    };

    BattleManager.endTurn = function() {
        this._phase = 'turnEnd';
        if (this._turnEndSubject) {
            this._turnEndSubject.setWp(this._turnEndSubject.wp - MAX_WP);
            this._turnEndSubject.onTurnEnd();
            this._turnEndSubject.setActionState('undecided');
        }
    };

    BattleManager.startInput = function() {
        throw 'not reach';
    };

    BattleManager.startTurn = function() {
        // Do nothing. This can be reached when 'escape' command is selected.
    };

    var _BattleManager_endBattle = BattleManager.endBattle;
    BattleManager.endBattle = function(result) {
        _BattleManager_endBattle.call(this, result);
        this._turnsWindow.close();
    };

    Sprite_Actor.prototype.updateTargetPosition = function() {
        if (this._actor.canMove() && BattleManager.isEscaped()) {
            this.retreat();
        } else if (this._actor.isInputting() || this._actor.isActing()) {
            this.stepForward();
        } else if (!this.inHomePosition()) {
            this.stepBack();
        }
    };
})();
