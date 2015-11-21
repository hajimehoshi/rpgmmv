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
 * @plugindesc Mini Map like FF6
 * @author Hajime Hoshi
 *
 * @help This plugin enables to show a small map.
 *
 * MapInfo Note:
 *   <mini_map> # Show a mini map for this map.
 */

(function() {
    'use strict';

    var miniMapBitmaps = {};
    var POSITION_RADIUS = 4;

    /**
     * Replaces the pixel data.
     *
     * @method replacePixels.
     * @param {Uint8Array|Uint8ClampedArray} pixels The pixels representing RGBA values.
     */
    Bitmap.prototype.replacePixels = function(pixels) {
        var imageData = this._context.createImageData(this.width, this.height);
        imageData.data.set(pixels);
        this._context.putImageData(imageData, 0, 0);
        this._setDirty();
    };

    var Scene_Map_onMapLoaded = Scene_Map.prototype.onMapLoaded;
    Scene_Map.prototype.onMapLoaded = function() {
        Scene_Map_onMapLoaded.call(this);
        if (!$dataMap.meta.mini_map) {
            return;
        }
        if ($gameMap.mapId() in miniMapBitmaps) {
            return;
        }
        var pixels = new Uint8Array(4 * $dataMap.width * $dataMap.height);
        var p = 0;
        for (var j = 0; j < $dataMap.height; j++) {
            for (var i = 0; i < $dataMap.width; i++) {
                pixels[p]   = 255;
                pixels[p+1] = 255;
                pixels[p+2] = 255;
                if ($gameMap.checkPassage(i, j, 0x0f)) {
                    // Walkable
                    pixels[p+3] = 192;
                } else if (!$gameMap.isShipPassable(i, j)) {
                    // Not passable by ship
                    pixels[p+3] = 128;
                } else {
                    // Others
                    pixels[p+3] = 64;
                }
                p += 4;
            }
        }
        var bitmap = new Bitmap($dataMap.width, $dataMap.height);
        bitmap.replacePixels(pixels);
        miniMapBitmaps[$gameMap.mapId()] = bitmap;
    };

    var Spriteset_Map_createUpperLayer = Spriteset_Map.prototype.createUpperLayer;
    Spriteset_Map.prototype.createUpperLayer = function() {
        Spriteset_Map_createUpperLayer.call(this);
        this.createMiniMap();
    };

    Spriteset_Map.prototype.createMiniMap = function() {
        this._miniMapSprite = new Sprite();
        this._miniMapCurrentPositionSprite = new Sprite();
        var positionBitmap = new Bitmap(POSITION_RADIUS * 2, POSITION_RADIUS * 2);
        positionBitmap.drawCircle(POSITION_RADIUS, POSITION_RADIUS, POSITION_RADIUS, '#ff0000');
        this._miniMapCurrentPositionSprite.bitmap = positionBitmap;
        this.addChild(this._miniMapSprite);
        this.addChild(this._miniMapCurrentPositionSprite);
    };

    var Spriteset_Map_update = Spriteset_Map.prototype.update;
    Spriteset_Map.prototype.update = function() {
        Spriteset_Map_update.call(this);
        this.updateMiniMap();
    };

    Spriteset_Map.prototype.updateMiniMap = function() {
        var miniMapBitmap = miniMapBitmaps[$gameMap.mapId()];
        if (!miniMapBitmap) {
            this._miniMapSprite.opaque = false;
            this._miniMapCurrentPositionSprite.opaque = false;
            return;
        }
        var miniMapX = Graphics.width - miniMapBitmap.width - 16;
        var miniMapY = Graphics.height - miniMapBitmap.height - 16;
        this._miniMapSprite.bitmap = miniMapBitmap;
        this._miniMapSprite.x = miniMapX;
        this._miniMapSprite.y = miniMapY;
        this._miniMapSprite.opaque = true;
        this._miniMapCurrentPositionSprite.x = miniMapX + $gamePlayer.x - POSITION_RADIUS;
        this._miniMapCurrentPositionSprite.y = miniMapY + $gamePlayer.y - POSITION_RADIUS;
        this._miniMapCurrentPositionSprite.opaque = true;
    };

})();
