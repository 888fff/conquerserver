/**
 * Created by wwh on 2016/8/22.
 */
var _ = require('underscore');
var GameRoom = require("./gameRoom");

module.exports = GetLobbyInstance;

var instance = null;


function GetLobbyInstance(nb) {

    if(instance == null)
    {
        instance = new Lobby(nb);
    }
    //
    return instance;
}

function Lobby(nb)
{
    if (!(this instanceof Lobby)) return new Lobby(nb);
    nb = nb || {};
    this.players = {};
    this.upper_limit = nb;
    this.next_index = 1;            //登陆过多少人
    this.lock_Lobby = false;
    //
    this.rooms = {};
}

Lobby.prototype.initRooms = function(config,server)
{
    //配置大厅房间总数
    var self  = this;
    _.each(_.range(config.nb_game_rooms), function(i) {
        var room = new GameRoom( i , config.nb_players_per_game, server , config.room_type);
        self.rooms[room.id] = room;
    });
};

Lobby.prototype.getRoomById = function(room_id)
{
    if(_.has(this.rooms,room_id))
    {
        return this.rooms[room_id];
    }

    return null;
};

Lobby.prototype.setPlayersUpperLimit = function (nb) {
    this.upper_limit = nb;
};

Lobby.prototype.addPlayer = function(player,cb,cb_err){

    if(!this.isFull() && this.canAddPlayer())
    {
        this.players[player.uid] = player;
        this.next_index++;
        if(cb) cb(player);
        return true;
    }
    //
    if(cb_err) cb_err();
    return false;
};

Lobby.prototype.removePlayer = function(player){

    if(_.has(this.players,player.uid))
    {
        this.players[player.uid] = null;
        delete this.players[player.uid];
    }

};

Lobby.prototype.getPlayer = function(id){

    return this.players[id];

};

Lobby.prototype.getPlayerCounter = function(){

    return _.size(this.players);

};

Lobby.prototype.isFull = function(){

    return (this.upper_limit === this.getPlayerCounter());

};

Lobby.prototype.findRoomHasSeat = function() {

    let self  = this;
    let r = _.find(self.rooms,function (room) {
        return room.hasSeat();
    });
    if(typeof(r) == "undefined") return null;
    return r;

};

Lobby.prototype.canAddPlayer = function () {

    return !this.lock_Lobby;

};

Lobby.prototype.setLocked = function () {

    this.lock_Lobby = true;

};

Lobby.prototype.setUnlocked = function () {

    this.lock_Lobby = false;

};

Lobby.prototype.getNextIndex = function(){

    return this.next_index;

};

Lobby.prototype.clearZombie = function () {

};