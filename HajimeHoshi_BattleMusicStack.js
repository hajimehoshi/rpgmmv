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
 * @plugindesc Battle music stack
 * @author Hajime Hoshi
 *
 * @help This plugin offers a stack for battle music.
 * This is useful when you want to change the battle music temporarily.
 * The stack state is not saved as a saved file, so do not save while the stack is used.
 *
 * Plugin Command:
 *   BattleMusicStack push # Push the current battle music to the stack.
 *   BattleMusicStack pop  # Pop from the battle music stack and set it as current.
 */

(function() {
    var stack = [];

    var _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        _Game_Interpreter_pluginCommand.call(this, command, args);
        if (command === 'BattleMusicStack') {
            switch (args[0]) {
            case 'push':
                stack.push($gameSystem.battleBgm());
                break;
            case 'pop':
                $gameSystem.setBattleBgm(stack.pop());
                break;
            }
        }
    };
})()
