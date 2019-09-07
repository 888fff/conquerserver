/**
 * Created by Hitman on 2016/7/1.
 */
let fs = require('fs');
function main(config) {
    let start_server_time = new Date();
    let sz_start_time = start_server_time.getFullYear() + '_' +
        (start_server_time.getMonth()+1) + '_' +
        start_server_time.getDate() + '_' +
        start_server_time.getHours() + '_' +
        start_server_time.getMinutes() + '_' +
        start_server_time.getSeconds();
    let log_file_name = 'logs/log_' + sz_start_time + '.txt';
    ///-----------------------------------------
    let log = require('./log')(7,/*fs.createWriteStream(log_file_name)*/);
    let Server = require('socket.io');
    let Lobby = require('./lobby')(config.nb_lobby_players);
    let Player = require('./player');
    let server = Server(config.port);
    let MsgType = require('./message.js').MsgType;
    let ErrorCode = require('./message.js').ErrorCode;


    /*
    switch (config.debug_level) {
        case "error":
            log = new Log(Log.ERROR);
            break;
        case "debug":
            log = new Log(Log.DEBUG,fs.createWriteStream(log_file_name));
            break;
        case "info":
            log = new Log(Log.INFO);
            break;
    }*/
    /* 给大厅设置人数上限 */
    Lobby.setPlayersUpperLimit(config.nb_lobby_players);
    /* 给大厅设置房间总数 */
    Lobby.initRooms(config,server);

    console.log('创建日志' + log_file_name);
    log.info("-启动CONQUER服务器-");
    //第一次链接的握手
    server.use((socket, next) => {
        var ip = socket.handshake.address;
        if (isHandshakeValid(socket.handshake.query)) {
            log.info('访客[' + ip +']令牌吻合');
            return next();
        }
        log.info('访客[' + ip +']令牌非法');
        return next(new Error('authentication error'));
    });
    //正式连入服务器
    server.on('connection', function(socket){
        var client_ip = socket.request.connection.remoteAddress;
        log.info('有访客socket[' + socket.id +']IP[' + client_ip +']连接到服务器');
        socket.emit( MsgType.WELCOME,{
            ip : client_ip,
            sid: config.server_id,
            sn : config.server_name
        });
        //20秒不登陆，则踢出玩家
        socket.tid = setTimeout(function(){
            if(socket.tid)
            {
                log.info('强制断开socket[' + socket.id +']的未知连接');
                delete socket.tid;
                socket.disconnect();
            }
        },20 * 1000);
        socket.on('login',function(obj){
            var uid = obj.uid;
            if(playerDB[uid] !== null ){
                delete socket.tid;  //不知道这样好不好
                var nickname = playerDB[uid].nickname;
                var player = Lobby.getPlayer(uid);
                var playerData = {
                    nickname : nickname
                };
                //仍然在服务器中
                if(player != null){
                    if(player.connect_fsm.state === 'offline'){
                        player.setup(socket,playerData);
                        player.reconnect();
                    }
                    else{
                        socket.emit(MsgType.LOGIN_ERROR,{err : ErrorCode.NO_REPEAT_LOGIN});
                    }
                }else{
                    //玩家首次连入游戏,把他加入到大厅
                    Lobby.addPlayer(new Player(uid,socket,playerData),
                        //成功将玩家加入至大厅
                        function(_player){
                            _player.fsm.born();
                            log.info('Player[' + _player.uid + ']首次连接，加入到大厅');
                        },
                        //加入大厅失败
                        function () {
                            socket.emit(MsgType.LOGIN_ERROR,{err : ErrorCode.LOGIN_FULL});
                        }
                    );
                }
            }
        });
    });
    server.on('disconnection',function(socket){
        log.info('socket[' + socket.id +']断开连接');
    });
    //主进程抓住异常处理
    process.on('uncaughtException', function (e) {
        log.info('uncaughtException: ' + e);
    });
    //
    log.info("服务器启动完毕");
}
//这里本应该链接数据库的,我这里简化，先写一个配置文件，里面保存uid和token和昵称
var playerDB = null;
function isHandshakeValid(query) {
    let token = query.token;
    let uid = query.user;
    return playerDB[uid] !== null && token === playerDB[uid].token;
}
function getConfigFile(path, callback) {
    fs.readFile(path, 'utf8', function(err, json_string) {
        if(err) {
            console.error("Could not open config file:", err.path);
            callback(null);
        } else {
            callback(JSON.parse(json_string));
        }
    });
}
//读取playerDB的伪造内容 HAHA
var defaultPlayerDBPath = './playerDB.json';
getConfigFile(defaultPlayerDBPath,function (PlayerDBConfig) {
    if(PlayerDBConfig) {
        playerDB = PlayerDBConfig;
    } else {
        console.error("没有PlayerDB无法启动服务器");
        process.exit(1);
    }
});
///---------------------------------------
var defaultConfigPath = './config.json';
getConfigFile(defaultConfigPath, function(defaultConfig) {
    if(defaultConfig) {
        main(defaultConfig);
    } else {
        console.error("没有配置文件无法启动服务器");
        process.exit(1);
    }
});
