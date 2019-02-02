var xoff    = PenPosition().x,
    yoff    = PenPosition().y;
var grid    = 2;
var height  = 330,
    width   = 490;

for (let i = 0; i < width / grid; i++) {
    for (let j = 0; j < height / grid; j++) {
        PickOne() ? LtR(i * grid, j * grid) : RtL(i * grid, j * grid);
    }
}

function PickOne() {
    return Math.floor(Math.random() * 2) ? true : false;
}

function RtL(x, y) {
    line(x + xoff, y + yoff, x + xoff + grid, y + yoff + grid);
}

function LtR(x, y) {
    line(x + xoff + grid, y + yoff, x + xoff, y + yoff + grid);
}
