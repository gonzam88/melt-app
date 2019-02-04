var PolargraphParser = (function(){
	var _parse = function(str){
		machine = {motors: {}};
		page = {};

		var arr = str.split(/\n/);
		for(let i = 0; i < arr.length; i++){
			if(arr[i].startsWith("#")) continue;

			let splitted = arr[i].split("=");
			if(splitted.length != 2) continue;

			let property = splitted[0].replace(/\s/g, '');
			let value = parseFloat( splitted[1].replace(/\s/g, '') );

			// hard work
			switch(property){
				case "controller.pixel.samplearea":
					break;
				case "controller.pictureframe.position.y":
					break;
				case "controller.pictureframe.position.x":
					break;
				case "controller.testPenWidth.startSize":
					break;
				case "controller.machine.colour":
					break;
				case "machine.motors.mmPerRev":
					machine.mmPerRev = value;
					break;
				case "controller.window.width":
					break;
				case "controller.frame.colour":
					break;
				case "controller.image.position.y":
					break;
				case "controller.image.position.x":
					break;
				case "machine.motors.accel":
					machine['motors']['acceleration'] = value;
					break;
				case "controller.image.height":
					break;
				case "controller.machine.serialport":
					break;
				case "controller.window.height":
					break;
				case "controller.maxSegmentLength":
					break;
				case "controller.geomerative.polygonizerLength":
					break;
				case "machine.penlift.up":
					machine.upPos = value;
					break;
				case "machine.penlift.down":
					machine.downPos = value;
					break;
				case "controller.page.position.y":
					break;
				case "controller.vector.scaling":
					break;
				case "controller.page.position.x":
					break;
				case "machine.step.multiplier":
					machine.stepMultiplier = value;
					break;
				case "controller.pictureframe.width":
					break;
				case "controller.grid.size":
					break;
				case "controller.testPenWidth.endSize":
					break;
				case "controller.pictureframe.height":
					break;
				case "controller.page.colour":
					break;
				case "controller.testPenWidth.incrementSize":
					break;
				case "controller.image.width":
					break;
				case "machine.motors.stepsPerRev":
					machine.stepsPerRev = value;
					break;
				case "machine.pen.size":
					break;
				case "controller.page.width":
					page.width = value;
					break;
				case "controller.pixel.mask.color":
					break;
				case "controller.machine.baudrate":
					break;
				case "controller.vector.minLineLength":
					break;
				case "machine.width":
					machine.widthMM = value;
					break;
				case "controller.geomerative.polygonizer":
					break;
				case "controller.page.height":
					page.height = value;
					break;
				case "controller.vector.position.y":
					break;
				case "controller.vector.position.x":
					break;
				case "controller.image.filename":
					break;
				case "controller.background.colour":
					break;
				case "controller.homepoint.y":
					break;
				case "controller.homepoint.x":
					break;
				case "machine.motors.maxSpeed":
					machine.motors.maxSpeed = value;
					break;
				case "controller.guide.colour":
					break;
				case "controller.density.preview.style":
					break;
				case "controller.pixel.scaling":
					break;
				case "controller.densitypreview.colour":
					break;
				case "machine.height":
					machine.heightMM = value;
					break;
			}
		}
		var out = {machine: machine, page: page};
		return out;
	}


	return{
		parse: (str)=>{ return _parse(str) }
	}

})();
