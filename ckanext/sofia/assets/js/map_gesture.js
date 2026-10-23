/* Map gesture handling: the mouse wheel zooms a map only while Ctrl (Cmd on
 * macOS) is held, so scrolling the page over an embedded map keeps scrolling
 * the page. Wraps geoview's ckan.commonLeafletMap so every Leaflet map it
 * creates gets this behaviour.
 */
(function (ckan, L) {
  "use strict";

  var createMap = ckan.commonLeafletMap;
  if (!createMap) {
    return;
  }

  var isMac = /Mac|iPhone|iPad/.test(navigator.platform);
  var key = isMac ? "⌘" : "Ctrl";
  var messages = {
    bg: "Използвайте " + key + " + колелото на мишката, за да промените мащаба на картата",
    en: "Use " + key + " + scroll to zoom the map"
  };

  function hintText() {
    var lang = (document.documentElement.lang || "en").slice(0, 2);
    return messages[lang] || messages.en;
  }

  function addGestureHandling(map) {
    var container = map.getContainer();
    var hint = L.DomUtil.create("div", "map-gesture-hint", container);
    var hideTimer;

    hint.textContent = hintText();

    // Capture phase, so this runs before Leaflet's own wheel listener on the
    // container and can keep plain wheel events away from it.
    container.addEventListener("wheel", function (e) {
      if (e.ctrlKey || e.metaKey) {
        L.DomUtil.removeClass(hint, "is-visible");
        return;
      }
      e.stopImmediatePropagation();
      L.DomUtil.addClass(hint, "is-visible");
      clearTimeout(hideTimer);
      hideTimer = setTimeout(function () {
        L.DomUtil.removeClass(hint, "is-visible");
      }, 1500);
    }, { capture: true, passive: true });
  }

  ckan.commonLeafletMap = function () {
    var map = createMap.apply(this, arguments);
    addGestureHandling(map);
    return map;
  };
})(this.ckan, this.L);
