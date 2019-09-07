const _ = require('underscore');
var AStarFinder = require('../lib/astarFinder');

module.exports.World = World = function (HexSize, Cols, Rows) {

    this.HEX_SIZE = HexSize || 64;
    this.COLS = Cols || 7;
    this.ROWS = Rows || 7;
    this.name = "WorldMap";
    let sideLength = this.HEX_SIZE / 2;
    this.gridSize_x = 1.5 * sideLength;
    this.gridSize_y = 1.732 * sideLength;
    //里面保存着territory的实例
    this.territoriesPool = [];
    //有效的Territory,里面保存着有效的idx
    this.validTerritors = [];
    //
    this.pathFinder = new AStarFinder({
        getNeighbours: this._getNeighbours.bind(this),
    });
};

World.prototype._getNeighbours = function (node) {
    let x = node.x;
    let y = node.y;
    let t = this.getTerritory({x: x, y: y});
    if (t) {
        return this.indexToHexCoord_Array(t.neighbours);
    } else {
        console.log('_getNeighbours null[' + x + ',' + y + ']');
    }
};

World.prototype.clearUp = function () {
    this.territoriesPool.splice(0);
    this.validTerritors.splice(0);
};


World.prototype.createWorldMap = function () {

    this.territoriesPool.splice(0);
    this.validTerritors.splice(0);

    let counter = 0;
    for (let i = 0; i < this.COLS; i++) {
        for (let j = 0; j < this.ROWS; j++) {
            let hexCoord = {
                x: i,
                y: j - Math.floor(i / 2)
            };
            let wPos = this.hexCoordToWorldPos(hexCoord);
            let t = new Territory(wPos.x, wPos.y);
            t.hexCoord = hexCoord;
            this.territoriesPool.push(t);
            this.validTerritors.push(counter);
            counter++;
        }
    }
    //
    this.linkToNeighbour();
    //
    this.carveTheMap(8);
    //
    this.makeSpecialTerritory(6);

};

World.prototype.carveTheMap = function (n) {
    let self = this;
    for (let i = 0; i < n; ++i) {
        let hc = self.getRandomValidHexCoord();
        let t = this.getTerritory(hc);
        if (t.hasNeighbour()) {
            self.removeTerritory(hc);
            console.log("carve removeTerritory:" + this.hexCoordToIndex(hc));
            let idx = _.indexOf(this.validTerritors,this.hexCoordToIndex(hc));
            if(idx !== -1){
                this.validTerritors.splice(idx, 1);
            }else{
                console.log("carveTheMap cant find index of [" + hc.x +',' +hc.y +']in the validTerritors');
            }
        } else {
            i--;
        }
    }
};

World.prototype.makeSpecialTerritory = function (n) {
    const discNumMax = 4;
    const discValueMinMax = 3;
    for (let i = 0; i < n; ++i) {
        let hc = this.getRandomValidHexCoord();
        let t = this.getTerritory(hc);
        if (t.isNormal()) {
            t.diceNum = _.random(1, discNumMax);
            t.diceValueMin = _.random(1, discValueMinMax);
        } else {
            --i
        }
    }
};

World.prototype.getPath = function (from, to) {
    return this.pathFinder.findPath(from.x, from.y, to.x, to.y);
};

World.prototype.getRandomHexCoord = function () {
    //因为本身idx就是idx
    let idx = _.random(0, _.size(this.territoriesPool) - 1);
    return this.indexToHexCoord(idx);
};

World.prototype.getRandomValidHexCoord = function () {
    let idx = this.validTerritors[_.random(0, _.size(this.validTerritors) - 1)];
    return this.indexToHexCoord(idx);
};
/*
World.prototype.createWorldMapFromData = function (data) {

};
*/
World.prototype.hexCoordToWorldPos = function (hexCell) {
    return {
        x: (hexCell.x) * this.gridSize_x,
        y: (hexCell.y + (hexCell.x) * 0.5) * this.gridSize_y
    };
};

World.prototype.worldPosToHexCoord = function (wpos) {
    let hexCell_x = Math.floor(wpos.x / this.gridSize_x);
    let hexCell_y = Math.floor(wpos.y / this.gridSize_y - hexCell_x * 0.5);
    return {
        x: hexCell_x,
        y: hexCell_y
    };
};

World.prototype.indexToHexCoord = function (idx) {
    let col = Math.floor(idx / this.ROWS);
    let row = idx % this.ROWS;
    row = row - Math.floor(col / 2);
    return {x: col, y: row};
};

World.prototype.indexToHexCoord_Array = function (idxes) {
    let hcs= [];
    let self = this;
    _.forEach(idxes,function (idx) {
        hcs.push(self.indexToHexCoord(idx));
    });
    return hcs;
};

World.prototype.hexCoordToIndex = function (hexCoord) {
    return this.ROWS * hexCoord.x + hexCoord.y + Math.floor(hexCoord.x / 2);
};

World.prototype.getTerritory = function (hexCoord) {
    let idx = -1;
    if(typeof hexCoord == 'number') idx = hexCoord;
    else idx = this.hexCoordToIndex(hexCoord);

    if (idx >= 0 && idx < _.size(this.territoriesPool)) return this.territoriesPool[idx];
    else {
        console.log("cant find hexCoord[" + hexCoord.x + ',' + hexCoord.y + ']Territory');
        return null;
    }
};
//就是WorldMap整张的Y值在每一列的范围（包含）
World.prototype.getRangeYAxis = function (x) {
    return {min: 0 - Math.floor(x / 2), max: this.ROWS - 1 - Math.floor(x / 2)};
};

World.prototype.filterNeighbour = function (hexCoord, neighbour) {
    //neighbour需要是数组
    let self = this;
    if (Array.isArray(neighbour)) {
        neighbour.splice(0);
        neighbour.push(this.hexCoordToIndex({x: hexCoord.x, y: hexCoord.y - 1}));        //top
        neighbour.push(this.hexCoordToIndex({x: hexCoord.x, y: hexCoord.y + 1}));        //down
        neighbour.push(this.hexCoordToIndex({x: hexCoord.x - 1, y: hexCoord.y}));       //lt
        neighbour.push(this.hexCoordToIndex({x: hexCoord.x - 1, y: hexCoord.y + 1}));   //ld
        neighbour.push(this.hexCoordToIndex({x: hexCoord.x + 1, y: hexCoord.y - 1}));    //rt
        neighbour.push(this.hexCoordToIndex({x: hexCoord.x + 1, y: hexCoord.y}));       //rd
        //将不合法的剔除
        for (let i = 0; i < neighbour.length; ++i) {
            let n = this.indexToHexCoord(neighbour[i]);
            //不合法，将其删除
            if (n.x < 0 || n.x > self.COLS - 1) {
                neighbour.splice(i, 1);
                i--;
                continue;
            }
            let range = self.getRangeYAxis(n.x);
            if (n.y < range.min || n.y > range.max) {
                neighbour.splice(i, 1);
                i--;
            }
        }
        return neighbour;
    }
    return null;
};

World.prototype.linkToNeighbour = function () {
    let self = this;
    _.forEach(this.territoriesPool, function (child) {
        if (child) {
            self.filterNeighbour(child.hexCoord, child.neighbours);
        }
    });
};

World.prototype.removeTerritory = function (hexCoord) {
    let territory = this.getTerritory(hexCoord);
    for (let i = 0, l =_.size(territory.neighbours); i < l; ++i) {
        //遍历所有的邻居，然后将邻居中的自己删掉
        let neighbour_tid = territory.neighbours[i];
        let t = this.getTerritory(neighbour_tid);
        t.removeNeighbour(this.hexCoordToIndex(hexCoord));
    }
    territory.neighbours.splice(0);

};

World.prototype.serialize = function () {
    //按顺序发送，hexCoord可以推算出来
    let content = [];
    _.forEach(this.territoriesPool, function (child) {
        content.push({
            //hc: {x: child.hexCoord.x, y: child.hexCoord.y},
            nb: child.neighbours,
            dn: child.diceNum,
            dv: child.diceValueMin
        });
    });
    return {
        cfg: {
            c: this.COLS,
            r: this.ROWS,
            s: this.HEX_SIZE
        },
        map: content
    };
};

module.exports.Territory = Territory = function (x, y) {
    this.pos = {x: x, y: y};    //这个是Territory在绘制Canvas的位置
    this.hexCoord = {};         //这个是Territory在网格坐标系的位置
    this.neighbours = [];        //周围的地形块
    this.overlord = null;       //这里保存着overlord的实例
    this.diceNum = 1;           //骰子个数
    this.diceValueMin = 1;      //骰子最小值
    this.diceValueMax = 6;      //骰子最大值
    this.gainCoin = 1;          //区域获得金币数
};

Territory.prototype.setData = function (data) {
    this.diceNum = data.dn || this.diceNum;           //骰子个数
    this.diceValueMin = data.dv || this.diceValueMin;      //骰子最小值
    this.diceValueMax = data.dm || this.diceValueMax;              //骰子最大值
    this.gainCoin = data.gc || this.gainCoin; //区域获得金币数
};
Territory.prototype.getData = function () {
    return {
        hc: this.hexCoord,
        dn: this.diceNum,
        dv: this.diceValueMin,
        dm: this.diceValueMax,
        gc: this.gainCoin,
    }
};
Territory.prototype.setOverlord = function (lord) {
    this.overlord = lord;
};
Territory.prototype.isNormal = function () {
    return this.diceNum === 1 || this.diceValueMin === 1;
};
Territory.prototype.upgradeDiceNum = function (dn) {
    if (dn) this.diceNum = dn;
    else this.diceNum += 1;
};
Territory.prototype.upgradeDiceValue = function (dv) {
    if (dv) this.diceValueMin = dv;
    else this.diceValueMin += 1;
};
Territory.prototype.isNeighbour = function (idx) {
    return _.contains(this.neighbours,idx);
};
//删除
Territory.prototype.removeNeighbour = function (idx) {
    let n_idx = _.indexOf(this.neighbours,idx);
    if (idx !== -1) this.neighbours.splice(n_idx, 1);
};
Territory.prototype.hasNeighbour = function () {
    return _.size(this.neighbours) !== 0;
};