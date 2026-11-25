/**
 * MADAR — مَدار | Global Store Configuration
 * Tripoli, Lebanon — Delivery across all Lebanon
 *
 * Edit EXCHANGE_RATE_LBP here to update LBP prices site-wide automatically.
 * Classic script (no ES modules) so index.html works directly via file:// double-click.
 */

(function (global) {
  'use strict';

  var STORE_CONFIG = {
    // Single editable exchange rate constant (LBP per 1 USD)
    EXCHANGE_RATE_LBP: 89500,

    // WhatsApp & Phone contact (Tripoli, Lebanon)
    WHATSAPP_NUMBER: '96171074246',
    PHONE_DISPLAY_EN: '+961 71 074 246',
    PHONE_DISPLAY_AR: '71 074 246 961+',
    PHONE_HREF: 'tel:+96171074246',

    // Store metadata
    BRAND_NAME_AR: 'مَدار',
    BRAND_NAME_EN: 'MADAR',
    CITY_AR: 'طرابلس، لبنان',
    CITY_EN: 'Tripoli, Lebanon',
    DEFAULT_LANG: 'ar',

    // Free delivery threshold in USD
    FREE_DELIVERY_THRESHOLD_USD: 60,

    // Special Offer countdown duration (auto-rolls ahead if expired)
    OFFER_DURATION_HOURS: 71,

    // Category mood themes (dynamic visual palette per category)
    CATEGORY_MOODS: {
      all: 'all',
      men: 'men',
      women: 'women',
      kids: 'kids',
      shoes: 'shoes',
      accessories: 'accessories'
    }
  };

  function formatUSD(amount) {
    var num = Number(amount) || 0;
    return Math.floor(num) === num ? '$' + num : '$' + num.toFixed(2);
  }

  function toLBP(usd) {
    var raw = (Number(usd) || 0) * STORE_CONFIG.EXCHANGE_RATE_LBP;
    return Math.round(raw / 1000) * 1000;
  }

  function formatLBP(usd, lang) {
    var lbp = toLBP(usd);
    var formatted = lbp.toLocaleString('en-US');
    return (lang || 'ar') === 'ar' ? formatted + ' ل.ل' : formatted + ' L.L';
  }

  function formatDualPrice(usd, lang) {
    return formatUSD(usd) + ' — ' + formatLBP(usd, lang);
  }

  global.MADAR_CONFIG = STORE_CONFIG;
  global.MADAR_FORMAT = {
    formatUSD: formatUSD,
    toLBP: toLBP,
    formatLBP: formatLBP,
    formatDualPrice: formatDualPrice
  };
})(window);
