#!/bin/sh
die () {
    echo >&2 "$@"
    exit 1
}

[ "$#" -eq 1 ] || die "Call with a version number argument in the form x.y"
echo $1 | grep -E -q '^[1-9]\.[0-9]+$' || die "Version number argument required (x.y), $1 provided"
echo "Concatenating all files..."
cat parse/abc_common.js parse/abc_parse.js parse/abc_parse_directive.js parse/abc_parse_header.js parse/abc_parse_key_voice.js parse/abc_tokenizer.js > tmp/parse.js
cat write/abc_glyphs.js write/abc_graphelements.js write/abc_layout.js write/abc_write.js write/sprintf.js > tmp/write.js
cat midi/MIDI.js midi/inc/Base64.js midi/inc/base64binary.js midi/timbre.js > tmp/MIDIlibs.js
cat midi/abc_midiwriter.js midi/abc_timbre_midi.js > tmp/midi.js
cat api/abc_tunebook.js data/abc_tune.js edit/abc_editor.js tmp/midi.js tmp/parse.js tmp/write.js > tmp/abcjs-noraphael.js
cat write/raphael.js tmp/abcjs-noraphael.js > tmp/abcjs_all.js
cat tmp/abcjs-noraphael.js plugin/abc_plugin.js > tmp/abcjs_plugin-noraphael.js
cat tmp/abcjs_all.js plugin/abc_plugin.js > tmp/abcjs_plugin.js
cat tmp/MIDIlibs.js tmp/abcjs_all.js > tmp/abcjs_all_midibeta.js
cat tmp/MIDIlibs.js tmp/abcjs_plugin.js > tmp/abcjs_plugin_midibeta.js 
echo "Compressing basic and editor..."
java -jar yuicompressor-2.4.2.jar  --line-break 7000 -o bin/abcjs_$1-min.js tmp/abcjs_all.js
java -jar yuicompressor-2.4.2.jar  --line-break 7000 -o bin/abcjs_noraphael_$1-min.js tmp/abcjs-noraphael.js
echo "Compressing plugin..."
java -jar yuicompressor-2.4.2.jar  --line-break 7000 -o bin/abcjs_plugin_noraphael_nojquery_$1-min.js tmp/abcjs_plugin-noraphael.js
java -jar yuicompressor-2.4.2.jar  --line-break 7000 -o bin/abcjs_plugin_nojquery_$1-min.js tmp/abcjs_plugin.js
echo "Compressing beta versions with midi..."
java -jar yuicompressor-2.4.2.jar  --line-break 7000 -o bin/abcjs_midibeta_$1-min.js tmp/abcjs_all_midibeta.js
java -jar yuicompressor-2.4.2.jar  --line-break 7000 -o bin/abcjs_plugin_midibeta_nojquery_$1-min.js tmp/abcjs_plugin_midibeta.js
cat lib/zepto.min.js bin/abcjs_plugin_nojquery_$1-min.js > bin/abcjs_plugin_$1-min.js
cat lib/zepto.min.js bin/abcjs_plugin_midibeta_nojquery_$1-min.js > bin/abcjs_plugin_midibeta_$1-min.js
cat plugin/greasemonkey.js bin/abcjs_plugin_$1-min.js > bin/abcjs_plugin_$1.user.js

