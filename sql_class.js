/**
 * Created by admin on 2016/9/21.
 */
var mysql  = require('mysql');
var sql_conf = require('./sql_config.json');
var cls = require("./lib/class");


const TAB_USER = 'mj_user';

const F_ID = 'id';
const UF_NAME = 'user_name';
const UF_NICK = 'nickname';
const UF_LOGINTYPE = 'login_type';
const UF_PWD = 'pwd';
const UF_URL = 'url';
const UF_MONEY = 'money';
const UF_CARD = 'room_card';
const UF_LAST = 'last_login_time';
const UF_RECORD = 'record_id';


module.exports = MYSQL = cls.Class.extend({

    init : function(tag)
    {
        this.sql_connection = null;
        this.tag = tag;
        this.handleDisconnect();
    },

    handleDisconnect : function () {
        var self = this;
        this.sql_connection = mysql.createConnection(sql_conf);
        console.log('MYSQL --- 生成一个数据库连接[' + this.tag + ']');
        this.sql_connection.connect(function (err) {              // The server is either down
            if (err) {                                     // or restarting (takes a while sometimes).
                console.log('连接DB时出现错误:', err);
                setTimeout( function(){ self.handleDisconnect(); }, 2000); // We introduce a delay before attempting to reconnect,
            }                                     // to avoid a hot loop, and to allow our node script to
        });                                     // process asynchronous requests in the meantime.
        // If you're also serving http, display a 503 error.
        this.sql_connection.on('error', function (err) {
            console.log('数据库发生错误', err);
            if (err.code === 'PROTOCOL_CONNECTION_LOST') {  // Connection to the MySQL server is usually
                self.handleDisconnect();                         // lost due to either server restart, or a
            } else {                                        // connnection idle timeout (the wait_timeout
                throw err;                                  // server variable configures this)
            }
        })
    },

    query : function(sql, values, cb)
    {
        if(this.sql_connection){
            this.sql_connection.query(sql,values,cb);
        }
    },
    
    queryUser: function (usr, fn) {
        var cmd = sprintf("SELECT * FROM %s WHERE %s='%s'", TAB_USER, UF_NAME, usr);
        this.query(cmd, [usr], fn);
    },

    updateUser: function (usr, args, fn) {
        var str = '';
        var vals = [];
        for (var key in args) {
            if (args[key] == undefined) continue;
            if (str) str += ',';
            str += sprintf("%s=?", key);
            vals.push(args[key]);
        }
        var cmd = sprintf("UPDATE %s SET %s WHERE %s='%s'", TAB_USER, str, UF_NAME, usr);
        this.query(cmd, vals, fn);
    },
    insertUser: function (usr, args, fn) {
        var str = UF_NAME;
        var ask = '?';
        var vals = [usr];
        for (var key in args) {
            if (args[key] == undefined) continue;
            if (str) {
                str += ',';
                ask += ',';
            }
            ask += '?';
            str += key;
            vals.push(args[key]);
        }
        var cmd = sprintf("INSERT INTO %s (%s) VALUES (%s)", TAB_USER, str, ask);
        this.query(cmd, vals, fn);
    },

    // 用户登录
    checkUser: function (usr, pwd, url, nick, lt,fn) {
        url = url || '';
        nick = nick || '';
        var self = this;
        //
        //游客登录,name应该为28位置,假的游客登陆
        if(lt && lt == 2){
            var yk_name = "YOUKE_" + randomWord(false,22);
            var yk_nick = "Y" + parseInt(Math.random() * 100000000);
            usr = yk_name;
            nick = yk_nick;
        }
        if (usr.length < 28 || usr.length > 32) {
            if (fn) fn('username length error(limited 28 to 32 character)', '');
            return;
        }
        //
        self.queryUser(usr, function (err, res) {
            if (err) {
                if (fn) fn(err, '');
            } else {
                var objs = {};
                objs[UF_NICK] = nick;
                //objs[UF_PWD] = pwd;
                objs[UF_URL] = url;
                if (res.length){
                    self.updateUser(usr, objs, callback);
                }
                else{
                    self.insertUser(usr, objs, callback);
                }
            }
        });
        function callback(err, res) {
            if (err) {
                if (fn) fn(err, '');
            } else self.queryUser(usr, fn);
        }
        function randomWord(randomFlag, min, max){
            var str = "",
                range = min,
                arr = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
            // 随机产生
            if(randomFlag){
                range = Math.round(Math.random() * (max-min)) + min;
            }
            for(var i=0; i<range; i++){
                var pos = Math.round(Math.random() * (arr.length-1));
                str += arr[pos];
            }
            return str;
        }
    }

});


function sprintf(fmt) {
    for (var i = 1; i < arguments.length; i++) fmt = fmt.replace('%s', arguments[i]);
    return fmt;
}