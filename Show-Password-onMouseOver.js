// ==UserScript==
// @name          Show Password onMouseOver
// @namespace     https://github.com/arrupe/
// @version       1.0.0
// @description	  Show password when mouseover on password field
// @author        arrupe
// @license       WTFPL
// @include       *
// ==/UserScript==

window.setTimeout(function() {
  var passFields = document.querySelectorAll("input[type='password']");
  if (!passFields.length) return;
  for (var i = 0; i < passFields.length; i++) {
    passFields[i].addEventListener("mouseover", function() {
      this.type = "text";
    }, false);
    passFields[i].addEventListener("mouseout", function() {
      this.type = "password";
    }, false);
  }
}, 1000)