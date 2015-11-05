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
 * @plugindesc Battle BGM stack
 * @author Hajime Hoshi
 *
 * @help This plugin offers a stack for battle BGM.
 * This is useful when you want to change the battle BGM temporarily.
 *
 * Plugin Command:
 *   BattleBGMStack push # Push the current battle BGM to the stack.
 *   BattleBGMStack pop  # Pop from the battle BGM stack and set it as current.
 */

(function() {
    'use strict';

    Game_System.prototype.pushBattleBgmStack = function() {
        if (this._battleBgmStack === undefined) {
            this._battleBgmStack = [];
        }
        this._battleBgmStack.push(this.battleBgm());
    };

    Game_System.prototype.popBattleBgmStack = function() {
        if (this._battleBgmStack === undefined) {
            this._battleBgmStack = [];
        }
        this.setBattleBgm(this._battleBgmStack.pop());
    };

    var _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        _Game_Interpreter_pluginCommand.call(this, command, args);
        if (command === 'BattleBGMStack') {
            switch (args[0]) {
            case 'push':
                $gameSystem.pushBattleBgmStack();
                break;
            case 'pop':
                $gameSystem.popBattleBgmStack();
                break;
            }
        }
    };
})()
