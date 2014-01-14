//    abc_timbre_midi.js: Implements the ABCJS midiproxy API via timbre.js
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


/**
 *
 *
 */
function TimbreMidi(midiwriter) {
  // note that this is generally based of of JavaMidi // which is getting deprecated
  this.playlist = []; // contains {time:t,funct:f} pairs, with t expressed in miditicks (480 per quarternote)
  this.trackcount = 0;
  this.timecount = 0;
  this.tempo = 60;
  this.synth = T("OscGen", {wave:"pulse", env:{type:"adsr", r:150}, mul:0.25}).play();
  this.midiwriter = midiwriter;
}

TimbreMidi.prototype.setTempo = function (qpm) {
  this.tempo = qpm;
};

TimbreMidi.prototype.startTrack = function () {
  this.silencelength = 0;
  this.trackcount++;
  this.timecount=0;
  this.playlistpos=0;
  this.first=true;
  if (this.instrument) {
    this.setInstrument(this.instrument);
  }
  if (this.channel) {
    this.setChannel(this.channel);
  }
};

TimbreMidi.prototype.endTrack = function () {
  // need to do anything?
};

TimbreMidi.prototype.setInstrument = function (number) {
  this.instrument=number;
  //this.setInstrument(number);
  //TODO-GD push this into the playlist?
};

TimbreMidi.prototype.setChannel = function (number) {
  this.channel=number;
  //this.midiapi.setChannel(number);
  //TODO-GD
};

TimbreMidi.prototype.updatePos = function() {
  while(this.playlist[this.playlistpos] && 
	this.playlist[this.playlistpos].time<this.timecount) {
    this.playlistpos++;
  }
};

TimbreMidi.prototype.startNote = function (pitch, loudness, abcelem) {
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

TimbreMidi.prototype.endNote = function (pitch, length) {
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

TimbreMidi.prototype.addRest = function (length) {
  this.silencelength += length;
};

TimbreMidi.prototype.embed = function(parent) {

  function setAttributes(elm, attrs){
    for(var attr in attrs)
      if (attrs.hasOwnProperty(attr))
	elm.setAttribute(attr, attrs[attr]);
    return elm;
  }
  
  this.playlink = setAttributes(document.createElement('a'), {
    style: "border:1px solid black; margin:3px;"
    });  
  this.playlink.innerHTML = "play";
  var self = this;
  this.playlink.onmousedown = function() {
    if (self.playing) {
      this.innerHTML = "play";
      self.pausePlay();
    } else {
      this.innerHTML = "pause";
      self.startPlay();
    }
  };
  parent.appendChild(this.playlink);

  var stoplink = setAttributes(document.createElement('a'), {
    style: "border:1px solid black; margin:3px;"
    });  
  stoplink.innerHTML = "stop";
  //var self = this;
  stoplink.onmousedown = function() {
    self.stopPlay(); 
  };
  parent.appendChild(stoplink);

  this.initPlay();
};

TimbreMidi.prototype.initPlay = function() {
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

TimbreMidi.prototype.stopPlay = function() {
  this.pausePlay();
  this.playlink.innerHTML = "play";
  this.midiwriter
  this.initPlay();
};

TimbreMidi.prototype.startPlay = function() {
  this.playing = true;
  this.sched.start();

};

TimbreMidi.prototype.pausePlay = function() {
  this.playing = false;
  this.sched.stop();
  this.synth.allNoteOff();
};