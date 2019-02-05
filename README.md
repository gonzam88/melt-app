# Melt
A polargraph controller

Melt is my response to the awesome and complete [Polargraph Controller](https://github.com/euphy/polargraphcontroller) made by Sandy Noble. It's a way to interact with the [Polargraph Server](https://github.com/euphy/polargraph_server_a1) in a flexible way. Also draw from code as if it were p5.js/Processing

![Custom JS Code](https://i.imgur.com/pTLWwDl.png "Melt Code")
![Queue with progress bar](https://i.imgur.com/FRWW641.png "Melt Queue")
![Configuration tab showing command and description](https://i.imgur.com/GQa8lcA.png "Melt Configuration")

## Melt "API"
Run any of these to control de plotter from code. You can use the included editor to comfortably write or open the inspector with CTRL/CMD+I for wild testing. Standard JavaScript applies.

### Line
`line(x1, y1, x2, y2)`
### Ellipse
`ellipse(x, y, radio)`
### Shape
`beginShape();`

`vertex(x1, y1);`

`vertex(x2, y2);`

`endShape();`
### Curve (Bezier)
`from = new Victor(0, height);`

`controlPt = new Victor(0,0);`

`to = new Victor(width, 0);`

`curve(from, controlPt, to)`

## About
My main goal when making Melt was to create a way to write creative code as if it were p5.js or Processing, being able to import a sketch and make minimum changes for the plotter to make the drawing. It might also be the best way for a slow, relaxed debugging.

## Either Download:

Head to the [releases page](https://github.com/gonzam88/melt-app/releases) and select your Mac or Windows flavor. (Linux on the way)

## Or Build:
Prerequisites: Node, npm, yarn (if you want to build)

1. [Clone / Download This Repository](https://github.com/gonzam88/melt-app.git)
2. In a terminal/console window `cd path/to/repo`
3. Download dependencies with `npm install`
4. To run the app `npm start`
5. To build the app `npm run build` (will trigger yarn dist)

## Awesome Libraries used in this project
- [polargraph_server_a1](https://github.com/euphy/polargraph_server_a1)
- [Electron](https://electronjs.org/)
- [semantic-ui](https://semantic-ui.com/)
- [fabric.js](http://fabricjs.com)
- [Ace code editor](https://ace.c9.io/)
- [Victor](http://victorjs.org)
- [Vue](https://vuejs.org)
- [BezierJs](https://github.com/Pomax/bezierjs)
- [jquery](https://jquery.com/)

## Hack

The app structure is very basic. It´s a website wrapped by Electron. `main.js` starts the process, it´s mostly electron stuff. `client/index.html` holds the DOM elements. `client/melt.js` is where everything happens. The code is pretty straight forward, go ahead and have a happy hacking

## Use

This software is not even Alpha. There's no warranty, but also it's harmless.
Feel free to suggest improvements, submit issues or pull request new features/fixes

You are most invited to open the developer console, poke around, break things and hack your way.

made by [Gonzalo Moiguer](https://www.gonzamoiguer.com.ar)
