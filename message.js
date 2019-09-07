/**
 * Created by wwh on 2016/7/21.
 */
var cls = require("./lib/class");
var    _ = require("underscore");

var MsgType = {

    WELCOME :                       'WELCOME',
    LOGIN_ERROR :                   'LOGIN_ERROR',
    LOGIN_SUCCESS :                 'LOGIN_SUCCESS',
    STAY_LOBBY :                    'STAY_LOBBY',
    BC_STAY_LOBBY :                 'BC_STAY_LOBBY',
    //
    BC_RE_ENTER_ROOM :              'BC_RE_ENTER_ROOM',
    RE_ENTER_ROOM :                 'RE_ENTER_ROOM',

    BC_ENTER_ROOM :                 'BC_ENTER_ROOM',
    ENTER_ROOM_SUCCESS :            'ENTER_ROOM_SUCCESS',
    ENTER_ROOM_ERROR :              'ENTER_ROOM_ERROR',
    //
    BC_LEAVE_ROOM :                 'BC_LEAVE_ROOM',
    LEAVE_ROOM_SUCCESS :            'LEAVE_ROOM_SUCCESS',
    LEAVE_ROOM_ERROR :              'LEAVE_ROOM_ERROR',

    PLAYER_MSG :                    'PLAYER_MSG',
    ROOM_DISMISSED :                'ROOM_DISMISSED',

    SET_READY_SUCCESS :              'SET_READY_SUCCESS',
    SET_UNREADY_SUCCESS :            'SET_UNREADY_SUCCESS',
    SET_READY_ERROR:                 'SET_READY_ERROR',

    GAMELOGIC_START :               'GAMELOGIC_START',

    //----------------------------------------------
    C_ENTER_ROOM :             'C_ENTER_ROOM',
    C_LEAVE_ROOM :             'C_LEAVE_ROOM',
    C_SET_READY :            'C_SET_READY',
    C_GET_INFO :             'C_GET_INFO',
    C_MSG :                 'C_MSG'
};

var ErrorCode = {

    LOGIN_PARAM_ERROR : '登陆参数错误',
    NO_REPEAT_LOGIN : '禁止重复登陆',
    LOGIN_FULL : '大厅人数已满',
    NO_FREE_ROOM : '没有空房间',
    INVALID_ROOM_ID : '无效的房间号',
    ALREADY_STAY_ROOM : '已经在房间中',
    ALREADY_STAY_LOBBY : '已经在大厅中',
    INVALID_READY_STATE : '无效的准备状态',
    CANT_OUT_WITH_STATE : '该状态无法退出游戏',
};

var Messages = cls.Class.extend({
    init : function () {

    }
});

Messages.Enter_Lobby = function(player){
    return {
        uid :           player.uid,
        nickname    :   player.nickname,
        state       :   player.fsm.state
    };
};

Messages.Enter_Room_Success = function(player)
{
    let room = player.getCurRoom();
    let roomData = {
        players : []
    };
    _.each(room.players,function(p){
        if(p)
        {
            roomData.players.push({
                pid:p.uid,
                nickname: p.nickname,
                state:p.fsm.state
            });
        }
    });
    return {
        uid:            player.uid,
        rid:        player.room_id,
        user_nickname:  player.user_nickname,
        ip:             player.ip,
        state       :   player.fsm.state,
        room:           roomData
    };
};

Messages.Re_Enter_Room_Success = function(player)
{
    let room = player.getCurRoom();
    let roomData = {
        players : []
    };
    _.each(room.players,function(p){
        if(p)
        {
            roomData.players.push({
                uid:p.uid,
                nickname: p.nickname,
                state:p.fsm.state
            });
        }
    });

    return {
        uid:            player.uid,
        rid:            player.room_id,
        user_nickname:  player.user_nickname,
        ip:             player.ip,
        state       :   player.fsm.state,
        room:           roomData
    };
};

Messages.Broadcast_Enter_Room = function(player){
    return {
        uid :           player.uid,
        nickname:       player.nickname,
        rid:            player.room_id,
    };
};

Messages.Broadcast_Re_Enter_Room = function(player){
    return {
        uid :           player.uid,
        nickname:       player.nickname,
        rid:            player.room_id,
    };
};

Messages.Leave_Room_Success = function(player){
    return {
        uid:            player.uid,
        state       :   player.fsm.state
    };
};

Messages.Set_Ready_Success = function(player){
    return {
        state       :   player.fsm.state
    };
};

Messages.Set_UnReady_Success = function(player){
    return {
        state       :   player.fsm.state
    };
};


Messages.Broadcast_Leave_Room = function(player){
    return {
        uid:            player.uid,
        nickname:       player.nickname,
    };
};

Messages.Player_Msg = function(player,act,msg){
    return {
        nickname:player.nickname,
        act:act,//是普通聊天，还是发表情或者“花儿都谢了”等特殊..act = 1 act = 2..
        msg:msg //如果是普通聊天，则是聊天内容，如果是其他，则为idx序号
    };
};

//注意这里是Messages!不是Message
module.exports = Messages;
module.exports.MsgType = MsgType;
module.exports.ErrorCode = ErrorCode;

//----------------------------------------------------------

