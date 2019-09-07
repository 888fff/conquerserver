/**
 * Created by wwh on 2016/7/29.
 */
var cls = require("./lib/class");
var _ = require('underscore');
var Conquer = require('./games/conquerGame');
var MsgType = require('./message.js').MsgType;
var log = require('./log')();
module.exports = GameRoom = cls.Class.extend({
    init: function (id, player_max, server, rt /*room type*/) {
        this.id = id;
        this.server = server;
        this.room_logic_id = rt;
        this.players = [];
        this.room_config = {
            release_time_max: 1000 * 20,
        };
        this.gameLogic = GameLogicFactory(this);
        this.player_max = this.gameLogic.getCfg().playerNum || player_max;
    },

    playerDisconnect: function () {

        let self = this;
        //
        if (!self.checkHasAnyOnlinePlayer()) {
            if (!this.gameLogic.gamming) {
                log.info('房间已经没有玩家,且游戏已经结束，立刻释放');
                self.emptyRoom(function (player) {
                    //房间收回,将玩家踢出游戏
                    if (player) player.fsm.die();
                });
            } else {
                if (!self.dismiss_tid) {
                    log.info('房间已经没有玩家，房间将在' + parseFloat(this.room_config.release_time_max / 1000).toFixed(2) + '秒后释放');
                    self.dismiss_tid = setTimeout(function () {
                        log.info('房间已经被大厅收回');
                        self.emptyRoom(function (player) {
                            //房间收回,将玩家踢出游戏
                            if (player) player.fsm.die();
                        });
                    }, this.room_config.release_time_max);
                }
            }
        }
    },

    playerReconnect: function (player) {
        let self = this;
        //解除房间解散状态
        if (self.dismiss_tid) {
            clearTimeout(self.dismiss_tid);
            delete self.dismiss_tid;
            log.info('玩家已经恢复连接，房间不会被释放');
        }
        //TODO 游戏重新和player链接
        if (player.fsm.state === 'gaming') {
            self.gameLogic.config_player(player.uid, player.connection, player.nickname);
        }
    },

    playerLeaveRoom: function (player) {
        let idx = _.findIndex(this.players, function (p) {
            return p.uid === player.uid;
        });
        if (idx !== -1) this.players.splice(idx, 1);
        //check
        if (_.size(this.players) === 0) {
            this.emptyRoom(null);
        }
    },

    playerEnterRoom: function (player) {
        if (this.player_max > _.size(this.players)) {
            if (-1 === _.findIndex(this.players, function (p) {
                return p.uid === player.uid;
            })) {
                this.players.push(player);
                return true;
            }
        }
        return false;
    },


    getPlayerByID: function (uid) {
        return _.find(this.players, function (player) {
            return player.uid === uid;
        });
    },

    hasSeat: function () {
        return this.player_max > _.size(this.players);
    },

    emptyRoom: function (onLeaveRoom) {

        console.log("emptyRoom");
        //
        if (onLeaveRoom) _.each(this.players, onLeaveRoom);

        this.players.splice(0);

        this.gameLogic.reset_game();

    },

    checkHasAnyOnlinePlayer: function () {
        return _.findIndex(this.players, function (player) {
            player.connect_fsm.state === 'online';
        }) !== -1;
    },

    try_to_start_game: function () {
        log.info("try_to_start_game");
        let self = this;
        let idx = _.findIndex(this.players, function (player) {
            return !player.fsm.is('ready');
        });
        //找不到不是ready的player了，意味着player全部都是ready,且人数足够
        if (idx === -1 && _.size(this.players) === this.player_max) {
            _.each(this.players, function (player) {
                self.gameLogic.config_player(player.uid, player.connection, player.nickname);
                player.fsm.startGame();
            });
            console.log('开始一局游戏！');
            this.gameLogic.start_game();
        }

    },

    onGameOver: function (uid) {
        log.info('[' + uid + ']game over!');
        let player = this.getPlayerByID(uid);
        if (player) {
            player.fsm.endGame();
            //结束的玩家移至大厅
            player.fsm.leaveRoom();
        }
    },
    //这个是通过server给房间的所有人广播
    broadcastEveryone: function (msg_head, msg_obj) {
        if (this.server) {
            this.server.to(this.id).emit(msg_head, msg_obj);
        } else {
            console.log('房间广播消息失败！');
        }
    },
});
//-------------------
const GameLogicFactory = function (room) {
    switch (room.room_logic_id) {
        case 0: {
            return new Conquer({
                over_cb: room.onGameOver.bind(room),
                broadcast_cb: room.broadcastEveryone.bind(room)
            });
        }
        case 1: {
            break;
        }
        default:
            break;
    }
};