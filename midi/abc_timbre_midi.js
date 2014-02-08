//    abc_timbre_midi.js: Implements the ABCJS midiproxy API via timbre.js or MIDI.js
//    Copyright (C) 2014 Gregory Dyke (gregdyke at gmail dot com)
//
//    This program is free software: you can redistribute it and/or modify
//    it under the terms of the GNU General Public License as published by
//    the Free Software Foundation, either version 3 of the License, or
//    (at your option) any later version.
//
//    This program is distributed in the hope that it will be useful,
//    but WITHOUT ANY WARRANTY; without even the implied warranty of
//    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//    GNU General Public License for more details.
//
//    You should have received a copy of the GNU General Public License
//    along with this program.  If not, see <http://www.gnu.org/licenses/>.

if (!window.ABCJS)
	window.ABCJS = {};

if (!window.ABCJS.midi)
	window.ABCJS.midi = {};

(function() {

/**
 *
 *
 */
ABCJS.midi.TimbreMidi = function (midiwriter, params) {
  this.playlist = []; // contains {time:t,funct:f} pairs, with t expressed in miditicks (480 per quarternote)
  this.trackcount = 0;
  this.timecount = 0;
  this.tempo = 60;
  this.channel = 1;
  this.instrument = 1; // numbers range 1..128
  this.instruments = params["instruments"] || [1];
 

  // temporary while midi loads. this.synth must respond to noteOn and noteOff commands, so can be an Timbre instance or MIDI.js
  this.setTimbreAsSynth();
  this.midiwriter = midiwriter;

  if (MIDI && params["usemidijs"]) { // MIDI.technology truthy -> midi.loadPlugin has been successfully called
    var soundfontUrl = params["soundfontUrl"] || "http://rawgithub.com/gleitz/midi-js-soundfonts/master/FluidR3_GM/";
    var instrument_names = [];
    for (var iidx=0; iidx<this.instruments.length; iidx++) {
      var GMinstrument = this.instruments[iidx]-1;
      instrument_names.push(MIDI.GeneralMIDI.byId[GMinstrument].id); // why .id accesses the instrument name in a hash that hashes by number id, I don't know
    }
    
    MIDI.technology && this.setMIDIJSAsSynth();
    MIDI.loadPlugin && (!MIDI.technology) && MIDI.loadPlugin({
      soundfontUrl: soundfontUrl,
      instruments: instrument_names, // or multiple instruments
      callback: function() { 
	console.log("MIDI.js loaded");
	// don't change midi playback on the fly because otherwise it's weird on iOS (user-events need to generate audio playback)
      }
    });
  }
  
}

ABCJS.midi.TimbreMidi.prototype.setTimbreAsSynth = function () {
  this.synth && this.synth.allNoteOff();
  var TSynth = T("OscGen", {wave:"pulse", env:{type:"adsr", r:150}, mul:0.25}).play();
  this.synth = {
    noteOn: function(pitch, velocity) {
      TSynth.noteOn(pitch, velocity);
    },
    noteOff: function(pitch) {
      TSynth.noteOff(pitch);
    },
    allNoteOff: function() {
      TSynth.allNoteOff();
    },
    setProgram: function(channel, instrument) {
      
    },
    type: "timbre"
  };
  this.setInstrument(this.instrument);
};

ABCJS.midi.TimbreMidi.prototype.setMIDIJSAsSynth = function () {
  this.synth && this.synth.allNoteOff();
  var onnotes = {};
  var self = this;
  this.synth = {
    noteOn: function(pitch, velocity) {
      MIDI.noteOn(self.channel, pitch, velocity, 0);
      onnotes[pitch] = true;
    },
    noteOff: function(pitch) {
      try {
	MIDI.noteOff(self.channel, pitch, 0);
      } catch (e) {
	// was already off
      }
      delete onnotes[pitch];
    },
    allNoteOff: function() {
      for (note in onnotes) {
	try {
	  MIDI.noteOff(self.channel, note, 0);
	} catch (e) {
	  //note was already off
	}
      }
      onnotes = {};
    },
    setProgram: function(channel, instrument) {
      MIDI.programChange(channel, instrument-1); // 0-indexed
      //TODO-GD this sets the program on the whole midi object - should specialise as we change between TimbreMidi instances
    },
    type: "MIDIJS"
  }
  this.setInstrument(this.instrument);
};

ABCJS.midi.TimbreMidi.prototype.setTempo = function (qpm) {
  this.tempo = qpm;
};

ABCJS.midi.TimbreMidi.prototype.startTrack = function () {
  this.silencelength = 0;
  this.trackcount++;
  this.timecount=0;
  this.playlistpos=0;
  this.first=true;
};

ABCJS.midi.TimbreMidi.prototype.endTrack = function () {
  // need to do anything?
};

ABCJS.midi.TimbreMidi.prototype.setInstrument = function (number) {
  if (this.instruments.indexOf(number)<0) {
    number = this.instruments[0];
  }
  this.instrument=number;
  this.synth.setProgram(this.channel,this.instrument);
  //this.setInstrument(number);
  //TODO-GD push this into the playlist?
};

ABCJS.midi.TimbreMidi.prototype.setChannel = function (number) {
  this.channel=number;
  //this.midiapi.setChannel(number);
  //TODO-GD
};

ABCJS.midi.TimbreMidi.prototype.updatePos = function() {
  while(this.playlist[this.playlistpos] && 
	this.playlist[this.playlistpos].time<this.timecount) {
    this.playlistpos++;
  }
};

ABCJS.midi.TimbreMidi.prototype.startNote = function (pitch, loudness, abcelem) {
  this.timecount+=this.silencelength;
  this.silencelength = 0;
  if (this.first) {
    //nothing special if first?
  }
  this.updatePos();
  var self=this;
  
  this.playlist.splice(this.playlistpos,0, {   
    time:this.timecount,
    funct:function() {
      self.synth.noteOn(pitch, loudness);
      self.midiwriter.notifySelect(abcelem);
    }
  });
};

ABCJS.midi.TimbreMidi.prototype.endNote = function (pitch, length) {
  this.timecount+=length;
  this.updatePos();
  var self=this;
  this.playlist.splice(this.playlistpos, 0, {   
    time:this.timecount,
	funct:	function() {
	self.synth.noteOff(pitch);
      }
    });
};

ABCJS.midi.TimbreMidi.prototype.addRest = function (length) {
  this.silencelength += length;
};

ABCJS.midi.TimbreMidi.prototype.embed = function(parent) {

  this.setAttributes = function(elm, attrs){
    for(var attr in attrs)
      if (attrs.hasOwnProperty(attr))
	elm.setAttribute(attr, attrs[attr]);
    return elm;
  }

  this.playstyle = "margin-left:15px; display:inline-block; width: 0; height: 0; border-top: 5px solid transparent; border-left: 10px solid black; border-bottom: 5px solid transparent; ";
  this.pausestyle = "margin-left:15px; display:inline-block; width: 2px; height: 10px; border-left: 4px solid black; border-top: 0px; border-bottom: 0px; border-right:4px solid black;"
  this.stopstyle = "margin-left:15px; display:inline-block; width:10px; height:10px; background:black";
  
  this.playlink = this.setAttributes(document.createElement('div'), {
    style: this.playstyle
    });  


  //this.playlink.innerHTML = "play";
  var self = this;
  this.playlink.onmousedown = function() {
    if (self.playing) {
      this.innerHTML = "";
      self.setAttributes(this, {
    style: self.playstyle
      });
      self.pausePlay();
    } else {
      self.setAttributes(this, {
	style: self.pausestyle
      });
      self.startPlay();
    }
  };
  parent.appendChild(this.playlink);

  var stoplink = this.setAttributes(document.createElement('div'), {
    style: this.stopstyle
    });  
  //stoplink.innerHTML = "stop";

  stoplink.onmousedown = function() {
    self.stopPlay(); 
  };
  parent.appendChild(stoplink);

  this.initPlay();
};

ABCJS.midi.TimbreMidi.prototype.initPlay = function() {
  // TODO set all general variables (such as MIDI to the specifics of this instance)
  this.playing = false;
  this.sched = T("schedule");
  var mspertick = (60000/this.tempo*480) // 480 * this.tempo is number of ticks per minute 
  for (var i=0; i<this.playlist.length;i++) {
    this.sched.schedAbs(this.playlist[i].time, this.playlist[i].funct);
  } 
  var self = this;
  this.sched.schedAbs(this.playlist[this.playlist.length-1].time, function() {
    self.stopPlay(); // when reach end
  });
};

ABCJS.midi.TimbreMidi.prototype.stopPlay = function() {
  this.pausePlay();
  this.playlink.innerHTML = "";
  this.setAttributes(this.playlink, {
    style: this.playstyle
  });
  this.midiwriter.notifySelect({});
  this.initPlay();
};

ABCJS.midi.TimbreMidi.prototype.startPlay = function() {

  if (this.synth.type !== "MIDIJS"  && MIDI.technology) {
    this.setMIDIJSAsSynth();
    // in iOS call this to activate sound
    if (/(iPad|iPhone|iPod)/g.test( navigator.userAgent)) {
      this.synth.noteOn(4,1);
      this.synth.noteOff(4);
    }
  } 

  this.playing = true;

 


  this.sched.start();

};

ABCJS.midi.TimbreMidi.prototype.pausePlay = function() {
  this.playing = false;
  this.synth.allNoteOff();
  this.sched.stop();
  
};
})();