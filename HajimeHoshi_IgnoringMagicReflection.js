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
 * @plugindesc Enables a skill/item to ignore magic reflection rate
 * @author Hajime Hoshi
 *
 * @help
 *
 * Skill/Item Note:
 *   <ignore_reflection> # Ignores the magic reflection rate of the target.
 */

(function() {
    'use strict';

    var _Game_Action_itemMrf = Game_Action.prototype.itemMrf;
    Game_Action.prototype.itemMrf = function(target) {
        if (this.item().meta.ignore_reflection) {
            return 0;
        }
        return _Game_Action_itemMrf.call(this, target);
    };
})();
