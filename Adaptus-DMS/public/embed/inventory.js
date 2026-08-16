/**
 * FlashFender dealership inventory embed — full Active lot for one rooftop.
 * Usage:
 *   <div data-adaptus-inventory data-dealership="UUID" data-token="aix_…"></div>
 *   <script async src="https://YOUR_HOST/embed/inventory.js"></script>
 *
 * Filters: Make / Model / Year (Brown Boys–style All Inventory). Load more pages
 * until the full Active catalog is shown. Click: hosted /embed/vehicles/{id}
 * unless data-vdp-base or data-vdp="showroom".
 */
(function () {
  "use strict";

  var ATTR = "data-adaptus-inventory";
  var STYLE_ID = "adaptus-inventory-embed-css";
  var HEIGHT_MSG = "flashfender-embed-height";
  var ACCENT = "#00AEEF";

  function scriptOrigin() {
    var scripts = document.getElementsByTagName("script");
    for (var i = scripts.length - 1; i >= 0; i--) {
      var src = scripts[i].src || "";
      if (src.indexOf("/embed/inventory.js") !== -1) {
        try {
          return new URL(src).origin;
        } catch (_e) {
          /* fall through */
        }
      }
    }
    return window.location.origin;
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css =
      ".adaptus-inv{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:inherit;background:transparent;box-sizing:border-box}" +
      ".adaptus-inv *,.adaptus-inv *:before,.adaptus-inv *:after{box-sizing:border-box}" +
      ".adaptus-inv__status{padding:1.25rem;text-align:center;opacity:.7;font-size:.875rem}" +
      ".adaptus-inv__grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:1rem}" +
      ".adaptus-inv__card{display:flex;flex-direction:column;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;background:#fff;color:#0f172a;text-decoration:none;transition:border-color .15s ease,box-shadow .15s ease}" +
      ".adaptus-inv__card:hover{border-color:" +
      ACCENT +
      ";box-shadow:0 4px 14px rgba(0,174,239,.18)}" +
      ".adaptus-inv__photo{aspect-ratio:16/10;background:#f1f5f9;overflow:hidden}" +
      ".adaptus-inv__photo img{width:100%;height:100%;object-fit:cover;display:block}" +
      ".adaptus-inv__body{padding:.85rem 1rem 1rem;display:flex;flex-direction:column;gap:.35rem;flex:1}" +
      ".adaptus-inv__title{font-size:1rem;font-weight:650;line-height:1.25;margin:0;letter-spacing:-.01em}" +
      ".adaptus-inv__meta{font-size:.75rem;color:#64748b;margin:0}" +
      ".adaptus-inv__price{font-size:1.05rem;font-weight:700;margin-top:auto;padding-top:.5rem;font-variant-numeric:tabular-nums;color:" +
      ACCENT +
      "}" +
      ".adaptus-inv__hdr{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:.75rem;margin-bottom:.85rem}" +
      ".adaptus-inv__hdr h2{font-size:1.125rem;font-weight:700;margin:0;letter-spacing:-.02em}" +
      ".adaptus-inv__hdr p{font-size:.75rem;opacity:.7;margin:0}" +
      ".adaptus-inv__tools{display:grid;grid-template-columns:repeat(auto-fit,minmax(8.5rem,1fr));gap:.5rem;margin-bottom:.85rem}" +
      ".adaptus-inv__select,.adaptus-inv__search{width:100%;min-width:0;height:2.25rem;border:1px solid #e2e8f0;border-radius:.5rem;padding:0 .6rem;font-size:.8125rem;background:#fff;color:#0f172a}" +
      ".adaptus-inv__select:focus,.adaptus-inv__search:focus{outline:2px solid " +
      ACCENT +
      ";outline-offset:1px;border-color:" +
      ACCENT +
      "}" +
      ".adaptus-inv__find{height:2.25rem;border:0;border-radius:.5rem;background:" +
      ACCENT +
      ";color:#fff;font-size:.8125rem;font-weight:600;cursor:pointer}" +
      ".adaptus-inv__more{display:block;width:100%;margin-top:1rem;min-height:2.5rem;border:1px solid " +
      ACCENT +
      ";background:transparent;color:" +
      ACCENT +
      ";border-radius:.5rem;font-size:.875rem;font-weight:600;cursor:pointer}" +
      ".adaptus-inv__more:hover{background:rgba(0,174,239,.08)}";
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function formatPrice(n) {
    if (n == null || n === "" || isNaN(Number(n))) return "Call for price";
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "CAD",
        maximumFractionDigits: 0,
      }).format(Number(n));
    } catch (_e) {
      return "$" + Number(n).toLocaleString();
    }
  }

  function formatMiles(n) {
    if (n == null || n === "") return "";
    return Number(n).toLocaleString() + " km";
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function reportHeight(el) {
    if (window.parent === window) return;
    var h = Math.ceil(el.getBoundingClientRect().height || el.scrollHeight || 0);
    window.parent.postMessage({ type: HEIGHT_MSG, height: h + 16 }, "*");
  }

  function injectJsonLd(vehicles) {
    if (!vehicles || !vehicles.length) return;
    var existing = document.getElementById("adaptus-inv-jsonld");
    if (existing) existing.remove();
    var graph = vehicles.map(function (v) {
      var price = v.special_price != null ? v.special_price : v.retail_price;
      var photos = v.photos && v.photos.length ? v.photos : v.photo ? [v.photo] : [];
      var node = {
        "@context": "https://schema.org",
        "@type": "Car",
        name: [v.year, v.make, v.model, v.trim].filter(Boolean).join(" "),
        brand: { "@type": "Brand", name: v.make },
        model: v.model,
        vehicleModelDate: v.year,
        color: v.exterior_color || undefined,
        image: photos.length ? photos : undefined,
      };
      // Never emit a VIN (masked or full) — photo filenames can still carry one in `image`.
      if (v.odometer != null) {
        node.mileageFromOdometer = {
          "@type": "QuantitativeValue",
          value: v.odometer,
          unitCode: "KMT",
        };
      }
      if (price != null) {
        node.offers = {
          "@type": "Offer",
          priceCurrency: "CAD",
          price: price,
          availability: "https://schema.org/InStock",
        };
      }
      return node;
    });
    var script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "adaptus-inv-jsonld";
    script.textContent = JSON.stringify(graph.length === 1 ? graph[0] : graph)
      .replace(/</g, "\\u003c")
      .replace(/>/g, "\\u003e")
      .replace(/&/g, "\\u0026");
    document.head.appendChild(script);
  }

  function cardHref(el, v, origin, dealer) {
    var vdpBase = el.getAttribute("data-vdp-base") || "";
    var vdpMode = (el.getAttribute("data-vdp") || "").toLowerCase();
    var slug = (dealer && dealer.slug) || "";
    var originClean = (origin || "").replace(/\/$/, "");
    if (vdpBase) {
      return (
        vdpBase.replace(/\/$/, "") +
        (vdpBase.indexOf("?") >= 0 ? "&" : "/") +
        encodeURIComponent(v.id)
      );
    }
    if (vdpMode === "showroom" && slug) {
      return (
        originClean +
        "/showroom/" +
        encodeURIComponent(slug) +
        "?vehicle=" +
        encodeURIComponent(v.id)
      );
    }
    return originClean + "/embed/vehicles/" + encodeURIComponent(v.id);
  }

  function pageSize(el) {
    var n = parseInt(el.getAttribute("data-limit") || "12", 10);
    if (isNaN(n) || n < 1) return 12;
    return Math.min(n, 100);
  }

  function optionList(values, selected, emptyLabel) {
    var html = '<option value="">' + esc(emptyLabel) + "</option>";
    for (var i = 0; i < values.length; i++) {
      var val = String(values[i]);
      html +=
        '<option value="' +
        esc(val) +
        '"' +
        (val === selected ? " selected" : "") +
        ">" +
        esc(val) +
        "</option>";
    }
    return html;
  }

  function modelOptions(facets, make, selected) {
    var list = [];
    if (make && facets && facets.modelsByMake && facets.modelsByMake[make]) {
      list = facets.modelsByMake[make];
    }
    return optionList(list, selected, make ? "All models" : "Select make first");
  }

  function render(el, state) {
    var payload = state.payload;
    var vehicles = payload.data || [];
    var dealer = payload.dealership || {};
    var origin = state.origin;
    var total = Number(payload.count || vehicles.length) || 0;
    var facets = payload.facets || el._adaptusFacets || { makes: [], modelsByMake: {}, years: [] };
    el._adaptusFacets = facets;

    var make = el.getAttribute("data-make") || "";
    var model = el.getAttribute("data-model") || "";
    var year = el.getAttribute("data-year") || "";
    var q = state.q || el.getAttribute("data-q") || "";

    var hdr =
      '<div class="adaptus-inv__hdr"><h2>All Inventory</h2><p>' +
      total +
      " vehicle" +
      (total === 1 ? "" : "s") +
      (dealer.name ? " · " + esc(dealer.name) : "") +
      "</p></div>";

    var tools =
      '<form class="adaptus-inv__tools" data-adaptus-filters>' +
      '<select class="adaptus-inv__select" name="make" aria-label="Make">' +
      optionList(facets.makes || [], make, "All makes") +
      "</select>" +
      '<select class="adaptus-inv__select" name="model" aria-label="Model"' +
      (make ? "" : " disabled") +
      ">" +
      modelOptions(facets, make, model) +
      "</select>" +
      '<select class="adaptus-inv__select" name="year" aria-label="Year">' +
      optionList((facets.years || []).map(String), year, "All years") +
      "</select>" +
      '<input class="adaptus-inv__search" type="search" name="q" maxlength="80" placeholder="Stock # or keyword" value="' +
      esc(q) +
      '" />' +
      '<button type="submit" class="adaptus-inv__find">Find</button>' +
      "</form>";

    if (!vehicles.length) {
      el.innerHTML =
        '<div class="adaptus-inv">' +
        hdr +
        tools +
        '<div class="adaptus-inv__status">No vehicles available right now.</div></div>';
      bindFilters(el);
      reportHeight(el);
      return;
    }

    var cards = vehicles
      .map(function (v) {
        var title = [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ");
        var photo = v.photo || (v.photos && v.photos[0]) || "";
        var price = formatPrice(
          v.special_price != null ? v.special_price : v.retail_price
        );
        var metaParts = [];
        if (v.stock_number) metaParts.push("Stock #" + v.stock_number);
        if (v.odometer != null) metaParts.push(formatMiles(v.odometer));
        if (v.exterior_color) metaParts.push(v.exterior_color);
        var href = cardHref(el, v, origin, dealer);
        return (
          '<a class="adaptus-inv__card" href="' +
          esc(href) +
          '" target="_blank" rel="noopener">' +
          '<div class="adaptus-inv__photo">' +
          (photo
            ? '<img src="' +
              esc(photo) +
              '" alt="' +
              esc(title) +
              '" loading="lazy" />'
            : "") +
          "</div>" +
          '<div class="adaptus-inv__body">' +
          '<p class="adaptus-inv__title">' +
          esc(title) +
          "</p>" +
          '<p class="adaptus-inv__meta">' +
          esc(metaParts.join(" · ")) +
          "</p>" +
          '<p class="adaptus-inv__price">' +
          esc(price) +
          "</p>" +
          "</div></a>"
        );
      })
      .join("");

    var more =
      vehicles.length < total
        ? '<button type="button" class="adaptus-inv__more" data-adaptus-more>Load more</button>'
        : "";

    el.innerHTML =
      '<div class="adaptus-inv">' +
      hdr +
      tools +
      '<div class="adaptus-inv__grid">' +
      cards +
      "</div>" +
      more +
      "</div>";

    if (el.getAttribute("data-jsonld") === "1") {
      injectJsonLd(vehicles);
    }
    bindFilters(el);
    var moreBtn = el.querySelector("[data-adaptus-more]");
    if (moreBtn) {
      moreBtn.addEventListener("click", function () {
        load(el, { append: true });
      });
    }
    reportHeight(el);
  }

  function readFilters(form, el) {
    var make = form.querySelector('[name="make"]');
    var model = form.querySelector('[name="model"]');
    var year = form.querySelector('[name="year"]');
    var q = form.querySelector('[name="q"]');
    el.setAttribute("data-make", make && make.value ? make.value : "");
    el.setAttribute("data-model", model && model.value ? model.value : "");
    el.setAttribute("data-year", year && year.value ? year.value : "");
    el.setAttribute("data-q", q && q.value ? q.value : "");
  }

  function bindFilters(el) {
    var form = el.querySelector("[data-adaptus-filters]");
    if (!form) return;
    var makeSel = form.querySelector('[name="make"]');
    var modelSel = form.querySelector('[name="model"]');
    if (makeSel && modelSel) {
      makeSel.addEventListener("change", function () {
        var make = makeSel.value;
        var facets = el._adaptusFacets || { modelsByMake: {} };
        modelSel.innerHTML = modelOptions(facets, make, "");
        modelSel.disabled = !make;
      });
    }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      readFilters(form, el);
      el.setAttribute("data-offset", "0");
      load(el, { append: false });
    });
  }

  function fetchInventory(el, origin, offset) {
    var dealership = el.getAttribute("data-dealership") || "";
    var slug = el.getAttribute("data-slug") || "";
    var token = el.getAttribute("data-token") || "";
    var q = el.getAttribute("data-q") || "";
    var make = el.getAttribute("data-make") || "";
    var model = el.getAttribute("data-model") || "";
    var year = el.getAttribute("data-year") || "";
    var limit = pageSize(el);

    var qs = [];
    if (dealership) qs.push("dealership_id=" + encodeURIComponent(dealership));
    if (slug) qs.push("slug=" + encodeURIComponent(slug));
    if (token) qs.push("token=" + encodeURIComponent(token));
    if (q) qs.push("q=" + encodeURIComponent(q));
    if (make) qs.push("make=" + encodeURIComponent(make));
    if (model) qs.push("model=" + encodeURIComponent(model));
    if (year) qs.push("year=" + encodeURIComponent(year));
    qs.push("limit=" + encodeURIComponent(String(limit)));
    qs.push("offset=" + encodeURIComponent(String(offset)));
    qs.push("jsonld=0");

    var url = origin.replace(/\/$/, "") + "/api/vehicles/public?" + qs.join("&");
    return fetch(url, { credentials: "omit" }).then(function (res) {
      return res.json().then(function (body) {
        if (!res.ok) throw new Error(body.error || "Failed to load inventory");
        return body;
      });
    });
  }

  function load(el, opts) {
    var append = !!(opts && opts.append);
    var origin = el.getAttribute("data-api-origin") || scriptOrigin();
    var offset = append ? parseInt(el.getAttribute("data-offset") || "0", 10) : 0;
    if (isNaN(offset) || offset < 0) offset = 0;

    if (!append) {
      el.innerHTML =
        '<div class="adaptus-inv"><div class="adaptus-inv__status">Loading inventory…</div></div>';
    }

    fetchInventory(el, origin, offset)
      .then(function (payload) {
        var prev = el._adaptusVehicles || [];
        var next = payload.data || [];
        var merged = append ? prev.concat(next) : next;
        if (payload.facets) el._adaptusFacets = payload.facets;
        payload = Object.assign({}, payload, {
          data: merged,
          facets: payload.facets || el._adaptusFacets,
        });
        el._adaptusVehicles = merged;
        el.setAttribute("data-offset", String(offset + next.length));
        render(el, {
          payload: payload,
          origin: origin,
          q: el.getAttribute("data-q") || "",
        });
      })
      .catch(function (err) {
        el.innerHTML =
          '<div class="adaptus-inv"><div class="adaptus-inv__status">' +
          esc(err.message || "Unable to load inventory") +
          "</div></div>";
        reportHeight(el);
      });
  }

  function mount(el) {
    ensureStyles();
    var dealership = el.getAttribute("data-dealership") || "";
    var slug = el.getAttribute("data-slug") || "";
    var token = el.getAttribute("data-token") || "";

    if (!dealership && !slug && !token) {
      el.innerHTML =
        '<div class="adaptus-inv"><div class="adaptus-inv__status">Missing dealership scope (data-dealership, data-slug, or data-token).</div></div>';
      return;
    }

    el.setAttribute("data-offset", "0");
    el._adaptusVehicles = [];
    load(el, { append: false });
  }

  function boot() {
    var nodes = document.querySelectorAll("[" + ATTR + "]");
    for (var i = 0; i < nodes.length; i++) mount(nodes[i]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.AdaptusInventoryEmbed = { refresh: boot };
})();
