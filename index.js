var animation = require('./src/api/abc_animation');
var tuneBook = require('./src/api/abc_tunebook');
var abcParser = require('./src/parse/abc_parse');
var midiParser = require('./src/midi/abc_midi_create');

var abcjs = {};

abcjs.signature = "abcjs-basic v5.0.0";

Object.keys(animation).forEach(function (key) {
	abcjs[key] = animation[key];
});

Object.keys(tuneBook).forEach(function (key) {
	abcjs[key] = tuneBook[key];
});

abcjs.renderAbc = require('./src/api/abc_tunebook_svg');

var editor = require('./src/edit/abc_editor');
abcjs['Editor'] = editor;

abcjs['AbcParser'] = abcParser;
abcjs['MidiParser'] = midiParser;

module.exports = abcjs;
