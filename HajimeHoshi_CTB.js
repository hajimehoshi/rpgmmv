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
 * @help This plugin offers Count Time Battle system.
 * Note that this is not 'ATB' but 'CTB' because time stops for any actions.
 * I used EllyeSimpleATB.js as reference (http://pastebin.com/fhGC2Sn7).
 */

(function() {
    // WP means 'waiting time'.

    //
    // UI
    //

    var MAX_WP = 65536;
    var AVERAGE_TIME = 60;

    Window_BattleStatus.prototype.gaugeAreaWidth = function() {
        return 400;
    };

    Window_BattleStatus.prototype.drawGaugeAreaWithTp = function(rect, actor) {
        this.drawActorHp(actor, rect.x + 0, rect.y, 97);
        this.drawActorMp(actor, rect.x + 112, rect.y, 86);
        this.drawActorTp(actor, rect.x + 213, rect.y, 86);
        this.drawActorWp(actor, rect.x + 314, rect.y, 86);
    };

    Window_BattleStatus.prototype.drawGaugeAreaWithoutTp = function(rect, actor) {
        this.drawActorHp(actor, rect.x + 0, rect.y, 130);
        this.drawActorMp(actor, rect.x + 145,  rect.y, 120);
        this.drawActorWp(actor, rect.x + 280,  rect.y, 120);
    };
    
    Window_Base.prototype.drawActorWp = function(actor, x, y, width) {
        var color1 = this.textColor(14);
        var color2 = this.textColor(6);
        this.drawGauge(x, y, width, actor.wpRate(), color1, color2);
        this.changeTextColor(this.systemColor());
        this.drawText("Time", x, y, 44);
    };

    //
    // System
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
        // TODO: Consider |_surprise| and |_preemptive|
        this.setWp(Math.randomInt(MAX_WP / 2));
    };

    Game_Battler.prototype.gainWp = function(value) {
        // TODO: Invert |value| if needed (see gainTp())
        this.setWp(this.wp + value);
    };

    var _BattleManager_initMembers = BattleManager.initMembers;
    BattleManager.initMembers = function() {
        _BattleManager_initMembers.call(this);
        this._turnWp = 0;
        this._turnEndSubject = null;
    };

    var _BattleManager_startBattle = BattleManager.startBattle;
    BattleManager.startBattle = function() {
        _BattleManager_startBattle.call(this);
        $gameParty.makeActions();
        $gameTroop.makeActions();
        this.makeActionOrders();
        this._phase = 'waiting';
        this._turnWp = 0;
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

    BattleManager.updateWaiting = function() {
        var activeBattlers = this.allBattleMembers().filter(function(battler) {
            return battler.canMove();
        });
        var averageWpDelta = MAX_WP / AVERAGE_TIME / activeBattlers.length;

        this._turnWp += Math.min(averageWpDelta, MAX_WP)|0;
        if (this._turnWp >= MAX_WP) {
            this._turnWp -= MAX_WP;
            $gameTroop.increaseTurn();
        }

        var totalAgi = activeBattlers.map(function(battler) {
            // TODO: Consider traits (see attackSpped()).
            // NOTE: agi property is already affected by param traits.
            return battler.agi;
        }).reduce(function(previous, current) {
            return previous + current;
        }, 0);
        var averageAgi = totalAgi / this.allBattleMembers().length;
        activeBattlers.forEach(function(battler) {
            var delta = Math.min(averageWpDelta * (battler.agi / averageAgi), MAX_WP)|0;
            battler.gainWp(delta);
        });
        // TODO: Sort battlers here?
        activeBattlers.forEach(function(battler) {
            if (battler.wp < MAX_WP) {
                return;
            }
            this._subject = battler;
            this._turnEndSubject = battler;
            battler.makeActions();
            if (battler.isActor()) {
                if (battler.canInput()) {
                    this._actorIndex = battler.index();
                    this._phase = 'input';
                    return;
                }
                battler.setWp(battler.wp - MAX_WP);
                this._phase = 'turn';
                return
            }
            battler.setWp(battler.wp - MAX_WP);
            this._phase = 'turn';
        }, this);
        this.refreshStatus();
    };

    BattleManager.updateTurnEnd = function() {
        $gameParty.makeActions();
        $gameTroop.makeActions();
        this._phase = 'waiting';
    };

    BattleManager.getNextSubject = function() {
        return null;
    };

    BattleManager.selectNextCommand = function() {
        do {
            if (!this.actor() || !this.actor().selectNextCommand()) {
                this.actor().setWp(this.actor().wp - MAX_WP);
                if (!this.isEscaped()) {
                    this._phase = 'turn';
                }
                $gameParty.requestMotionRefresh();
                break;
            }
        } while (!this.actor().canInput());
    };

    BattleManager.selectPreviousCommand = function() {
        // Do nothing
        // TODO: Implement skipping the current turn.
    };

    BattleManager.endTurn = function() {
        this._phase = 'turnEnd';
        this._preemptive = false;
        this._surprise = false;
        if (this._turnEndSubject !== null) {
            this._turnEndSubject.onTurnEnd();
            this.refreshStatus();
            this._logWindow.displayAutoAffectedStatus(this._turnEndSubject);
            this._logWindow.displayRegeneration(this._turnEndSubject);
        }
    };

    BattleManager.startInput = function() {
        throw 'not reach';
    };

    //
    // Escaping
    //

    var _Window_ActorCommand_makeCommandList = Window_ActorCommand.prototype.makeCommandList;
    Window_ActorCommand.prototype.makeCommandList = function() {
        _Window_ActorCommand_makeCommandList.call(this);
        this.addCommand(TextManager.escape, 'escape', BattleManager.canEscape());
    };

    var _Scene_Battle_createActorCommandWindow = Scene_Battle.prototype.createActorCommandWindow;
    Scene_Battle.prototype.createActorCommandWindow = function() {
        _Scene_Battle_createActorCommandWindow.call(this);
        this._actorCommandWindow.setHandler('escape',   this.commandEscape.bind(this));
    };

    Scene_Battle.prototype.commandEscape = function() {
        BattleManager.processEscape();
        this.selectNextCommand();
    };

    BattleManager.startTurn = function() {
        throw 'not reach';
    };

    BattleManager.makeEscapeRatio = function() {
        this._escapeRatio = 0.25 * $gameParty.agility() / $gameTroop.agility();
    };

    BattleManager.processEscape = function() {
        $gameParty.removeBattleStates();
        $gameParty.performEscape();
        SoundManager.playEscape();
        var success = this._preemptive ? true : (Math.random() < this._escapeRatio);
        if (success) {
            this.displayEscapeSuccessMessage();
            this._escaped = true;
            this.processAbort();
        } else {
            this.displayEscapeFailureMessage();
            this._escapeRatio += 0.05;
            $gameParty.clearActions();
        }
        return success;
    };

})();
