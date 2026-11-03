/* GeoJSON preview: replaces geoview's geojsonpreview module (see
 * templates/dataviewer/geojson.html).
 *
 * - Shows "Loading visualization" with a spinner until the map or a message
 *   is ready.
 * - Files that turn out not to be GeoJSON (by their first bytes, or when
 *   parsed) take the view off the resource page, tab and all. Resources whose
 *   file name says they are something else never get the view (geojson.py).
 * - Files over max_file_size, or that do not show within a 5 second budget of
 *   time the page is visible, get a "large resource" message with a button
 *   that loads them anyway, without the size and time limits. Features are
 *   drawn in short slices so the budget can be checked.
 */
ckan.module('sofia-geojson-preview', function (jQuery) {
  "use strict";

  var messages = {
    bg: {
      loading: "Зареждане на визуализацията...",
      large: "Ресурсът е голям и зареждането му ще отнеме време.",
      load: "Зареди ресурс",
      too_big: "Ресурсът е твърде голям, за да бъде зареден в платформата. Изтеглете го, за да го разгледате.",
      error: "Ресурсът не може да бъде зареден."
    },
    en: {
      loading: "Loading visualization...",
      large: "This resource is large and will take a while to load.",
      load: "Load resource",
      too_big: "This resource is too big to load on the platform. Download it to view it.",
      error: "The resource could not be loaded."
    }
  };

  var GEOJSON_TYPES = [
    "FeatureCollection", "Feature", "Point", "MultiPoint", "LineString",
    "MultiLineString", "Polygon", "MultiPolygon", "GeometryCollection"
  ];

  // Shown while a large resource loads, until the features' bounds are known
  var SOFIA_CENTER = [42.6977, 23.3219];

  // Height of the view's iframe with a map: the 650px min-height CKAN's CSS
  // gives view iframes, so maps keep their usual size
  var MAP_FRAME_HEIGHT = 650;

  // Height of the view's iframe while loading. The resource page gives the
  // iframe this height from the start (templates/package/snippets/resource_view.html)
  var LOADING_FRAME_HEIGHT = 120;

  // sessionStorage key, followed by the resource id, for resources whose file
  // turned out not to be GeoJSON. Also in
  // templates/package/snippets/resource_view.html
  var NOT_GEOJSON_KEY = "sofia-not-geojson:";

  // Thrown to stop loading. "not_geojson" removes the view, the other
  // reasons show one of the messages above.
  function Stop(reason) {
    this.reason = reason;
  }

  function now() {
    return window.performance ? performance.now() : Date.now();
  }

  return {
    options: {
      table: '<div class="table-container"><table class="table table-striped table-bordered table-condensed"><tbody>{body}</tbody></table></div>',
      row: '<tr><th>{key}</th><td>{value}</td></tr>',
      style: {
        opacity: 0.7,
        fillOpacity: 0.1,
        weight: 2
      },
      time_budget_ms: 5000,
      // Drawing yields to the browser after this long, then checks the budget
      slice_ms: 50
    },

    initialize: function () {
      var resource = window.preload_resource || {};

      this.showLoading();

      // The standard CRS for GeoJSON according to RFC 7946 is
      // urn:ogc:def:crs:OGC::CRS84, but proj4s uses a different name
      // for it. See https://github.com/ckan/ckanext-geoview/issues/51
      proj4.defs['OGC:CRS84'] = proj4.defs['EPSG:4326'];

      this._watchVisibility();

      if (resource.size && resource.size > this._maxBytes()) {
        return this.showLarge();
      }
      this._load(false);
    },

    // forced: the user asked for a large resource, so load it without the
    // size and time limits, on a map that is shown right away
    _load: function (forced) {
      var self = this;
      var resource = window.preload_resource || {};

      this.forced = forced;
      this._startClock();
      if (forced) {
        this._createMap();
        this.map.setView(SOFIA_CENTER, 11);
      }

      this._download(resource.url, forced ? Infinity : this._maxBytes())
        .then(function (text) {
          var data = self._parse(text);
          return self._draw(data);
        })
        .catch(function (err) {
          if (self.map) {
            self.map.remove();
            self.map = null;
          }
          if (err instanceof Stop) {
            if (err.reason === "not_geojson") {
              self.removeView();
            } else if (err.reason === "large") {
              self.showLarge();
            } else {
              self.showMessage(err.reason);
            }
          } else {
            if (window.console) {
              console.error("GeoJSON preview failed", err);
            }
            self.showMessage("error");
          }
        });
    },

    _text: function (key) {
      var lang = (document.documentElement.lang || "en").slice(0, 2);
      return (messages[lang] || messages.en)[key];
    },

    showLoading: function () {
      this.el.empty().append(
        jQuery("<div class='geojson-status'></div>").append(
          jQuery("<div class='geojson-loading-spinner' aria-hidden='true'></div>"),
          jQuery("<span></span>").text(this._text("loading"))
        )
      );
      this._setFrameHeight(LOADING_FRAME_HEIGHT);
    },

    // Takes this view off the resource page. When the resource has other
    // views, the page shows the first of them instead, without the tabs of
    // GeoJSON views for the rest of the session, as they all show this file.
    removeView: function () {
      var resource = window.preload_resource || {};

      this.el.empty();
      this._setFrameHeight(0);

      try {
        sessionStorage.setItem(NOT_GEOJSON_KEY + resource.id, resource.metadata_modified);
      } catch (e) {
        // Storage turned off: the tabs come back on other pages
      }

      var frame = this._frame();
      if (!frame) {
        return;
      }
      var page = frame.ownerDocument;
      var tabs = page.querySelectorAll(".nav-tabs .view-item");
      var other = Array.prototype.filter.call(tabs, function (tab) {
        return !tab.classList.contains("view-item-geojson_view");
      })[0];
      if (other) {
        page.defaultView.location.replace(other.href);
        return;
      }

      // Only GeoJSON views, so nothing is left to show
      Array.prototype.forEach.call(tabs, function (tab) {
        tab.closest(".nav-tabs").style.display = "none";
      });
      // The view's block, and the one around it on the resource page
      var block = frame.closest("[id^='view-']");
      if (block) {
        (block.parentNode.closest(".resource-view") || block).style.display = "none";
      }
    },

    showMessage: function (key) {
      var p = jQuery("<p class='text-danger'></p>").text(this._text(key));
      this.el.empty().append(jQuery("<div class='data-viewer-error'></div>").append(p));
      this._fitFrameToContent();
    },

    showLarge: function () {
      var self = this;
      var button = jQuery("<button type='button' class='btn btn-primary'></button>")
        .text(this._text("load"))
        .on("click", function () {
          self._load(true);
        });
      this.el.empty().append(
        jQuery("<div class='data-viewer-info'></div>").append(
          jQuery("<p></p>").text(this._text("large")),
          button
        )
      );
      this._fitFrameToContent();
    },

    // Also refits when the width changes, since the text then wraps differently
    _fitFrameToContent: function () {
      var self = this;
      this._setFrameHeight(Math.ceil(this.el[0].getBoundingClientRect().bottom) + 10);
      if (!this.refitOnResize) {
        this.refitOnResize = function () {
          if (!self.map) {
            self._setFrameHeight(Math.ceil(self.el[0].getBoundingClientRect().bottom) + 10);
          }
        };
        window.addEventListener("resize", this.refitOnResize);
      }
    },

    // Sizes the iframe this view is shown in on the resource page. CKAN's CSS
    // gives it a 650px min-height and its data-viewer module sets a height
    // when it loads, so min-height is cleared and the height is set again
    // whenever something else changes it.
    _setFrameHeight: function (height) {
      var self = this;
      var frame = this._frame();
      if (!frame) {
        return;
      }

      this.frameHeight = height + "px";
      frame.style.minHeight = "0px";
      frame.style.height = this.frameHeight;

      if (!this.frameObserver) {
        this.frameObserver = new MutationObserver(function () {
          if (frame.style.height !== self.frameHeight || frame.style.minHeight !== "0px") {
            frame.style.minHeight = "0px";
            frame.style.height = self.frameHeight;
          }
        });
        this.frameObserver.observe(frame, {attributes: true, attributeFilter: ["style"]});
      }
    },

    // The iframe this view is shown in, or null when it is opened on its own
    // or embedded on another site
    _frame: function () {
      try {
        return window.frameElement;
      } catch (e) {
        return null;
      }
    },

    _maxBytes: function () {
      return parseInt(this.options.max_file_size, 10) || Infinity;
    },

    // The budget counts wall-clock time, including the browser's own layout
    // and painting, but not time while the tab is hidden: timers in background
    // tabs are throttled, which would use up the budget without any work.
    _watchVisibility: function () {
      var self = this;
      document.addEventListener("visibilitychange", function () {
        if (document.hidden) {
          self.hiddenSince = now();
        } else if (self.hiddenSince !== null) {
          self.hiddenMs += now() - self.hiddenSince;
          self.hiddenSince = null;
        }
      });
    },

    _startClock: function () {
      this.startedAt = now();
      this.hiddenMs = 0;
      this.hiddenSince = document.hidden ? now() : null;
    },

    _remainingMs: function () {
      if (this.forced) {
        return Infinity;
      }
      var hidden = this.hiddenMs + (this.hiddenSince !== null ? now() - this.hiddenSince : 0);
      return this.options.time_budget_ms - (now() - this.startedAt - hidden);
    },

    // Resolves with the response text. Gives up when the file is bigger than
    // maxBytes, does not start like a JSON object, or takes the whole budget.
    _download: function (url, maxBytes) {
      var self = this;
      var controller = new AbortController();
      var timer;

      function checkTime() {
        if (self.forced) {
          return;
        }
        var remaining = self._remainingMs();
        if (remaining <= 0) {
          controller.abort();
        } else {
          timer = setTimeout(checkTime, remaining);
        }
      }
      checkTime();

      function finish() {
        clearTimeout(timer);
      }

      return fetch(url, {signal: controller.signal, credentials: "same-origin"})
        .then(function (response) {
          // resource_proxy answers 409 for files over its own size limit
          if (response.status === 409) {
            throw new Stop("too_big");
          }
          if (!response.ok) {
            throw new Error("HTTP " + response.status);
          }
          var length = parseInt(response.headers.get("Content-Length"), 10);
          if (length > maxBytes) {
            controller.abort();
            throw new Stop("large");
          }

          var reader = response.body.getReader();
          var chunks = [];
          var received = 0;

          function read() {
            return reader.read().then(function (result) {
              if (result.done) {
                return;
              }
              if (received === 0 && !self._startsLikeJsonObject(result.value)) {
                controller.abort();
                throw new Stop("not_geojson");
              }
              received += result.value.length;
              if (received > maxBytes) {
                controller.abort();
                throw new Stop("large");
              }
              chunks.push(result.value);
              return read();
            });
          }

          return read().then(function () {
            var bytes = new Uint8Array(received);
            var offset = 0;
            chunks.forEach(function (chunk) {
              bytes.set(chunk, offset);
              offset += chunk.length;
            });
            return new TextDecoder("utf-8").decode(bytes);
          });
        })
        .then(function (text) {
          finish();
          return text;
        }, function (err) {
          finish();
          if (err && err.name === "AbortError") {
            throw new Stop("large");
          }
          throw err;
        });
    },

    // GeoJSON is always a JSON object, so the first character after any
    // whitespace or UTF-8 byte order mark must be "{". Catches zip files
    // ("PK"), HTML error pages, CSV and so on without downloading them.
    _startsLikeJsonObject: function (bytes) {
      var i = 0;
      if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
        i = 3;
      }
      while (i < bytes.length && (bytes[i] === 0x20 || bytes[i] === 0x09 ||
             bytes[i] === 0x0A || bytes[i] === 0x0D)) {
        i++;
      }
      return i === bytes.length || bytes[i] === 0x7B;
    },

    _parse: function (text) {
      var data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Stop("not_geojson");
      }
      if (!data || GEOJSON_TYPES.indexOf(data.type) === -1) {
        throw new Stop("not_geojson");
      }
      if (this._remainingMs() <= 0) {
        throw new Stop("large");
      }
      return data;
    },

    _createMap: function () {
      if (this.map) {
        return;
      }
      // Before creating the map, so Leaflet sees its real size
      this._setFrameHeight(MAP_FRAME_HEIGHT);
      this.el.empty().append(jQuery("<div></div>").attr("id", "map"));
      this.map = ckan.commonLeafletMap('map', this.options.map_config, {attributionControl: false});

      // hack to make leaflet use a particular location to look for images
      L.Icon.Default.imagePath = this.options.site_url + 'js/vendor/leaflet/images/';

      // Covers the map until the features are on it
      this.spinner = jQuery("<div class='geojson-loading' aria-hidden='true'><div class='geojson-loading-spinner'></div></div>")
        .appendTo(this.map.getContainer());
    },

    // Builds the Leaflet layers off the map, sets the view from their bounds,
    // then moves them onto the map. Both loops run in slices so the budget can
    // be checked: Leaflet creates the markers' DOM only once a layer is on a
    // map with a view, and that is the slow part for big point files.
    _draw: function (data) {
      var self = this;
      var features = data.type === "FeatureCollection" ? (data.features || []) : [data];
      var batch = 200;

      var layer = L.Proj.geoJson(null, {
        style: self.options.style,
        onEachFeature: function (feature, featureLayer) {
          self._bindPopup(feature, featureLayer);
        }
      });

      return this._inSlices(Math.ceil(features.length / batch), function (i) {
        // Batches keep the file's crs so proj4leaflet reprojects them
        layer.addData({
          type: "FeatureCollection",
          crs: data.crs,
          features: features.slice(i * batch, (i + 1) * batch)
        });
      }).then(function () {
        var bounds = layer.getBounds();
        if (!bounds.isValid()) {
          throw new Stop("not_geojson");
        }

        self._createMap();
        self.map.fitBounds(bounds);

        // Hidden while filling, so the browser lays out and paints the
        // features once at the end instead of after every slice
        var panes = ["overlayPane", "shadowPane", "markerPane"].map(function (name) {
          return self.map.getPane(name);
        });
        panes.forEach(function (pane) {
          pane.style.display = "none";
        });

        var shown = L.featureGroup().addTo(self.map);
        var children = layer.getLayers();
        return self._inSlices(Math.ceil(children.length / batch), function (i) {
          children.slice(i * batch, (i + 1) * batch).forEach(function (child) {
            shown.addLayer(child);
          });
        }).then(function () {
          panes.forEach(function (pane) {
            pane.style.display = "";
          });
          self.spinner.remove();
        });
      });
    },

    // Calls work(0) .. work(count - 1), yielding to the browser every slice_ms
    // and rejecting with "large" once the time budget is used up.
    _inSlices: function (count, work) {
      var self = this;
      var i = 0;
      return new Promise(function (resolve, reject) {
        function step() {
          var started = now();
          try {
            while (i < count && now() - started < self.options.slice_ms) {
              work(i);
              i++;
            }
          } catch (e) {
            return reject(new Stop("not_geojson"));
          }

          if (self._remainingMs() <= 0) {
            return reject(new Stop("large"));
          }
          if (i < count) {
            return setTimeout(step, 0);
          }
          resolve();
        }
        step();
      });
    },

    _bindPopup: function (feature, layer) {
      var self = this;
      if (!feature.properties) {
        return;
      }
      var body = '';
      jQuery.each(feature.properties, function (key, value) {
        if (value != null && typeof value === 'object') {
          value = JSON.stringify(value);
        }
        body += L.Util.template(self.options.row, {key: key, value: value});
      });
      layer.bindPopup(L.Util.template(self.options.table, {body: body}));
    }
  };
});
