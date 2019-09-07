let Heap = require('./heap');
let Heuristic ={
    manhattan: function(dx, dy) {
        return dx + dy;
    }
};

let backtrace = function(node) {
    let path = [[node.x, node.y]];
    while (node.parent) {
        node = node.parent;
        path.push([node.x, node.y]);
    }
    return path.reverse();
};

function AStarFinder(opt) {
    opt = opt || {};
    this.getNeighbours = opt.getNeighbours;
    this.heuristic = opt.heuristic || Heuristic.manhattan;
    this.weight = opt.weight || 1;

    //
    this.Node = function(x, y, parent_index, g, h, f) {
        this.x = x;
        this.y = y;
        this.parent = parent_index;
        this.g = g;
        this.h = h;
        this.f = f;
        this.opened = false;
        this.closed = false;

    }
}

AStarFinder.prototype.findPath = function(startX, startY, endX, endY) {

    // Create start and destination as true nodes
    let start = new this.Node(startX, startY, null, 0, 0, 0);
    //let destination = new this.Node(endX, endY, null, 0, 0, 0);

    let open = new Heap(function(nodeA, nodeB) {
        return nodeA.f - nodeB.f;
    });

    start.g = 0;
    start.f = 0;

    open.push(start);
    start.opened = true;

    while (!open.empty())
    {
        // Set it as our current node
        let current_node = open.pop();

        current_node.closed = true;

        // Check if we've reached our destination
        if (current_node.x === endX && current_node.y === endY)
        {
            return  backtrace(current_node);
        }

        let neighbors = this.getNeighbours(current_node);

        for (let i = 0,l = neighbors.length; i < l; ++i) {

            let mapNode = neighbors[i];
            let neighbor = new this.Node(mapNode.x, mapNode.y, null, 0, 0, 0);

            if (neighbor.closed) {
                continue;
            }

            let x = neighbor.x;
            let y = neighbor.y;

            let ng = current_node.g + ((x - current_node.x === 0 || y - current_node.y === 0) ? 1 : 1.414);

            if (!neighbor.opened || ng < neighbor.g) {
                neighbor.g = ng;
                neighbor.h = neighbor.h || this.weight * this.heuristic(Math.abs(x - endX), Math.abs(y - endY));
                neighbor.f = neighbor.g + neighbor.h;
                neighbor.parent = current_node;

                if (!neighbor.opened) {
                    open.push(neighbor);
                    neighbor.opened = true;
                } else {
                    open.updateItem(neighbor);
                }
            }

        }
    }

    return [];
};



module.exports = AStarFinder;