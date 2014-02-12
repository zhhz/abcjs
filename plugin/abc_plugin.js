//    abc_plugin.js: Find everything which looks like abc and convert it

//    Copyright (C) 2010 Gregory Dyke (gregdyke at gmail dot com)
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

//    requires: abcjs, raphael, jquery, documentready.js (creates window.$$$ function)

if (!window.ABCJS)
	window.ABCJS = {};

(function (addDocumentReady) {

  function setAttributes(elm, attrs){
    for(var attr in attrs)
      if (attrs.hasOwnProperty(attr)) {
	if (attr==="className") {
	  elm.className = attrs[attr];
	} else {
	  elm.setAttribute(attr, attrs[attr]);
	}
      }
    return elm;
  }

  //insert new before ref
  function before(newelem, refelem) {
    refelem.parentNode.insertBefore(newelem, refelem);
  }

  function after(newelem, refelem) {
    refelem.parentNode.insertBefore(newelem, refelem.nextSibling);
  }

  function createElem(tagname, content) {
    var elem = document.createElement(tagname);
    elem.innerHTML = content;
    return elem;
  }

  function remove(elem) {
    elem.parentNode.removeChild(elem);
  }
 
  // don't call on elements that might already have associated styles
  function hide(elem) {
    return setAttributes(elem,{style:"display:none;"});
  }

  function isTagName(elem, tagname) {
    return (elem.tagName && elem.tagName.toLowerCase() === tagname);
  }
 
  window.ABCJS.Plugin = function() {
    var is_user_script = false;
    try {
      is_user_script = abcjs_is_user_script;
    } catch (ex) {
    }
    this.show_midi = !is_user_script || navigator.userAgent.match(/Mozilla/);	// midi currently only works in Firefox, so in the userscript, don't complicate it. 
    this.hide_abc = false;
    this.render_before = false;
    this.midi_options = {};
    if (typeof T === "function") { // using timbre
      this.show_midi = true;
      this.midi_options.type = "timbre"
    }
    //this.parse_options = {};
    this.render_options = {};
    this.render_classname = "abcrendered";
    this.text_classname = "abctext";
    this.auto_render_threshold = 20;
    this.show_text = "show score for: ";
    //this.hide_text = "hide score for: ";
  };
  
  window.ABCJS.Plugin.prototype.start = function() {
    this.errors=[];
    var elems = this.getABCContainingElements(document.getElementsByTagName("body")[0]);
    var divs = [];
    elems.forEach(function(elem){
      divs = divs.concat(this.convertToDivs(elem));
    },this);

    this.clicktorender = (divs.length>this.auto_render_threshold);
    divs.forEach(function(pair){
      this.render(pair.div,pair.text);
    },this);
  };
  
  // returns a jquery set of the descendants (including self) of elem which have a text node which matches "X:"
  window.ABCJS.Plugin.prototype.getABCContainingElements = function(elem) {
    var results = [];
    var includeself = false; // whether self is already included (no need to include multiple times when an elem contains multiple abc texts)

    // TODO maybe look to see whether it's even worth it by using textContent ? -- But then how to find the closest parent relative?
    for (var node=elem.firstChild; node; node=node.nextSibling) { 
      if (node.nodeType == 3 && !includeself) {
	if (node.nodeValue.match(/^\s*X:/m)) {
	  if (!isTagName(elem, 'textarea')) {
	    results.push(elem);
	    includeself = true;
	  }
	}
      } else if (node.nodeType==1 && !isTagName(node,"textarea")) {
	results = results.concat(this.getABCContainingElements(node));
      }
    }
    return results;
  };
  
  // in this element there are one or more pieces of abc 
  // (and it is not in a subelem)
  // for each abc piece, we surround it with a div return an array of {div,text}
  window.ABCJS.Plugin.prototype.convertToDivs = function (elem) {
    var abctext = "";
    var abcdiv = null;
    var inabc = false;
    var brcount = 0;
    var nodestobemoved = []; //move nodes after so as not to break node.nextSibling
    var results = [];

    function closeABC(abctext, abcdiv, nodestobemoved) {
      abctext = abctext.replace(/\n+$/,"\n").replace(/^\n+/,"\n"); // get rid of extra blank lines
      results.push({
	"div": abcdiv,
	"text": abctext,
	"nodestobemoved": nodestobemoved
      });
    }

    for (var node=elem.firstChild; node; node=node.nextSibling) { 
      if (node.nodeType==3) { //textnode not containing just whitespace
	if (!node.nodeValue.match(/^\s*$/)) {
	  brcount=0;
	  var text = node.nodeValue;
	  if (text.match(/^\s*X:/m)) {
	    inabc=true;
	    abctext="";
	    nodestobemoved=[];
	    abcdiv = setAttributes(createElem("div",""),{className: this.text_classname});
	    before(abcdiv, node);
	    if (this.hide_abc) {
	      hide(abc_div);
	    } 
	  }
	  if (inabc) {
	    abctext += text.replace(/\n+$/,"").replace(/^\n+/,"");
	    nodestobemoved.push(node);
	  } 
	} else {
	  1;
	  //swallow empty textnodes?
	}
      } else if (inabc && isTagName(node,"br")) { // <br>
	if (brcount==0) { //is first consecutive
	  abctext += "\n";
	  nodestobemoved.push(node);
	  brcount++;
	} else {
	  inabc = false;
	  brcount=0;
	  closeABC(abctext, abcdiv, nodestobemoved);
	}
      } else if (inabc && node.nodeType === 1) { // found some kind of element, include the text inside that element, cut off by two newlines
	//abctext += "\n"; // GD: removed this as didn't understand why it had been treated that wayv (sent email 2014-02-12)
	var textcontent = (node.innerText || node.textContent);
	nodestobemoved.push(node);
	if (textcontent.match(/\n\n/)) {
	  abctext+=textcontent.split("\n\n")[0];
	  inabc = false;
	  brcount=0;
	  closeABC(abctext, abcdiv, nodestobemoved);
	} else {
	  abctext+=textcontent;
	}
      }
    }
    if (inabc) {
      closeABC(abctext, abcdiv, nodestobemoved);
    }

    results.forEach(function(r) {
      r.nodestobemoved.forEach(function(node) {
	r.div.appendChild(node);
      })
      delete r.nodestobemoved;
    });

    return results
  };
  
  window.ABCJS.Plugin.prototype.render = function (contextnode, abcstring) {
    var abcdiv = setAttributes(createElem("div",""),{className: this.render_classname});
    var insert = this.render_before ? before : after;
    insert(abcdiv,contextnode);
    
    try {
      var tunebook = new ABCJS.TuneBook(abcstring);
      var abcParser = new ABCJS.parse.Parse();
      abcParser.parse(tunebook.tunes[0].abc);
      var tune = abcParser.getTune();
      
      var self = this;
      var doPrint = function() {
	try {
	  var paper = Raphael(abcdiv, 800, 400);
	  var printer = new ABCJS.write.Printer(paper,self.render_options);
	  printer.printABC(tune);
	} catch (ex) { // f*** internet explorer doesn't like innerHTML in weird situations
	  // can't remember why we don't do this in the general case, but there was a good reason
	  remove(abcdiv);
	  abcdiv = setAttributes(createElem("div",""),{className: self.render_classname});
	  paper = Raphael(abcdiv, 800, 400);
	  printer = new ABCJS.write.Printer(paper);
	  printer.printABC(tune);
	  insert(abcdiv,contextnode);
	}
	if (ABCJS.midi.MidiWriter && self.show_midi) {
	  var midiwriter = new ABCJS.midi.MidiWriter(abcdiv,self.midi_options);
	  midiwriter.writeABC(tune);
	}
      };
      
      if (this.clicktorender) {
	var showspan = setAttributes(createElem("a",
						this.show_text+(tune.metaText.title||"untitled")),
				     {className:"abcshow", href:"#"});
	showspan.onclick = function(){
	  doPrint();
	  hide(showspan);
	  return false;
	};
	before(showspan,abcdiv);	
      } else {
	doPrint();
      }
      
    } catch (e) {
      this.errors.push(e);
   }
  };
  
  // There may be a variable defined which controls whether to automatically run the script. If it isn't
  // there then it will throw an exception, so we'll catch it here.
  addDocumentReady(function() {
    var autostart = true;
    try {
		autostart = abcjs_plugin_autostart;
    } catch (ex) {
      // It's ok to fail, and we don't have to do anything.
    }
    if (autostart) ABCJS.plugin.start();
  });
})($$$);

window.ABCJS.plugin = new window.ABCJS.Plugin();
 