// Lissajous Curve
// You can play with these two numbers to get different shapes
// http://mathworld.wolfram.com/LissajousCurve.html
// https://www.youtube.com/watch?v=glDU8Nsyidg

var a = 0.3;
var b = 0.4;

var t = 0;
beginShape();
for (i = 0; i < 630; i++) {
    x = 160*Math.sin(a*t+Math.PI/2);
    y = 160*Math.sin(b*t);
    vertex(width/2+x, height/2+y);
    t+=0.1;
}
endShape();
