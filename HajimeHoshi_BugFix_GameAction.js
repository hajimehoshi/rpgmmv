// This software is in the public domain.

/*:
 * @plugindesc Bug fix in Game_Action
 * @author Hajime Hoshi
 *
 * @help
 *
 * This plugin fixes these bugs:
 * * 'Force Action' event command with 'Random Target' only targeted
 *   a first enemy or actor.
 * * An actor with 'Auto Battle' only targeted a first enemy.
 * * An enemy action for a dead enemy only targeted a first enemy.
 */

(function() {
    'use strict';

    Game_Action.prototype.decideRandomTarget = function() {
        var target;
        if (this.isForDeadFriend()) {
            target = this.friendsUnit().randomDeadTarget();
        } else if (this.isForFriend()) {
            target = this.friendsUnit().randomTarget();
        } else {
            target = this.opponentsUnit().randomTarget();
        }
        if (target) {
            this._targetIndex = target.index();
        } else {
            this.clear();
        }
    };

    Game_Action.prototype.evaluate = function() {
        var value = 0;
        this.itemTargetCandidates().forEach(function(target) {
            var targetValue = this.evaluateWithTarget(target);
            if (this.isForAll()) {
                value += targetValue;
            } else if (targetValue > value) {
                value = targetValue;
                this._targetIndex = target.index();
            }
        }, this);
        value *= this.numRepeats();
        if (value > 0) {
            value += Math.random();
        }
        return value;
    };

    Game_Action.prototype.targetsForFriends = function() {
        var targets = [];
        var unit = this.friendsUnit();
        if (this.isForUser()) {
            return [this.subject()];
        } else if (this.isForDeadFriend()) {
            if (this.isForOne()) {
                if (this._targetIndex < 0) {
                    targets.push(unit.randomDeadTarget());
                } else {
                    targets.push(unit.smoothDeadTarget(this._targetIndex));
                }
            } else {
                targets = unit.deadMembers();
            }
        } else if (this.isForOne()) {
            if (this._targetIndex < 0) {
                targets.push(unit.randomTarget());
            } else {
                targets.push(unit.smoothTarget(this._targetIndex));
            }
        } else {
            targets = unit.aliveMembers();
        }
        return targets;
    };

})();
