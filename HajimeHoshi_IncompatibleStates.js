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
 * @plugindesc Enables 'incompatible' states
 * @author Hajime Hoshi
 *
 * @help
 *
 * State Note:
 *   <incompatible_with:10,11> # Sets state #10 and #11 as incompatible states,
 *                             # which means if the state is added to a battler,
 *                             # state #10 and #11 are automatically removed
 *                             # from the battler.
 */

(function() {
    'use strict';

    var _Game_BattlerBase_addNewState = Game_BattlerBase.prototype.addNewState;
    Game_BattlerBase.prototype.addNewState = function(stateId) {
        _Game_BattlerBase_addNewState.call(this, stateId);
        var state = $dataStates[stateId];
        var incompatibleStates = state.meta.incompatible_with;
        if (incompatibleStates) {
            var states = incompatibleStates.split(',');
            states.forEach(function(state) {
                var stateId = Number(state);
                this.removeState(stateId); 
            }, this);
        }
    };
})();
