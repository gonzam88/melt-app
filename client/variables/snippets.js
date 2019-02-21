var snippets = [
    {
        title: "Log",
        icon: "comment outline",
        code: "log('hi there')\n",
        hint: "Replacement for console.log()"
    },
    {
        title: "Line",
        icon: "window minimize",
        code: "line(x1, y1, x2, y2);\n",
        hint: "Will draw a straight line"
    },
    {
        title: "Ellipse",
        icon: "circle outline",
        code: "ellipse(x, y, radio);\n",
        hint: "Draws a circle. A fourth parameter sets resolution (default:100)"
    },
    {
        title: "Shape",
        icon: "star outline",
        code: "beginShape();\nvertex(x1,y1);\nvertex(x2,y2);\nendShape();\n",
        hint: "Joins given vertices by straight lines"
    },
    {
        title: "Text",
        icon: "font",
        code: "textSize(0.5);\ntextFont('cursive');\ntext('Hello World', PenPosition().x,PenPosition().y);\n",
        hint: "Draws single-path text. Available fonts: astrology, cursive, cyrillic, futural, futuram, gothiceng, gothicger, gothicita, greek, japanese, markers, mathlow, mathupp, meteorology, music, scriptc, scripts, symbolic, timesg, timesi, timesib, timesr, timesrb"
    },
    {
        title: "Start Pen Position",
        icon: "compass outline",
        code: "PenPosition().x\nPenPosition().y;\n",
        hint: "Returns a vector showing the position of the pen from where it started"
    },
    {
        title: "Width",
        icon: "arrows alternate horizontal",
        code: "width\n",
        hint: "Returns page width"
    },
    {
        title: "Height",
        icon: "arrows alternate vertical",
        code: "height\n",
        hint: "Returns page height"
    }
]
