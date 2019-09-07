/**
 * Created by wwh on 2016/9/7.
 */
var cls = require("../lib/class");

module.exports = GameLogic = cls.Class.extend({

    //游戏逻辑是基于room的
    init : function (room) {
        this.room = room;
    },
    //配置是来控制生成players的
    config : function (room) {

    },

    config_player : function (player) {

    },

    getPlayers : function () {
        return this.room.players;
    },

    reset_game : function () {

    }
});