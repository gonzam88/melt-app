// Draws a 10PRINT pattern from current Pen Position
// Read more here: https://10print.org/

var xoff            = PenPosition().x,
    yoff            = PenPosition().y;
var grid            = 8;
var drawnigHeight   = 200,
    drawingWidth    = 200;

for (let i = 0; i < drawnigHeight / grid; i++) {
    for (let j = 0; j < drawingWidth / grid; j++) {
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
