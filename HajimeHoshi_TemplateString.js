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
 * @plugindesc Template String
 * @author Hajime Hoshi
 *
 * @help This plugin offers template string feature like ES6.
 * You can use ${[JavaScript literal]} at a text message.
 * Templates is evaluated ahead of resolving escape characters (like \N[...]).
 *
 * This template string is NOT compatible with ES6 template literal.
 * For example, in this template string, braces ('{' and '}') must be paired,
 * but ES6 doesn't request that.
 */

(function() {
    function evalTemplateStrings(text) {
        var state = 0;
        var newText = '';
        var currentLiteral = '';
        for (var i = 0; i < text.length; i++) {
            var ch = text[i];
            switch (state) {
            case 0:
                if (ch === '$') {
                    state = 1;
                    break;
                }
                newText += ch;
                break;
            case 1:
                if (ch === '{') {
                    state = 2;
                    currentLiteral = '';
                    break;
                }
                state = 0;
                newText += '$' + ch;
                break;
            case 2:
                if (ch === '}') {
                    state = 0;
                    console.log(currentLiteral);
                    newText += eval(currentLiteral);
                    break;
                }
                if (ch === '{') {
                    state++;
                }
                currentLiteral += ch;
                break;
            default:
                if (ch === '{') {
                    state++;
                }
                if (ch === '}') {
                    state--;
                }
                currentLiteral += ch;
                break;
            }
        }
        if (state !== 0) {
            throw 'syntax error: braces are not closed correctly?'
        }
        return newText;
    }

    var _Window_Base_convertEscapeCharacters = Window_Base.prototype.convertEscapeCharacters;
    Window_Base.prototype.convertEscapeCharacters = function(text) {
        text = evalTemplateStrings(text);
        text = _Window_Base_convertEscapeCharacters.call(this, text);
        return text;
    };
})();
