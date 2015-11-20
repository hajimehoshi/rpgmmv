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
        return this._scaleForAirship;
    };

    Game_Map.prototype.setScaleForAirship = function(scale) {
        this._scaleForAirship = scale;
    };

    var Game_Player_centerX = Game_Player.prototype.centerX;
    Game_Player.prototype.centerX = function() {
        return Game_Player_centerX.call(this) * $gameMap.scaleForAirship();
    };

    var Game_Player_centerY = Game_Player.prototype.centerY;
    Game_Player.prototype.centerY = function() {
        return Game_Player_centerY.call(this) * $gameMap.scaleForAirship();
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

    var Scene_Map_updateMain = Scene_Map.prototype.updateMain;
    Scene_Map.prototype.updateMain = function() {
        var airship = $gameMap.airship();
        var wasHighest = airship.isHighest();
        var wasInAirship = $gamePlayer.isInAirship();
        Scene_Map_updateMain.call(this);
        $gameMap.setScaleForAirship(1);
        if ($gamePlayer.isInAirship()) {
            if (!airship.isHighest()) {
                var rate = (airship.altitude() / airship.maxAltitude());
                $gameMap.setScaleForAirship(rate * maxScale + (1 - rate) * 1);
                $gamePlayer.center($gamePlayer.x, $gamePlayer.y);
            } else {
                $gameMap.setScaleForAirship(maxScale);
                if (!wasHighest) {
                    $gamePlayer.center($gamePlayer.x, $gamePlayer.y);
                }
            }
        } else if (wasInAirship) {
            $gamePlayer.center($gamePlayer.x, $gamePlayer.y);
        }
        this._spriteset._tilemap.scale.x = 1 / $gameMap.scaleForAirship();
        this._spriteset._tilemap.scale.y = 1 / $gameMap.scaleForAirship();
    };

})();
