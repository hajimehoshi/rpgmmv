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
 * @plugindesc Add 'Escape' command to actor commands instead of party commands.
 * @author Hajime Hoshi
 *
 * @param Rate
 * @desc The multiplier to the probability to escape.
 * @default 1
 *
 * @help This plugin adds 'Escape' command to actor commands instead of party commands.
 * This might be useful when you want to use ATB or CTB.
 */

(function() {
    var parameters = PluginManager.parameters('HajimeHoshi_EscapeAsActorCommand');
    var rate = Number(parameters['Rate'] || 1);

    var _Game_Action_clear = Game_Action.prototype.clear;
    Game_Action.prototype.clear = function() {
        _Game_Action_clear.call(this);
        this._isEscape = false;
    };

    // TODO: setObject should clear the flag |_isEscape|.

    Game_Action.prototype.setEscape = function() {
        this.clear();
        this._isEscape = true;
    };

    Game_Action.prototype.isEscape = function() {
        return this._isEscape;
    };

    var _Game_Action_isValid = Game_Action.prototype.isValid;
    Game_Action.prototype.isValid = function() {
        if (_Game_Action_isValid.call(this)) {
            return true;
        }
        return this.isEscape() && BattleManager.canEscape();
    };

    var _Game_Actor_performAction = Game_Actor.prototype.performAction;
    Game_Actor.prototype.performAction = function(action) {
        _Game_Actor_performAction.call(this, action);
        if (action.isEscape()) {
            this.requestMotion('escape');
        }
    };

    Window_PartyCommand.prototype.makeCommandList = function() {
        this.addCommand(TextManager.fight, 'fight');
    };

    var _Window_ActorCommand_makeCommandList = Window_ActorCommand.prototype.makeCommandList;
    Window_ActorCommand.prototype.makeCommandList = function() {
        _Window_ActorCommand_makeCommandList.call(this);
        this.addCommand(TextManager.escape, 'escape', BattleManager.canEscape());
    };

    var _BattleManager_startAction = BattleManager.startAction;
    BattleManager.startAction = function() {
        if (this._subject.currentAction().isEscape()) {
            BattleManager.processEscape();
            return;
        }
        _BattleManager_startAction.call(this);
    }

    var _Scene_Battle_createActorCommandWindow = Scene_Battle.prototype.createActorCommandWindow;
    Scene_Battle.prototype.createActorCommandWindow = function() {
        _Scene_Battle_createActorCommandWindow.call(this);
        this._actorCommandWindow.setHandler('escape', this.commandEscapeInActorCommands.bind(this));
    };

    Scene_Battle.prototype.commandEscapeInActorCommands = function() {
        BattleManager.inputtingAction().setEscape();
        this.selectNextCommand();
    };

    var _BattleManager_makeEscapeRatio = BattleManager.makeEscapeRatio;
    BattleManager.makeEscapeRatio = function() {
        _BattleManager_makeEscapeRatio.call(this);
        this._escapeRatio *= rate;
    };

    BattleManager.processEscape = function() {
        $gameParty.performEscape();
        SoundManager.playEscape();
        var success = this._preemptive ? true : (Math.random() < this._escapeRatio);
        if (success) {
            this.displayEscapeSuccessMessage();
            this._escaped = true;
            this.processAbort();
        } else {
            this.displayEscapeFailureMessage();
            this._escapeRatio += 0.1 * rate;
            this.startTurn();
        }
        return success;
    };
})();
