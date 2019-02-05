// A Simple Curve
// This shows how to define vectors (using de Victor.js)
// And assign them to create a quadratic Bezier curve
//
//
// Cubic bezier is not supported now, but will be
// Credit goes to https://pomax.github.io/bezierjs/

from = new Victor(0, height)
controlPt = new Victor(0,0)
to = new Victor(width, 0)

ellipse(from.x,from.y,20)
ellipse(controlPt.x,controlPt.y,20)
ellipse(to.x,to.y,20)

curve(from,controlPt,to)

log(from)
log(controlPt)
log(to)
