// ==UserScript==
// @name         reCAPTCHA Helper
// @namespace    https://github.com/arrupe/
// @version      1.0.0
// @description  On reCAPTCHA image challenges: shortens transition effects and enables click-and-drag tile selection (MoreCAPTCHA). On Google "sorry" interstitials: re-issues the search on another Google regional domain (Bypass Google Sorry).
// @author       arrupe
// @license      WTFPL
// @include      https://www.google.com/recaptcha/api2/bframe?*
// @include      *://ipv4.google.*/sorry/*
// @run-at       document-start
// @grant        unsafeWindow
// @icon         https://images.icon-icons.com/2699/PNG/512/google_recaptcha_logo_icon_170062.png
// ==/UserScript==

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  // MoreCAPTCHA: factor by which reCAPTCHA transitions and timers are sped up.
  var SPEED = 5;

  // Bypass Google Sorry: regional Google domains to retry the search on.
  var RETRY_DOMAINS = [
    'https://www.google.co.jp/search?q=',
    'https://www.google.com.tw/search?q=',
    'https://www.google.com.hk/search?q='
  ];

  // ---------------------------------------------------------------------------
  // Module 1: MoreCAPTCHA (runs inside the reCAPTCHA challenge iframe)
  // ---------------------------------------------------------------------------

  function runMoreCaptcha() {
    var selector = {
      selecting: undefined,

      handle: function (event) {
        var tiles = new Set(document.querySelectorAll('#rc-imageselect td'));
        var tile = event.target;

        while (tile && !tiles.has(tile)) {
          tile = tile.parentNode;
        }

        if (tile) {
          event.stopPropagation();
          event.preventDefault();

          var selected = 'selected' in tile.dataset && tile.dataset.selected == 'true';

          if (this[event.type](selected)) {
            tile.dataset.selected = this.selecting;
            tile.firstElementChild.click();
          }
        }
      },

      mouseover: function (selected) {
        return !(this.selecting === undefined || this.selecting === selected);
      },

      mousedown: function (selected) {
        this.selecting = !selected;
        return true;
      },

      mouseup: function (selected) {
        this.selecting = undefined;
        return false;
      }
    };

    window.addEventListener('load', function () {
      var sheet = document.body.appendChild(document.createElement('style')).sheet;

      sheet.insertRule(
        '.rc-imageselect-table-33, .rc-imageselect-table-42, .rc-imageselect-table-44' +
        '{ transition-duration: ' + (1 / SPEED) + 's !important }', 0);
      sheet.insertRule(
        '.rc-imageselect-tile' +
        '{ transition-duration: ' + (4 / SPEED) + 's !important }', 1);
      sheet.insertRule(
        '.rc-imageselect-dynamic-selected' +
        '{ transition-duration: ' + (2 / SPEED) + 's !important }', 2);
      sheet.insertRule(
        '.rc-imageselect-progress' +
        '{ transition-duration: ' + (1 / SPEED) + 's !important }', 3);
      sheet.insertRule(
        '.rc-image-tile-overlay' +
        '{ transition-duration: ' + (1 / SPEED) + 's !important }', 4);

      var handler = selector.handle.bind(selector);

      document.body.addEventListener('mouseover', handler, false);
      document.body.addEventListener('mousedown', handler, false);
      document.body.addEventListener('mouseup', handler, false);
    });

    // Expose a sandbox function to the page context (Firefox needs exportFunction).
    function publish(func) {
      if (typeof exportFunction == 'function') {
        return exportFunction(func, unsafeWindow);
      }
      return func;
    }

    var __setTimeout = unsafeWindow.setTimeout.bind(unsafeWindow);

    unsafeWindow.setTimeout = publish(function (callback, delay) {
      return __setTimeout(callback, Number(delay) / SPEED);
    });
  }

  // ---------------------------------------------------------------------------
  // Module 2: Bypass Google Sorry (runs on ipv4.google.*/sorry/* pages)
  // ---------------------------------------------------------------------------

  function getParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, '\\$&');
    var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)');
    var results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
  }

  function getRandomRetryURL() {
    return RETRY_DOMAINS[Math.floor(Math.random() * RETRY_DOMAINS.length)];
  }

  function runSorryRedirect() {
    var sorryUrl = decodeURIComponent(window.location.href);
    var target = getParameterByName('continue', sorryUrl);
    var query = getParameterByName('q', sorryUrl);

    if (target && /google/.test(target) && query !== null) {
      window.location.replace(getRandomRetryURL() + encodeURIComponent(query));
    }
  }

  // ---------------------------------------------------------------------------
  // Dispatch on the current page
  // ---------------------------------------------------------------------------

  var path = window.location.pathname;

  if (path.indexOf('/sorry/') === 0) {
    runSorryRedirect();
  } else if (path.indexOf('/recaptcha/api2/bframe') === 0) {
    runMoreCaptcha();
  }
})();