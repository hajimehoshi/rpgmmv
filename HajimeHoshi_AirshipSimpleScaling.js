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
 * @plugindesc Airship like FF4
 * @author Hajime Hoshi
 *
 * @param Max Scale
 * @desc The drawing scale when the airship is in the highest position.
 * @default 2
 *
 * @help This plugin enables to scale a map when using a airship like FF4.
 */

(function() {
    'use strict'

    var parameters = PluginManager.parameters('HajimeHoshi_AirshipSimpleScaling');
    var maxScale = Number(parameters['Max Scale'] || 2);

    var Tilemap_initialize = Tilemap.prototype.initialize;
    Tilemap.prototype.initialize = function() {
        Tilemap_initialize.call(this);
        this.width *= maxScale
        this.height *= maxScale;
    };

    Game_Vehicle.prototype.altitude = function() {
        return this._altitude;
    };

    var Game_Map_initialize = Game_Map.prototype.initialize;
    Game_Map.prototype.initialize = function() {
        Game_Map_initialize.call(this);
        this._scaleForAirship = 1;
    };

    Game_Map.prototype.scaleForAirship = function() {
        // |_scaleForAirship| may not be defined when loading an existing data.
        if (typeof this._scaleForAirship === 'undefined') {
            this._scaleForAirship = 1;
        }
        return this._scaleForAirship;
    };

    Game_Map.prototype.setScaleForAirship = function(scale) {
        this._scaleForAirship = scale;
    };

    Game_Player.prototype.centerX = function() {
        return (Graphics.width / ($gameMap.tileWidth() / $gameMap.scaleForAirship()) - 1) / 2.0;
    };

    Game_Player.prototype.centerY = function() {
        return (Graphics.height / ($gameMap.tileHeight() / $gameMap.scaleForAirship()) - 1) / 2.0;
    };

    var Game_Map_screenTileX = Game_Map.prototype.screenTileX;
    Game_Map.prototype.screenTileX = function() {
        return Game_Map_screenTileX.call(this) * this.scaleForAirship();
    };

    var Game_Map_screenTileY = Game_Map.prototype.screenTileY;
    Game_Map.prototype.screenTileY = function() {
        return Game_Map_screenTileY.call(this) * this.scaleForAirship();
    };

    Game_Map.prototype.canvasToMapX = function(y) {
        var tileWidth = this.tileWidth() / this.scaleForAirship();
        var originX = this._displayX * tileWidth;
        var mapX = Math.floor((originX + y) / tileWidth);
        return this.roundX(mapX);
    };

    Game_Map.prototype.canvasToMapY = function(y) {
        var tileHeight = this.tileHeight() / this.scaleForAirship();
        var originY = this._displayY * tileHeight;
        var mapY = Math.floor((originY + y) / tileHeight);
        return this.roundY(mapY);
    };

    Scene_Map.prototype.updateMain = function() {
        var airship = $gameMap.airship();
        var wasHighest = airship.isHighest();

        var active = this.isActive();
        $gameMap.update(active);

        // Center the player before calling $gamePlayer.update because
        // airship.isHighest has been changed so that the player can move.
        // Centering should be done before the player moves.
        $gameMap.setScaleForAirship(1);
        if ($gamePlayer.isInAirship()) {
            var rate = (airship.altitude() / airship.maxAltitude());
            $gameMap.setScaleForAirship(rate * maxScale + (1 - rate) * 1);
            if (!airship.isHighest() || !wasHighest) {
                $gamePlayer.center($gamePlayer.x, $gamePlayer.y);
            }
        }
        this._spriteset._tilemap.scale.x = 1 / $gameMap.scaleForAirship();
        this._spriteset._tilemap.scale.y = 1 / $gameMap.scaleForAirship();

        $gamePlayer.update(active);
        $gameTimer.update(active);
        $gameScreen.update();
    };

})();
