/*-----------------------------------
  Currency Service for OpenUTM
  Exchange rates via Frankfurter API
  (ECB reference rates, base = EUR)
------------------------------------*/

(function (global) {
  "use strict";

  /* Supported currencies. "frankfurter" currencies get live ECB rates;
     the rest fall back to indicative static rates (EUR-based). */
  var CURRENCIES = [
    { code: "USD", name: "US Dollar", flag: "🇺🇸", frankfurter: true, fallback: 1.08 },
    { code: "EUR", name: "Euro", flag: "🇪🇺", frankfurter: true, fallback: 1 },
    { code: "GBP", name: "British Pound", flag: "🇬🇧", frankfurter: true, fallback: 0.85 },
    { code: "JPY", name: "Japanese Yen", flag: "🇯🇵", frankfurter: true, fallback: 165 },
    { code: "AUD", name: "Australian Dollar", flag: "🇦🇺", frankfurter: true, fallback: 1.65 },
    { code: "CAD", name: "Canadian Dollar", flag: "🇨🇦", frankfurter: true, fallback: 1.48 },
    { code: "CHF", name: "Swiss Franc", flag: "🇨🇭", frankfurter: true, fallback: 0.95 },
    { code: "HKD", name: "Hong Kong Dollar", flag: "🇭🇰", frankfurter: true, fallback: 8.45 },
    { code: "NZD", name: "New Zealand Dollar", flag: "🇳🇿", frankfurter: true, fallback: 1.8 },
    { code: "SEK", name: "Swedish Krona", flag: "🇸🇪", frankfurter: true, fallback: 11.3 },
    { code: "KRW", name: "South Korean Won", flag: "🇰🇷", frankfurter: true, fallback: 1480 },
    { code: "SGD", name: "Singapore Dollar", flag: "🇸🇬", frankfurter: true, fallback: 1.46 },
    { code: "NOK", name: "Norwegian Krone", flag: "🇳🇴", frankfurter: true, fallback: 11.7 },
    { code: "MXN", name: "Mexican Peso", flag: "🇲🇽", frankfurter: true, fallback: 20.5 },
    { code: "INR", name: "Indian Rupee", flag: "🇮🇳", frankfurter: true, fallback: 90 },
    { code: "RUB", name: "Russian Ruble", flag: "🇷🇺", frankfurter: false, fallback: 92 },
    { code: "ZAR", name: "South African Rand", flag: "🇿🇦", frankfurter: true, fallback: 19.8 },
    { code: "TRY", name: "Turkish Lira", flag: "🇹🇷", frankfurter: true, fallback: 37 },
    { code: "BRL", name: "Brazilian Real", flag: "🇧🇷", frankfurter: true, fallback: 5.9 },
    { code: "TWD", name: "Taiwan Dollar", flag: "🇹🇼", frankfurter: false, fallback: 35.5 },
    { code: "DKK", name: "Danish Krone", flag: "🇩🇰", frankfurter: true, fallback: 7.46 },
    { code: "PLN", name: "Polish Zloty", flag: "🇵🇱", frankfurter: true, fallback: 4.3 },
    { code: "THB", name: "Thai Baht", flag: "🇹🇭", frankfurter: true, fallback: 39 },
    { code: "IDR", name: "Indonesian Rupiah", flag: "🇮🇩", frankfurter: true, fallback: 17500 },
    { code: "HUF", name: "Hungarian Forint", flag: "🇭🇺", frankfurter: true, fallback: 395 },
    { code: "CZK", name: "Czech Koruna", flag: "🇨🇿", frankfurter: true, fallback: 25.2 },
    { code: "ILS", name: "Israeli Shekel", flag: "🇮🇱", frankfurter: true, fallback: 4.0 },
    { code: "CLP", name: "Chilean Peso", flag: "🇨🇱", frankfurter: false, fallback: 1030 },
    { code: "PHP", name: "Philippine Peso", flag: "🇵🇭", frankfurter: true, fallback: 62 },
    { code: "AED", name: "UAE Dirham", flag: "🇦🇪", frankfurter: false, fallback: 3.97 },
    { code: "SAR", name: "Saudi Riyal", flag: "🇸🇦", frankfurter: false, fallback: 4.06 },
    { code: "MYR", name: "Malaysian Ringgit", flag: "🇲🇾", frankfurter: true, fallback: 5.1 },
    { code: "COP", name: "Colombian Peso", flag: "🇨🇴", frankfurter: false, fallback: 4400 }
  ];

  var BASE = "EUR";
  var CACHE_KEY = "openutm_exchange_rates";
  var CACHE_TTL_MS = 12 * 60 * 60 * 1000; /* 12 hours */
  var API_ENDPOINTS = [
    "https://api.frankfurter.dev/v1/latest?base=" + BASE,
    "https://api.frankfurter.app/latest?from=" + BASE
  ];

  /* ------- Cache helpers (localStorage) ------- */

  function readCache() {
    try {
      var raw = global.localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var cached = JSON.parse(raw);
      if (!cached || !cached.rates || !cached.fetchedAt) return null;
      if (Date.now() - cached.fetchedAt > CACHE_TTL_MS) return null; /* stale */
      return cached;
    } catch (e) {
      return null;
    }
  }

  function writeCache(rates) {
    try {
      global.localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ rates: rates, fetchedAt: Date.now() })
      );
    } catch (e) {
      /* storage unavailable - cache simply not persisted */
    }
  }

  /* ------- Fetching ------- */

  function ratesFrom(currencies) {
    var rates = { EUR: 1 };
    currencies.forEach(function (c) {
      rates[c.code] = c.fallback;
    });
    return rates;
  }

  function fetchRates() {
    /* Merged static rates: live Frankfurter values override the fallbacks. */
    var merged = ratesFrom(CURRENCIES);

    return new Promise(function (resolve) {
      var cached = readCache();
      if (cached) {
        Object.keys(cached.rates).forEach(function (code) {
          merged[code] = cached.rates[code];
        });
        resolve({ rates: merged, live: true, source: "cached" });
        return;
      }

      var attempt = function (index) {
        if (index >= API_ENDPOINTS.length) {
          resolve({ rates: merged, live: false, source: "fallback" });
          return;
        }
        fetch(API_ENDPOINTS[index])
          .then(function (resp) {
            if (!resp.ok) throw new Error("HTTP " + resp.status);
            return resp.json();
          })
          .then(function (data) {
            if (!data || !data.rates) throw new Error("Bad response");
            var live = { EUR: 1 };
            CURRENCIES.forEach(function (c) {
              if (c.frankfurter && typeof data.rates[c.code] === "number") {
                live[c.code] = data.rates[c.code];
              }
            });
            writeCache(live);
            Object.keys(live).forEach(function (code) {
              merged[code] = live[code];
            });
            resolve({ rates: merged, live: true, source: "frankfurter" });
          })
          .catch(function () {
            attempt(index + 1);
          });
      };

      attempt(0);
    });
  }

  /* ------- Public helpers ------- */

  function getCurrency(code) {
    for (var i = 0; i < CURRENCIES.length; i++) {
      if (CURRENCIES[i].code === code) return CURRENCIES[i];
    }
    return null;
  }

  function convert(amountInEur, code, rates) {
    var currency = getCurrency(code);
    if (!currency) return null;
    var rate = rates && rates[code] ? rates[code] : currency.fallback;
    return amountInEur * rate;
  }

  function format(amount, code) {
    var digits = amount >= 1000 ? 0 : amount >= 1 ? 2 : 4;
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: code,
        minimumFractionDigits: 0,
        maximumFractionDigits: digits
      }).format(amount);
    } catch (e) {
      /* Unknown currency code on this browser */
      return code + " " + amount.toFixed(digits);
    }
  }

  function formatEur(amountInEur) {
    return format(amountInEur, "EUR");
  }

  /* Populate a <select> with all supported currencies. */
  function populateSelect(selectEl, selectedCode) {
    if (!selectEl) return;
    CURRENCIES.forEach(function (c) {
      var option = global.document.createElement("option");
      option.value = c.code;
      option.textContent =
        c.flag + "  " + c.code + " — " + c.name + (c.frankfurter ? "" : " *");
      if (selectedCode === c.code) option.selected = true;
      selectEl.appendChild(option);
    });
  }

  global.currencyService = {
    BASE: BASE,
    CURRENCIES: CURRENCIES,
    fetchRates: fetchRates,
    getCurrency: getCurrency,
    convert: convert,
    format: format,
    formatEur: formatEur,
    populateSelect: populateSelect
  };
})(window);
