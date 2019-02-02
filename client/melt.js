/*
https://github.com/euphy/polargraph/wiki/Polargraph-machine-commands-and-responses
*/
const remote = require('electron').remote;
const win = remote.getCurrentWindow();

require('electron-titlebar');
const SerialPort = require("serialport");
const Readline = require('@serialport/parser-readline')

const {
    app
} = require('electron');
const settings = require('electron-settings');
var Mousetrap = require('mousetrap');
var usbDetect = require('usb-detection');


function Selector_Cache() {
    // Caching jquery selectors
    // source: https://ttmm.io/tech/selector-caching-jquery/
    // Usage $( '#element' ) becomes
    // dom.get( '#element' );
    var collection = {};

    function get_from_cache(selector) {
        if (undefined === collection[selector]) {
            collection[selector] = $(selector);
        }
        return collection[selector];
    }
    return {
        get: get_from_cache
    };
}
var dom = new Selector_Cache();

function map(x, in_min, in_max, out_min, out_max) {
    return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

function p(txt) {
    // just a lazy shortcut
    console.log(txt);
}


var Polargraph = (function() {
    var serial = {
        port: null,
        parser: null,
    };
    var machine = {
        mmPerStep: null,
        stepsPerMM: null,

        widthSteps: null,
        heightSteps: null,
        widthMM: null,
        heightMM: null,

        mmPerRev: null,
        stepsPerRev: null,
        stepMultiplier: null,
        downPos: null,
        upPos: null,

        isReady: false,
        queue: [],
        isQueueActive: true,
        motors: {
            leftDisSteps: null,
            rightDisSteps: null,
            leftPosPx: new Victor(0, 0),
            rightPosPx: new Victor(0, 0),
            maxSpeed: null,
            acceleration: null,
            syncedLeft: null,
            syncedRight: null,
        }
    };
    var page = {
        width: null,
        height: null,
    };
    var factors = {
        mmToPx: 0.25,
        pxToMM: 4,
        pxPerStep: null,
        stepPerPx: null
    };
    var statusIcon = {
        error: '<i class="statuserror small exclamation circle icon"></i>',
        success: '<i class="statusok small check circle icon"></i>',
        working: '<i class="statusworking notched circle loading icon"></i>',
        element: $("statusAlert")
    };

    var ui = {
        toggledElement: null,
        canvas: null,
        canvasNeedsRender: false,
        appRefreshRate: 500, // in millis
        machine: {
            lineRight: null,
            lineLeft: null,
            rightCircle: null,
            leftCircle: null,
            squareBounds: null,
            rightPosPx: new Victor(0, 0),
            leftPosPx: new Victor(0, 0)
        },
        newPenPositionArrow: null,
        waitingReadyAfterPause: null,
        currContent: null,
        mousePos: new Victor(0, 0),
        isSettingPenPos: false,
        isSettingNewPenPosition: false,
        isKeyboardControlling: false,
        keyboardControlDeltaPx: 2.5,
        penPositionPixels: new Victor(0, 0),
        nextPenPosition: new Victor(0, 0),
        gondolaCircle: null,
        homeSquare: null,
        queueEmptyContent: $("#queue").html(),
        homePos: null,
        movementLine: null
    };

    var serialInit = function() {
        let myport = settings.get('serial-path')
        if (typeof myport != "undefined") {
            SerialConnectTo(myport)
        } else {
            ListSerialPorts();
        }

        // If theres any change to USB Ports, scan again
        usbDetect.startMonitoring();
        usbDetect.on('change', function() {
            // console.log("USB Changed")
            setTimeout(ListSerialPorts, 500)
        });

        // Worker setup to allow
        var doWork
        try {
            doWork = new Worker('interval.js')
            // Worker allowed. initializing
            doWork.onmessage = function(event) {
                if (event.data === 'interval.start') {
                    CheckQueue(); // queue your custom methods in here or whatever
                }
            };
            doWork.postMessage({
                start: true,
                ms: ui.appRefreshRate
            }); // tell the worker to start up with 250ms intervals
            // doWork.postMessage({stop:true}); // or tell it just to stop.
        } catch {
            // Worker denied
            CheckQueue();
            console.warn("Web worker not allowed 👨‍🏭 Plotter will run slow if tab is in background or computer fell asleep 😴");
        }
    }
    var fabricInit = function() {
        ui.canvas = new fabric.Canvas('myCanvas');
        ui.canvas.freeDrawingBrush.color = "purple";
        ui.canvas.freeDrawingBrush.width = .5;
        ui.canvas.isDrawingMode = false;

        fabric.Object.prototype.set({
            hasControls: false,
            originX: 'center',
            originY: 'center',
            lockRotation: true,
            lockMovementX: true,
            lockMovementY: true,
            lockScalingX: true,
            lockScalingY: true,
            lockUniScaling: true,
            hasControls: false,
            selectable: false
        });

        window.addEventListener('resize', resizeCanvas, false);

        // Define some fabric.js elements
        ui.machine.squareBounds = new fabric.Rect({
            width: 0,
            height: 0,
            left: 0,
            top: 0,
            fill: 'rgba(255,255,255,.2)',
            stroke: "white",
            originX: 'left',
            originY: 'top',
        })
        ui.canvas.add(ui.machine.squareBounds);

        ui.machine.lineRight = new fabric.Line([machine.motors.rightPosPx.x, machine.motors.rightPosPx.y, 0, 0], {
            left: 0,
            top: 0,
            stroke: 'grey',
        });
        ui.machine.lineLeft = new fabric.Line([machine.motors.leftPosPx.x, machine.motors.leftPosPx.y, 0, 0], {
            left: 0,
            top: 0,
            stroke: 'grey',
        });
        ui.canvas.add(ui.machine.lineRight);
        ui.canvas.add(ui.machine.lineLeft);

        ui.machine.rightCircle = new fabric.Circle({
            radius: 6,
            fill: 'white',
            left: machine.motors.rightPosPx.x,
            top: machine.motors.rightPosPx.y,
        });
        ui.machine.leftCircle = new fabric.Circle({
            radius: 6,
            fill: 'white',
            left: machine.motors.leftPosPx.x,
            top: machine.motors.rightPosPx.y,
        });
        ui.canvas.add(ui.machine.rightCircle);
        ui.canvas.add(ui.machine.leftCircle);

        ui.homeSquare = new fabric.Triangle({
            left: 0,
            top: 0,
            width: 3,
            height: 3,
            fill: 'black',
            visible: false
        })
        ui.canvas.add(ui.homeSquare)

        ui.movementLine = new fabric.Line([0, 0, 100, 100], {
            left: 0,
            top: 0,
            stroke: 'white',
            strokeWidth: .5,
            visible: false
        });
        ui.canvas.add(ui.movementLine)

        ui.gondolaCircle = new fabric.Circle({
            radius: 3,
            fill: '#a4bd8e',
            left: 0,
            top: 0,
        });
        ui.canvas.add(ui.gondolaCircle);

        ui.newPenPositionArrow = new fabric.Line([machine.motors.leftPosPx.x, machine.motors.leftPosPx.y, 0, 0], {
            left: 0,
            top: 0,
            stroke: 'grey',
        });
        ui.canvas.add(ui.newPenPositionArrow);
        // Mousewheel Zoom
        ui.canvas.on('mouse:wheel', function(opt) {
            var delta = opt.e.deltaY;
            // let pointer = canvas.getPointer(opt.e);
            var zoom = ui.canvas.getZoom();
            zoom = zoom + delta / 200;
            if (zoom > 10) zoom = 10;
            if (zoom < 0.6) zoom = 0.6;
            ui.canvas.zoomToPoint({
                x: opt.e.offsetX,
                y: opt.e.offsetY
            }, zoom);
            opt.e.preventDefault();
            opt.e.stopPropagation();

            let objs = ui.canvas.getObjects();
            for (let i = 0; i < objs.length; i++) {
                if (!objs[i].isGrid) {
                    objs[i].setCoords();
                }
            }
        });

        ui.canvas.on('mouse:down', function(opt) {

            var evt = opt.e;
            if (evt.altKey === true || opt.which == 2) {
                this.isDragging = true;
                this.selection = false;
                this.lastPosX = evt.clientX;
                this.lastPosY = evt.clientY;
            } else {
                if (ui.isSettingPenPos) {
                    SetPenPositionPixels(ui.mousePos.x, ui.mousePos.y);
                    ui.isSettingPenPos = false; // SHould this go here or inside the function SetPenPositionPixels ?
                    DeactivateToggles();
                    $("#set-custom-postion").removeClass("teal");
                } else if (ui.isSettingNewPenPosition) {
                    SetNextPenPositionPixels(ui.mousePos.x, ui.mousePos.y);
                    // ui.isSettingNewPenPosition = false;
                }
            }
        });

        // canvas mouse move
        ui.canvas.on('mouse:move', function(opt) {
            if (this.isDragging) {
                var e = opt.e;
                // Pan
                this.viewportTransform[4] += e.clientX - this.lastPosX;
                this.viewportTransform[5] += e.clientY - this.lastPosY;
                this.requestRenderAll();
                this.lastPosX = e.clientX;
                this.lastPosY = e.clientY;
            }

            let pointer = ui.canvas.getPointer(options.e);
            ui.mousePos.x = pointer.x;
            ui.mousePos.y = pointer.y;

            UpdatePositionMetadata(ui.mousePos);
            ui.canvas.renderAll();
        }); // mouse move

        ui.canvas.on('mouse:up', function(opt) {
            this.isDragging = false;
            this.selection = true;
        });

        dom.get("canvas").hover(
            function() {
                isMouseOverCanvas = true;
            },
            function() {
                isMouseOverCanvas = false;
                UpdatePositionMetadata(ui.penPositionPixels);
            }
        );

        ui.canvas.on('path:created', function(e) {
            // canvas.isDrawingMode = false;
            showNotificationOnFinish = true;
            var myPath = e.path;
            // console.log(myPath);
            let points = myPath.path;

            for (let i = 0; i < points.length; i++) {
                if (i == 0) {
                    // Es el primer punto
                    melt.PenUp();
                    AddPixelCoordToQueue(points[i][2], points[i][1]);
                    melt.PenDown();

                } else if (i == points.length - 1) {
                    // es el ultimo punto
                    AddPixelCoordToQueue(points[i][2], points[i][1]);
                    melt.PenUp();
                } else {
                    // Es un punto normal
                    AddPixelCoordToQueue(points[i][2], points[i][1]);
                }
            }
        });
    }
    var uiInit = function() {
        queueEmptyContent = $("#queue").html();
        // Input console
        dom.get("#consoleInput").keyup(function(e) {
            let code = e.which; // recommended to use e.which, it's normalized across browsers
            if (code == 13 || code == 176) {
                // 13 es el Enter comun. 176 es el enter del keypad
                e.preventDefault();
                let msg = dom.get("#consoleInput").val();
                if (msg == "") return;
                msg = msg.toUpperCase();
                SerialSend(msg);
                // WriteConsole(msg, false);
                dom.get("#consoleInput").val(""); // Vacío el input
                lastSentConsoleCmd = msg;

            } else if (code == 38 || code == 104) {
                // Up arrow
                e.preventDefault();
                if (lastSentConsoleCmd != "") {
                    dom.get("#consoleInput").val(lastSentConsoleCmd);
                }

            }
        });

        ui.currContent = dom.get("#content-control");

        dom.get(".main-menu-link").click(function() {

            let href = $(this).data("panel");
            let newContent = dom.get("#content-" + href);
            // if( ui.currContent != newContent ){
            ui.currContent.hide();
            newContent.show();
            if (href == "console") {
                dom.get("#console").scrollTop(dom.get("#console")[0].scrollHeight); // Scroleo para abajo de todo

            } else if (href == "tools") {
                ExitEditorMode();
            }

            ui.currContent = newContent;
        })
        $('.ui.menu')
            .on('click', '.item', function() {
                if (!$(this).hasClass('dropdown')) {
                    $(this).addClass('active').siblings('.item').removeClass('active');
                }
            });

        dom.get("#serial_connections").on("click", ".button", function() {
            if (serial.port !== undefined && serial.port.isOpen) {
                serial.port.close();
            }

            statusIcon.element.html(statusIcon.error);

            portPath = $(this).data("connectto");
            console.log("Conntecting to", portPath);
            SerialConnectTo(portPath);
        })

        dom.get(".serial_reconnect").click(function() {
            ListSerialPorts();
        })

        $('.mypopup').popup();

        dom.get("#set-custom-postion").click(function() {
            ui.isSettingPenPos = true;
        })

        dom.get("#pen-lift").click(function() {
            melt.PenUp(true); // True sets to now instead of queue
        })

        dom.get("#pen-drop").click(function() {
            melt.PenDown(true); // True sets to now instead of queue
        })

        $('#pause-queue').click(function() {
            if (machine.isQueueActive) {
                machine.isQueueActive = false;
                ui.waitingReadyAfterPause = true;
                $('#pause-queue').html('<i class="play icon"></i>Resume');
            } else {
                machine.isQueueActive = true;
                ui.waitingReadyAfterPause = false;
                $('#pause-queue').html('<i class="pause icon"></i>Pause');
            }
        });

        $('#clear-queue').click(function() {
            machine.queue = [];
            lastQueueCmd = "";
            QueueBatchComplete();
            dom.get('#queue').html(queueEmptyContent);
        });

        dom.get("#queue-progress").progress({
            percent: 100
        });

        dom.get("#run-code-button").click(function() {
            CheckCode();
        })

        dom.get(".run-code-updown").click(function() {
            if ($(this).children().hasClass("up")) {
                codeRepetitions++;
            } else {
                if (codeRepetitions > 0) codeRepetitions--;
            }
            refButton();
        })

        function refButton() {
            let txt = "";
            if (codeRepetitions == 0) {
                txt = "Draw forever";
            } else if (codeRepetitions == 1) {
                txt = "Draw once";
            } else {
                txt = "Draw " + codeRepetitions + " times";
            }
            dom.get("#run-code-button span").html(txt);
        }
        refButton();

        var snippets = {
            line: "melt.line(x1, y1, x2, y2);",
            ellipse: "melt.ellipse(x, y, radio);",
            shape: "melt.beginShape();\n\// Your vertices\n\melt.endShape();",
            penposition: "(PenPosition().x, PenPosition().y);",
        }
        dom.get(".codeTools").click(function() {
            let tool = $(this).data("toolname");
            let action = $(this).data("toolaction");
            switch (action) {
                case "insert":
                    editor.session.insert(editor.getCursorPosition(), snippets[tool]);
                    break;
            }
            editor.focus()
        })

        dom.get("#reveal-code").click(function() {
            EnterEditorMode();
        })

        dom.get("#uploadMachineConfig").click(function() {
            UploadMachineConfig();
        })

        function EnterEditorMode() {
            dom.get("#editor-container").slideDown();
            dom.get("#tools-buttons").hide();
            editor.focus()
        }

        function ExitEditorMode() {
            dom.get("#tools-buttons").slideDown();
            dom.get("#editor-container").hide();
        }

        // Custom toggle callback implementation
        dom.get(".myToggle").click(function() {
            if (ui.toggledElement) {
                if ($(this).attr("id") == $(ui.toggledElement).attr("id")) {
                    // Deselect current toggle
                    ui.toggledElement.trigger("toggleDeselect");
                    ui.toggledElement.removeClass("activeToggle");
                    ui.toggledElement = "";
                } else {
                    // Deselect prev toggle
                    ui.toggledElement.trigger("toggleDeselect");
                    ui.toggledElement.removeClass("activeToggle");

                    // Select the new toggle
                    ui.toggledElement = $(this);
                    ui.toggledElement.trigger("toggleSelect");
                    ui.toggledElement.addClass("activeToggle");
                }
            } else {
                // First toggle to be selected
                ui.toggledElement = $(this);
                ui.toggledElement.trigger("toggleSelect");
                ui.toggledElement.addClass("activeToggle");
            }
        });

        dom.get(".deactivateToggle").click(function() {
            DeactivateToggles();
        });

        // Setting the callbacks to their specific actions
        dom.get("#tools-free-draw").on("toggleSelect", function() {
            canvas.isDrawingMode = true;
        })
        dom.get("#tools-free-draw").on("toggleDeselect", function() {
            canvas.isDrawingMode = true;
        })

        dom.get("#control-pen-position").on("toggleSelect", function() {
            ui.isSettingNewPenPosition = true;
        })
        dom.get("#control-pen-position").on("toggleDeselect", function() {
            ui.isSettingNewPenPosition = false;
        })

        dom.get("#return-home").on("click", function() {
            if (typeof home !== undefined) {
                SetNextPenPositionPixels(homePos.x, homePos.y);
            }
        })

        dom.get("#keyboard-control").on("toggleSelect", function() {
            ui.isKeyboardControlling = true;
            dom.get("#keyboard-control-container").slideDown();
        })
        dom.get("#keyboard-control").on("toggleDeselect", function() {
            ui.isKeyboardControlling = false;
            dom.get("#keyboard-control-container").slideUp();
        })

        // ******************
        // Keyboard shortcuts
        // ******************
        Mousetrap.bind('up', function() {
            if (!ui.isKeyboardControlling || !machine.isReady) return
            SetNextPenPositionPixels(ui.penPositionPixels.x, ui.penPositionPixels.y - ui.keyboardControlDeltaPx, true);
        });

        Mousetrap.bind('right', function() {
            if (!ui.isKeyboardControlling || !machine.isReady) return
            SetNextPenPositionPixels(ui.penPositionPixels.x + ui.keyboardControlDeltaPx, ui.penPositionPixels.y, true);
        });

        Mousetrap.bind('down', function() {
            if (!ui.isKeyboardControlling || !machine.isReady) return
            SetNextPenPositionPixels(ui.penPositionPixels.x, ui.penPositionPixels.y + ui.keyboardControlDeltaPx, true);
        });

        Mousetrap.bind('left', function() {
            if (!ui.isKeyboardControlling || !machine.isReady) return
            SetNextPenPositionPixels(ui.penPositionPixels.x - ui.keyboardControlDeltaPx, ui.penPositionPixels.y, true); // setting last param to true skips the queue
        });

        Mousetrap.bind('space', function() {
            if (!ui.isKeyboardControlling || !machine.isReady) return
            melt.TogglePen();
        });
    }
    var initKeyboardControl = function() {
        dom.get("#keyboard-input-mm").val(ui.keyboardControlDeltaPx * factors.pxToMM);
        dom.get("#keyboard-input-px").val(ui.keyboardControlDeltaPx);
        dom.get("#keyboard-input-steps").val(ui.keyboardControlDeltaPx * machine.stepsPerMM);

        dom.get("#keyboard-input-mm").change(function() {
            let val = $(this).val();
            ui.keyboardControlDeltaPx = val / factors.pxToMM;
            dom.get("#keyboard-input-px").val(ui.keyboardControlDeltaPx);
            dom.get("#keyboard-input-steps").val(ui.keyboardControlDeltaPx * machine.stepsPerMM);
        })

        dom.get("#keyboard-input-px").change(function() {
            ui.keyboardControlDeltaPx = $(this).val();
            dom.get("#keyboard-input-mm").val(ui.keyboardControlDeltaPx * factors.pxToMM);
            dom.get("#keyboard-input-steps").val(ui.keyboardControlDeltaPx * machine.stepsPerMM);
        })

        dom.get("#keyboard-input-steps").change(function() {
            let val = $(this).val();
            ui.keyboardControlDeltaPx = val / machine.stepsPerMM;
            dom.get("#keyboard-input-mm").val(ui.keyboardControlDeltaPx * factors.pxToMM);
            dom.get("#keyboard-input-px").val(ui.keyboardControlDeltaPx);
        })
    }

    var DeactivateToggles = function() {
        if (ui.toggledElement) {
            // Deselect current toggle
            ui.toggledElement.trigger("toggleDeselect");
            ui.toggledElement.removeClass("activeToggle");
            ui.toggledElement = "";
        }
    }
    var EnableWorkspace = function() {
        dom.get("#dimmerEl").removeClass("active");
    }
    var DisableWorkspace = function() {
        dom.get("#dimmerEl").addClass("active");
    }
    var DrawGrid = function() {
        let offset = -200;
        options = {
                isGrid: true,
                distance: 20,
                width:  ui.canvas.width,
                height: ui.canvas.height,
                param: {
                    stroke: '#4c5669',
                    strokeWidth: 1,
                    selectable: false
                }
            },
            gridLen = (options.width / options.distance) + 1;

        for (var i = 0; i < gridLen; i++) {
            var distance = (i * options.distance) + offset,
                horizontal = new fabric.Line([distance, +offset, distance, options.width + offset], options.param),
                vertical = new fabric.Line([+offset, distance, options.width + offset, distance], options.param);
            ui.canvas.add(horizontal);
            ui.canvas.add(vertical);
            horizontal.sendToBack();
            vertical.sendToBack();
            if (i % 5 === 0) {
                horizontal.set({
                    stroke: '#7a7d82'
                });
                vertical.set({
                    stroke: '#7a7d82'
                });
            };
        };
        // End grid
        ui.canvasNeedsRender = true;
    }
    var resizeCanvas = function() {
        ui.canvas.setHeight($('#canvasSizer').height());
        ui.canvas.setWidth($('#canvasSizer').width());

        let offX = (ui.canvas.width - ui.machine.squareBounds.width) / 2;
        let offY = (ui.canvas.height - ui.machine.squareBounds.height) / 2;

        ui.canvas.viewportTransform[4] = offX;
        ui.canvas.viewportTransform[5] = offY;
        ui.canvas.requestRenderAll();
    }

    var editor, session, scriptCode;
    var codePluginInit = function() {
        // flask = new CodeFlask('#myFlask', { language: 'js', lineNumbers: true });
        // flask.updateCode('"use strict";\n');
        // trigger extension
        scriptCode = localStorage["scriptCode"];

        ace.require("ace/ext/language_tools");
        editor = ace.edit("editor");
        editor.setTheme("ace/theme/tomorrow");
        // enable autocompletion and snippets
        editor.setOptions({
            enableBasicAutocompletion: true,
            enableSnippets: true,
            enableLiveAutocompletion: true,
            asi: true // acepta que no haya comas
        });
        session = editor.getSession();
        if (scriptCode != undefined) {
            session.setValue(scriptCode);
        }
        session.setMode('ace/mode/javascript');
        session.setUseSoftTabs(true);
        session.setTabSize(4);


        session.on('change', function() {
            let scriptCode = editor.getValue();
            localStorage["scriptCode"] = scriptCode;
        });

    }

    // *********************
    //
    // Serial & Socket Communication
    //
    // *********************
    var SerialSend = function(cmd) {
        serial.port.write(cmd + '\n');
        statusIcon.element.html(statusIcon.working);
        machine.isReady = false;
        WriteConsole(cmd)
    }
    var lastReceivedString = "";
    var SerialReceive = function(currentString) {

        // Parse response in cases where data is space separated
        var responseWords = currentString.split(" ");
        switch (responseWords[0]) {
            case 'POLARGRAPH':
                // Serial connection worked
                onPolargraphConnect();
                break;

            case 'READY':
                OnMachineReady();
                break;

            case 'Loaded':
                if (responseWords[1].startsWith("width")) {
                    machine.widthMM = parseInt(responseWords[1].split(":")[1]); // Vue auto updates input

                } else if (responseWords[1].startsWith("height")) {
                    machine.heightMM = parseInt(responseWords[1].split(":")[1]);

                } else if (responseWords[1].startsWith("mmPerRev")) {
                    machine.mmPerRev = parseInt(responseWords[1].split(":")[1]);

                } else if (responseWords[1] == "steps" && responseWords[2] == "per") {
                    machine.stepsPerRev = parseInt(responseWords[3].split(":")[1]);

                } else if (responseWords[1] == "step" && responseWords[2].startsWith("multiplier")) {
                    machine.stepMultiplier = parseInt(responseWords[2].split(":")[1]);

                } else if (responseWords[1] == "down") {
                    machine.downPos = parseInt(responseWords[2].split(":")[1]);

                } else if (responseWords[1] == "up") {
                    machine.upPos = parseInt(responseWords[2].split(":")[1]);
                }
                break;

            case 'Recalc':
                if (responseWords[1] == "mmPerStep") {
                    machine.mmPerStep = parseFloat(responseWords[2].slice(0, -2).substring(1))
                    machine.stepsPerMM = parseFloat(responseWords[4].slice(0, -1).substring(1))

                } else if (responseWords[1] == "pageWidth") {
                    page.width = parseInt(responseWords[4].slice(0, -1).substring(1));

                } else if (responseWords[1] == "pageHeight") {
                    page.height = parseInt(responseWords[4].slice(0, -1).substring(1));

                    // This is the last received data, so now I recalculate
                    SetMachineDimensionsMM(machine.widthMM, machine.heightMM);
                }
                break;
        }

        // Now check for cases where data is comma separated
        responseWords = currentString.split(",");
        switch (responseWords[0]) {
            case "SYNC":
                syncedLeft = responseWords[1];
                syncedRight = responseWords[2];

                let gondolaPos = NativeToCartesian(syncedLeft, syncedRight);
                SyncGondolaPosition(gondolaPos.x * factors.stepPerPx, gondolaPos.y * factors.stepPerPx);
                // TODO Revisar que factors.pxPerStep este bien!
                break;

            case 'PGSPEED':
                machine.motors.maxSpeed = parseInt(responseWords[1]);
                machine.motors.acceleration = parseInt(responseWords[2]);

                break;
        }
        // end parse response

        if (currentString == lastReceivedString) {
            let lastLog = dom.get(".log:last-child");
            let repetitions = lastLog.data("repeated");
            repetitions++;
            lastLog.data("repeated", repetitions);
            dom.get(".log:last-child .content").html("(" + repetitions + ") " + currentString);
            return;
        }
        WriteConsole(currentString, true);
        lastReceivedString = currentString;
    }
    var lastSentConsoleCmd = ""; // TODO hacer de esto un array
    var consoleDomElement = dom.get("#console");
    var WriteConsole = function(txt, received = false) {
        let icon, clase = "log";
        if (received) {
            icon = '<i class="caret down icon receivedCmd"></i>';
        } else {
            icon = '<i class="caret up icon sentCmd"></i>';
        }
        txt = '<span class="content">' + txt + '</span>';

        let msg = "<div data-repeated='0' class='" + clase + "'>" + icon + txt + "</div>";
        dom.get("#console").append(msg);

        // dom.get("#console").scrollTop(dom.get("#console")[0].scrollHeight); // Scroleo para abajo de todo
        if (dom.get("#console").children().length > 100) {
            // Limit the amount of console history
            dom.get("#console").children().first().remove();
        }
    }
    var arduinoAutoConnect = false;
    var ListSerialPorts = function() {
        // List all serial ports
        SerialPort.list(function(err, ports) {
            $('.ui.basic.modal').modal('show');
            dom.get("#serial_connections").html("");
            let serialConnectionsContent = "";
            let portsToAnArduino = [];

            ports.forEach(function(port) {
                var icon = "microchip";
                if (port.comName.includes("Bluetooth")) {
                    icon = "bluetooth";
                }

                let manufacturer = "";
                if (port.manufacturer !== undefined && port.manufacturer.includes("Arduino")) {
                    portsToAnArduino.push(port.comName);
                    icon = '';
                }

                let iconEle;
                if (icon == '') {
                    iconEle = `<img class="arduinoIcon" src="images/arduino-icon.svg"/> `;
                } else {
                    iconEle = `<i class="${icon} large icon"></i>`;
                }
                serialConnectionsContent += `<div class="ui green basic cancel inverted button" data-connectto="${port.comName}">${iconEle} ${port.comName}</div>`;

                // serialconnect defaults to tty.* connections
                // So I manually create a cu.* option
                let newPort = port.comName.replace("/dev/tty.", "/dev/cu.");
                serialConnectionsContent += `<div class="ui green basic cancel inverted button" data-connectto="${newPort}">${iconEle} ${newPort}</div><br>`;

            });
            if (arduinoAutoConnect) {
                if (portsToAnArduino.length == 1) {
                    // If theres only one arduino, automatically connect. Else show list
                    SerialConnectTo(portsToAnArduino[0]);
                    dom.get("#serial_connections").html(`Arduino detected. Connecting to ${portsToAnArduino[0]}`);
                } else {
                    dom.get("#serial_connections").html(serialConnectionsContent);
                }
            } else {
                dom.get("#serial_connections").html(serialConnectionsContent);
            }
        });
    }
    var serialPathConnected = "";
    var SerialConnectTo = function(path) {

        // Now i actually make the connection
        serial.port = new SerialPort(path, {
            baudRate: 57600
        }, function(err) {
            if (err) {
                console.log("error conneting to " + path, err);
                ListSerialPorts();

            } else {
                serialPathConnected = path;
                usbDetect.stopMonitoring()
            }
        });

        serial.parser = serial.port.pipe(new Readline({
            delimiter: '\r\n'
        }))
        serial.parser.on('data', SerialReceive);
        dom.get("#connected_to").html(path);
        return true;
    }

    // *********************
    //
    // Machine control
    //
    // *********************
    var SetMachineDimensionsMM = function(_w, _h) {
        machine.widthMM = _w;
        machine.heightMM = _h;

        machine.widthSteps = machine.widthMM * machine.stepsPerMM;
        machine.heightMMSteps = machine.heightMM * machine.stepsPerMM;

        leftMotorPositionSteps = new Victor(0, 0);
        rightMotorPositionSteps = new Victor(0, machine.widthSteps);

        machine.motors.rightPosPx.x = machine.widthMM * factors.mmToPx;

        ui.machine.rightCircle.left = machine.motors.rightPosPx.x;
        ui.machine.lineRight.set({
            'x1': ui.machine.rightCircle.left,
            'y1': 0
        })

        ui.machine.squareBounds.set({
            'width': ui.machine.rightCircle.left,
            'height': machine.heightMM * factors.mmToPx
        });

        factors.pxPerStep = machine.widthSteps / machine.motors.rightPosPx.x;
        factors.stepPerPx = machine.motors.rightPosPx.x / machine.widthSteps;

        ui.canvasNeedsRender = true;
        initKeyboardControl();
        resizeCanvas();
        DrawGrid();
    }
    var SetPenPositionPixels = function(_x, _y) {
        ui.penPositionPixels.x = _x;
        ui.penPositionPixels.y = _y;
        ui.gondolaCircle.left = _x;
        ui.gondolaCircle.top = _y;

        ui.homeSquare.top = _y;
        ui.homeSquare.left = _x;
        ui.homeSquare.visible = true;
        homePos = new Victor(_x, _y);
        UpdatePositionMetadata(ui.penPositionPixels);

        let leftMotorDist = ui.penPositionPixels.distance(machine.motors.leftPosPx) * factors.pxPerStep;
        let rightMotorDist = ui.penPositionPixels.distance(machine.motors.rightPosPx) * factors.pxPerStep;

        let cmd = "C09," + Math.round(leftMotorDist) + "," + Math.round(rightMotorDist) + ",END";
        SerialSend(cmd);
        dom.get("#return-home").removeClass("disabled");
        dom.get("#control-pen-position").removeClass("disabled");
    }
    var SyncGondolaPosition = function(_x, _y) {
        ui.penPositionPixels.x = _x;
        ui.penPositionPixels.y = _y;
        ui.gondolaCircle.left = _x;
        ui.gondolaCircle.top = _y;
        UpdatePositionMetadata(ui.penPositionPixels);
    }
    var NativeToCartesian = function(_left, _right) {
        // Math borrowed from original polarcontroller :)  https://github.com/euphy/polargraphcontroller/blob/master/Machine.pde#L339
        let calcX = (Math.pow(machine.widthSteps, 2) - Math.pow(_right, 2) + Math.pow(_left, 2)) / (machine.widthSteps * 2);
        let calcY = Math.sqrt(Math.pow(_left, 2) - Math.pow(calcX, 2));

        let pos = new Victor(calcX, calcY);
        return pos;
    }
    var SetNextPenPositionPixels = function(_x, _y, skipQueue = false) {
        // console.time("SetNextPenPositionPixels");
        ui.nextPenPosition.x = _x;
        ui.nextPenPosition.y = _y;
        // newPenPositionCircle.left = _x;
        // newPenPositionCircle.top = _y;
        ui.canvasNeedsRender = true;

        let rightMotorDist = ui.nextPenPosition.distance(machine.motors.rightPosPx) * factors.pxPerStep;
        let leftMotorDist = ui.nextPenPosition.distance(machine.motors.leftPosPx) * factors.pxPerStep;
        let cmd = "C17," + Math.round(leftMotorDist) + "," + Math.round(rightMotorDist) + ",2,END";
        // console.timeEnd("SetNextPenPositionPixels");

        if (skipQueue) {
            SerialSend(cmd); // cheating the queue.. im in a hurry!!
        } else {
            AddToQueue(cmd);
        }
    }
    var AddMMCoordToQueue = function(x, y) {
        let pos = new Victor(x * factors.mmToPx, y * factors.mmToPx);

        let leftMotorDist = pos.distance(machine.motors.leftPosPx) * factors.pxPerStep;
        let rightMotorDist = pos.distance(machine.motors.rightPosPx) * factors.pxPerStep;
        // console.log(pos, leftMotorDist, rightMotorDist, factors.pxPerStep);
        let cmd = "C17," + Math.round(leftMotorDist) + "," + Math.round(rightMotorDist) + ",2,END";
        AddToQueue(cmd);
    }
    var AddPixelCoordToQueue = function(x, y) {
        let pos = new Victor(x * factors.pxPerStep, y * factors.pxPerStep);
        let leftMotorDist = pos.distance(leftMotorPositionSteps);
        let rightMotorDist = pos.distance(rightMotorPositionSteps);
        let cmd = "C17," + Math.round(leftMotorDist) + "," + Math.round(rightMotorDist) + ",2,END";
        AddToQueue(cmd);
    }
    var UpdatePositionMetadata = function(vec) {
        // Linea Motor
        ui.machine.lineRight.set({
            'x2': vec.x,
            'y2': vec.y
        });
        ui.machine.lineLeft.set({
            'x2': vec.x,
            'y2': vec.y
        });

        dom.get("#canvasMetaData .x").html(Math.round(vec.x));
        dom.get("#canvasMetaData .y").html(Math.round(vec.y));

        dom.get("#canvasMetaData .xmm").html((vec.x * factors.pxToMM).toFixed(1));
        dom.get("#canvasMetaData .ymm").html((vec.y * factors.pxToMM).toFixed(1));

        let disToLMotor = vec.distance(machine.motors.leftPosPx);
        dom.get("#canvasMetaData .lmotomm").html((disToLMotor * factors.pxToMM).toFixed(1));
        dom.get("#canvasMetaData .lmotosteps").html((disToLMotor * factors.pxPerStep).toFixed(1));

        let disToRMotor = vec.distance(machine.motors.rightPosPx);
        dom.get("#canvasMetaData .rmotomm").html((disToRMotor * factors.pxToMM).toFixed(1));
        dom.get("#canvasMetaData .rmotosteps").html((disToRMotor * factors.pxPerStep).toFixed(1));

        ui.canvasNeedsRender = true;
    }
    var UploadMachineConfig = function() {
        // Set machine size
        AddToQueue(`C24,${machine.widthMM},${machine.heightMM},END`);
        // Set machine millimetre extension per motor revolution (MM Per Rev)
        AddToQueue(`C29,${machine.mmPerRev},END`);
        // Set motor steps per revolution:
        AddToQueue(`C30,${machine.stepsPerRev},END`);
        // maximum motor speed
        AddToQueue(`C31,${machine.motors.maxSpeed},END`);
        //  motor Acceleration
        AddToQueue(`C32,${machine.motors.acceleration},END`);
        // step multiplier
        AddToQueue(`C37,${machine.stepMultiplier},END`);
    }
    var OnMachineReady = function() {
        // Fired when receives a 'ready' message from machine
        ui.movementLine.visible = false;
        ui.canvasNeedsRender = true;

        statusIcon.element.html(statusIcon.success);
        machine.isReady = true;
        if (!batchCompleted) {
            if (machine.isQueueActive || ui.waitingReadyAfterPause) {
                meltEvents.dispatchEvent(plotterReadyEvent);
                ui.waitingReadyAfterPause = false;
                batchDone++;
                if (batchDone >= batchTotal) QueueBatchComplete();
                UpdateBatchPercent();
            }
        }

    }

    // *******
    //
    // Queue
    //
    // *******
    var externalQueueLength = 0;
    var queueUiLength = 51;
    var showNotificationOnFinish = false;

    var CheckQueue = function() {
        // TODO ! Move sending commands to objects, in pixels.
        // Do conversion to left / right steps in the last moment
        // Keep the possibility to send string comands by checking typeof
        //
        if (machine.isQueueActive && machine.isReady) {
            if (machine.queue.length > 0) {

                let commandString = machine.queue.shift()
                if (commandString.startsWith("C17")) {
                    let cmdArr = commandString.split(",");
                    let futurePos = NativeToCartesian(cmdArr[1], cmdArr[2]);
                    ui.movementLine.set({
                        'x1': ui.penPositionPixels.x,
                        'y1': ui.penPositionPixels.y,
                        'x2': futurePos.x * factors.stepPerPx,
                        'y2': futurePos.y * factors.stepPerPx
                    });
                    ui.movementLine.visible = true;
                }
                SerialSend(commandString);

                $('#queue .item').first().remove();
                if (machine.queue.length > queueUiLength) {
                    dom.get("#queue-last-item").before("<div class='queue item'><span class='cmd'>" + machine.queue[queueUiLength - 1] + "</span><div class='ui divider'></div></div>");
                } else {
                    dom.get("#queue-last-item").hide();
                }

                if (machine.queue.length == 0) {
                    // Queue & Batch have just finished
                    UpdateBatchPercent();
                    if (showNotificationOnFinish) {
                        let myNotification = new Notification('Drawing Finished', {
                            body: 'Queue is empty again'
                        })
                        myNotification.onclick = function() {
                            win.show();
                        }
                        showNotificationOnFinish = false;
                    }

                }

            }
        }
        FormatBatchElapsed();
        if (ui.canvasNeedsRender) {
            ui.canvas.renderAll();
            ui.canvasNeedsRender = false;
        }
    }
    var AddToQueue = function(cmd) {
        if (cmd == lastQueueCmd) return "Command ignored for being identical to previous"; // Avoid two equal commands to be sent
        machine.queue.push(cmd);
        lastQueueCmd = cmd;
        // console.timeEnd("AddToQueue");
        if (batchCompleted) NewQueueBatch();
        batchTotal++;
        if (machine.queue.length < queueUiLength) {
            // If UI queue is not populated, lets add it
            $("#queue-last-item").before("<div class='queue item'><span class='cmd'>" + cmd + "</span><div class='ui divider'></div></div>");
            // dom.get("#queue").append();
        } else {
            dom.get("#queue-last-item").show();
        }
    }
    var lastQueueCmd = "";
    var batchTotal = 0,
        batchDone = 0,
        batchPercent = 0;
    var millisBatchStarted, millisBatchEnded, batchCompleted = false;
    var UpdateBatchPercent = function() {
        // TODO: show elapsed time
        let newBatchPercent;

        if (machine.queue.length == 0) {
            newBatchPercent = 0;
            win.setProgressBar(-1)
            dom.get("#queue-progress").progress({
                percent: 0
            });
        } else if (batchTotal > 0) {
            newBatchPercent = batchDone / batchTotal * 100;
        }


        if (newBatchPercent != batchPercent) {
            // By only doing this on different values I assure a proper animation on the progress bar
            dom.get("#queue-progress").progress({
                percent: batchPercent
            });
            win.setProgressBar(batchPercent / 100); // mac dock progressbar
            batchPercent = newBatchPercent;
        }

        if ($(dom.get("#queue-last-item")).is(":visible")) {
            dom.get("#queueRemaining").html(machine.queue.length - queueUiLength);
        }
    }
    var NewQueueBatch = function() {
        batchTotal = 0;
        batchDone = 0;
        batchCompleted = false;
        millisBatchStarted = new Date().getTime();
    }
    var QueueBatchComplete = function() {
        batchCompleted = true;
        millisBatchEnded = new Date().getTime();
    }
    var FormatBatchElapsed = function() {
        // Current batch elapsed
        if (millisBatchStarted == null) return;

        let elapsed, diff = {};
        if (batchCompleted) {
            elapsed = millisBatchEnded;
        } else {
            elapsed = new Date().getTime();
        }
        elapsed = (elapsed - millisBatchStarted) / 1000;
        diff.hours = Math.floor(elapsed / 3600 % 24);
        diff.minutes = Math.floor(elapsed / 60 % 60);
        diff.seconds = Math.floor(elapsed % 60);
        let msg = diff.hours + "h " + diff.minutes + "m " + diff.seconds + "s"
        dom.get("#elapsed-time").html(msg);
    }
    var onPolargraphConnect = function() {
        statusIcon.element.html(statusIcon.success);
        EnableWorkspace();
        $('.ui.basic.modal').modal('hide');
        SerialSend("C26,END");
        console.log(`Succesfully connected ✏️ to Polargraph`);
        settings.set('serial-path', serialPathConnected); // save in local config
    }

    // Public Stuff
    return {
        init: function() {
            // Call Main Functions
            serialInit();
            fabricInit();
            uiInit();
            codePluginInit();
            UpdateBatchPercent();
        },
        machine: machine
    };

})();


var vue = new Vue({
    el: '#app',
    data: {
        polargraph: Polargraph,
    }
})

window.addEventListener('load', function() {
    Polargraph.init()
    console.log("Polargraph. Made with 💚 by Gonzalo Moiguer 🇦🇷 https://www.gonzamoiguer.com.ar");
}, false)




// ***********************
//
// Commands
//
// ***********************
// Same command vars as polargraph_server_a1.ino
var CMDS = {
    "CHANGELENGTH": "C01",
    "CHANGEPENWIDTH": "C02",
    "DRAWPIXEL": "C05",
    "DRAWSCRIBBLEPIXEL": "C06",
    "CHANGEDRAWINGDIRECTION": "C08",
    "TESTPENWIDTHSQUARE": "C11",
    "SETPOSITION": "C09",
    "PENDOWN": "C13",
    "PENUP": "C14",
    "SETPENLIFTRANGE": "C45",
    "CHANGELENGTHDIRECT": "C17",
    "SETMACHINESIZE": "C24",
    "GETMACHINEDETAILS": "C26",
    "RESETEEPROM": "C27",
    "SETMACHINEMMPERREV": "C29",
    "SETMACHINESTEPSPERREV": "C30",
    "SETMOTORSPEED": "C31",
    "SETMOTORACCEL": "C32",
    "SETMACHINESTEPMULTIPLIER": "C37"
}
Object.freeze(CMDS)



// ***********************
//
// Polargraph Drawing Functions
//
// ***********************


var meltEvents = document.createTextNode(null);

var plotterReadyEvent = new Event("plotterReady");

const Melt = class {
    // Drawing Functions
    //
    // They try to mimic the p5.js reference
    //
    constructor() {
        this.isDrawingPath = false;
        this.isPenUp = true;
        // if set to true it wont move the pen up and down after each shape
    }

    // ready event
    Log(str) {
        // Will add a log to queue, which will console log when it reaches its time
        AddToQueue({
            cmd: "log",
            msg: str
        });
    }
    BeginShape() {
        this.isDrawingPath = true;
    }
    EndShape() {
        this.isDrawingPath = false;
    }
    PenUp(now = false) { // the now param sends command right away. Otherwise, it is queued
        if (now) {
            SerialSend("C14,UP,END");
        } else {
            AddToQueue("C14,UP,END"); // pen down
        }
        this.isPenUp = true;
    }
    PenDown(now = false) { // the now param sends command right away. Otherwise, it is queued
        if (now) {
            SerialSend("C13,DOWN,END");
        } else {
            AddToQueue("C13,DOWN,END"); // pen down
        }
        this.isPenUp = false;
    }

    TogglePen() {
        if (this.isPenUp) {
            this.PenDown(true);
        } else {
            this.PenUp(true);
        }
        this.isPenUp != this.isPenUp;
    }

    PenPosition() {
        // returns pen position in mm (converted from ui.penPositionPixels)
        p = new Victor(ui.penPositionPixels.x * factors.pxToMM, ui.penPositionPixels.y * factors.pxToMM);
        return p;
    }

    line(x1, y1, x2, y2, thickness = 1) {
        /// <summary>Draws a line from (x1, y1) to (x2, y2). Positions should be set in millimetres. Warning! If called between StartPath() and EndPath(), pen will not be raised when moving to starting coordinate</summary>
        if (thickness < 1) thickness = 1;
        thickness = parseInt(thickness);

        if (!this.isDrawingPath) {
            this.PenUp();
        }

        // Width means going over the same line several times
        for (let i = 0; i < thickness; i++) {
            if (isEven(i) && thickness > 1) {
                AddMMCoordToQueue(x2, y2);
                if (i == 0) this.PenDown();
                AddMMCoordToQueue(x1, y1);
            } else {
                AddMMCoordToQueue(x1, y1);
                if (i == 0) this.PenDown();
                AddMMCoordToQueue(x2, y2);
            }
        }

        if (!this.isDrawingPath) {
            this.PenUp();
        }
    }

    ellipse(x, y, r, res = 100) {
        // console.time("ellipse");
        res = Math.round(res);
        if (res < 3) res = 3; // A "circle" cant have less than 3 sides.. though that´s a triangle yo
        this.cachedFirstVx;
        this.PenUp();
        // I generete an array of points that create the circle
        for (let i = 0; i < res; i++) {
            let angle = map(i, 0, res, 0, 2 * Math.PI);
            let posX = (r * Math.cos(angle)) + x;
            let posY = (r * Math.sin(angle)) + y;
            if (i == 0) {
                this.cachedFirstVx = new Victor(posX, posY);
            } else if (i == 1) {
                // After the moving to the first vertex I start drawing
                this.PenDown();
            }
            AddMMCoordToQueue(posX, posY);
        }
        // After the circle is complete i have to go back to the first vertex position
        // console.timeEnd("ellipse");
        AddMMCoordToQueue(this.cachedFirstVx.x, this.cachedFirstVx.y);
        this.PenUp();
    }
}

var codeError = "";
var codeStr;
// var isRunningCode = false;
var codeRepetitions = 1,
    remainingCodeRepetitions; //isRunningCodeForever = false;

function CheckCode() {

    if (session.getAnnotations().length == 0) {
        codeStr = editor.getValue();
        try { // This is a second test
            StartedDrawingCode()
            EvalCode()
        } catch (e) {
            if (e instanceof SyntaxError) {
                // didnt pass try catch
                codeError = e;
                delay = 4000;
                dom.get("#run-code-check-error span").html(codeError).delay(delay).html("");
                dom.get("#run-code-check-error").show(0).delay(delay).hide(0);
            }
        }

    } else {
        dom.get("#run-code-check-error").show(0).delay(2000).hide(0);
    }
}

var attachedScript;

function EvalCode() {
    showNotificationOnFinish = true;
    console.log('Code Run @ ' + new Date());
    // eval(codeStr); // Actually interprets string as javascript
    if (attachedScript !== undefined) attachedScript.remove();
    attachedScript = document.createElement("script");
    attachedScript.text = codeStr;
    var firstScriptTag = document.getElementsByTagName("script")[1];
    firstScriptTag.parentNode.insertBefore(attachedScript, firstScriptTag);

    dom.get("#remaining-repetitions span").html(remainingCodeRepetitions);
    console
    if (machine.queue.length == 0) {
        // the code executed succesfully but theres nothing on the queue
        EndedDrawingCode();
    }
}

function StartedDrawingCode() {
    if (codeRepetitions == 0) {
        isRunningCodeForever = true;
        // dom.get("#stop-code-loop").show();
    } else if (codeRepetitions > 1) {
        remainingCodeRepetitions = codeRepetitions;
        dom.get("#remaining-repetitions").show();
        dom.get("#remaining-repetitions span").html(remainingCodeRepetitions);
    } else {
        // only once
        remainingCodeRepetitions = 0;
    }
    isRunningCode = true;
    dom.get("#codeStatusIcon").hide();
    // dom.get("#run-code-button").addClass("disabled");
    // dom.get(".run-code-updown").addClass("disabled");
}

function EndedDrawingCode() {
    isRunningCode = false;
    isRunningCodeForever = false;
    // dom.get("#run-code-button").removeClass("disabled");
    // dom.get(".run-code-updown").removeClass("disabled");
    dom.get("#stop-code-loop").hide();
    dom.get("#remaining-repetitions").hide();
}

function TenPrint() {
    var xoff = melt.PenPosition().x,
        yoff = melt.PenPosition().y;
    var grid = 2;
    var alto = 330,
        ancho = 490;

    for (let i = 0; i < ancho / grid; i++) {
        for (let j = 0; j < alto / grid; j++) {
            PickOne() ? LtR(i * grid, j * grid) : RtL(i * grid, j * grid);
        }
    }

    function PickOne() {
        return Math.floor(Math.random() * 2) ? true : false;
    }

    function RtL(x, y) {
        melt.line(x + xoff, y + yoff, x + xoff + grid, y + yoff + grid);
    }

    function LtR(x, y) {
        melt.line(x + xoff + grid, y + yoff, x + xoff, y + yoff + grid);
    }
}

function isEven(n) {
    return n % 2 == 0;
}

function isOdd(n) {
    return Math.abs(n % 2) == 1;
}
