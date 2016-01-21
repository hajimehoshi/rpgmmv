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
 * @plugindesc Mini Map like FF6 (ver 0.3.0 alpha)
 * @author Hajime Hoshi
 *
 * @param Picture ID
 * @desc Picture ID reserved for a mini map.
 * @default 90
 *
 * @help This plugin enables to show a mini map.
 * Note that this plugin preserves one picture ID for a mini map,
 * and the picture ID can't be used for a regular picture.
 *
 * Plugin Command:
 *   MiniMap add-pin 1 2 10 20 # Adds a pin #2 at (10, 20) in Map #1.
 *                             # Note that pin ID should be in between 1 and 10.
 *   MiniMap remove-pin 1 2    # Removes a pin #2 in Map #1
 *
 * MapInfo Note:
 *   <mini_map> # Show a mini map for this map.
 *
 * For other information, see:
 * http://forums.rpgmakerweb.com/index.php?/topic/51143-mini-map/
 */

(function() {
    'use strict';

    var parameters = PluginManager.parameters('HajimeHoshi_MiniMap');
    var miniMapPictureId = Number(parameters['Picture ID'] || 90);

    var miniMapBitmaps = {};
    var EMPTY_BITMAP = new Bitmap(16, 16);

    var MINI_MAP_MARGIN = 16;
    var MINI_MAP_SIZE = 184;
    var POSITION_RADIUS = 4;
    var POSITION_COLOR = '#ff0000';
    var PIN_RADIUS = 4;
    var PIN_COLOR = '#0040ff';
    var MAX_PIN_ID = 10;
    var COLORS = {
        'walk':     [192, 192, 192, 224],
        'mountain': [255, 255, 255, 224],
        'other':    [128, 128, 128, 192],
    };

    var _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        _Game_Interpreter_pluginCommand.call(this, command, args);
        if (command !== 'MiniMap') {
            return;
        }
        var mapId = Number(args[1]);
        var pinId = Number(args[2]);
        switch (args[0]) {
        case 'add-pin':
            if (args.length !== 5) {
                throw 'MiniMap add-pins arguments must be equal to 4';
            }
            var x = Number(args[3]);
            var y = Number(args[4]);
            $gameSystem.addMiniMapPin(mapId, pinId, x, y);
            break;
        case 'remove-pin':
            if (args.length !== 3) {
                throw 'MiniMap remove-pins arguments must be equal to 2';
            }
            $gameSystem.removeMiniMapPin(mapId, pinId);
            break;
        }
    }

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

    function Sprite_MiniMapPicture(pictureId) {
        this.initialize.apply(this, arguments);
    }

    Sprite_MiniMapPicture.prototype = Object.create(Sprite_Picture.prototype);
    Sprite_MiniMapPicture.prototype.constructor = Sprite_MiniMapPicture;

    Sprite_MiniMapPicture.prototype.initialize = function(pictureId) {
        Sprite_Picture.prototype.initialize.call(this, pictureId);

        var pinBitmap = new Bitmap(PIN_RADIUS * 2, PIN_RADIUS * 2);
        pinBitmap.drawCircle(PIN_RADIUS, PIN_RADIUS, PIN_RADIUS, PIN_COLOR);
        this._pinSprites = [];
        for (var i = 0; i < MAX_PIN_ID; i++) {
            var sprite = new Sprite();
            sprite.bitmap = pinBitmap;
            this._pinSprites.push(sprite);
            this.addChild(sprite);
        }

        var positionBitmap = new Bitmap(POSITION_RADIUS * 2, POSITION_RADIUS * 2);
        positionBitmap.drawCircle(POSITION_RADIUS, POSITION_RADIUS, POSITION_RADIUS, POSITION_COLOR);
        this._currentPositionSprite = new Sprite();
        this._currentPositionSprite.bitmap = positionBitmap;
        this.addChild(this._currentPositionSprite);
    };

    Sprite_MiniMapPicture.prototype.update = function() {
        Sprite_Picture.prototype.update.call(this);
        if (!this.visible) {
            return;
        }
        if (!this.bitmap) {
            return;
        }
        this.updatePinSprites();
        this.updateCurrentPositionSprite();
    };

    Sprite_MiniMapPicture.prototype.adjustPointSprite = function(sprite, x, y) {
        var picture = this.picture();
        var size = Math.max(this.bitmap.width, this.bitmap.height);
        var miniMapScale = MINI_MAP_SIZE / size;
        var scaleX = picture.scaleX() / 100.0;
        var scaleY = picture.scaleY() / 100.0;
        var positionScaleX = 1 / miniMapScale / scaleX;
        var positionScaleY = 1 / miniMapScale / scaleY;
        var radiusX = sprite.bitmap.width / 2;
        var radiusY = sprite.bitmap.height / 2;
        sprite.x = x - radiusX * positionScaleX + 0.5 - this.anchor.x * this.bitmap.width;
        sprite.y = y - radiusY * positionScaleY + 0.5 - this.anchor.y * this.bitmap.height;
        sprite.scale.x = positionScaleX;
        sprite.scale.y = positionScaleY;
    }

    Sprite_MiniMapPicture.prototype.updatePinSprites = function() {
        for (var i = 0; i < MAX_PIN_ID; i++) {
            this._pinSprites[i].visible = false;
        }
        if (this.bitmap === EMPTY_BITMAP) {
            return;
        }
        var picture = this.picture();
        if (!picture) {
            return;
        }
        var mapId = $gameMap.mapId();
        for (var i = 0; i < MAX_PIN_ID; i++) {
            var pinId = i + 1;
            var pin = $gameSystem.getMiniMapPin(mapId, pinId);
            if (!pin) {
                continue;
            }
            this._pinSprites[i].visible = true;
            this.adjustPointSprite(this._pinSprites[i], pin.x, pin.y);
        }
    };

    Sprite_MiniMapPicture.prototype.updateCurrentPositionSprite = function() {
        if (this.bitmap === EMPTY_BITMAP) {
            this._currentPositionSprite.visible = false;
            return;
        }
        this._currentPositionSprite.visible = true;
        var picture = this.picture();
        if (!picture) {
            return;
        }
        this.adjustPointSprite(this._currentPositionSprite, $gamePlayer.x, $gamePlayer.y);
    };

    Sprite_MiniMapPicture.prototype.updateScale = function() {
        Sprite_Picture.prototype.updateScale.call(this);
        if (!this.bitmap) {
            return;
        }
        var size = Math.max(this.bitmap.width, this.bitmap.height);
        var miniMapScale = MINI_MAP_SIZE / size;
        this.scale.x *= miniMapScale;
        this.scale.y *= miniMapScale;
    };

    Sprite_MiniMapPicture.prototype.loadBitmap = function() {
        // Do nothing.
    };

    var miniMapPictureSprite = null;

    var Spriteset_Base_createPictures = Spriteset_Base.prototype.createPictures;
    Spriteset_Base.prototype.createPictures = function() {
        Spriteset_Base_createPictures.call(this);
        miniMapPictureSprite = new Sprite_MiniMapPicture(miniMapPictureId);
        // Subtract 1 from the picture id since the picture IDs starts with 1, not 0.
        var index = miniMapPictureId - 1;
        this._pictureContainer.removeChildAt(index);
        this._pictureContainer.addChildAt(miniMapPictureSprite, index);
    };

    var DataManager_setupNewGame = DataManager.setupNewGame;
    DataManager.setupNewGame = function() {
        DataManager_setupNewGame.call(this);
        var x = Graphics.width - MINI_MAP_SIZE - MINI_MAP_MARGIN;
        var y = Graphics.height - MINI_MAP_SIZE - MINI_MAP_MARGIN;
        $gameScreen.showPicture(miniMapPictureId, '', 0, x, y, 100, 100, 255, 0);
    };

    function isWater(gameMap, x, y) {
        if (gameMap.isOverworld()) {
            var tileId = gameMap.autotileType(x, y, 0);
            if ([0, 1, 2, 3, 11].some(function(id) {
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
                if ($gameMap.checkPassage(i, j, 0x01) ||
                    $gameMap.checkPassage(i, j, 0x02) ||
                    $gameMap.checkPassage(i, j, 0x04) ||
                    $gameMap.checkPassage(i, j, 0x08)) {
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

    var Spriteset_Map_update = Spriteset_Map.prototype.update;
    Spriteset_Map.prototype.update = function() {
        this.updateMiniMap();
        Spriteset_Map_update.call(this);
    };

    Spriteset_Map.prototype.updateMiniMap = function() {
        var miniMapBitmap = miniMapBitmaps[$gameMap.mapId()];
        if (!miniMapBitmap) {
            miniMapPictureSprite.bitmap = EMPTY_BITMAP;
            return;
        }
        miniMapPictureSprite.bitmap = miniMapBitmap;
    };

    var _Game_System_initialize = Game_System.prototype.initialize;
    Game_System.prototype.initialize = function() {
        _Game_System_initialize.call(this);
        this._miniMapPins = {};
    };

    Game_System.prototype.addMiniMapPin = function(mapId, pinId, x, y) {
        if (this._miniMapPins === undefined) {
            this._miniMapPins = {};
        }
        if (!(mapId in this._miniMapPins)) {
            this._miniMapPins[mapId] = {};
        }
        this._miniMapPins[mapId][pinId] = {x: x, y: y};
    };

    Game_System.prototype.removeMiniMapPin = function(mapId, pinId) {
        if (this._miniMapPins === undefined) {
            this._miniMapPins = {};
        }
        if (!(mapId in this._miniMapPins)) {
            return;
        }
        delete this._miniMapPins[mapId][pinId];
    };

    Game_System.prototype.getMiniMapPin = function(mapId, pinId) {
        if (this._miniMapPins === undefined) {
            this._miniMapPins = {};
        }
        if (!(mapId in this._miniMapPins)) {
            return null;
        }
        if (!(pinId in this._miniMapPins[mapId])) {
            return null;
        }
        return this._miniMapPins[mapId][pinId];
    };

})();
