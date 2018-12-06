const remote = require('electron').remote;
const win = remote.getCurrentWindow();

const SerialPort = require("serialport");
const Readline = require('@serialport/parser-readline')
const Delimiter = require('@serialport/parser-delimiter')





console.log("Made with 💚 by Gonzalo Moiguer 🇦🇷 https://www.gonzamoiguer.com.ar");

/*
https://github.com/euphy/polargraph/wiki/Polargraph-machine-commands-and-responses
*/

var port, parser;

var machineWidthSteps, machineHeightSteps;
var mmPerRev, stepsPerRev;
var stepMultiplier;
var downPos, upPos;
var mmPerStep, stepsPerMM;
var pageWidth, pageHeight;
var machineWidthMM, machineHeightMM;
var leftMotorPositionSteps, rightMotorPositionSteps;
var isMachineReady = false;
var isQueueActive = true;
var motorMaxSpeed, motorAcceleration;

var machineQueue = [];

var mmToPxFactor = 0.25;
var pxToMMFactor = 4;
var pxPerStep, stepPerPx;
var syncedLeft, syncedRight;

var statusErrorIcon = '<i class="statuserror small exclamation circle icon"></i>';
var statusSuccessIcon = '<i class="statusok small check circle icon"></i>';
var statusWorkingIcon = '<i class="statusworking notched circle loading icon"></i>';
var statusElement = $("#statusAlert");
var currToggleEl;

var canvas, canvasNeedsRender = false;
var appRefreshRate = 500; // in millis
var motorLineRight, motorLineLeft, motorRightCircle, motorLeftCircle, machineSquare;
var mouseVector = new Victor(0,0);
var isSettingPenPos = false;
var isSettingNewPenPosition = false;
var isKeyboardControlling = false;
var keyboardControlDeltaPx  = 2.5;
var penPositionPixels = new Victor(0,0);
var nextPenPosition = new Victor(0,0);
var gondolaCircle;

var leftMotorPositionPixels = new Victor(0,0);
var rightMotorPositionPixels = new Victor(0,0);
var newPenPositionArrow, newPenPositionCircle;
var waitingReadyAfterPause = false;
var currContent;

var melt;
var queueEmptyContent;

// Caching jquery selectors
// source: https://ttmm.io/tech/selector-caching-jquery/
function Selector_Cache() {
    var collection = {};
    function get_from_cache( selector ) {
        if ( undefined === collection[ selector ] ) {
            collection[ selector ] = $( selector );
        }
        return collection[ selector ];
    }
    return { get: get_from_cache };
}
var dom = new Selector_Cache();
// Usage $( '#element' ) becomes
// dom.get( '#element' );


$("document").ready(function(){
// *************************
// *  Call Main Functions  *
// *************************
    MeltInit();
    FabricInit();
    UiInit();
    codePluginInit();
    UpdateBatchPercent();
}); // doc ready

// Preventing some accidents
// window.onbeforeunload = function() {
//   return "Are you sure you want to stop plotting awesome drawings?";
// }

function map(x, in_min, in_max, out_min, out_max)
{
  return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

function debug(){
    mmPerRev = 32;
    stepsPerRev = 200;
    stepMultiplier = 1;
    mmPerStep = .16;
    stepsPerMM = 6.25;
    SetMachineDimensionsMM(1200, 800);
}
function p(txt){
    // just a lazy shortcut
    console.log(txt);
}


function MeltInit(){
    ListSerialPorts();

    // Worker setup to allow
    var doWork
    try {
        doWork = new Worker('interval.js')
        // Worker allowed. initializing
        workerAllowed = true;
        doWork.onmessage = function(event) {
            if ( event.data === 'interval.start' ) {
                CheckQueue(); // queue your custom methods in here or whatever
            }
        };
        doWork.postMessage({start:true,ms:appRefreshRate}); // tell the worker to start up with 250ms intervals
        // doWork.postMessage({stop:true}); // or tell it just to stop.
    } catch{
        // Worker denied
        workerAllowed = false;
        CheckQueue();
        console.warn( "Web worker not allowed 👨‍🏭 Plotter will run slow if tab is in background or computer fell asleep 😴 Try to run this in a local server enviroment like Mamp 🐘" );
    }

    // Define the Melt Object
    melt = new Melt();
} // Melt Init

function FabricInit(){
  canvas = new fabric.Canvas('myCanvas');
  canvas.freeDrawingBrush.color = "purple";
  canvas.freeDrawingBrush.width = .5;
  canvas.isDrawingMode = false;

  window.addEventListener('resize', resizeCanvas, false);
  // resize on init
  // resizeCanvas();
  // DrawGrid();

  // Define some fabric.js elements
  motorLineRight = new fabric.Line([rightMotorPositionPixels.x, rightMotorPositionPixels.y, 0, 0], {
      left: 0, top: 0, stroke: 'grey', selectable:false
  });
  motorLineLeft = new fabric.Line([leftMotorPositionPixels.x, leftMotorPositionPixels.y, 0, 0], {
      left: 0, top: 0, stroke: 'grey', selectable:false
  });
  canvas.add(motorLineRight);
  canvas.add(motorLineLeft);

  motorRightCircle = new fabric.Circle({
    radius: 6, fill: 'white', left: rightMotorPositionPixels.x, top: rightMotorPositionPixels.y, hasControls: false, originX: 'center', originY: 'center',
    lockRotation: true,
    lockMovementX: true,
    lockMovementY: true,
    lockScalingX: true,
    lockScalingY: true,
    lockUniScaling: true,
    hasControls: false
  });
  motorLeftCircle = new fabric.Circle({
    radius: 6, fill: 'white', left: leftMotorPositionPixels.x, top: rightMotorPositionPixels.y, hasControls: false, originX: 'center', originY: 'center',
    lockRotation: true,
    lockMovementX: true,
    lockMovementY: true,
    lockScalingX: true,
    lockScalingY: true,
    lockUniScaling: true,
    hasControls: false
  });
  canvas.add(motorRightCircle);
  canvas.add(motorLeftCircle);

  gondolaCircle = new fabric.Circle({
    radius: 3, fill: '#a4bd8e', left: 0, top: 0, hasControls: false, originX: 'center', originY: 'center',
    lockRotation: true,
    lockMovementX: true,
    lockMovementY: true,
    lockScalingX: true,
    lockScalingY: true,
    lockUniScaling: true,
    hasControls: false
  });
  canvas.add(gondolaCircle);

  machineSquare = new fabric.Rect({
    width: 0, height: 0,
    left: 0, top: 0,
    fill: 'rgba(0,0,0,0)',
    stroke: "white",
    lockRotation: true,
    lockMovementX: true,
    lockMovementY: true,
    lockScalingX: true,
    lockScalingY: true,
    lockUniScaling: true,
    hasControls: false
  })
  canvas.add(machineSquare);

  newPenPositionArrow = new fabric.Line([leftMotorPositionPixels.x, leftMotorPositionPixels.y, 0, 0], {
      left: 0, top: 0, stroke: 'grey', selectable:false});
  canvas.add(newPenPositionArrow);

  newPenPositionCircle = new fabric.Circle({
   radius: 3, fill: '#B38FAC', left: 0, top: 0, hasControls: false, originX: 'center', originY: 'center',
   lockRotation: true,
   lockMovementX: true,
   lockMovementY: true,
   lockScalingX: true,
   lockScalingY: true,
   lockUniScaling: true,
   hasControls: false
  });
  canvas.add(newPenPositionCircle);

  // Mousewheel Zoom
  canvas.on('mouse:wheel', function(opt) {
    var delta = opt.e.deltaY;
    // let pointer = canvas.getPointer(opt.e);
    var zoom = canvas.getZoom();
    zoom = zoom + delta/200;
    if (zoom > 10) zoom = 10;
    if (zoom < 0.6) zoom = 0.6;
    canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
    opt.e.preventDefault();
    opt.e.stopPropagation();

    let objs = canvas.getObjects();
    for(let i=0; i < objs.length; i++ ){
      if( !objs[i].isGrid){
        objs[i].setCoords();
      }
    }
  });

  canvas.on('mouse:down', function(opt) {
    var evt = opt.e;
    if (evt.altKey === true || opt.which == 2) {
        this.isDragging = true;
        this.selection = false;
        this.lastPosX = evt.clientX;
        this.lastPosY = evt.clientY;
    }else{
        if( isSettingPenPos){
        SetpenPositionPixels(mouseVector.x, mouseVector.y);
  		  isSettingPenPos = false; // SHould this go here or inside the function SetpenPositionPixels ?
        DeactivateToggles();
  	  }else if( isSettingNewPenPosition ){
  		  SetNextPenPositionPixels(mouseVector.x, mouseVector.y);
          // console.log("Setting at ", mouseVector.x, mouseVector.y);
  		  // isSettingNewPenPosition = false;
  	  }
    }
  });

  // canvas mouse move
  canvas.on('mouse:move', function(opt) {
  	if (this.isDragging) {
  		var e = opt.e;
      // Pan
  		this.viewportTransform[4] += e.clientX - this.lastPosX;
  		this.viewportTransform[5] += e.clientY - this.lastPosY;
  		this.requestRenderAll();
  		this.lastPosX = e.clientX;
  		this.lastPosY = e.clientY;
  	}

  	let pointer = canvas.getPointer(options.e);
  	mouseVector.x = pointer.x;
  	mouseVector.y = pointer.y;

  	UpdatePositionMetadata(mouseVector);
    canvas.renderAll();
  }); // mouse move

  canvas.on('mouse:up', function(opt) {
    this.isDragging = false;
    this.selection = true;
  });

  $( "canvas" ).hover(
    function() {
      isMouseOverCanvas = true;
    }, function() {
      isMouseOverCanvas = false;
      UpdatePositionMetadata(penPositionPixels);
    }
  );

  canvas.on('path:created', function(e){
    // canvas.isDrawingMode = false;
    showNotificationOnFinish = true;
    var myPath = e.path;
      // console.log(myPath);
  	let points = myPath.path;

  	for(let i = 0; i <  points.length; i++){
  		if(i == 0){
  			// Es el primer punto
  			melt.PenUp();
  			AddPixelCoordToQueue(points[i][2], points[i][1]);
            melt.PenDown();

  		}else if(i == points.length-1){
  			// es el ultimo punto
  			AddPixelCoordToQueue(points[i][2], points[i][1]);
        		melt.PenUp();
  		}else{
  			// Es un punto normal
  			AddPixelCoordToQueue(points[i][2], points[i][1]);
  		}
  	}
  });

} // fabric init

function UiInit(){
  queueEmptyContent = $("#queue").html();
  // Input console
  dom.get("#consoleInput").keyup(function(e){
    let code = e.which; // recommended to use e.which, it's normalized across browsers
    if(code==13||code==176){
      // 13 es el Enter comun. 176 es el enter del keypad
      e.preventDefault();
      let msg = dom.get("#consoleInput").val();
      if( msg == "") return;
      msg = msg.toUpperCase();
      SerialSend(msg);
      // WriteConsole(msg, false);
      dom.get("#consoleInput").val(""); // Vacío el input
      lastSentConsoleCmd = msg;

    }else if (code==38||code==104) {
      // Up arrow
      e.preventDefault();
      if(lastSentConsoleCmd != ""){
        dom.get("#consoleInput").val( lastSentConsoleCmd );
      }

    }
  });

  currContent = dom.get("#content-control");

  dom.get(".main-menu-link").click(function(){

    let href = $(this).data("panel");
    let newContent = dom.get("#content-"+href);
    // if( currContent != newContent ){
    currContent.hide();
    newContent.show();
    if(href == "console"){
      dom.get("#console").scrollTop(dom.get("#console")[0].scrollHeight); // Scroleo para abajo de todo

      }else if(href == "tools"){
        ExitEditorMode();
      }

    currContent = newContent;
  })
      $('.ui.menu')
      .on('click', '.item', function() {
        if(!$(this).hasClass('dropdown')) {
          $(this)
            .addClass('active')
            .siblings('.item')
              .removeClass('active');
        }
      });

  dom.get("#serial_connections").on("click", ".button", function(){
    if(port !== undefined && port.isOpen){
      port.close();
    }

    statusElement.html(statusErrorIcon);

    portPath = $(this).data("connectto");
    console.log("Connectando a ", portPath);
    SerialConnectTo(portPath);
  })

  dom.get(".serial_reconnect").click(function(){
    ListSerialPorts();
  })

  $('.mypopup').popup();

  dom.get("#set-custom-postion").click(function(){
  	isSettingPenPos = true;
  })

  // dom.get("#control-pen-position").click(function(){
  // 	isSettingNewPenPosition = true;
  // })

  dom.get("#pen-lift").click(function(){
    melt.PenUp(true); // True sets to now instead of queue
  })

  dom.get("#pen-drop").click(function(){
  	melt.PenDown(true); // True sets to now instead of queue
  })

  $('#pause-queue').click(function(){
  	if(isQueueActive){
  		isQueueActive = false;
      waitingReadyAfterPause = true;
  		$('#pause-queue').html( '<i class="play icon"></i>Resume' );
  	}else{
  		isQueueActive = true;
      waitingReadyAfterPause = false;
  		$('#pause-queue').html( '<i class="pause icon"></i>Pause' );
  	}
  });

  $('#clear-queue').click(function(){
  	machineQueue = [];
    lastQueueCmd = "";
    QueueBatchComplete();
  	dom.get('#queue').html( queueEmptyContent );
  });

  dom.get("#queue-progress").progress({
    percent: 100
  });

  dom.get("#run-code-button").click(function(){
      // if(!isRunningCode)
      CheckCode();
  })

	dom.get(".run-code-updown").click(function(){
	  if( $(this).children().hasClass("up") ){
	    codeRepetitions ++;
	     }else{
	       if(codeRepetitions>0)codeRepetitions --;
	  }
	  refButton();
	})

	function refButton(){
	  let txt = "";
	  if(codeRepetitions== 0){
	    txt="Draw forever";
	  }else if(codeRepetitions== 1){
	  txt="Draw once";
	}  else{
	    txt = "Draw "+ codeRepetitions +" times";
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
    dom.get(".codeTools").click(function(){
        let tool = $(this).data("toolname");
        let action = $(this).data("toolaction");
        switch(action){
            case "insert":
                editor.session.insert(editor.getCursorPosition(), snippets[tool]);
            break;
        }
        editor.focus()
    })

    dom.get("#reveal-code").click(function(){
        EnterEditorMode();
    })

    function EnterEditorMode(){
        dom.get("#editor-container").slideDown();
        dom.get("#tools-buttons").hide();
        editor.focus()
    }
    function ExitEditorMode(){
        dom.get("#tools-buttons").slideDown();
        dom.get("#editor-container").hide();
    }


    // Custom toggle callback implementation
    dom.get(".myToggle").click(function(){
        if(currToggleEl){
            if( $(this).attr("id") == $(currToggleEl).attr("id") ){
                // Deselect current toggle
                currToggleEl.trigger("toggleDeselect");
                currToggleEl.removeClass("activeToggle");
                currToggleEl = "";
            }else{
                // Deselect prev toggle
                currToggleEl.trigger("toggleDeselect");
                currToggleEl.removeClass("activeToggle");

                // Select the new toggle
                currToggleEl = $(this);
                currToggleEl.trigger("toggleSelect");
                currToggleEl.addClass("activeToggle");
            }
        }else{
            // First toggle to be selected
            currToggleEl = $(this);
            currToggleEl.trigger("toggleSelect");
            currToggleEl.addClass("activeToggle");
        }
    });

    dom.get(".deactivateToggle").click(function(){
        DeactivateToggles();
    });

    // Setting the callbacks to their specific actions
    dom.get("#tools-free-draw").on("toggleSelect", function(){
        canvas.isDrawingMode = true;
    })
    dom.get("#tools-free-draw").on("toggleDeselect", function(){
        canvas.isDrawingMode = true;
    })



    dom.get("#control-pen-position").on("toggleSelect", function(){
        isSettingNewPenPosition = true;
    })
    dom.get("#control-pen-position").on("toggleDeselect", function(){
        isSettingNewPenPosition = false;
    })


    dom.get("#keyboard-control").on("toggleSelect", function(){
        isKeyboardControlling = true;
        dom.get("#keyboard-control-container").slideDown();
    })
    dom.get("#keyboard-control").on("toggleDeselect", function(){
        isKeyboardControlling = false;
        dom.get("#keyboard-control-container").slideUp();
    })

    dom.get("#keyboard-input-mm").val( keyboardControlDeltaPx * pxToMMFactor );
    dom.get("#keyboard-input-px").val( keyboardControlDeltaPx);
    dom.get("#keyboard-input-steps").val( keyboardControlDeltaPx * stepsPerMM);


    // Keyboard movement
    document.onkeydown = checkKeycode;
    function checkKeycode(event) {
        if(!isKeyboardControlling || !isMachineReady) return
        // handling Internet Explorer stupidity with window.event
        // @see http://stackoverflow.com/a/3985882/517705
        var keyDownEvent = event || window.event,
            keycode = (keyDownEvent.which) ? keyDownEvent.which : keyDownEvent.keyCode;
        var LEFT = 37, UP = 38, RIGHT = 39, DOWN = 40, SPACEBAR = 32;

        let interaction = false;

        switch (keycode) {

            case LEFT:
                SetNextPenPositionPixels(penPositionPixels.x - keyboardControlDeltaPx, penPositionPixels.y, true); // setting last param to true skips the queue
                interaction = true;
                break;
            case UP:
                SetNextPenPositionPixels(penPositionPixels.x, penPositionPixels.y - keyboardControlDeltaPx, true);
                interaction = true;
                break;
            case RIGHT:
                SetNextPenPositionPixels(penPositionPixels.x + keyboardControlDeltaPx, penPositionPixels.y, true);
                interaction = true;
                break;
            case DOWN:
                SetNextPenPositionPixels(penPositionPixels.x, penPositionPixels.y + keyboardControlDeltaPx, true);
                interaction = true;
                break;
            case SPACEBAR:
                melt.TogglePen();
                interaction = true;
            break;
        }
        if(interaction){
            keyDownEvent.stopPropagation();
            keyDownEvent.preventDefault();
        }
    }

	dom.get("#uploadMachineConfig").click(function(){
		UploadMachineConfig();
	})

} // ui elements init

function DeactivateToggles(){
    if(currToggleEl){
        // Deselect current toggle
        currToggleEl.trigger("toggleDeselect");
        currToggleEl.removeClass("activeToggle");
        currToggleEl = "";
    }
}
function EnableWorkspace(){
  dom.get("#dimmerEl").removeClass("active");
}
function DisableWorkspace(){
  dom.get("#dimmerEl").addClass("active");
}

function DrawGrid(){
  let offset = -200;
  options = {
    isGrid: true,
    distance: 20,
    width: canvas.width,
    height: canvas.height,
    param: {
       stroke: '#4c5669',
       strokeWidth: 1,
       selectable: false
    }
  },
  gridLen = (options.width / options.distance) + 1;

  for (var i = 0; i < gridLen; i++) {
      var distance   = (i * options.distance) + offset,
        horizontal = new fabric.Line([ distance, + offset, distance, options.width + offset], options.param),
        vertical   = new fabric.Line([ + offset, distance, options.width  + offset, distance], options.param);
        canvas.add(horizontal);
        canvas.add(vertical);
        horizontal.sendToBack();
        vertical.sendToBack();
        if(i%5 === 0){
            horizontal.set({stroke: '#7a7d82'});
            vertical.set({stroke: '#7a7d82'});
        };
    };
    // End grid
    canvasNeedsRender = true;
}

function resizeCanvas() {
  canvas.setHeight( $('#canvasSizer').height() );
  canvas.setWidth(  $('#canvasSizer').width() );

  let offX = (canvas.width - machineSquare.width) / 2;
  let offY = (canvas.height - machineSquare.height) / 2;

  canvas.viewportTransform[4] = offX;
  canvas.viewportTransform[5] = offY;
  canvas.requestRenderAll();
}

// ui stuff ends here (mostly)



var editor, session, scriptCode;
function codePluginInit(){
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
        enableLiveAutocompletion: false
    });
    session = editor.getSession();
    if(scriptCode != undefined){
        session.setValue(scriptCode);
    }
	session.setMode('ace/mode/javascript');
	session.setUseSoftTabs(true);
	session.setTabSize(4);


  session.on('change', function() {
    let scriptCode = editor.getValue();
    localStorage["scriptCode"] = scriptCode;
	});

} // codePluginInit


// Machine functions
function debug(){

    mmPerRev = 32;
    stepsPerRev = 200;
    stepMultiplier = 1;
    mmPerStep = .16;
    stepsPerMM = 6.25;
    SetMachineDimensionsMM(1200, 800);

}

function SetMachineDimensionsMM(_w, _h){
	machineWidthMM = _w;
	machineHeightMM = _h;

	machineWidthSteps = machineWidthMM * stepsPerMM;
	machineHeightMMSteps = machineHeightMM * stepsPerMM;

	leftMotorPositionSteps = new Victor(0,0);
	rightMotorPositionSteps = new Victor(0, machineWidthSteps);

	rightMotorPositionPixels.x = machineWidthMM * mmToPxFactor;

	motorRightCircle.left = rightMotorPositionPixels.x;
	motorLineRight.set({'x1': motorRightCircle.left, 'y1': 0})

	machineSquare.set({'width': motorRightCircle.left, 'height': machineHeightMM * mmToPxFactor});


	pxPerStep = machineWidthSteps / rightMotorPositionPixels.x;
	stepPerPx = rightMotorPositionPixels.x / machineWidthSteps;

    canvasNeedsRender = true;
    resizeCanvas();
    DrawGrid();
}

function SetpenPositionPixels(_x, _y){
	penPositionPixels.x = _x;
	penPositionPixels.y = _y;
	gondolaCircle.left = _x;
	gondolaCircle.top = _y;
	UpdatePositionMetadata(penPositionPixels);

	let leftMotorDist = penPositionPixels.distance(leftMotorPositionPixels) *  pxPerStep;
	let rightMotorDist = penPositionPixels.distance(rightMotorPositionPixels) *  pxPerStep;

	let cmd = "C09,"+ Math.round(leftMotorDist) +","+ Math.round(rightMotorDist) +",END";
	SerialSend(cmd);
	console.log("New Pos: " + cmd);
}

function SyncGondolaPosition(_x, _y){
	penPositionPixels.x = _x;
	penPositionPixels.y = _y;
	gondolaCircle.left = _x;
	gondolaCircle.top = _y;
	UpdatePositionMetadata(penPositionPixels);
}

function NativeToCartesian(_left, _right){
	// Math borrowed from original polarcontroller :)  https://github.com/euphy/polargraphcontroller/blob/master/Machine.pde#L339
 	let calcX = (Math.pow(machineWidthSteps, 2) - Math.pow(_right, 2) + Math.pow(_left, 2)) / (machineWidthSteps * 2);
	let calcY = Math.sqrt( Math.pow(_left, 2) - Math.pow(calcX, 2) );

	let pos = new Victor(calcX, calcY);
	return pos;
}

function SetNextPenPositionPixels(_x, _y, skipQueue = false){
    // console.time("SetNextPenPositionPixels");
	nextPenPosition.x = _x;
	nextPenPosition.y = _y;
	newPenPositionCircle.left = _x;
	newPenPositionCircle.top = _y;
    canvasNeedsRender = true;

	let rightMotorDist = nextPenPosition.distance(rightMotorPositionPixels) *  pxPerStep;
	let leftMotorDist = nextPenPosition.distance(leftMotorPositionPixels) *  pxPerStep;
	let cmd = "C17,"+ Math.round(leftMotorDist) +","+ Math.round(rightMotorDist) +",2,END";
    // console.timeEnd("SetNextPenPositionPixels");

    if(skipQueue){
        SerialSend(cmd); // cheating the queue.. im in a hurry!!
    }else{
        AddToQueue(cmd);
    }
}

function AddMMCoordToQueue(x,y){
	let pos = new Victor(x *  mmToPxFactor, y *  mmToPxFactor);

	let leftMotorDist = pos.distance(leftMotorPositionPixels) * pxPerStep;
	let rightMotorDist = pos.distance(rightMotorPositionPixels) * pxPerStep;
	let cmd = "C17,"+ Math.round(leftMotorDist) +","+ Math.round(rightMotorDist) +",2,END";
	AddToQueue(cmd);
}

function GetMMCoordCommand(x,y){
	let pos = new Victor(x *  mmToPxFactor, y *  mmToPxFactor);

	let leftMotorDist = pos.distance(leftMotorPositionPixels) * pxPerStep;
	let rightMotorDist = pos.distance(rightMotorPositionPixels) * pxPerStep;
	let cmd = "C17,"+ Math.round(leftMotorDist) +","+ Math.round(rightMotorDist) +",2,END";
	return cmd;
}


function UpdatePositionMetadata(vec){
    // Linea Motor
    motorLineRight.set({'x2': vec.x, 'y2': vec.y });
    motorLineLeft.set({'x2': vec.x, 'y2': vec.y});

    dom.get("#canvasMetaData .x").html( Math.round(vec.x) );
    dom.get("#canvasMetaData .y").html( Math.round(vec.y) );

    dom.get("#canvasMetaData .xmm").html( (vec.x * pxToMMFactor).toFixed(1) );
    dom.get("#canvasMetaData .ymm").html( (vec.y * pxToMMFactor).toFixed(1) );

    let disToLMotor = vec.distance(leftMotorPositionPixels);
    dom.get("#canvasMetaData .lmotomm").html( (disToLMotor * pxToMMFactor).toFixed(1) );
    dom.get("#canvasMetaData .lmotosteps").html( (disToLMotor *  pxPerStep).toFixed(1));

    let disToRMotor = vec.distance(rightMotorPositionPixels);
    dom.get("#canvasMetaData .rmotomm").html( (disToRMotor * pxToMMFactor).toFixed(1) );
    dom.get("#canvasMetaData .rmotosteps").html( (disToRMotor *  pxPerStep).toFixed(1));

    canvasNeedsRender = true;
}


// *********************
//
// Serial & Socket Communication
//
// *********************

function SerialSend(cmd){
  port.write(cmd + '\n');
  statusElement.html(statusWorkingIcon);
  isMachineReady = false;
  WriteConsole(cmd)
}

var lastReceivedString = "";

function SerialReceive(currentString) {

  // Parse response in cases where data is space separated
  var responseWords = currentString.split(" ");
  switch(responseWords[0]){
    case 'POLARGRAPH':
      // Serial connection worked
      statusElement.html(statusSuccessIcon);
      EnableWorkspace();
      $('.ui.basic.modal').modal('hide');
      console.log(`Succesfully connected ✏️ to serial`);
      SerialSend("C26,END");
    break;

    case 'READY':
        OnMachineReady();
  		break;

	case 'Loaded':
		if(responseWords[1].startsWith("width")){
			machineWidthMM = parseInt( responseWords[1].split(":")[1] );
			dom.get("#inputMachineWidth").val(machineWidthMM);

		}else if(responseWords[1].startsWith("height")){
			machineHeightMM = parseInt( responseWords[1].split(":")[1] );
			dom.get("#inputMachineHeight").val(machineHeightMM);

      }else if(responseWords[1].startsWith("mmPerRev")){
        mmPerRev = parseInt( responseWords[1].split(":")[1] );
        dom.get("#inputMmPerRev").val(mmPerRev);

			}else if(responseWords[1] == "steps" && responseWords[2] == "per" ){
				stepsPerRev = parseInt( responseWords[3].split(":")[1] );
				dom.get("#inputStepsPerRev").val(stepsPerRev);

			}else if(responseWords[1] =="step"  && responseWords[2].startsWith("multiplier")){
				stepMultiplier = parseInt( responseWords[2].split(":")[1] );
				dom.get("#inputStepMultiplier").val(stepMultiplier);

			}else if(responseWords[1] == "down"){
				downPos = parseInt( responseWords[2].split(":")[1] );
				dom.get("#inputDownPos").val(downPos);

			}else if(responseWords[1] == "up"){
				upPos = parseInt( responseWords[2].split(":")[1] );
				dom.get("#inputUpPos").val(upPos);
			}
			break;

		case 'Recalc':
			if(responseWords[1] == "mmPerStep"){
				mmPerStep = parseFloat(responseWords[2].slice(0,-2).substring(1))
				stepsPerMM = parseFloat(responseWords[4].slice(0,-1).substring(1))

				dom.get("#inputMmPerStep").val(mmPerStep);
				dom.get("#inputStepsPerMM").val(stepsPerMM);

			}else if(responseWords[1] == "pageWidth"){
				pageWidth = parseInt( responseWords[4].slice(0,-1).substring(1) );
				dom.get("#inputPageWidthSteps").val(pageWidth);

			}else if(responseWords[1] == "pageHeight"){
				pageHeight = parseInt( responseWords[4].slice(0,-1).substring(1) );
				dom.get("#inputPageHeightSteps").val(pageHeight);

				// This is the last received data, so now I recalculate
				SetMachineDimensionsMM(machineWidthMM, machineHeightMM);
			}
		break;
  }

	// Now check for cases where data is comma separated
	responseWords = currentString.split(",");
	switch(responseWords[0]){
		case "SYNC":
			syncedLeft = responseWords[1];
			syncedRight = responseWords[2];

			let gondolaPos = NativeToCartesian(syncedLeft, syncedRight);
			SyncGondolaPosition(gondolaPos.x *  stepPerPx, gondolaPos.y * stepPerPx);
			// TODO Revisar que pxPerStep este bien!
		break;

    case 'PGSPEED':
      motorMaxSpeed = parseInt( responseWords[1] );
      motorAcceleration = parseInt( responseWords[2] );

      dom.get("#inputMaxSpeed").val(motorMaxSpeed);
      dom.get("#inputAcceleration").val(motorAcceleration);

    break;
	}
  // end parse response

  if(currentString == lastReceivedString){
    let lastLog = dom.get(".log:last-child");
    let repetitions = lastLog.data("repeated");
    repetitions++;
    lastLog.data("repeated", repetitions);
    dom.get(".log:last-child .content").html( "(" + repetitions + ") " + currentString);
    return;
  }
  WriteConsole(currentString, true);
  lastReceivedString = currentString;
} // SerialReceive

var lastSentConsoleCmd = ""; // TODO hacer de esto un array
var consoleDomElement = dom.get("#console");

function WriteConsole(txt, received = false){
  let icon, clase = "log";
  if(received){
     icon = '<i class="caret down icon receivedCmd"></i>';
  }else{
    icon = '<i class="caret up icon sentCmd"></i>';
  }
  txt = '<span class="content">' + txt + '</span>';

  let msg = "<div data-repeated='0' class='" + clase + "'>" + icon + txt  + "</div>";
  dom.get("#console").append(msg);

  // dom.get("#console").scrollTop(dom.get("#console")[0].scrollHeight); // Scroleo para abajo de todo
  if(dom.get("#console").children().length > 100){
    // Limit the amount of console history
    dom.get("#console").children().first().remove();
  }
}

var arduinoAutoConnect = true;
function ListSerialPorts() {
    // List all serial ports
    SerialPort.list(function (err, ports) {
        $('.ui.basic.modal').modal('show');
        dom.get("#serial_connections").html("");
        let serialConnectionsContent = "";
        let portsToAnArduino = [];

        ports.forEach(function(port) {
            var icon = "microchip";
            if(port.comName.includes("Bluetooth")){
              icon = "bluetooth";
            }

            let manufacturer = "";
            if( port.manufacturer !== undefined && port.manufacturer.includes("Arduino")){
                    portsToAnArduino.push(port.comName);
                    icon = '';
            }

            let iconEle;
            if(icon == ''){
                iconEle = `<img class="arduinoIcon" src="images/arduino-icon.svg"/> `;
            }else{
                iconEle = `<i class="${icon} large icon"></i>`;
            }
            serialConnectionsContent += `<div class="ui green basic cancel inverted button" data-connectto="${port.comName}">${iconEle} ${port.comName}</div>`;
        });
        if(arduinoAutoConnect){
            if(portsToAnArduino.length == 1){
                // If theres only one arduino, automatically connect. Else show list
                SerialConnectTo(portsToAnArduino[0]);
                dom.get("#serial_connections").html(`Arduino detected. Connecting to ${portsToAnArduino[0]}`);
            }else{
                dom.get("#serial_connections").html(serialConnectionsContent);
            }
        }else{
            dom.get("#serial_connections").html(serialConnectionsContent);
        }



    });
}

function SerialConnectTo(path){
    port = new SerialPort("/dev/tty.usbmodem14C1", {
      baudRate: 57600
    });
    parser = port.pipe(new Readline({ delimiter: '\r\n' }))

    parser.on('data', SerialReceive)
    dom.get("#connected_to").html(path);
}


// *********************
//
// Machine control
//
// *********************

function SetMachineDimensionsMM(_w, _h){
	machineWidthMM = _w;
	machineHeightMM = _h;

	machineWidthSteps = machineWidthMM * stepsPerMM;
	machineHeightMMSteps = machineHeightMM * stepsPerMM;

	leftMotorPositionSteps = new Victor(0,0);
	rightMotorPositionSteps = new Victor(0, machineWidthSteps);

	rightMotorPositionPixels.x = machineWidthMM * mmToPxFactor;

	motorRightCircle.left = rightMotorPositionPixels.x;
	motorLineRight.set({'x1': motorRightCircle.left, 'y1': 0})

	machineSquare.set({'width': motorRightCircle.left, 'height': machineHeightMM * mmToPxFactor});


	pxPerStep = machineWidthSteps / rightMotorPositionPixels.x;
	stepPerPx = rightMotorPositionPixels.x / machineWidthSteps;

    canvasNeedsRender = true;
    resizeCanvas();
    DrawGrid();
}

function SetpenPositionPixels(_x, _y){
	penPositionPixels.x = _x;
	penPositionPixels.y = _y;
	gondolaCircle.left = _x;
	gondolaCircle.top = _y;
	UpdatePositionMetadata(penPositionPixels);

	let leftMotorDist = penPositionPixels.distance(leftMotorPositionPixels) *  pxPerStep;
	let rightMotorDist = penPositionPixels.distance(rightMotorPositionPixels) *  pxPerStep;

	let cmd = "C09,"+ Math.round(leftMotorDist) +","+ Math.round(rightMotorDist) +",END";
	SerialSend(cmd);
	console.log("New Pos: " + cmd);
}

function SyncGondolaPosition(_x, _y){
	penPositionPixels.x = _x;
	penPositionPixels.y = _y;
	gondolaCircle.left = _x;
	gondolaCircle.top = _y;
	UpdatePositionMetadata(penPositionPixels);
}

function NativeToCartesian(_left, _right){
	// Math borrowed from original polarcontroller :)  https://github.com/euphy/polargraphcontroller/blob/master/Machine.pde#L339
 	let calcX = (Math.pow(machineWidthSteps, 2) - Math.pow(_right, 2) + Math.pow(_left, 2)) / (machineWidthSteps * 2);
	let calcY = Math.sqrt( Math.pow(_left, 2) - Math.pow(calcX, 2) );

	let pos = new Victor(calcX, calcY);
	return pos;
}

function SetNextPenPositionPixels(_x, _y, skipQueue = false){
    // console.time("SetNextPenPositionPixels");
	nextPenPosition.x = _x;
	nextPenPosition.y = _y;
	newPenPositionCircle.left = _x;
	newPenPositionCircle.top = _y;
    canvasNeedsRender = true;

	let rightMotorDist = nextPenPosition.distance(rightMotorPositionPixels) *  pxPerStep;
	let leftMotorDist = nextPenPosition.distance(leftMotorPositionPixels) *  pxPerStep;
	let cmd = "C17,"+ Math.round(leftMotorDist) +","+ Math.round(rightMotorDist) +",2,END";
    // console.timeEnd("SetNextPenPositionPixels");

    if(skipQueue){
        SerialSend(cmd); // cheating the queue.. im in a hurry!!
    }else{
        AddToQueue(cmd);
    }
}

function AddMMCoordToQueue(x,y){
	let pos = new Victor(x *  mmToPxFactor, y *  mmToPxFactor);

	let leftMotorDist = pos.distance(leftMotorPositionPixels) * pxPerStep;
	let rightMotorDist = pos.distance(rightMotorPositionPixels) * pxPerStep;
    // console.log(pos, leftMotorDist, rightMotorDist, pxPerStep);
	let cmd = "C17,"+ Math.round(leftMotorDist) +","+ Math.round(rightMotorDist) +",2,END";
	AddToQueue(cmd);
}

function AddPixelCoordToQueue(x,y){
	let pos = new Victor(x *  pxPerStep, y *  pxPerStep);
	let leftMotorDist = pos.distance(leftMotorPositionSteps);
	let rightMotorDist = pos.distance(rightMotorPositionSteps);
	let cmd = "C17,"+ Math.round(leftMotorDist) +","+ Math.round(rightMotorDist) +",2,END";
	AddToQueue(cmd);
}

function UpdatePositionMetadata(vec){
    // Linea Motor
    motorLineRight.set({'x2': vec.x, 'y2': vec.y });
    motorLineLeft.set({'x2': vec.x, 'y2': vec.y});

    dom.get("#canvasMetaData .x").html( Math.round(vec.x) );
    dom.get("#canvasMetaData .y").html( Math.round(vec.y) );

    dom.get("#canvasMetaData .xmm").html( (vec.x * pxToMMFactor).toFixed(1) );
    dom.get("#canvasMetaData .ymm").html( (vec.y * pxToMMFactor).toFixed(1) );

    let disToLMotor = vec.distance(leftMotorPositionPixels);
    dom.get("#canvasMetaData .lmotomm").html( (disToLMotor * pxToMMFactor).toFixed(1) );
    dom.get("#canvasMetaData .lmotosteps").html( (disToLMotor *  pxPerStep).toFixed(1));

    let disToRMotor = vec.distance(rightMotorPositionPixels);
    dom.get("#canvasMetaData .rmotomm").html( (disToRMotor * pxToMMFactor).toFixed(1) );
    dom.get("#canvasMetaData .rmotosteps").html( (disToRMotor *  pxPerStep).toFixed(1));

    canvasNeedsRender = true;
}

function UploadMachineConfig(){
	// Set machine size
	machineWidthMM 	= dom.get("#inputMachineWidth").val();
	machineHeightMM	= dom.get("#inputMachineHeight").val();
	AddToQueue(`C24,${machineWidthMM},${machineHeightMM},END`);

	// Set machine millimetre extension per motor revolution (MM Per Rev)
	mmPerRev = dom.get("#inputMmPerRev").val();
	AddToQueue(`C29,${mmPerRev},END`);

	// Set motor steps per revolution:
	stepsPerRev = dom.get("#inputStepsPerRev").val();
	AddToQueue(`C30,${stepsPerRev},END`);

	// maximum motor speed
	motorMaxSpeed = dom.get("#inputMaxSpeed").val();
	AddToQueue(`C31,${motorMaxSpeed},END`);

	//  motor Acceleration
	motorAcceleration = dom.get("#inputAcceleration").val();
	AddToQueue(`C32,${motorAcceleration},END`);

	// step multiplier
	stepMultiplier = dom.get("#inputStepMultiplier").val();
	AddToQueue(`C37,${stepMultiplier},END`);
}

function OnMachineReady(){
    // Fired when receives a 'ready' message from machine
    statusElement.html(statusSuccessIcon);
    isMachineReady = true;
    if(!batchCompleted){
      if(isQueueActive || waitingReadyAfterPause){
        waitingReadyAfterPause = false;
        batchDone ++;
        if(batchDone >= batchTotal) QueueBatchComplete();
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

function CheckQueue(){
	// console.log("checking queue");
  if(isQueueActive && isMachineReady){
    if(machineQueue.length > 0){
        SerialSend( machineQueue.shift() );
        $('#queue .item').first().remove();
        if(machineQueue.length > queueUiLength){
            dom.get("#queue-last-item").before("<div class='queue item'><span class='cmd'>"+machineQueue[queueUiLength-1]+"</span><div class='ui divider'></div></div>");
        }else{
            dom.get("#queue-last-item").hide();
        }

        if(machineQueue.length == 0){
            // Queue & Batch have just finished
            UpdateBatchPercent();
            if(showNotificationOnFinish){
                let myNotification = new Notification('Drawing Finished', {
                    body: 'Queue is empty again'
                })
                myNotification.onclick = function () {
                    win.show();
                }
                showNotificationOnFinish = false;
            }

        }

    }
  }
  FormatBatchElapsed();
  if(canvasNeedsRender){
      canvas.renderAll();
      canvasNeedsRender = false;
  }
}

function AddToQueue(cmd){
    // console.time("AddToQueue");
  if(cmd == lastQueueCmd) return "Command ignored for being identical to previous"; // Avoid two equal commands to be sent
  machineQueue.push(cmd);
  lastQueueCmd = cmd;
  // console.timeEnd("AddToQueue");
  if(batchCompleted) NewQueueBatch();
  batchTotal++;
  if(machineQueue.length < queueUiLength){
      // If UI queue is not populated, lets add it
      $("#queue-last-item").before("<div class='queue item'><span class='cmd'>"+cmd+"</span><div class='ui divider'></div></div>");
      // dom.get("#queue").append();
  }else{
      dom.get("#queue-last-item").show();
  }
}

var lastQueueCmd = "";
var batchTotal = 0, batchDone = 0, batchPercent = 0;
var millisBatchStarted, millisBatchEnded, batchCompleted = false;

function UpdateBatchPercent(){
  // TODO: show elapsed time
  let newBatchPercent;

  if(machineQueue.length == 0){
      newBatchPercent = 0;
      win.setProgressBar(-1)
  }else if (batchTotal > 0) {
    newBatchPercent = batchDone / batchTotal * 100;
  }


  if( newBatchPercent != batchPercent){
      // By only doing this on different values I assure a proper animation on the progress bar
      dom.get("#queue-progress").progress({percent: batchPercent});
      win.setProgressBar(batchPercent/100); // mac dock progressbar
      batchPercent = newBatchPercent;
  }

  if( $(dom.get("#queue-last-item")).is(":visible") ){
      dom.get("#queueRemaining").html( machineQueue.length - queueUiLength );
  }
}

function NewQueueBatch(){
  batchTotal = 0;
  batchDone = 0;
  batchCompleted = false;
  millisBatchStarted = new Date().getTime();
}
function QueueBatchComplete(){
  batchCompleted = true;
  millisBatchEnded = new Date().getTime();
}

function FormatBatchElapsed(){
  // Current batch elapsed
  if(millisBatchStarted == null) return;

  let elapsed, diff = {};
  if(batchCompleted){
    elapsed = millisBatchEnded;
  }else{
    elapsed = new Date().getTime();
  }
  elapsed = (elapsed - millisBatchStarted) / 1000;
  diff.hours = Math.floor(elapsed / 3600 % 24);
  diff.minutes = Math.floor(elapsed / 60 % 60);
  diff.seconds = Math.floor(elapsed % 60);
  let msg = diff.hours +"h "+ diff.minutes +"m "+ diff.seconds +"s"
  dom.get("#elapsed-time").html(msg);
}





const Polargraph = class{
	// TODO Put plotter functions here
}

// ***********************
//
// Melt Drawing Functions
//
// ***********************

const Melt = class{
	// Drawing Functions
	//
	// They try to mimic the p5.js reference
	//
	constructor(){
		this.isDrawingPath = false;
        this.isPenUp = true;
		// if set to true it wont move the pen up and down after each shape
	}
	BeginShape(){
		this.isDrawingPath = true;
	}
	EndShape(){
		this.isDrawingPath = false;
	}
	PenUp(now = false){ // the now param sends command right away. Otherwise, it is queued
        if(now){
            SerialSend("C14,UP,END");
        }else{
            AddToQueue("C14,UP,END"); // pen down
        }
        this.isPenUp = true;
	}
	PenDown(now = false){ // the now param sends command right away. Otherwise, it is queued
        if(now){
            SerialSend("C13,DOWN,END");
        }else{
            AddToQueue("C13,DOWN,END"); // pen down
        }
        this.isPenUp = false;
	}

    TogglePen(){
        if(this.isPenUp){
            this.PenDown(true);
        }else{
            this.PenUp(true);
        }
        this.isPenUp != this.isPenUp;
    }

    PenPosition(){
        // returns pen position in mm (converted from penPositionPixels)
        p = new Victor(penPositionPixels.x * pxToMMFactor, penPositionPixels.y * pxToMMFactor);
        return p;
    }

	line(x1, y1, x2, y2, thickness = 1){
		/// <summary>Draws a line from (x1, y1) to (x2, y2). Positions should be set in millimetres. Warning! If called between StartPath() and EndPath(), pen will not be raised when moving to starting coordinate</summary>
    if(thickness < 1) thickness = 1;
    thickness = parseInt(thickness);

		if( !this.isDrawingPath ){
			this.PenUp();
		}

    // Width means going over the same line several times
    for(let i = 0; i < thickness; i++){
      if(isEven(i) && thickness > 1){
        AddMMCoordToQueue(x2,y2);
  			if(i==0) this.PenDown();
    		AddMMCoordToQueue(x1,y1);
      }else{
        AddMMCoordToQueue(x1,y1);
  			if(i==0) this.PenDown();
    		AddMMCoordToQueue(x2,y2);
      }
    }

		if( !this.isDrawingPath ){
			this.PenUp();
		}
	}

	ellipse(x, y, r, res = 100){
        // console.time("ellipse");
        res = Math.round(res);
        if(res < 3) res = 3; // A "circle" cant have less than 3 sides.. though that´s a triangle yo
        this.cachedFirstVx;
        this.PenUp();
    		// I generete an array of points that create the circle
        for (let i = 0; i < res; i++) {
            let angle = map(i, 0, res, 0, 2 * Math.PI);
            let posX = (r * Math.cos(angle)) + x;
            let posY = (r * Math.sin(angle)) + y;
            if(i == 0){
              this.cachedFirstVx = new Victor(posX,posY);
            }else if(i == 1){
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
var codeRepetitions = 1, remainingCodeRepetitions; //isRunningCodeForever = false;

function CheckCode(){

    if(session.getAnnotations().length == 0){
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

    }else{
        dom.get("#run-code-check-error").show(0).delay(2000).hide(0);
    }
}

function EvalCode(){
    showNotificationOnFinish = true;
	eval(codeStr); // Actually interprets string as javascript
	console.log('code evaluated');
	dom.get("#remaining-repetitions span").html(remainingCodeRepetitions);
	console
	if(machineQueue.length == 0){
		// the code executed succesfully but theres nothing on the queue
		EndedDrawingCode();
	}
}

function StartedDrawingCode(){
	if(codeRepetitions == 0){
		isRunningCodeForever = true;
		// dom.get("#stop-code-loop").show();
	}else if(codeRepetitions > 1){
		remainingCodeRepetitions = codeRepetitions;
		dom.get("#remaining-repetitions").show();
		dom.get("#remaining-repetitions span").html(remainingCodeRepetitions);
	}else{
		// only once
		remainingCodeRepetitions = 0;
	}
	isRunningCode = true;
	dom.get("#codeStatusIcon").hide();
	// dom.get("#run-code-button").addClass("disabled");
	// dom.get(".run-code-updown").addClass("disabled");
}
function EndedDrawingCode(){
	isRunningCode = false;
	isRunningCodeForever = false;
	// dom.get("#run-code-button").removeClass("disabled");
	// dom.get(".run-code-updown").removeClass("disabled");
	dom.get("#stop-code-loop").hide();
	dom.get("#remaining-repetitions").hide();
}

function TenPrint(){
    var xoff = melt.PenPosition().x, yoff = melt.PenPosition().y;
    var grid = 2;
    var alto = 330, ancho = 490;

    for(let i=0; i<ancho/grid; i++){
        for(let j=0; j<alto/grid; j++){
           PickOne()? LtR(i*grid, j*grid) : RtL(i*grid, j*grid);
        }
    }

    function PickOne(){
        return Math.floor(Math.random()*2) ? true:false;
    }

    function RtL(x,y){
        melt.line(x+xoff, y+yoff, x+xoff+grid, y+yoff+grid);
    }

    function LtR(x,y){
        melt.line(x+xoff+grid, y+yoff, x+xoff, y+yoff+grid);
    }
}


function isEven(n) {
   return n % 2 == 0;
}

function isOdd(n) {
   return Math.abs(n % 2) == 1;
}
