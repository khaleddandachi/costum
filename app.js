/**
 * MADAR — مَدار | Main Storefront Application
 * Classic non-module script: works seamlessly both via direct file:// double-click AND HTTP servers.
 * Bilingual AR/EN (RTL/LTR), Dynamic Category Moods, Cart + WhatsApp Checkout,
 * Wishlist, Quick View with Zoom, Search/Filter/Sort, Countdown, Sparkle Burst.
 */

(function () {
  'use strict';

  var STORE_CONFIG = window.MADAR_CONFIG || {
    EXCHANGE_RATE_LBP: 89500,
    WHATSAPP_NUMBER: '96171074246',
    DEFAULT_LANG: 'ar',
    FREE_DELIVERY_THRESHOLD_USD: 60,
    OFFER_DURATION_HOURS: 71,
    CATEGORY_MOODS: { all: 'all', men: 'men', women: 'women', kids: 'kids', shoes: 'shoes', accessories: 'accessories' }
  };

  var fmt = window.MADAR_FORMAT || {
    formatUSD: function (a) { return '$' + (Number(a) || 0); },
    formatLBP: function (a, l) {
      var v = Math.round(((Number(a) || 0) * STORE_CONFIG.EXCHANGE_RATE_LBP) / 1000) * 1000;
      return v.toLocaleString('en-US') + (l === 'ar' ? ' ل.ل' : ' L.L');
    },
    formatDualPrice: function (a, l) { return fmt.formatUSD(a) + ' — ' + fmt.formatLBP(a, l); }
  };

  var formatUSD = fmt.formatUSD;
  var formatLBP = fmt.formatLBP;
  var formatDualPrice = fmt.formatDualPrice;
  var TRANSLATIONS = window.MADAR_TRANSLATIONS || { ar: {}, en: {} };

  /* ==================== SAFE STORAGE HELPERS ==================== */
  function safeStorageGet(key, fallback) {
    try {
      var v = window.localStorage.getItem(key);
      return v !== null ? v : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function safeStorageSet(key, val) {
    try {
      window.localStorage.setItem(key, val);
    } catch (e) {
      // Ignore storage quota / privacy mode errors
    }
  }

  function safeJsonParse(raw, fallback) {
    try {
      var parsed = JSON.parse(raw);
      return parsed !== null && parsed !== undefined ? parsed : fallback;
    } catch (e) {
      return fallback;
    }
  }

  /* ==================== STATE ==================== */
  var state = {
    lang: safeStorageGet('madar_lang', STORE_CONFIG.DEFAULT_LANG),
    theme: safeStorageGet('madar_theme', 'light'),
    products: Array.isArray(window.MADAR_PRODUCTS) ? window.MADAR_PRODUCTS : [],
    category: 'all',
    tab: 'all',
    search: '',
    maxPrice: 80,
    sort: 'featured',
    selectedRegionId: safeStorageGet('madar_region', 'tripoli'),
    cart: safeJsonParse(safeStorageGet('madar_cart', '[]'), []),
    wishlist: safeJsonParse(safeStorageGet('madar_wishlist', '[]'), []),
    cardSelections: {},
    quickViewProductId: null,
    qvColorIdx: 0,
    qvSizeIdx: 0,
    sgTab: 'adults'
  };

  /* ==================== DOM & I18N HELPERS ==================== */
  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function t(key) {
    var dict = TRANSLATIONS[state.lang] || TRANSLATIONS.ar || {};
    if (dict[key] !== undefined) return dict[key];
    return (TRANSLATIONS.ar && TRANSLATIONS.ar[key] !== undefined) ? TRANSLATIONS.ar[key] : key;
  }

  function getFallbackSvg(title) {
    var safe = encodeURIComponent(String(title || 'MADAR').slice(0, 22));
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='750' viewBox='0 0 600 750'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0%25' stop-color='%23FF4D2E'/%3E%3Cstop offset='100%25' stop-color='%231D4ED8'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='600' height='750' fill='url(%23g)'/%3E%3Ctext x='50%25' y='48%25' text-anchor='middle' fill='white' font-family='sans-serif' font-size='34' font-weight='800'%3EMADAR%3C/text%3E%3Ctext x='50%25' y='55%25' text-anchor='middle' fill='rgba(255,255,255,0.85)' font-family='sans-serif' font-size='20'%3E" + safe + '%3C/text%3E%3C/svg%3E';
  }

  function attachImageFallbacks(root) {
    $$('img', root || document).forEach(function (img) {
      if (img.dataset.fbBound) return;
      img.dataset.fbBound = '1';
      img.addEventListener('error', function () {
        if (!img.dataset.errored) {
          img.dataset.errored = '1';
          img.src = getFallbackSvg(img.dataset.fallbackTitle || img.alt || 'MADAR');
        }
      });
    });
  }

  function getProductName(p) {
    return state.lang === 'ar' ? p.name_ar : p.name_en;
  }

  function getProductDesc(p) {
    return state.lang === 'ar' ? p.desc_ar : p.desc_en;
  }

  function getColorName(c) {
    if (!c) return '-';
    return state.lang === 'ar' ? c.name_ar : c.name_en;
  }

  function getCategoryLabel(cat) {
    var map = {
      all: 'catAll',
      men: 'catMen',
      women: 'catWomen',
      kids: 'catKids',
      shoes: 'catShoes',
      accessories: 'catAccessories'
    };
    return t(map[cat] || 'catAll');
  }

  function getSelectedRegion() {
    var list = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang].regions) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === state.selectedRegionId) return list[i];
    }
    return list[0] || { id: 'tripoli', name: 'Tripoli', eta: '24h', feeUsd: 2 };
  }

  function saveCart() {
    safeStorageSet('madar_cart', JSON.stringify(state.cart));
  }

  function saveWishlist() {
    safeStorageSet('madar_wishlist', JSON.stringify(state.wishlist));
  }

  function showToast(msg) {
    var stack = $('#toastStack');
    if (!stack) return;
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    stack.appendChild(el);
    setTimeout(function () {
      el.style.opacity = '0';
      el.style.transform = 'translateY(10px)';
      el.style.transition = 'opacity 0.25s, transform 0.25s';
      setTimeout(function () { el.remove(); }, 260);
    }, 2600);
  }

  /* ==================== WHATSAPP BUILDER ==================== */
  function openWhatsApp(message) {
    var url = 'https://wa.me/' + STORE_CONFIG.WHATSAPP_NUMBER + '?text=' + encodeURIComponent(message);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function buildSingleProductWhatsApp(product, size, colorObj) {
    var name = getProductName(product);
    var colorName = colorObj ? getColorName(colorObj) : '-';
    var region = getSelectedRegion();
    return [
      t('waSingleGreeting'),
      '',
      '• *' + name + '*',
      '• ' + t('waSizeLabel') + ': ' + size,
      '• ' + t('waColorLabel') + ': ' + colorName,
      '• ' + t('waQtyLabel') + ': 1',
      '• ' + t('waTotalLabel') + ': ' + formatDualPrice(product.price_usd, state.lang),
      '• ' + t('waRegionLabel') + ': ' + region.name
    ].join('\n');
  }

  function buildCartCheckoutWhatsApp(payload) {
    var lines = [
      t('waGreeting'),
      '',
      t('waItemsHeader')
    ];

    state.cart.forEach(function (item, idx) {
      var prod = state.products.find(function (p) { return p.id === item.productId; });
      if (!prod) return;
      var pName = getProductName(prod);
      var colObj = prod.colors[item.colorIdx] || prod.colors[0];
      var colName = colObj ? getColorName(colObj) : '-';
      var lineUsd = prod.price_usd * item.qty;
      lines.push(
        (idx + 1) + '. *' + pName + '* | ' + t('waSizeLabel') + ': ' + item.size + ' | ' +
        t('waColorLabel') + ': ' + colName + ' | ' + t('waQtyLabel') + ': ' + item.qty + ' — ' +
        formatDualPrice(lineUsd, state.lang)
      );
    });

    var delivText = payload.deliveryUsd === 0 ? t('cartFree') : formatDualPrice(payload.deliveryUsd, state.lang);

    lines.push(
      '',
      '💵 ' + t('waSubtotalLabel') + ': ' + formatDualPrice(payload.subtotalUsd, state.lang),
      '🚚 ' + t('waDeliveryLabel') + ' (' + payload.regionName + '): ' + delivText,
      '✅ *' + t('waTotalLabel') + ': ' + formatDualPrice(payload.totalUsd, state.lang) + '*',
      '',
      t('waCustomerHeader'),
      '• ' + t('waNameLabel') + ': ' + payload.name,
      '• ' + t('waPhoneLabel') + ': ' + payload.phone,
      '• ' + t('waRegionLabel') + ': ' + payload.regionName,
      '• ' + t('waAddressLabel') + ': ' + payload.address
    );

    if (payload.notes) {
      lines.push('• ' + t('waNotesLabel') + ': ' + payload.notes);
    }

    return lines.join('\n');
  }

  /* ==================== SPARKLE / CONFETTI BURST ==================== */
  var particles = [];
  var sparkleAnimId = null;

  function triggerSparkleBurst(x, y) {
    try {
      var canvas = $('#sparkleCanvas');
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      var colors = ['#FF4D2E', '#F59E0B', '#25D366', '#E11D74', '#2563EB', '#FDE047', '#A855F7'];

      for (var i = 0; i < 28; i++) {
        var angle = (Math.PI * 2 * i) / 28 + (Math.random() - 0.5) * 0.4;
        var speed = 2.6 + Math.random() * 5.2;
        particles.push({
          x: x,
          y: y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2.2,
          size: 4 + Math.random() * 5,
          color: colors[i % colors.length],
          alpha: 1,
          rotation: Math.random() * Math.PI,
          vRot: (Math.random() - 0.5) * 0.25
        });
      }

      if (!sparkleAnimId) {
        var ctx = canvas.getContext('2d');
        var step = function () {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          for (var j = particles.length - 1; j >= 0; j--) {
            var p = particles[j];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.16;
            p.alpha -= 0.022;
            p.rotation += p.vRot;
            if (p.alpha <= 0) {
              particles.splice(j, 1);
              continue;
            }
            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.65);
            ctx.restore();
          }
          if (particles.length > 0) {
            sparkleAnimId = requestAnimationFrame(step);
          } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            sparkleAnimId = null;
          }
        };
        sparkleAnimId = requestAnimationFrame(step);
      }
    } catch (err) {
      console.error('Sparkle effect error:', err);
    }
  }

  /* ==================== LANGUAGE & THEME ==================== */
  function applyLanguage(lang) {
    state.lang = lang === 'en' ? 'en' : 'ar';
    safeStorageSet('madar_lang', state.lang);

    document.documentElement.lang = state.lang;
    document.documentElement.dir = state.lang === 'ar' ? 'rtl' : 'ltr';
    document.title = t('metaTitle');
    var metaDesc = $('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', t('metaDesc'));

    $$('[data-i18n]').forEach(function (el) {
      var val = t(el.dataset.i18n);
      if (typeof val === 'string') el.textContent = val;
    });

    $$('[data-i18n-placeholder]').forEach(function (el) {
      var val = t(el.dataset.i18nPlaceholder);
      if (typeof val === 'string') el.setAttribute('placeholder', val);
    });

    $$('[data-lang-switch]').forEach(function (btn) {
      var active = btn.dataset.langSwitch === state.lang;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });

    renderMarquee();
    renderHeroSpotlight();
    updateCategoryCounts();
    updatePriceRangeLabel();
    renderProducts();
    renderLookbook();
    renderWhyUs();
    renderReviews();
    renderDeliverySection();
    renderCart();
    renderWishlist();
    renderSizeGuideTable();
    if (state.quickViewProductId) {
      renderQuickViewBody();
    }
  }

  function applyTheme(theme) {
    state.theme = theme === 'dark' ? 'dark' : 'light';
    safeStorageSet('madar_theme', state.theme);
    document.documentElement.setAttribute('data-theme', state.theme);
  }

  function applyMood(category) {
    var mood = (STORE_CONFIG.CATEGORY_MOODS && STORE_CONFIG.CATEGORY_MOODS[category]) || 'all';
    document.documentElement.setAttribute('data-mood', mood);
  }

  /* ==================== DYNAMIC SECTION RENDERERS ==================== */
  function renderMarquee() {
    var track = $('#marqueeTrack');
    if (!track) return;
    var items = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang].marqueeItems) || [];
    var repeated = items.concat(items, items);
    track.innerHTML = repeated
      .map(function (txt) {
        return '<span class="marquee-item"><span>' + txt + '</span><span class="marquee-star">✦</span></span>';
      })
      .join('');
  }

  function renderHeroSpotlight() {
    var box = $('#heroSpotlightBody');
    if (!box || !state.products.length) return;
    var featured = state.products.find(function (p) { return p.id === 'w-01'; }) || state.products[0];
    box.innerHTML =
      '<div class="spotlight-card" data-qv-open="' + featured.id + '" role="button" tabindex="0">' +
        '<img src="' + featured.image + '" alt="' + getProductName(featured) + '" loading="lazy" decoding="async" data-fallback-title="' + getProductName(featured) + '" />' +
        '<div class="spotlight-info">' +
          '<h4>' + getProductName(featured) + '</h4>' +
          '<div class="spotlight-price">' + formatUSD(featured.price_usd) + '</div>' +
          '<div class="spotlight-lbp">' + formatLBP(featured.price_usd, state.lang) + '</div>' +
        '</div>' +
      '</div>';
    attachImageFallbacks(box);
  }

  function updateCategoryCounts() {
    ['men', 'women', 'kids', 'shoes', 'accessories'].forEach(function (cat) {
      var count = state.products.filter(function (p) { return p.category === cat; }).length;
      var el = $('[data-cat-count="' + cat + '"]');
      if (el) el.textContent = count + ' ' + t('catItemsUnit');
    });
  }

  function updatePriceRangeLabel() {
    var el = $('#priceRangeValue');
    if (!el) return;
    el.textContent = formatUSD(state.maxPrice) + ' · ' + formatLBP(state.maxPrice, state.lang);
  }

  function getFilteredProducts() {
    var q = state.search.trim().toLowerCase();
    var list = state.products.filter(function (p) {
      if (state.category !== 'all' && p.category !== state.category) return false;
      if (state.tab !== 'all' && (!p.badges || p.badges.indexOf(state.tab) === -1)) return false;
      if (p.price_usd > state.maxPrice) return false;
      if (q) {
        var hay = (p.name_ar + ' ' + p.name_en + ' ' + p.desc_ar + ' ' + p.desc_en + ' ' + p.category).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });

    if (state.sort === 'price-asc') {
      list.sort(function (a, b) { return a.price_usd - b.price_usd; });
    } else if (state.sort === 'price-desc') {
      list.sort(function (a, b) { return b.price_usd - a.price_usd; });
    } else if (state.sort === 'newest') {
      list.sort(function (a, b) { return (b.created_order || 0) - (a.created_order || 0); });
    } else {
      list.sort(function (a, b) {
        var score = function (p) {
          return (p.badges.indexOf('bestseller') > -1 ? 2 : 0) + (p.badges.indexOf('new') > -1 ? 1 : 0);
        };
        return score(b) - score(a);
      });
    }

    return list;
  }

  function renderProducts() {
    var grid = $('#productsGrid');
    var empty = $('#emptyCatalog');
    var countEl = $('#resultsNumber');
    var resetBtn = $('#resetFiltersBtn');
    if (!grid) return;

    var list = getFilteredProducts();
    if (countEl) countEl.textContent = list.length;

    var hasActiveFilters =
      state.category !== 'all' || state.tab !== 'all' || state.search.trim() !== '' || state.maxPrice < 80;
    if (resetBtn) resetBtn.hidden = !hasActiveFilters;

    if (!list.length) {
      grid.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }

    if (empty) empty.hidden = true;

    grid.innerHTML = list
      .map(function (p) {
        var sel = state.cardSelections[p.id] || { colorIdx: 0, sizeIdx: 0 };
        var activeColor = p.colors[sel.colorIdx] || p.colors[0];
        var activeSize = p.sizes[sel.sizeIdx] || p.sizes[0];
        var cardImg = (activeColor && activeColor.image) || p.image;
        var isWish = state.wishlist.indexOf(p.id) > -1;

        var discountPct =
          p.old_price_usd && p.old_price_usd > p.price_usd
            ? Math.round(((p.old_price_usd - p.price_usd) / p.old_price_usd) * 100)
            : 0;

        var badgesHtml = (p.badges || [])
          .map(function (b) {
            if (b === 'sale' && discountPct > 0) {
              return '<span class="p-badge p-badge-sale">-' + discountPct + '% ' + t('badgeSale') + '</span>';
            }
            if (b === 'new') return '<span class="p-badge p-badge-new">' + t('badgeNew') + '</span>';
            if (b === 'bestseller') return '<span class="p-badge p-badge-bestseller">★ ' + t('badgeBestseller') + '</span>';
            return '';
          })
          .join('');

        var swatchesHtml = (p.colors || [])
          .map(function (c, idx) {
            return '<button type="button" class="swatch-dot ' + (idx === sel.colorIdx ? 'active' : '') +
              '" style="background:' + c.hex + '" title="' + getColorName(c) + '" aria-label="' + getColorName(c) +
              '" data-card-color="' + p.id + ':' + idx + '"></button>';
          })
          .join('');

        var sizesHtml = (p.sizes || [])
          .slice(0, 4)
          .map(function (sz, idx) {
            return '<button type="button" class="size-mini ' + (idx === sel.sizeIdx ? 'active' : '') +
              '" data-card-size="' + p.id + ':' + idx + '">' + sz + '</button>';
          })
          .join('');

        return (
          '<article class="product-card" data-product-id="' + p.id + '">' +
            '<div class="product-media" data-qv-open="' + p.id + '">' +
              '<div class="product-badges">' + badgesHtml + '</div>' +
              '<div class="product-media-actions">' +
                '<button type="button" class="card-icon-btn ' + (isWish ? 'wish-active' : '') + '" data-wish-toggle="' + p.id + '" aria-label="' + t('wishlistTitle') + '">' +
                  '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' +
                '</button>' +
                '<button type="button" class="card-icon-btn" data-qv-open="' + p.id + '" aria-label="' + t('quickView') + '">' +
                  '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' +
                '</button>' +
              '</div>' +
              '<img src="' + cardImg + '" alt="' + getProductName(p) + '" loading="lazy" decoding="async" data-fallback-title="' + getProductName(p) + '" />' +
            '</div>' +
            '<div class="product-body">' +
              '<div class="product-cat-row">' +
                '<span>' + getCategoryLabel(p.category) + '</span>' +
                '<span class="product-rating">★ ' + p.rating.toFixed(1) + '</span>' +
              '</div>' +
              '<h3 class="product-title" data-qv-open="' + p.id + '">' + getProductName(p) + '</h3>' +
              '<p class="product-desc">' + getProductDesc(p) + '</p>' +
              '<div class="product-variants">' +
                '<div class="swatch-row">' + swatchesHtml + '</div>' +
                '<div class="size-mini-row">' + sizesHtml + '</div>' +
              '</div>' +
              '<div class="product-price-block">' +
                '<div class="price-top-line">' +
                  '<strong class="price-usd">' + formatUSD(p.price_usd) + '</strong>' +
                  (p.old_price_usd ? '<span class="price-old">' + formatUSD(p.old_price_usd) + '</span>' : '') +
                '</div>' +
                '<span class="price-lbp">' + formatLBP(p.price_usd, state.lang) + '</span>' +
              '</div>' +
              '<div class="product-actions">' +
                '<button type="button" class="btn-card-add" data-add-cart="' + p.id + '" data-active-size="' + activeSize + '">' +
                  '<span>+ ' + t('addToCart') + '</span>' +
                '</button>' +
                '<button type="button" class="btn-card-wa" data-direct-wa="' + p.id + '" aria-label="' + t('orderNowWa') + '" title="' + t('orderNowWa') + '">' +
                  '<svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M12.031 2c-5.516 0-9.969 4.453-9.969 9.969 0 1.766.469 3.484 1.344 5l-1.406 5.156 5.281-1.391c1.469.797 3.109 1.219 4.75 1.219 5.516 0 9.969-4.453 9.969-9.984S17.547 2 12.031 2zm5.813 14.125c-.25.703-1.438 1.344-2 1.422-.516.078-1.188.109-1.922-.125-.453-.141-1.031-.344-1.766-.656-3.094-1.328-5.109-4.453-5.266-4.656-.156-.203-1.266-1.688-1.266-3.219s.797-2.281 1.078-2.594c.281-.313.625-.391.828-.391s.422.016.609.016c.188 0 .453-.078.703.531.25.609.875 2.125.953 2.281.078.156.125.344.016.547-.094.203-.156.344-.313.516-.156.188-.328.406-.469.547-.156.156-.313.328-.141.641.188.313.813 1.344 1.75 2.172 1.203 1.078 2.219 1.406 2.531 1.563.313.156.5.125.688-.078.188-.219.797-.922 1-1.25.219-.313.422-.266.719-.156.297.109 1.875.891 2.203 1.047.313.156.531.234.609.375.078.141.078.813-.172 1.516z"/></svg>' +
                '</button>' +
              '</div>' +
            '</div>' +
          '</article>'
        );
      })
      .join('');

    attachImageFallbacks(grid);
    attachCardTilt();
  }

  function attachCardTilt() {
    if (!window.matchMedia || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    $$('.product-card').forEach(function (card) {
      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = 'perspective(900px) rotateX(' + (-y * 4.5).toFixed(2) + 'deg) rotateY(' + (x * 4.5).toFixed(2) + 'deg) translateY(-5px)';
      });
      card.addEventListener('mouseleave', function () {
        card.style.transform = '';
      });
    });
  }

  function renderLookbook() {
    var grid = $('#lookbookGrid');
    if (!grid || !state.products.length) return;
    var items = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang].lookItems) || [];
    grid.innerHTML = items
      .map(function (item) {
        var prod = state.products.find(function (p) { return p.id === item.productId; }) || state.products[0];
        return (
          '<article class="look-card" data-qv-open="' + prod.id + '" role="button" tabindex="0">' +
            '<img src="' + prod.image + '" alt="' + item.caption + '" loading="lazy" decoding="async" data-fallback-title="' + item.tag + '" />' +
            '<div class="look-overlay">' +
              '<span class="look-tag">' + item.tag + '</span>' +
              '<h3>' + item.caption + '</h3>' +
              '<span class="look-shop-btn">' + t('lookShopPiece') + ' · ' + formatUSD(prod.price_usd) + ' ↗</span>' +
            '</div>' +
          '</article>'
        );
      })
      .join('');
    attachImageFallbacks(grid);
  }

  function renderWhyUs() {
    var grid = $('#whyGrid');
    if (!grid) return;
    var cards = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang].whyCards) || [];
    grid.innerHTML = cards
      .map(function (c) {
        return '<article class="why-card"><div class="why-num">' + c.num + '</div><h3>' + c.title + '</h3><p>' + c.desc + '</p></article>';
      })
      .join('');
  }

  function renderReviews() {
    var track = $('#reviewsTrack');
    if (!track) return;
    var reviews = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang].reviewsList) || [];
    track.innerHTML = reviews
      .map(function (r) {
        return (
          '<article class="review-card">' +
            '<div class="review-stars" aria-label="5 out of 5 stars">' + '★'.repeat(r.rating) + '</div>' +
            '<p class="review-text">“' + r.text + '”</p>' +
            '<span class="review-item-tag">' + r.item + '</span>' +
            '<div class="review-author">' +
              '<div class="review-avatar" aria-hidden="true">' + r.name.charAt(0) + '</div>' +
              '<div><strong>' + r.name + '</strong><span>' + r.city + '</span></div>' +
            '</div>' +
          '</article>'
        );
      })
      .join('');
  }

  function renderDeliverySection() {
    var select = $('#deliveryRegionSelect');
    var checkoutSelect = $('#custRegion');
    var pills = $('#deliveryRegionPills');
    var regions = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang].regions) || [];

    var optsHtml = regions
      .map(function (r) {
        return '<option value="' + r.id + '"' + (r.id === state.selectedRegionId ? ' selected' : '') + '>' + r.name + '</option>';
      })
      .join('');

    if (select) select.innerHTML = optsHtml;
    if (checkoutSelect) checkoutSelect.innerHTML = optsHtml;

    if (pills) {
      pills.innerHTML = regions
        .map(function (r) {
          return '<button type="button" class="region-pill ' + (r.id === state.selectedRegionId ? 'active' : '') +
            '" data-region-pick="' + r.id + '">' + r.name + '</button>';
        })
        .join('');
    }

    var active = getSelectedRegion();
    var nameEl = $('#selectedRegionName');
    var etaEl = $('#selectedRegionEta');
    var feeEl = $('#selectedRegionFee');
    var exchEl = $('#exchangeRateBadge');

    if (nameEl) nameEl.textContent = active.name;
    if (etaEl) etaEl.textContent = active.eta;
    if (feeEl) feeEl.textContent = formatDualPrice(active.feeUsd, state.lang);
    if (exchEl) exchEl.textContent = '1$ = ' + STORE_CONFIG.EXCHANGE_RATE_LBP.toLocaleString('en-US') + ' L.L';
  }

  /* ==================== CART LOGIC ==================== */
  function addToCart(productId, size, colorIdx, triggerEl) {
    var prod = state.products.find(function (p) { return p.id === productId; });
    if (!prod) return;
    var chosenSize = size || prod.sizes[0];
    var chosenColor = typeof colorIdx === 'number' && !isNaN(colorIdx) ? colorIdx : 0;

    var existing = state.cart.find(function (item) {
      return item.productId === productId && item.size === chosenSize && item.colorIdx === chosenColor;
    });

    if (existing) {
      existing.qty += 1;
    } else {
      state.cart.push({ productId: productId, size: chosenSize, colorIdx: chosenColor, qty: 1 });
    }

    saveCart();
    renderCart();
    showToast(t('addedToast'));

    var badge = $('#cartBadge');
    if (badge) {
      badge.classList.add('badge-bump');
      setTimeout(function () { badge.classList.remove('badge-bump'); }, 280);
    }
    if (triggerEl && triggerEl.getBoundingClientRect) {
      var rect = triggerEl.getBoundingClientRect();
      triggerSparkleBurst(rect.left + rect.width / 2, rect.top + rect.height / 2);
    } else {
      triggerSparkleBurst(window.innerWidth / 2, window.innerHeight / 2);
    }
  }

  function updateCartQty(index, delta) {
    var item = state.cart[index];
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) {
      state.cart.splice(index, 1);
    }
    saveCart();
    renderCart();
  }

  function removeCartItem(index) {
    state.cart.splice(index, 1);
    saveCart();
    renderCart();
  }

  function renderCart() {
    var totalQty = state.cart.reduce(function (sum, i) { return sum + (i.qty || 0); }, 0);
    var badge = $('#cartBadge');
    var mobBadge = $('#mobCartBadge');
    var drawerCount = $('#cartDrawerCount');
    var itemsWrap = $('#cartItems');
    var emptyEl = $('#cartEmpty');
    var checkoutWrap = $('#cartCheckoutWrap');
    var clearBtn = $('#clearCartBtn');

    if (badge) badge.textContent = totalQty;
    if (mobBadge) mobBadge.textContent = totalQty;
    if (drawerCount) drawerCount.textContent = '(' + totalQty + ')';

    if (!itemsWrap) return;

    if (!state.cart.length) {
      itemsWrap.innerHTML = '';
      if (emptyEl) emptyEl.hidden = false;
      if (checkoutWrap) checkoutWrap.hidden = true;
      if (clearBtn) clearBtn.hidden = true;
      return;
    }

    if (emptyEl) emptyEl.hidden = true;
    if (checkoutWrap) checkoutWrap.hidden = false;
    if (clearBtn) clearBtn.hidden = false;

    var subtotalUsd = 0;

    itemsWrap.innerHTML = state.cart
      .map(function (item, idx) {
        var prod = state.products.find(function (p) { return p.id === item.productId; });
        if (!prod) return '';
        var colObj = prod.colors[item.colorIdx] || prod.colors[0];
        var img = (colObj && colObj.image) || prod.image;
        var lineUsd = prod.price_usd * item.qty;
        subtotalUsd += lineUsd;

        return (
          '<div class="cart-item">' +
            '<img src="' + img + '" alt="' + getProductName(prod) + '" loading="lazy" decoding="async" />' +
            '<div class="cart-item-info">' +
              '<div class="cart-item-top">' +
                '<h4>' + getProductName(prod) + '</h4>' +
                '<button type="button" class="cart-item-remove" data-cart-remove="' + idx + '">' + t('removeItem') + '</button>' +
              '</div>' +
              '<div class="cart-item-meta">' + t('selectSize') + ': ' + item.size + ' · ' + t('selectColor') + ': ' + getColorName(colObj) + '</div>' +
              '<div class="cart-item-bottom">' +
                '<div class="qty-control">' +
                  '<button type="button" data-cart-qty="' + idx + ':-1" aria-label="Decrease quantity">−</button>' +
                  '<span>' + item.qty + '</span>' +
                  '<button type="button" data-cart-qty="' + idx + ':1" aria-label="Increase quantity">+</button>' +
                '</div>' +
                '<div class="cart-item-price">' +
                  '<strong>' + formatUSD(lineUsd) + '</strong>' +
                  '<span>' + formatLBP(lineUsd, state.lang) + '</span>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>'
        );
      })
      .join('');

    attachImageFallbacks(itemsWrap);

    var region = getSelectedRegion();
    var deliveryUsd = subtotalUsd >= STORE_CONFIG.FREE_DELIVERY_THRESHOLD_USD ? 0 : region.feeUsd;
    var totalUsd = subtotalUsd + deliveryUsd;

    var subEl = $('#cartSubtotalDisplay');
    var delEl = $('#cartDeliveryDisplay');
    var totUsdEl = $('#cartTotalUsd');
    var totLbpEl = $('#cartTotalLbp');

    if (subEl) subEl.textContent = formatDualPrice(subtotalUsd, state.lang);
    if (delEl) delEl.textContent = deliveryUsd === 0 ? t('cartFree') : formatDualPrice(deliveryUsd, state.lang);
    if (totUsdEl) totUsdEl.textContent = formatUSD(totalUsd);
    if (totLbpEl) totLbpEl.textContent = formatLBP(totalUsd, state.lang);
  }

  /* ==================== WISHLIST LOGIC ==================== */
  function toggleWishlist(productId) {
    var idx = state.wishlist.indexOf(productId);
    if (idx > -1) {
      state.wishlist.splice(idx, 1);
      showToast(t('wishlistRemoved'));
    } else {
      state.wishlist.push(productId);
      showToast(t('wishlistAdded'));
    }
    saveWishlist();
    renderWishlist();
    renderProducts();
  }

  function renderWishlist() {
    var count = state.wishlist.length;
    var badge = $('#wishlistBadge');
    var mobBadge = $('#mobWishlistBadge');
    var drawerCount = $('#wishlistDrawerCount');
    var itemsWrap = $('#wishlistItems');
    var emptyEl = $('#wishlistEmpty');

    if (badge) badge.textContent = count;
    if (mobBadge) mobBadge.textContent = count;
    if (drawerCount) drawerCount.textContent = '(' + count + ')';

    if (!itemsWrap) return;

    if (!count) {
      itemsWrap.innerHTML = '';
      if (emptyEl) emptyEl.hidden = false;
      return;
    }

    if (emptyEl) emptyEl.hidden = true;

    itemsWrap.innerHTML = state.wishlist
      .map(function (pid) {
        var p = state.products.find(function (x) { return x.id === pid; });
        if (!p) return '';
        return (
          '<div class="cart-item">' +
            '<img src="' + p.image + '" alt="' + getProductName(p) + '" loading="lazy" decoding="async" />' +
            '<div class="cart-item-info">' +
              '<div class="cart-item-top">' +
                '<h4>' + getProductName(p) + '</h4>' +
                '<button type="button" class="cart-item-remove" data-wish-toggle="' + p.id + '">' + t('removeItem') + '</button>' +
              '</div>' +
              '<div class="cart-item-meta">' + formatDualPrice(p.price_usd, state.lang) + '</div>' +
              '<div class="cart-item-bottom">' +
                '<button type="button" class="btn btn-primary btn-sm" data-wish-to-cart="' + p.id + '">' + t('moveToCart') + '</button>' +
                '<button type="button" class="btn btn-outline btn-sm" data-qv-open="' + p.id + '">' + t('quickView') + '</button>' +
              '</div>' +
            '</div>' +
          '</div>'
        );
      })
      .join('');

    attachImageFallbacks(itemsWrap);
  }

  /* ==================== QUICK VIEW MODAL (WITH ZOOM) ==================== */
  function openQuickView(productId) {
    var prod = state.products.find(function (p) { return p.id === productId; });
    if (!prod) return;
    var sel = state.cardSelections[productId] || { colorIdx: 0, sizeIdx: 0 };
    state.quickViewProductId = productId;
    state.qvColorIdx = sel.colorIdx || 0;
    state.qvSizeIdx = sel.sizeIdx || 0;

    renderQuickViewBody();
    openOverlay('#quickViewModal', '#quickViewBackdrop');
  }

  function renderQuickViewBody() {
    var wrap = $('#qvContent');
    var prod = state.products.find(function (p) { return p.id === state.quickViewProductId; });
    if (!wrap || !prod) return;

    var activeColor = prod.colors[state.qvColorIdx] || prod.colors[0];
    var activeSize = prod.sizes[state.qvSizeIdx] || prod.sizes[0];
    var mainImg = (activeColor && activeColor.image) || prod.image;
    var rawGal = [mainImg].concat(prod.gallery || [prod.image]);
    var gallery = rawGal.filter(function (v, i, a) { return v && a.indexOf(v) === i; });

    wrap.innerHTML =
      '<div class="qv-gallery">' +
        '<div class="qv-main-img-wrap" id="qvZoomContainer">' +
          '<img src="' + mainImg + '" alt="' + getProductName(prod) + '" id="qvMainImg" decoding="async" />' +
          '<span class="qv-zoom-hint">🔍 ' + t('qvZoomHint') + '</span>' +
        '</div>' +
        (gallery.length > 1
          ? '<div class="qv-thumbs">' +
              gallery.map(function (src, idx) {
                return '<button type="button" class="qv-thumb ' + (idx === 0 ? 'active' : '') + '" data-qv-thumb="' + src + '">' +
                  '<img src="' + src + '" alt="' + getProductName(prod) + ' ' + (idx + 1) + '" loading="lazy" /></button>';
              }).join('') +
            '</div>'
          : '') +
      '</div>' +
      '<div class="qv-details">' +
        '<div class="product-cat-row">' +
          '<span>' + getCategoryLabel(prod.category) + '</span>' +
          '<span class="product-rating">★ ' + prod.rating.toFixed(1) + ' (' + prod.reviews_count + ' ' + t('qvReviews') + ')</span>' +
        '</div>' +
        '<h3 id="qvTitle">' + getProductName(prod) + '</h3>' +
        '<p class="section-desc">' + getProductDesc(prod) + '</p>' +
        '<div class="qv-price-box">' +
          '<div>' +
            '<strong class="price-usd">' + formatUSD(prod.price_usd) + '</strong>' +
            (prod.old_price_usd ? ' <span class="price-old">' + formatUSD(prod.old_price_usd) + '</span>' : '') +
            '<div class="price-lbp">' + formatLBP(prod.price_usd, state.lang) + '</div>' +
          '</div>' +
          '<span class="perk-chip">✓ ' + t('inStock') + '</span>' +
        '</div>' +
        '<div class="qv-option-group">' +
          '<div class="qv-option-head"><span>' + t('selectColor') + ': ' + getColorName(activeColor) + '</span></div>' +
          '<div class="qv-colors">' +
            prod.colors.map(function (c, idx) {
              return '<button type="button" class="qv-color-chip ' + (idx === state.qvColorIdx ? 'active' : '') + '" data-qv-color="' + idx + '">' +
                '<i style="background:' + c.hex + '"></i><span>' + getColorName(c) + '</span></button>';
            }).join('') +
          '</div>' +
        '</div>' +
        '<div class="qv-option-group">' +
          '<div class="qv-option-head">' +
            '<span>' + t('selectSize') + ': ' + activeSize + '</span>' +
            '<button type="button" class="link-reset" id="qvSizeGuideTrigger">' + t('sizeGuideBtn') + '</button>' +
          '</div>' +
          '<div class="qv-sizes">' +
            prod.sizes.map(function (sz, idx) {
              return '<button type="button" class="qv-size-btn ' + (idx === state.qvSizeIdx ? 'active' : '') + '" data-qv-size="' + idx + '">' + sz + '</button>';
            }).join('') +
          '</div>' +
        '</div>' +
        '<div class="qv-actions">' +
          '<button type="button" class="btn btn-primary btn-lg btn-full" id="qvAddCartBtn">+ ' + t('addToCart') + ' — ' + formatUSD(prod.price_usd) + '</button>' +
          '<button type="button" class="btn btn-whatsapp btn-lg btn-full" id="qvDirectWaBtn">' + t('qvDirectWa') + '</button>' +
        '</div>' +
      '</div>';

    attachImageFallbacks(wrap);

    var zoomBox = $('#qvZoomContainer', wrap);
    var zoomImg = $('#qvMainImg', wrap);
    if (zoomBox && zoomImg) {
      zoomBox.addEventListener('click', function () { zoomBox.classList.toggle('zoomed'); });
      zoomBox.addEventListener('mousemove', function (e) {
        if (!zoomBox.classList.contains('zoomed')) return;
        var r = zoomBox.getBoundingClientRect();
        var px = ((e.clientX - r.left) / r.width) * 100;
        var py = ((e.clientY - r.top) / r.height) * 100;
        zoomImg.style.transformOrigin = px + '% ' + py + '%';
      });
      zoomBox.addEventListener('mouseleave', function () {
        zoomBox.classList.remove('zoomed');
        zoomImg.style.transformOrigin = 'center center';
      });
    }

    $$('[data-qv-thumb]', wrap).forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (zoomImg) zoomImg.src = btn.dataset.qvThumb;
        $$('[data-qv-thumb]', wrap).forEach(function (b) { b.classList.toggle('active', b === btn); });
      });
    });

    $$('[data-qv-color]', wrap).forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.qvColorIdx = Number(btn.dataset.qvColor);
        renderQuickViewBody();
      });
    });

    $$('[data-qv-size]', wrap).forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.qvSizeIdx = Number(btn.dataset.qvSize);
        renderQuickViewBody();
      });
    });

    var sgTrigger = $('#qvSizeGuideTrigger', wrap);
    if (sgTrigger) {
      sgTrigger.addEventListener('click', function () {
        closeAllOverlays();
        openOverlay('#sizeGuideModal', '#sizeGuideBackdrop');
      });
    }

    var addBtn = $('#qvAddCartBtn', wrap);
    if (addBtn) {
      addBtn.addEventListener('click', function (e) {
        addToCart(prod.id, prod.sizes[state.qvSizeIdx], state.qvColorIdx, e.currentTarget);
      });
    }

    var waBtn = $('#qvDirectWaBtn', wrap);
    if (waBtn) {
      waBtn.addEventListener('click', function () {
        var col = prod.colors[state.qvColorIdx] || prod.colors[0];
        openWhatsApp(buildSingleProductWhatsApp(prod, prod.sizes[state.qvSizeIdx], col));
      });
    }
  }

  /* ==================== SIZE GUIDE TABLES ==================== */
  function renderSizeGuideTable() {
    var wrap = $('#sgTableWrap');
    if (!wrap) return;
    var ar = state.lang === 'ar';

    if (state.sgTab === 'adults') {
      wrap.innerHTML =
        '<table class="sg-table"><thead><tr>' +
          '<th>' + (ar ? 'المقاس' : 'Size') + '</th>' +
          '<th>' + (ar ? 'الصدر (سم)' : 'Chest (cm)') + '</th>' +
          '<th>' + (ar ? 'الخصر (سم)' : 'Waist (cm)') + '</th>' +
          '<th>' + (ar ? 'الأرداف (سم)' : 'Hips (cm)') + '</th>' +
        '</tr></thead><tbody>' +
          '<tr><td><strong>XS</strong></td><td>82 – 86</td><td>66 – 70</td><td>88 – 92</td></tr>' +
          '<tr><td><strong>S</strong></td><td>87 – 92</td><td>71 – 76</td><td>93 – 98</td></tr>' +
          '<tr><td><strong>M</strong></td><td>93 – 98</td><td>77 – 82</td><td>99 – 104</td></tr>' +
          '<tr><td><strong>L</strong></td><td>99 – 105</td><td>83 – 89</td><td>105 – 111</td></tr>' +
          '<tr><td><strong>XL</strong></td><td>106 – 113</td><td>90 – 97</td><td>112 – 118</td></tr>' +
          '<tr><td><strong>XXL</strong></td><td>114 – 122</td><td>98 – 106</td><td>119 – 126</td></tr>' +
        '</tbody></table>';
    } else if (state.sgTab === 'kids') {
      wrap.innerHTML =
        '<table class="sg-table"><thead><tr>' +
          '<th>' + (ar ? 'المقاس / العمر' : 'Age / Size') + '</th>' +
          '<th>' + (ar ? 'الطول (سم)' : 'Height (cm)') + '</th>' +
          '<th>' + (ar ? 'الصدر (سم)' : 'Chest (cm)') + '</th>' +
          '<th>' + (ar ? 'الخصر (سم)' : 'Waist (cm)') + '</th>' +
        '</tr></thead><tbody>' +
          '<tr><td><strong>2Y – 3Y</strong></td><td>92 – 98</td><td>53 – 55</td><td>51 – 52</td></tr>' +
          '<tr><td><strong>4Y</strong></td><td>104</td><td>57</td><td>53</td></tr>' +
          '<tr><td><strong>6Y</strong></td><td>116</td><td>61</td><td>56</td></tr>' +
          '<tr><td><strong>8Y</strong></td><td>128</td><td>66</td><td>59</td></tr>' +
          '<tr><td><strong>10Y</strong></td><td>140</td><td>71</td><td>62</td></tr>' +
          '<tr><td><strong>12Y</strong></td><td>152</td><td>77</td><td>66</td></tr>' +
        '</tbody></table>';
    } else {
      wrap.innerHTML =
        '<table class="sg-table"><thead><tr>' +
          '<th>EU</th>' +
          '<th>US (' + (ar ? 'نسائي' : 'Women') + ')</th>' +
          '<th>US (' + (ar ? 'رجالي' : 'Men') + ')</th>' +
          '<th>' + (ar ? 'طول القدم (سم)' : 'Foot Length (cm)') + '</th>' +
        '</tr></thead><tbody>' +
          '<tr><td><strong>36</strong></td><td>5.5</td><td>—</td><td>22.8</td></tr>' +
          '<tr><td><strong>38</strong></td><td>7</td><td>5.5</td><td>24.1</td></tr>' +
          '<tr><td><strong>40</strong></td><td>8.5</td><td>7</td><td>25.4</td></tr>' +
          '<tr><td><strong>41</strong></td><td>9.5</td><td>8</td><td>26.0</td></tr>' +
          '<tr><td><strong>42</strong></td><td>10</td><td>8.5</td><td>26.7</td></tr>' +
          '<tr><td><strong>43</strong></td><td>—</td><td>9.5</td><td>27.3</td></tr>' +
          '<tr><td><strong>44</strong></td><td>—</td><td>10.5</td><td>28.0</td></tr>' +
          '<tr><td><strong>45</strong></td><td>—</td><td>11.5</td><td>28.7</td></tr>' +
        '</tbody></table>';
    }
  }

  /* ==================== OVERLAY MANAGER ==================== */
  function openOverlay(panelSel, backdropSel) {
    closeAllOverlays();
    var panel = $(panelSel);
    var backdrop = $(backdropSel);
    if (!panel || !backdrop) return;
    backdrop.hidden = false;
    requestAnimationFrame(function () {
      backdrop.classList.add('open');
      panel.classList.add('open');
      panel.setAttribute('aria-hidden', 'false');
    });
    document.body.style.overflow = 'hidden';
  }

  function closeAllOverlays() {
    ['#cartDrawer', '#wishlistDrawer', '#mobileNavDrawer', '#quickViewModal', '#sizeGuideModal'].forEach(function (sel) {
      var el = $(sel);
      if (el) {
        el.classList.remove('open');
        el.setAttribute('aria-hidden', 'true');
      }
    });
    ['#cartBackdrop', '#wishlistBackdrop', '#mobileMenuBackdrop', '#quickViewBackdrop', '#sizeGuideBackdrop'].forEach(
      function (sel) {
        var el = $(sel);
        if (el) {
          el.classList.remove('open');
          setTimeout(function () {
            if (!el.classList.contains('open')) el.hidden = true;
          }, 280);
        }
      }
    );
    document.body.style.overflow = '';
  }

  /* ==================== COUNTDOWN TIMER ==================== */
  function initCountdown() {
    var storageKey = 'madar_offer_deadline';
    var deadline = Number(safeStorageGet(storageKey, '0'));
    var now = Date.now();
    if (!deadline || deadline <= now + 3600000) {
      deadline = now + STORE_CONFIG.OFFER_DURATION_HOURS * 3600 * 1000;
      safeStorageSet(storageKey, String(deadline));
    }

    var pad = function (n) { return String(n).padStart(2, '0'); };
    var tick = function () {
      var diff = Math.max(0, deadline - Date.now());
      var d = Math.floor(diff / (1000 * 60 * 60 * 24));
      var h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      var m = Math.floor((diff / (1000 * 60)) % 60);
      var s = Math.floor((diff / 1000) % 60);

      var dEl = $('#cdDays');
      var hEl = $('#cdHours');
      var mEl = $('#cdMins');
      var sEl = $('#cdSecs');
      if (dEl) dEl.textContent = pad(d);
      if (hEl) hEl.textContent = pad(h);
      if (mEl) mEl.textContent = pad(m);
      if (sEl) sEl.textContent = pad(s);
    };

    tick();
    setInterval(tick, 1000);
  }

  /* ==================== SCROLL EFFECTS, PARALLAX & CURSOR ==================== */
  function initVisualDelight() {
    var progress = $('#scrollProgress');
    var header = $('#siteHeader');
    var heroMedia = $('#heroMedia');
    var backBtn = $('#backToTop');

    window.addEventListener(
      'scroll',
      function () {
        var scrollY = window.scrollY || window.pageYOffset || 0;
        var docH = document.documentElement.scrollHeight - window.innerHeight;
        var pct = docH > 0 ? Math.min(100, (scrollY / docH) * 100) : 0;
        if (progress) progress.style.width = pct + '%';
        if (header) header.classList.toggle('scrolled', scrollY > 40);
        if (backBtn) backBtn.hidden = scrollY < 450;
        if (heroMedia && scrollY < 900) {
          heroMedia.style.transform = 'translateY(' + (scrollY * 0.16) + 'px)';
        }
      },
      { passive: true }
    );

    if (backBtn) {
      backBtn.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              io.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.01, rootMargin: '0px 0px 90px 0px' }
      );
      $$('.reveal').forEach(function (el) { io.observe(el); });
    } else {
      $$('.reveal').forEach(function (el) { el.classList.add('is-visible'); });
    }

    if (window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      var dot = $('#cursorDot');
      var ring = $('#cursorRing');
      var rx = 0, ry = 0, mx = 0, my = 0;

      document.addEventListener('mousemove', function (e) {
        mx = e.clientX;
        my = e.clientY;
        document.body.classList.add('cursor-visible');
        if (dot) {
          dot.style.left = mx + 'px';
          dot.style.top = my + 'px';
        }
      });

      var animateRing = function () {
        rx += (mx - rx) * 0.18;
        ry += (my - ry) * 0.18;
        if (ring) {
          ring.style.left = rx + 'px';
          ring.style.top = ry + 'px';
        }
        requestAnimationFrame(animateRing);
      };
      animateRing();

      document.addEventListener('mouseover', function (e) {
        var interactive = e.target && e.target.closest && e.target.closest('a, button, .product-card, .cat-card, .look-card, input, select');
        document.body.classList.toggle('cursor-hover', Boolean(interactive));
      });
    }
  }

  /* ==================== EVENT BINDINGS ==================== */
  function setActiveCategory(cat) {
    state.category = cat;
    applyMood(cat);
    $$('.mood-pill').forEach(function (b) { b.classList.toggle('active', b.dataset.category === cat); });
    renderProducts();
  }

  function setSelectedRegion(regionId) {
    state.selectedRegionId = regionId;
    safeStorageSet('madar_region', regionId);
    renderDeliverySection();
    renderCart();
  }

  function bindEvents() {
    document.addEventListener('click', function (e) {
      var target = e.target;
      if (!target || !target.closest) return;

      var langBtn = target.closest('[data-lang-switch]');
      if (langBtn) {
        applyLanguage(langBtn.dataset.langSwitch);
        return;
      }

      var catJump = target.closest('[data-cat-jump]');
      if (catJump) {
        setActiveCategory(catJump.dataset.catJump);
        var shopSec = $('#shop');
        if (shopSec) shopSec.scrollIntoView({ behavior: 'smooth' });
        return;
      }

      var pill = target.closest('[data-category]');
      if (pill) {
        setActiveCategory(pill.dataset.category);
        return;
      }

      var tabBtn = target.closest('[data-tab]');
      if (tabBtn) {
        state.tab = tabBtn.dataset.tab;
        $$('.shop-tab').forEach(function (b) {
          var active = b.dataset.tab === state.tab;
          b.classList.toggle('active', active);
          b.setAttribute('aria-selected', String(active));
        });
        renderProducts();
        return;
      }

      var swatch = target.closest('[data-card-color]');
      if (swatch) {
        var partsC = swatch.dataset.cardColor.split(':');
        var prevC = state.cardSelections[partsC[0]] || { colorIdx: 0, sizeIdx: 0 };
        state.cardSelections[partsC[0]] = { colorIdx: Number(partsC[1]), sizeIdx: prevC.sizeIdx };
        renderProducts();
        return;
      }

      var szBtn = target.closest('[data-card-size]');
      if (szBtn) {
        var partsS = szBtn.dataset.cardSize.split(':');
        var prevS = state.cardSelections[partsS[0]] || { colorIdx: 0, sizeIdx: 0 };
        state.cardSelections[partsS[0]] = { colorIdx: prevS.colorIdx, sizeIdx: Number(partsS[1]) };
        renderProducts();
        return;
      }

      var wishBtn = target.closest('[data-wish-toggle]');
      if (wishBtn) {
        e.stopPropagation();
        toggleWishlist(wishBtn.dataset.wishToggle);
        return;
      }

      var wishCartBtn = target.closest('[data-wish-to-cart]');
      if (wishCartBtn) {
        var wp = state.products.find(function (x) { return x.id === wishCartBtn.dataset.wishToCart; });
        if (wp) addToCart(wp.id, wp.sizes[0], 0, wishCartBtn);
        return;
      }

      var qvTrigger = target.closest('[data-qv-open]');
      if (qvTrigger && !target.closest('button:not([data-qv-open])')) {
        openQuickView(qvTrigger.dataset.qvOpen);
        return;
      }

      var addBtn = target.closest('[data-add-cart]');
      if (addBtn) {
        var ap = state.products.find(function (x) { return x.id === addBtn.dataset.addCart; });
        if (!ap) return;
        var selA = state.cardSelections[ap.id] || { colorIdx: 0, sizeIdx: 0 };
        addToCart(ap.id, ap.sizes[selA.sizeIdx] || ap.sizes[0], selA.colorIdx || 0, addBtn);
        return;
      }

      var waCardBtn = target.closest('[data-direct-wa]');
      if (waCardBtn) {
        var dp = state.products.find(function (x) { return x.id === waCardBtn.dataset.directWa; });
        if (!dp) return;
        var selW = state.cardSelections[dp.id] || { colorIdx: 0, sizeIdx: 0 };
        openWhatsApp(buildSingleProductWhatsApp(dp, dp.sizes[selW.sizeIdx] || dp.sizes[0], dp.colors[selW.colorIdx] || dp.colors[0]));
        return;
      }

      var qtyBtn = target.closest('[data-cart-qty]');
      if (qtyBtn) {
        var pq = qtyBtn.dataset.cartQty.split(':');
        updateCartQty(Number(pq[0]), Number(pq[1]));
        return;
      }

      var remBtn = target.closest('[data-cart-remove]');
      if (remBtn) {
        removeCartItem(Number(remBtn.dataset.cartRemove));
        return;
      }

      var regPill = target.closest('[data-region-pick]');
      if (regPill) {
        setSelectedRegion(regPill.dataset.regionPick);
        return;
      }

      var sgTab = target.closest('[data-sg-tab]');
      if (sgTab) {
        state.sgTab = sgTab.dataset.sgTab;
        $$('.sg-tab').forEach(function (b) { b.classList.toggle('active', b === sgTab); });
        renderSizeGuideTable();
      }
    });

    var themeBtn = $('#themeToggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', function () {
        applyTheme(state.theme === 'dark' ? 'light' : 'dark');
      });
    }

    var searchInput = $('#searchInput');
    var searchClear = $('#searchClear');
    if (searchInput) {
      searchInput.addEventListener('input', function (e) {
        state.search = e.target.value;
        if (searchClear) searchClear.hidden = !state.search;
        renderProducts();
      });
    }
    if (searchClear) {
      searchClear.addEventListener('click', function () {
        state.search = '';
        if (searchInput) searchInput.value = '';
        searchClear.hidden = true;
        renderProducts();
      });
    }

    var priceRange = $('#priceRange');
    if (priceRange) {
      priceRange.addEventListener('input', function (e) {
        state.maxPrice = Number(e.target.value);
        updatePriceRangeLabel();
        renderProducts();
      });
    }

    var sortSelect = $('#sortSelect');
    if (sortSelect) {
      sortSelect.addEventListener('change', function (e) {
        state.sort = e.target.value;
        renderProducts();
      });
    }

    var resetFilters = function () {
      state.category = 'all';
      state.tab = 'all';
      state.search = '';
      state.maxPrice = 80;
      state.sort = 'featured';
      if (searchInput) searchInput.value = '';
      if (searchClear) searchClear.hidden = true;
      if (priceRange) priceRange.value = '80';
      if (sortSelect) sortSelect.value = 'featured';
      $$('.shop-tab').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === 'all'); });
      setActiveCategory('all');
      updatePriceRangeLabel();
    };
    var resetBtn = $('#resetFiltersBtn');
    var emptyResetBtn = $('#emptyResetBtn');
    if (resetBtn) resetBtn.addEventListener('click', resetFilters);
    if (emptyResetBtn) emptyResetBtn.addEventListener('click', resetFilters);

    var jumpSale = $('#jumpToSaleBtn');
    if (jumpSale) {
      jumpSale.addEventListener('click', function () {
        state.tab = 'sale';
        state.category = 'all';
        applyMood('all');
        $$('.mood-pill').forEach(function (b) { b.classList.toggle('active', b.dataset.category === 'all'); });
        $$('.shop-tab').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === 'sale'); });
        renderProducts();
        var shopSec = $('#shop');
        if (shopSec) shopSec.scrollIntoView({ behavior: 'smooth' });
      });
    }

    var delivSelect = $('#deliveryRegionSelect');
    var custRegSelect = $('#custRegion');
    if (delivSelect) delivSelect.addEventListener('change', function (e) { setSelectedRegion(e.target.value); });
    if (custRegSelect) custRegSelect.addEventListener('change', function (e) { setSelectedRegion(e.target.value); });

    var track = $('#reviewsTrack');
    var revNext = $('#reviewsNext');
    var revPrev = $('#reviewsPrev');
    if (revNext) {
      revNext.addEventListener('click', function () {
        if (!track) return;
        track.scrollBy({ left: 380 * (state.lang === 'ar' ? -1 : 1), behavior: 'smooth' });
      });
    }
    if (revPrev) {
      revPrev.addEventListener('click', function () {
        if (!track) return;
        track.scrollBy({ left: -380 * (state.lang === 'ar' ? -1 : 1), behavior: 'smooth' });
      });
    }

    function bindClick(sel, fn) {
      var el = $(sel);
      if (el) el.addEventListener('click', fn);
    }

    bindClick('#openCartBtn', function () { openOverlay('#cartDrawer', '#cartBackdrop'); });
    bindClick('#mobCartBtn', function () { openOverlay('#cartDrawer', '#cartBackdrop'); });
    bindClick('#closeCartBtn', closeAllOverlays);
    bindClick('#cartBackdrop', closeAllOverlays);

    bindClick('#openWishlistBtn', function () { openOverlay('#wishlistDrawer', '#wishlistBackdrop'); });
    bindClick('#mobWishlistBtn', function () { openOverlay('#wishlistDrawer', '#wishlistBackdrop'); });
    bindClick('#closeWishlistBtn', closeAllOverlays);
    bindClick('#wishlistBackdrop', closeAllOverlays);

    bindClick('#openMobileMenu', function () { openOverlay('#mobileNavDrawer', '#mobileMenuBackdrop'); });
    bindClick('#closeMobileMenu', closeAllOverlays);
    bindClick('#mobileMenuBackdrop', closeAllOverlays);
    $$('.mobile-nav-links a').forEach(function (a) { a.addEventListener('click', closeAllOverlays); });

    bindClick('#closeQuickView', closeAllOverlays);
    bindClick('#quickViewBackdrop', closeAllOverlays);

    ['#openSizeGuideTop', '#openSizeGuideShop', '#footerSizeGuideBtn'].forEach(function (sel) {
      bindClick(sel, function () { openOverlay('#sizeGuideModal', '#sizeGuideBackdrop'); });
    });
    bindClick('#closeSizeGuide', closeAllOverlays);
    bindClick('#sizeGuideBackdrop', closeAllOverlays);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAllOverlays();
    });

    bindClick('#clearCartBtn', function () {
      state.cart = [];
      saveCart();
      renderCart();
    });

    var checkoutForm = $('#checkoutForm');
    if (checkoutForm) {
      checkoutForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var errEl = $('#checkoutError');
        var name = ($('#custName') && $('#custName').value || '').trim();
        var phone = ($('#custPhone') && $('#custPhone').value || '').trim();
        var address = ($('#custAddress') && $('#custAddress').value || '').trim();
        var notes = ($('#custNotes') && $('#custNotes').value || '').trim();
        var region = getSelectedRegion();

        if (!name || !phone || !address) {
          if (errEl) {
            errEl.textContent = t('checkoutMissingError');
            errEl.hidden = false;
          }
          return;
        }

        if (errEl) errEl.hidden = true;

        var subtotalUsd = state.cart.reduce(function (sum, item) {
          var p = state.products.find(function (x) { return x.id === item.productId; });
          return sum + (p ? p.price_usd * item.qty : 0);
        }, 0);
        var deliveryUsd = subtotalUsd >= STORE_CONFIG.FREE_DELIVERY_THRESHOLD_USD ? 0 : region.feeUsd;
        var totalUsd = subtotalUsd + deliveryUsd;

        var msg = buildCartCheckoutWhatsApp({
          name: name,
          phone: phone,
          regionName: region.name,
          address: address,
          notes: notes,
          subtotalUsd: subtotalUsd,
          deliveryUsd: deliveryUsd,
          totalUsd: totalUsd
        });

        openWhatsApp(msg);
      });
    }

    [
      '#heroWhatsappBtn',
      '#saleWhatsappBtn',
      '#contactWhatsappBtn',
      '#footerWaBtn',
      '#floatingWaBtn',
      '#mobileMenuWaBtn',
      '#mobWaBtn',
      '#sgWhatsappBtn'
    ].forEach(function (sel) {
      bindClick(sel, function () { openWhatsApp(t('waGeneralGreeting')); });
    });
  }

  /* ==================== SAFE BOOTSTRAP ==================== */
  function safeRun(label, fn) {
    try {
      fn();
    } catch (err) {
      console.error('[MADAR init error in ' + label + ']:', err);
    }
  }

  function init() {
    safeRun('theme', function () { applyTheme(state.theme); });
    safeRun('mood', function () { applyMood('all'); });
    safeRun('imageFallbacks', function () { attachImageFallbacks(document); });
    safeRun('visualDelight', initVisualDelight);
    safeRun('countdown', initCountdown);
    safeRun('events', bindEvents);
    safeRun('languageAndRender', function () { applyLanguage(state.lang); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
