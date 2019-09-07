var cls = require("../lib/class");
var _ = require('underscore');
const World = require("./world").World;
const Territory = require("./world").Territory;
var GameLogic = require("./gameLogic");
var MsgType = require('../message.js').MsgType;

module.exports = Logic;

function Logic(opt) {
    return new Conquer(opt.over_cb, opt.broadcast_cb);
}

var Cfg = {
    AP_COST_0: 1,
    AP_COST_1: 1,
    AP_COST_2: 2,
    AP_COST_3: 3,
    AP_MAX: 7,
    DN_MAX: 8,
    DV_MAX: 6,

    playerNum: 2,
    bornSite:2,
    hexSize: 64,
    worldCols: 7,
    worldRows: 7
};
var GameMsgType = {
    C_ACTION: "C_ACTION",
    C_REVIEW: "C_REVIEW",
    C_AUTO: "C_AUTO",
    ///
    S_BC_ACTION: "S_BC_ACTION",
    S_ACTION: "S_ACTION",
    S_ASSIGN: "S_ASSIGN",
    S_REVIEW: "S_REVIEW",
    S_GAMEOVER: "S_GAMEOVER",
    S_ERR: "S_ERR"
};

var Err = {
    wait: '还没轮到你行动.',
    act: '该行为不可执行.',
    miss: '找不到区域:',
    afford: '不足的行动点数',
    match: '地形和玩家不匹配',
    dist : '距离不合法'
};

var Act = {
    INVALID: 0,
    UPGRADE_DN: 1,
    UPGRADE_DV: 2,
    ATTACK: 4,
    PASS: 8,
    PATH_FINDER:16,
    TURN: 256
};

var Conquer = GameLogic.extend({

    init: function (over_cb, broadcast_cb) {
        this.gamming = false;
        this.cbBroadcast = broadcast_cb;
        this.cbRoundOver = over_cb;
        this.mgr = new GameManager(
            this.acting.bind(this),
            this.assign.bind(this),
            this.turn.bind(this),
            this.gameOver.bind(this),
            this.onAction.bind(this));
        this.sockets = {};
    },

    getCfg : function(){
        return Cfg;
    },

    config_player: function (uid, socket ,nickname) {
        console.log("GAME >> config_player");
        let self = this;
        this.reset_player(uid, socket);
        socket.on(GameMsgType.C_ACTION, function (d) {
            self.onAction(d.uid, d.act, d.tid, d.extra)
        });
        socket.on(GameMsgType.C_REVIEW, function (d) {
            self.onReview(d.uid)
        });
        //socket.on("c_auto", function (d) { self.set_config({idx:idx, auto:d.auto }) });
        this.sockets[uid] = socket;
        this.mgr.addPlayer(uid,nickname);
    },

    start_game: function () {
        //TODO start_game
        if (!this.gamming) {
            this.cbBroadcast(MsgType.GAMELOGIC_START, {});
            this.mgr.start();
            this.gamming = true;
        }
    },

    reset_player: function (uid, socket) {
        if (uid !== "") socket = this.sockets[uid];
        if (socket) {
            socket.removeAllListeners(GameMsgType.C_ACTION);
            socket.removeAllListeners(GameMsgType.C_REVIEW);
        }
    },
    reset_game: function () {
        let self = this;
        _.forEach(this.sockets,function (socket) {
            self.reset_player("",socket);
        });
        this.mgr.reset();
        this.gamming = false;
    },


    onAction: function (uid, act, tid, extra) {
        if (!this.gamming) {
            this.onError('游戏还未开始,无法执行行为');
            return;
        }
        act = parseInt(act);
        let ret;
        try {
            ret = this.mgr.action(uid, act, tid, extra);
        } catch (err) {
            this.onError('[' + uid + '] Action failed act:' + act + ' tid:' + JSON.stringify(tid) + ' ' + err, this.sockets[uid]);
            return;
        }
        if (ret && ret.e) {
            this.onError('[' + uid + '] Action failed:' + ret.e + ' act:' + act + ' tid:' + JSON.stringify(tid), this.sockets[uid]);
            return;
        }
        if (act) this.cbBroadcast(GameMsgType.S_BC_ACTION, {uid: uid, act: act, extra: ret});
    },
    onReview: function (uid) {
        if (!this.gamming) {
            this.onError('游戏还未开始,无法获取牌局信息');
            return;
        }
        let data;
        try {
            data = this.mgr.review(uid);
        } catch (err) {
            this.onError('[' + uid + '] onReview failed:' + err, this.sockets[uid]);
            return;
        }
        this.sockets[uid].emit(GameMsgType.S_REVIEW, data);
    },
    //------------------------------
    // 广播牌局的四人,轮到uid的玩家行动
    turn: function (uid, act, data) {
        this.cbBroadcast(GameMsgType.S_BC_ACTION, {uid: uid, act: act, extra: data});
    },
    //这个应该是服务器主动向单一玩家推送的
    acting: function (idx, act, tid, extra) {
        let skt = this.sockets[idx];
        if (skt) skt.emit(GameMsgType.S_ACTION, {act: act, tid: tid, extra: extra});
    },
    // 客户端第一次开始游戏，得到地图，和轮次
    assign: function (uid, world, extra) {
        let skt = this.sockets[uid];
        if (skt) skt.emit(GameMsgType.S_ASSIGN, {uid: uid, world: world, extra: extra});
    },

    gameOver: function (uid, ret) {
        let self = this;
        if (ret === true) {
            console.log("GAME >> gameOver");
            this.gamming = false;
            this.mgr.reset();
        }
        if (this.cbRoundOver) {
            setTimeout(function () {
                self.cbBroadcast(GameMsgType.S_GAMEOVER, {uid: uid, ret: ret});
                self.cbRoundOver(uid);
            }, 100);
        }
    },

    ////////
    onError: function (info, socket) {
        if (socket) socket.emit(GameMsgType.S_ERR, {e: info});
        else this.cbBroadcast(GameMsgType.S_ERR, {e: info});
    },
});

var globalWorld = new World(Cfg.hexSize, Cfg.worldCols, Cfg.worldRows);
var GameManager = cls.Class.extend({
    init: function (_acting, _assign, _turn, _over, _onact) {
        this.fnActing = _acting;     // 通知客户端选择执行事件
        this.fnAssign = _assign;     // 向客户端发送开局世界
        this.fnTurn = _turn;         // 广播客户端:轮到指定玩家行动
        this.fnOver = _over;         // 通知客户端:此局游戏结束
        this.fnOnact = _onact;       // 广播客户端:指定玩家执行动作(仅供托管)
        this.turnQueen = [];         //按照顺序进行，里面保存着uid
        this.curTurn = -1;          //这里保存着当前turn的Idx
        this.overlords = {};        //字典！这里是装载overlords的实例容器
        this.world = globalWorld;
        this.turnCounter = 0;       //执行回合计数器
        //
        this.actFunc = [];
        this.actFunc[Act.UPGRADE_DN] = this.actUpgrade_dn.bind(this);
        this.actFunc[Act.UPGRADE_DV] = this.actUpgrade_dv.bind(this);
        this.actFunc[Act.ATTACK] = this.actAttack.bind(this);
        this.actFunc[Act.PASS] = this.actPass.bind(this);
        this.actFunc[Act.PATH_FINDER] = this.actPathfinder.bind(this);
        //
        this.nicknameDict = {};

    },
    addPlayer: function (uid,nickname) {
        console.log("GAME >> mgr > addPlayer");
        if (_.size(this.overlords) === Cfg.playerNum) return false;
        if (_.has(this.overlords, uid)) return false;
        this.overlords[uid] = new Overlord(uid);
        let idx = _.indexOf(this.turnQueen,uid);
        if (idx === -1) {
            this.turnQueen.push(uid);
            this.overlords[uid].setColorIndex(_.size(this.turnQueen) - 1);
            this.nicknameDict[uid] = nickname;
            return true;
        }
        return false;
    },

    isOverlordTurn: function (uid) {
        if (this.curTurn !== -1) {
            return this.turnQueen[this.curTurn] === uid;
        }
        return false;
    },
    getCurTurnOverlord: function () {
        if (this.curTurn !== -1)
            return this.overlords[this.turnQueen[this.curTurn]];
        return null;
    },

    getOverlord: function (uid) {
        return this.overlords[uid];
    },

    start: function () {
        console.log("GAME >> mgr > start");
        //新建一个地图
        let self = this;
        this.world.createWorldMap();
        let world_map = this.world.serialize();
        //将随机的地图块分配给玩家
        _.forEach(this.overlords, function (lord) {
            _.forEach(_.range(Cfg.bornSite), function () {
                let occupied = true;
                do {
                    var hc = self.world.getRandomValidHexCoord();
                    //没有被占据的玩家
                    var territory = self.world.getTerritory(hc);
                    if (territory && !territory.overlord && territory.isNormal()) {
                        occupied = false;
                    }
                } while (occupied);

                let dn = 8;
                let dv = 1;
                let gc = 1;
                let territoryData = {tid: hc, dv: dv, dn: dn, gc: gc};
                lord.addTerritory(self.world.hexCoordToIndex(hc));
                territory.setOverlord(lord);
                territory.setData(territoryData);
            });
        });
        //按照流程顺序，序列化overlord
        let overlords = [];
        _.forEach(this.turnQueen, function (uid) {
            let d = self.overlords[uid].serialize();
            d.nickname = self.nicknameDict[uid];
            overlords.push(d);
        });
        let extra = {
            overlords: overlords
        };
        //准备将游戏第一次的数据发送
        _.forEach(this.overlords, function (lord) {
            /* uid, world, extra*/
            self.fnAssign(lord.uid, world_map, extra);
        });
        //开始准备第一次的回合通知。
        setImmediate(function () {
            self.nextTurn();
        });
    },
    nextTurn: function () {
        console.log("GAME >> nextTurn");

        this.curTurn += 1;
        this.turnCounter++;
        if (this.curTurn === this.turnQueen.length) {
            this.curTurn = 0;
        }
        let uid = this.turnQueen[this.curTurn];
        //广播给其他玩家，告诉现在是谁的回合
        let lord = this.getCurTurnOverlord();
        lord.refreshAP();
        /* uid, act ,data*/
        this.fnTurn(uid, Act.TURN, {ap: lord.ap});
    },

    isGameOver: function () {
        let self = this;
        let lose_uid = null;
        let win_uid = null;
        _.forEach(this.overlords,function (lord) {
            if(!lord.hasAnyTerritory()){
                lose_uid = lord.uid;
            }
        });

        if (lose_uid) {
            let idx = _.indexOf(this.turnQueen, lose_uid);
            if (idx !== -1) {
                this.turnQueen.splice(idx, 1);
                this.overlords[lose_uid] = null;
                delete this.overlords[lose_uid];
                this.nicknameDict[lose_uid] = null;
                delete this.nicknameDict[lose_uid];
            }
            //this.fnOver(lose_uid, false)
            setImmediate(function (){self.fnOver(lose_uid, false)});//失败了,告訴所有人
        }
        if (_.size(this.turnQueen) === 1) {
            win_uid = this.turnQueen[0];
            //this.fnOver(win_uid, true);//win!
            setImmediate(function (){self.fnOver(win_uid, true)});//成功了,告訴所有人
        }
    },

    reset: function () {
        console.log("GAME >> mgr > reset");
        let self = this;
        _.forEach(this.turnQueen, function (uid) {
            self.overlords[uid] = null;
            self.nicknameDict[uid] = null;

            delete self.overlords[uid];
            delete self.nicknameDict[uid];

        });
        this.turnCounter = 0;
        this.turnQueen.splice(0);
        this.curTurn = -1;
        this.world.clearUp();
    },
    //---------------------------

    actUpgrade_dn: function (uid, territory) {
        console.log("GAME >> actUpgrade_dn");

        let hc = territory.hexCoord;
        let overlord = territory.overlord;
        if (!overlord || overlord.uid !== uid) return {e: Err.match};
        if (overlord.ap < Cfg.AP_COST_1) return {e: Err.afford};
        if (territory.diceNum + 1 > Cfg.DN_MAX) return {e: Err.act};
        overlord.expenseAP(Cfg.AP_COST_1);
        let dn = Math.min(territory.diceNum + 1, Cfg.DN_MAX);
        //将territory 和 overlord 设置
        territory.diceNum = dn;
        return {
            ret: true,
            uid: uid,
            tid: hc,
            dn: dn,
            ap: overlord.ap
        }
    },
    actUpgrade_dv: function (uid, territory) {
        console.log("GAME >> actUpgrade_dv");

        let hc = territory.hexCoord;
        let overlord = territory.overlord;
        if (!overlord || overlord.uid !== uid) return {e: Err.match};
        if (overlord.ap < Cfg.AP_COST_2) return {e: Err.afford};
        if (territory.diceValueMin + 1 > Cfg.DV_MAX) return {e: Err.act};
        overlord.expenseAP(Cfg.AP_COST_2);
        let dv = Math.min(territory.diceValueMin + 1, Cfg.DV_MAX);
        //将territory 和 overlord 设置
        territory.diceValueMin = dv;
        return {
            ret: true,
            uid: uid,
            tid: hc,
            dv: dv,
            ap: overlord.ap
        }
    },
    actAttack: function (uid, territory, t_tid) {
        console.log("GAME >> actAttack");

        const randomSum = function (dn, dv) {
            let sum = 0;
            for (let i = dn; i > 0; i--) {
                sum += _.random(dv, Cfg.DV_MAX);
            }
            return sum;
        };

        let from_t = territory;
        //排除from 的 合法性
        if (!from_t.overlord || from_t.overlord.uid !== uid) return {e: Err.match};
        let to_t = this.world.getTerritory(t_tid);
        //验证to的区域合法
        if (!to_t) return {e: Err.miss};
        //验证 from 和 to 是同一个区域
        if (to_t.overlord && from_t.overlord.uid === to_t.overlord.uid) return {e: Err.match};
        //验证from和to的距离
        if(!from_t.isNeighbour(this.world.hexCoordToIndex(to_t.hexCoord))) return {e: Err.dist};
        let from_overlord = from_t.overlord;
        let to_overlord = to_t.overlord;
        //验证进攻方from的ap足够
        if (from_overlord.ap < Cfg.AP_COST_1) return {e: Err.afford};
        let f_akt = randomSum(from_t.diceNum, from_t.diceValueMin);
        let t_akt = randomSum(to_t.diceNum, to_t.diceValueMin);
        let ret = (f_akt > t_akt);
        //计算出剩余战斗力
        let remain = 1;
        let occupy = from_t.diceNum - 1;

        let t_uid = (to_t.overlord == null) ? "" : to_t.overlord.uid;
        let t_dv = Math.max(1, to_t.diceValueMin - 1);
        //将territory 和 overlord 设置
        from_overlord.expenseAP(Cfg.AP_COST_1);

        if (!ret) {   //如果进攻失败
            occupy = to_t.diceNum - 1;
            from_t.diceNum = remain;
            to_t.diceNum = occupy;
            to_t.diceValueMin = t_dv;
            from_overlord.updateTerritory(this.world.hexCoordToIndex(from_t.hexCoord));
            if(to_overlord) to_overlord.updateTerritory(this.world.hexCoordToIndex(to_t.hexCoord));
        } else {
            //如果进攻成功
            from_t.diceNum = remain;
            from_overlord.updateTerritory(this.world.hexCoordToIndex(from_t.hexCoord));
            //
            if(to_overlord) to_overlord.removeTerritory(this.world.hexCoordToIndex(to_t.hexCoord));
            //
            to_t.diceNum = occupy;
            to_t.diceValueMin = t_dv;
            from_overlord.addTerritory(this.world.hexCoordToIndex(to_t.hexCoord));
        }
        //在攻击完成后，都需要判断一下游戏是否结束了
        this.isGameOver();
        //打包数据
        return {
            f_uid: uid,
            t_uid: t_uid,
            ret: ret,     //进攻的结果是否成功
            ap: from_overlord.ap,
            f_atk: f_akt,   //进攻方的战斗值
            t_atk: t_akt,   //防守方的战斗值
            f_tData: from_t.getData(),   //进攻方区域的hexCoord和dn,dv等
            t_tData: to_t.getData()    //防守方区域的hexCoord和dn,dv等
        };
    },
    actPass: function (uid) {
        console.log("GAME >> actPass");
        let self = this;
        if(this.isOverlordTurn(uid)){
            setImmediate(function () {
                self.nextTurn()
            });
            return {
                uid: uid,
                rd: this.turnCounter        //现在是多少回合
            }
        }
        return {e: Err.act};
    },
    actPathfinder : function(uid, territory, extra){
        let path = this.world.getPath(territory.hexCoord,extra);
        return {path:path};
    },
    //玩家传入的动作指令
    action: function (uid, act, tid, extra) {
        //如果是当前玩家
        if (!this.isOverlordTurn(uid)) return {e: Err.wait};
        if (!this.actFunc[act]) return {e: Err.act};
        let territory = null;
        if(tid){
            territory = this.world.getTerritory(tid);
            if (!territory) return {e: Err.miss};
        }
        //分流處理玩家的action
        let ret = this.actFunc[act](uid, territory, extra);
        if (ret.e) {
            return ret;
        }
        return ret;
    },
    //玩家传入的重新恢复世界内容
    review: function (uid) {
        //世界信息
        let self = this;
        let worldMap = this.world.serialize();
        //玩家信息
        let overlords = [];
        _.forEach(this.overlords,function (lord) {
            let d = lord.serialize();
            d.nickname = self.nicknameDict[lord.uid];
            overlords.push(d);
        });
        //当前回合玩家uid
        let curTurnUID = this.turnQueen[this.curTurn];
        let extra = {
            overlords : overlords,
            curTurnUID : curTurnUID
        };
        console.log("GAME >> review");
        return {uid:uid,world:worldMap,extra:extra};
    }
});





const Overlord = cls.Class.extend({
    init: function (uid) {
        this.uid = uid;
        this.colorIndex = -1;
        this.ap = 1;
        this.ownTerritories = [];   //保存着Territory的idx
    },
    setColorIndex: function (idx) {
        this.colorIndex = idx;
    },
    /**
     * @return {boolean}
     */
    isOwnTerritory: function (idx) {
        return _.contains(this.ownTerritories,idx);
    },

    removeTerritory: function (idx) {
        let i = _.indexOf(this.ownTerritories, idx);
        if (i !== -1) {
            let t = globalWorld.getTerritory(idx);
            t.setOverlord(null);
            console.warn('overlord[' + this.uid + "]removeTerritory[" + idx + ']neighbours:' + t.neighbours.length);
            this.ownTerritories.splice(i, 1);
            return true;
        }
        return false;
    },

    addTerritory: function (idx) {
        let i = _.indexOf(this.ownTerritories, idx);
        if (i === -1) {
            let t = globalWorld.getTerritory(idx);
            console.warn('overlord[' + this.uid + "]addTerritory[" + idx + ']neighbours:' + t.neighbours.length);
            if(t.overlord){
                console.warn("addTerritory >> territory[" + idx + ']has overlord['+t.overlord.uid+']');
            }
            this.ownTerritories.push(idx);
            t.setOverlord(this);
        }
    },

    updateTerritory: function (idx) {
        //TODO Nothing!
        console.log("updateTerritory[" + idx +']');
        let i = _.indexOf(this.ownTerritories, idx);
        return i !== -1;
    },


    refreshAP: function () {
        this.ap = Math.min(_.size(this.ownTerritories), Cfg.AP_MAX);
    },

    expenseAP: function (cost) {
        if (cost > this.ap) {
            return false;
        }
        this.ap -= cost;
        return true;
    },

    hasAnyTerritory: function () {
        return _.size(this.ownTerritories) !== 0;
    },

    getRandomOwnTerritory : function(){
        return this.ownTerritories[_.random(0,_.size(this.ownTerritories) - 1)];
    },

    serialize : function () {
        let ts = [];
        _.forEach(this.ownTerritories, function (idx) {
            let t = globalWorld.getTerritory(idx);
            if (t) {
                let data = t.getData();
                ts.push(data);
            }
        });
        return {
            uid: this.uid,
            ap: this.ap,
            ts: ts
        }
    }
});