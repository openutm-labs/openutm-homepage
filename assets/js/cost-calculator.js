/*-----------------------------------
  OpenUTM Cost Calculator
  Usage-based (pay-as-you-use) estimate
------------------------------------*/

(function () {
  "use strict";

  /* Base prices per flight, in EUR (mid-range of each pricing band).
     Adjust these constants to change pricing. */
  var BASE_PRICES = {
    vlos: 0.3, /* Simple VLOS */
    evlos: 0.45, /* Specialized VLOS (EVLOS) */
    bvlos: 0.625 /* Complex/BVLOS (enabled for future use) */
  };

  var CURRENCY_KEY = "openutm_calc_currency";
  var DEFAULT_CURRENCY = "USD";
  var WEEKS_PER_MONTH = 4.33;

  var operationEl = document.getElementById("calc-operation");
  var flightsEl = document.getElementById("calc-flights");
  var flightsValueEl = document.getElementById("calc-flights-value");
  var currencyEl = document.getElementById("calc-currency");
  var rateNoteEl = document.getElementById("calc-rate-note");
  var weeklyEl = document.getElementById("calc-weekly");
  var monthlyEl = document.getElementById("calc-monthly");
  var eurEl = document.getElementById("calc-eur");

  var rates = null;
  var ratesLive = false;

  function getFlights() {
    return parseInt(flightsEl.value, 10) || 0;
  }

  function getPriceEur() {
    var op = operationEl.value;
    return BASE_PRICES[op] || null;
  }

  function render() {
    flightsValueEl.textContent = String(getFlights());

    var priceEur = getPriceEur();
    var currencyCode = currencyEl.value || DEFAULT_CURRENCY;

    if (!priceEur) {
      /* No operation selected yet */
      weeklyEl.textContent = "—";
      monthlyEl.textContent = "Select an operation type to see your estimate";
      eurEl.textContent = "";
      return;
    }

    var weeklyEur = getFlights() * priceEur;

    var converted = currencyService.convert(weeklyEur, currencyCode, rates);
    if (converted === null) {
      weeklyEl.textContent = "—";
      return;
    }

    weeklyEl.textContent = currencyService.format(converted, currencyCode);
    monthlyEl.textContent =
      "≈ " +
      currencyService.format(converted * WEEKS_PER_MONTH, currencyCode) +
      " per month";
    eurEl.textContent =
      "Weekly cost in EUR: " + currencyService.formatEur(weeklyEur);
  }

  function renderRateNote(info) {
    if (!info || info.live) {
      rateNoteEl.textContent =
        "Live rates via Frankfurter (ECB), 1 EUR ≈ " +
        (rates && rates[currencyEl.value]
          ? Number(rates[currencyEl.value]).toFixed(2) + " " + currencyEl.value
          : "—");
    } else {
      rateNoteEl.textContent =
        "Indicative offline rates — connect to the internet for live ECB rates.";
    }
  }

  function loadRates() {
    return currencyService.fetchRates().then(function (info) {
      rates = info.rates;
      ratesLive = info.live;
      render();
      renderRateNote(info);
    });
  }

  function initCurrencySelect() {
    var saved = null;
    try {
      saved = localStorage.getItem(CURRENCY_KEY);
    } catch (e) {
      /* storage unavailable */
    }
    if (!currencyService.getCurrency(saved)) {
      saved = DEFAULT_CURRENCY;
    }
    /* Remove the loading placeholder, then populate with real currencies */
    while (currencyEl.firstChild) {
      currencyEl.removeChild(currencyEl.firstChild);
    }
    currencyService.populateSelect(currencyEl, saved);
    currencyEl.value = saved;
  }

  function init() {
    initCurrencySelect();

    operationEl.addEventListener("change", render);
    flightsEl.addEventListener("input", render);
    currencyEl.addEventListener("change", function () {
      try {
        localStorage.setItem(CURRENCY_KEY, currencyEl.value);
      } catch (e) {
        /* storage unavailable */
      }
      render();
      renderRateNote({ live: ratesLive });
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
