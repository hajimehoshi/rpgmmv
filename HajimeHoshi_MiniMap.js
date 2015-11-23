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

    var MINI_MAP_MARGIN = 16;
    var MINI_MAP_SIZE = 184;
    var POSITION_RADIUS = 4;
    var COLORS = {
        'walk':     [192, 192, 192, 224],
        'mountain': [255, 255, 255, 224],
        'other':    [128, 128, 128, 192],
    };

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

    function isWater(gameMap, x, y) {
        if (gameMap.isOverworld()) {
            var tileId = gameMap.autotileType(x, y, 0);
            if ([0, 1, 2, 3, 7].some(function(id) {
                return id === tileId;
            })) {
                return true;
            }
        }
        return gameMap.isShipPassable(x, y);
    }

    var Scene_Map_onMapLoaded = Scene_Map.prototype.onMapLoaded;
    Scene_Map.prototype.onMapLoaded = function() {
        Scene_Map_onMapLoaded.call(this);
        // |$dataMap.meta| can be null on event testing.
        if (!$dataMap.meta || !$dataMap.meta.mini_map) {
            return;
        }
        if ($gameMap.mapId() in miniMapBitmaps) {
            return;
        }
        var pixels = new Uint8Array(4 * $dataMap.width * $dataMap.height);
        var p = 0;
        for (var j = 0; j < $dataMap.height; j++) {
            for (var i = 0; i < $dataMap.width; i++) {
                var color = null;
                if ($gameMap.checkPassage(i, j, 0x0f)) {
                    color = COLORS['walk'];
                } else if (!isWater($gameMap, i, j)) {
                    color = COLORS['mountain'];
                } else {
                    color = COLORS['other'];
                }
                pixels[p]   = color[0];
                pixels[p+1] = color[1];
                pixels[p+2] = color[2];
                pixels[p+3] = color[3];
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
            this._miniMapSprite.visible = false;
            this._miniMapCurrentPositionSprite.visible = false;
            return;
        }
        var size = Math.max(miniMapBitmap.width, miniMapBitmap.height);
        var miniMapScale = MINI_MAP_SIZE / size;
        var miniMapX = Graphics.width - miniMapBitmap.width * miniMapScale - MINI_MAP_MARGIN;
        var miniMapY = Graphics.height - miniMapBitmap.height * miniMapScale - MINI_MAP_MARGIN;
        this._miniMapSprite.bitmap = miniMapBitmap;
        this._miniMapSprite.x = miniMapX;
        this._miniMapSprite.y = miniMapY;
        this._miniMapSprite.scale.x = miniMapScale;
        this._miniMapSprite.scale.y = miniMapScale;
        this._miniMapCurrentPositionSprite.x = miniMapX + ($gamePlayer.x * miniMapScale) - POSITION_RADIUS;
        this._miniMapCurrentPositionSprite.y = miniMapY + ($gamePlayer.y * miniMapScale) - POSITION_RADIUS;

        this._miniMapSprite.visible = true;
        this._miniMapCurrentPositionSprite.visible = true;
    };

})();
