/*-----------------------------------
  OpenUTM Pricing Table
  KES is the quoted/billed currency.
  USD, EUR and other equivalents convert
  live from the EUR base via Frankfurter
  (ECB reference rates).
------------------------------------*/

(function () {
  "use strict";

  var CURRENCY_KEY = "openutm_pricing_currency";
  var DEFAULT_CURRENCY = "USD";
  /* Secondary (reference) currency shown alongside the selected one.
     EUR is the conversion base; fall back to USD when EUR is primary. */
  var SECONDARY_FALLBACK = "EUR";

  var currencyEl = document.getElementById("pricing-currency");
  var rateNoteEl = document.getElementById("pricing-rate-note");
  var priceAmounts = document.querySelectorAll(".price-amount");

  var rates = null;
  var rateDate = null;
  var ratesLive = false;

  function getSecondaryCode(primary) {
    return primary === "EUR" ? "USD" : SECONDARY_FALLBACK;
  }

  function renderPrice(el, eurAmount, code) {
    var converted = currencyService.convert(eurAmount, code, rates);
    if (converted === null) {
      el.textContent = "—";
      return;
    }
    var suffix = el.getAttribute("data-suffix") || "";
    var formatted = currencyService.formatPrice(converted, code);
    el.textContent = suffix ? formatted + " " + suffix : formatted;
  }

  function render() {
    if (!currencyEl || !priceAmounts.length) return;

    var primaryCode = currencyEl.value || DEFAULT_CURRENCY;
    var secondaryCode = getSecondaryCode(primaryCode);

    priceAmounts.forEach(function (el) {
      var eur = parseFloat(el.getAttribute("data-eur"));
      if (isNaN(eur)) return;
      if (el.classList.contains("price-primary")) {
        renderPrice(el, eur, primaryCode);
      } else {
        /* price-secondary and overage-eq use the secondary currency */
        renderPrice(el, eur, secondaryCode);
      }
    });
  }

  function renderRateNote(info) {
    if (!rateNoteEl || !currencyEl) return;
    var primaryCode = currencyEl.value || DEFAULT_CURRENCY;

    if (info && info.live) {
      var rate = rates && rates[primaryCode] ? Number(rates[primaryCode]) : null;
      var rateStr = rate ? rate.toFixed(4) + " " + primaryCode : "—";
      var dateStr = info.date ? " · ECB reference " + info.date : "";
      rateNoteEl.textContent =
        "Live rates via Frankfurter (ECB) — 1 EUR ≈ " + rateStr + dateStr + ".";
    } else {
      rateNoteEl.textContent =
        "Indicative offline rates — connect to the internet for live ECB rates.";
    }
  }

  function loadRates() {
    return currencyService.fetchRates().then(function (info) {
      rates = info.rates;
      rateDate = info.date;
      ratesLive = info.live;
      render();
      renderRateNote(info);
    });
  }

  function initCurrencySelect() {
    if (!currencyEl) return;
    var saved = null;
    try {
      saved = localStorage.getItem(CURRENCY_KEY);
    } catch (e) {
      /* storage unavailable */
    }
    if (!currencyService.getCurrency(saved)) {
      saved = DEFAULT_CURRENCY;
    }
    /* Replace the loading placeholder with the real currency list */
    while (currencyEl.firstChild) {
      currencyEl.removeChild(currencyEl.firstChild);
    }
    currencyService.populateSelect(currencyEl, saved);
    currencyEl.value = saved;
  }

  function init() {
    if (!currencyEl) return;

    initCurrencySelect();

    currencyEl.addEventListener("change", function () {
      try {
        localStorage.setItem(CURRENCY_KEY, currencyEl.value);
      } catch (e) {
        /* storage unavailable */
      }
      render();
      renderRateNote({ live: ratesLive, date: rateDate });
    });

    render();
    loadRates();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
