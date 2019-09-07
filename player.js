/*
*   player 模块
*
* */
var cls = require("./lib/class");
var StateMachine = require("javascript-state-machine");
var Lobby = require('./lobby')();

//------
var Messages = require('./message.js');
var MsgType = require('./message.js').MsgType;
var ErrorCode = require('./message.js').ErrorCode;
var log = require('./log')();


module.exports = Player = cls.Class.extend({

    init: function (id,socket,data) {
        this.uid = id;
        this.initiated = false;
        this.nickname = null;
        this.room_id = -1;          //所在的room-id
        this.setup(socket,data);
    },

    setup : function (socket,data) {
        //
        let self = this;
        //
        this.connection = socket;
        //
        this.ip = socket.request.connection.remoteAddress;
        /* 断开连接 */
        socket.on('disconnect',self.onPlayerDisconnect.bind(self));
        /* 进入房间 */
        socket.on(MsgType.C_ENTER_ROOM,self.onPlayerEnterRoom.bind(self));
        /* 离开房间 */
        socket.on(MsgType.C_LEAVE_ROOM,self.onPlayerLeaveRoom.bind(self));
        /* 玩家设置在房间中的准备情况 */
        socket.on(MsgType.C_SET_READY,self.onPlayerSetReady.bind(self));
        /* 获得玩家信息*/
        socket.on(MsgType.C_GET_INFO,self.onPlayerGetInfo.bind(self));
        /* 发消息聊天 */
        socket.on(MsgType.C_MSG,self.onPlayerMsg.bind(self));
        //
        if(!this.initiated){
            this.initiated = true;
            //第一次的化初始化数据什么的
            this.nickname = data.nickname;
            //创建状态机
            this.connect_fsm = new StateMachine({
                init: 'online',
                transitions: [
                    { name: 'disconnect', from: 'online', to: 'offline' },
                    { name: 'connect', from: 'offline', to: 'online' }
                ],
                methods: {
                    onOnline: function () {
                        console.log('entered state Online');
                    },
                    onOffline: function () {
                        console.log('entered state Offline');
                        if(self.hasRoomID()) {
                            self.connection.leave(self.room_id.toString(), function (err) {});
                            log.info('因断线将玩家[' + self.uid +']从频道[' + self.room_id.toString() + ']移除！');
                            var room = self.getCurRoom();
                            if(room) room.playerDisconnect();
                        }
                        else{
                            /* 玩家不在房间中 */
                            self.fsm.die();
                        }
                    },
                }
            });
            this.fsm = new StateMachine({
                init: 'none',
                transitions: [
                    { name: 'born', from: 'none', to: 'stayLobby'  },
                    { name: 'enterRoom', from: 'stayLobby', to: 'stayRoom' },
                    { name: 'leaveRoom', from: 'stayRoom', to: 'stayLobby' },
                    { name: 'raiseHand', from: 'stayRoom', to: 'ready' },
                    { name: 'lowerHand', from: 'ready', to: 'stayRoom' },
                    { name: 'startGame', from: 'ready', to: 'gaming' },
                    { name: 'endGame', from: 'gaming', to: 'stayRoom' },
                    { name: 'die', from: '*', to: 'exit' },
                    { name: 'goto', from: '*', to: function (state) { return state;} },

                ],
                methods: {
                    onBorn: function () {
                        console.log('born,first into lobby');
                    },
                    onEnterRoom: function () {
                        console.log('enterRoom');
                        log.info('将玩家[' + self.uid +']加入到房间频道[' +self.room_id.toString() + ']');
                        self.connection.join(self.room_id.toString());
                        //给加入的当前玩家发送成功入座的消息
                        self.connection.emit(MsgType.ENTER_ROOM_SUCCESS, Messages.Enter_Room_Success(self));
                        //给房间中其他人发送有人进入房间的消息
                        self.connection.broadcast.to(self.room_id.toString())
                            .emit(MsgType.BC_ENTER_ROOM, Messages.Broadcast_Enter_Room(self));
                        log.info('player[' + self.uid + ']进入房间成功!');
                    },
                    onLeaveRoom: function () {
                        console.log('leaveRoom');
                        // 先广播再离开, 否则房间号清空了就无法广播了

                        let room = Lobby.getRoomById(self.room_id);
                        room.playerLeaveRoom(self);
                        self.connection.emit(MsgType.Leave_Room_Success, Messages.Leave_Room_Success(self));
                        self.connection.broadcast.to(self.room_id.toString())
                            .emit(MsgType.BC_LEAVE_ROOM, Messages.Broadcast_Leave_Room(self));
                        self.connection.leave(room.id.toString(), function (err) {});
                        self.room_id = -1;
                    },
                    onRaiseHand: function () {
                        console.log('raiseHand');
                        log.info("玩家[" + self.uid + "]准备就绪");
                        self.connection.emit(MsgType.SET_READY_SUCCESS,Messages.Set_Ready_Success(self));
                    },
                    onLowerHand: function () {
                        console.log('lowerHand');
                        log.info("玩家[" + self.uid + "]取消准备");
                        self.connection.emit(MsgType.SET_UNREADY_SUCCESS,Messages.Set_UnReady_Success(self));
                    },
                    onStartGame: function () {
                        console.log('startGame');
                    },
                    onEndGame: function () {
                        console.log('endGame');
                    },
                    //-----------------------------------------------
                    onStayLobby: function () {
                        console.log('entered state StayLobby');
                        self.connection.emit(MsgType.STAY_LOBBY, (new Messages.Enter_Lobby(self)));
                    },
                    onStayRoom: function () {
                        console.log('entered state StayRoom');
                    },
                    onReady: function () {
                        console.log('entered state Ready');
                        let room = Lobby.getRoomById(self.room_id);
                        if (room) {
                            setImmediate(function (){
                                room.try_to_start_game();
                            });
                        }
                    },
                    onGaming: function () {
                        console.log('entered state Gaming');
                    },
                    onExit: function () {
                        Lobby.removePlayer(self);
                        socket.disconnect();
                        log.info('玩家[' + self.uid + ']离开了服务器，从大厅中移除');
                    },
                }
            });
        }
    },
    ///--------------
    hasRoomID :function(){
        return this.room_id !== -1;
    },

    getCurRoom : function(){
        return Lobby.getRoomById(this.room_id) ;
    },

    ////
    reconnect :function () {

        this.connect_fsm.connect();

        let ret = false;
        if(this.hasRoomID()) {
            log.info(this.uid + '尝试重连入之前的房间' + this.room_id);
            let room = this.getCurRoom();
            //房间只要存在，就要尝试进入之前的房间
            if(room && room.getPlayerByID(this.uid))
            {
                room.playerReconnect(this);
                log.info('将玩家[' + this.uid +']加入到房间频道[' +this.room_id.toString() + ']重新进入房间');
                this.connection.join(this.room_id.toString());
                this.connection.emit(MsgType.RE_ENTER_ROOM, Messages.Re_Enter_Room_Success(this, room));
                this.connection.broadcast.to(this.room_id.toString())
                    .emit(MsgType.BC_RE_ENTER_ROOM, Messages.Broadcast_Re_Enter_Room(this,room));
                ret = true;
                log.info('玩家[' + this.uid +']的状态为[' + this.fsm.state +']');
                //服务器发送完成功重新进入房间后，如果在游戏中，客户端应该主动向服务器请求游戏数据review
            }
        }
        //房间已经不在了，将玩家离开房间
        if(!ret) {
            this.fsm.leaveRoom();
        }
    },

    onPlayerDisconnect : function () {

        this.connect_fsm.disconnect();

    },

    onPlayerEnterRoom : function (data) {
        let Err = ErrorCode.ALREADY_STAY_ROOM;
        if(!this.hasRoomID()) {
            let room_id = data.room_id;
            let room = null;
            if(room_id == null || typeof(room_id) == 'undefined'){
                room = Lobby.findRoomHasSeat();
            }
            else {
                room = Lobby.getRoomById(room_id);
            }
            if(room && this.fsm.can('enterRoom')) {
                if(room.playerEnterRoom(this)) {
                    this.room_id = room.id;
                    //将玩家切换状态
                    this.fsm.enterRoom();
                    //
                    return true;
                }
                else{
                    Err = ErrorCode.NO_FREE_ROOM;
                }
            }
            else {
                Err = ErrorCode.INVALID_ROOM_ID;
            }
        }
        console.log('player[' + this.uid + ']进入房间失败![' + Err +']');
        this.connection.emit(MsgType.ENTER_ROOM_ERROR,{err:Err});
        return false;
    },
    
    onPlayerLeaveRoom : function () {
        let Err = ErrorCode.ALREADY_STAY_LOBBY;
        if (this.hasRoomID()) {
            let room = this.getCurRoom();
            if (room) {
                if(this.fsm.can('leaveRoom')){
                    this.fsm.leaveRoom();
                    return true;
                }else{
                    Err = ErrorCode.CANT_OUT_WITH_STATE;
                }
            }else{
                Err = ErrorCode.INVALID_ROOM_ID;
            }
        }
        console.log('player[' + this.uid + ']离开房间失败!');
        this.connection.emit(MsgType.LEAVE_ROOM_ERROR, {err: Err});
        return false;
    },

    playerKicked : function(){

    },

    onPlayerSetReady : function (data) {
        if (data.ready === true) {
            this.fsm.raiseHand();
        } else if (data.ready === false) {
            this.fsm.lowerHand(); //在房间中
        } else {
            this.connection.emit(MsgType.SET_READY_ERROR, {err: ErrorCode.INVALID_READY_STATE});
        }
    },

    onPlayerGetInfo : function () {
        
    },

    onPlayerMsg : function (data) {
        //就是广播转发一下
        let msg = Messages.Player_Msg(this, data.act, data.msg);
        this.connection.broadcast.to(this.room_id.toString()).emit(MsgType.PLAYER_MSG, msg);
        console.log('玩家[' + this.uid + ']向全体说:' + data.msg);
    },

});