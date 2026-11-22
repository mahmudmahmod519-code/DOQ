/* DOQ landing page motion.
 * Libraries (loaded before this file, both optional): Motion (window.Motion) and Lenis (window.Lenis).
 * Without Motion, or with prefers-reduced-motion, the page stays a static, fully readable layout.
 * Easing tokens: ease-out [0.23,1,0.32,1] for entrances, ease-in-out [0.77,0,0.175,1] for on-screen moves.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  var M = window.Motion;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The 3.5s safety timer in <head> may already have switched to the static layout.
  if (!root.classList.contains('lp-js')) return;
  if (!M || !M.animate || !M.scroll || !M.inView || reduce) {
    root.classList.remove('lp-js', 'lp-intro');
    return;
  }

  var animate = M.animate, scroll = M.scroll, inView = M.inView, stagger = M.stagger;
  var EASE_OUT = [0.23, 1, 0.32, 1];
  var EASE_IN_OUT = [0.77, 0, 0.175, 1];
  var desktop = window.matchMedia('(min-width: 768px)');

  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function clamp(v, a, b) { a = a === undefined ? 0 : a; b = b === undefined ? 1 : b; return Math.min(b, Math.max(a, v)); }
  function each(sel, fn) { $$(sel).forEach(fn); }

  root.classList.add('lp-ready');

  /* ---------- smooth scrolling (Spyker uses Lenis) ---------- */
  var lenis = null;
  if (window.Lenis) {
    try {
      lenis = new window.Lenis({ lerp: 0.1 });
      var raf = function (t) { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    } catch (e) { lenis = null; }
  }

  /* ---------- 1. hero entrance ---------- */
  var heroPlayed = false;
  function heroIn() {
    if (heroPlayed) return;
    heroPlayed = true;
    animate('.lp-hero__img', { transform: ['scale(1.18)', 'scale(1)'] }, { duration: 1.8, ease: EASE_OUT });
    animate('.lp-hero__title .lp-line > span', { transform: ['translateY(105%)', 'translateY(0%)'] },
      { duration: 1, delay: stagger(0.12, { startDelay: 0.15 }), ease: EASE_OUT });
    animate('.lp-hero__trace > span', { transform: ['scaleX(0)', 'scaleX(1)'] },
      { duration: 1.2, delay: stagger(0.05), ease: EASE_OUT });
    animate('.lp-hero__tag', { opacity: [0, 1], transform: ['translateY(-50%) scale(0.95)', 'translateY(-50%) scale(1)'] },
      { duration: 0.6, delay: 0.9, ease: EASE_OUT });
    animate('.lp-hero .lp-fade', { opacity: [0, 1], transform: ['translateY(16px)', 'translateY(0px)'] },
      { duration: 0.8, delay: stagger(0.08, { startDelay: 0.45 }), ease: EASE_OUT });
  }

  /* ---------- intro curtain (first visit of the session) ---------- */
  var curtain = $('.lp-curtain');
  if (root.classList.contains('lp-intro') && curtain) {
    if (lenis) lenis.stop();
    animate('.lp-curtain__logo, .lp-curtain__kicker', { opacity: [0, 1], transform: ['translateY(12px)', 'translateY(0px)'] },
      { duration: 0.6, delay: stagger(0.08), ease: EASE_OUT });
    animate('.lp-curtain__title > span', { transform: ['translateY(100%)', 'translateY(0%)'] },
      { duration: 0.8, delay: 0.15, ease: EASE_OUT });
    var lifted = false;
    var lift = function () {
      if (lifted) return;
      lifted = true;
      setTimeout(heroIn, 350);
      animate(curtain, { transform: ['translateY(0%)', 'translateY(-100%)'] }, { duration: 0.9, ease: EASE_IN_OUT })
        .finished.then(function () {
          root.classList.remove('lp-intro');
          if (lenis) lenis.start();
        });
    };
    curtain.addEventListener('click', lift);
    setTimeout(lift, 1300);
  } else {
    root.classList.remove('lp-intro');
    heroIn();
  }

  /* hero tag cycles through dish categories */
  var tagBox = $('.lp-hero__tag');
  var tagText = $('[data-tag-text]');
  var tags = [];
  try { tags = JSON.parse(tagBox.getAttribute('data-tags') || '[]'); } catch (e) { tags = []; }
  if (tags.length > 1) {
    var ti = 0;
    setInterval(function () {
      if (document.hidden) return;
      ti = (ti + 1) % tags.length;
      animate(tagText, { opacity: [1, 0] }, { duration: 0.2, ease: EASE_OUT }).finished.then(function () {
        tagText.textContent = tags[ti];
        animate(tagText, { opacity: [0, 1] }, { duration: 0.25, ease: EASE_OUT });
      });
    }, 2600);
  }

  /* hero leaves with the scroll */
  var hero = $('[data-hero]');
  var heroMedia = $('[data-hero-media]');
  var heroContent = $('[data-hero-content]');
  scroll(function (p) {
    heroMedia.style.transform = 'translate3d(0,' + (p * 18).toFixed(2) + '%,0)';
    heroContent.style.transform = 'translate3d(0,' + (-p * 80).toFixed(1) + 'px,0)';
    heroContent.style.opacity = String(clamp(1 - p * 1.3));
  }, { target: hero, offset: ['start start', 'end start'] });

  /* ---------- 2. pinned word-by-word reveal (Traced) ---------- */
  var story = $('[data-story]');
  var para = $('[data-words]');
  var words = [];
  if (para) {
    var text = para.textContent.trim().split(/\s+/);
    para.textContent = '';
    text.forEach(function (w, i) {
      var span = document.createElement('span');
      span.className = 'lp-word';
      span.textContent = w;
      span.style.opacity = '0.18';
      para.appendChild(span);
      if (i < text.length - 1) para.appendChild(document.createTextNode(' '));
      words.push(span);
    });
  }
  var storyBar = $('[data-story-bar]');
  var storyBg = $('[data-story-bg]');
  scroll(function (p) {
    var q = clamp((p - 0.08) / 0.8);
    var lit = q * words.length;
    for (var i = 0; i < words.length; i++) words[i].style.opacity = String(0.18 + 0.82 * clamp(lit - i));
    storyBar.style.transform = 'scaleY(' + q.toFixed(4) + ')';
    storyBg.style.transform = 'scale(' + (1.12 - p * 0.1).toFixed(4) + ')';
  }, { target: story, offset: ['start start', 'end end'] });

  /* ---------- 3. order road trip (Route 66) ---------- */
  var route = $('[data-route]');
  var cards = $$('[data-card]');
  var counter = $('[data-route-count]');
  var active = 0;
  function setActive(i) {
    if (i === active) return;
    cards[active].classList.remove('is-active');
    cards[i].classList.add('is-active');
    counter.textContent = String(i + 1).padStart(2, '0');
    active = i;
  }
  // One road for wide screens and one for phones; only the visible map is drawn each frame.
  var maps = $$('[data-map]').map(function (map) {
    var vb = map.getAttribute('data-vb').split(' ').map(Number);
    var geo = $('[data-geo]', map);
    var stops = $$('[data-stop]', map);
    return {
      el: map, vbw: vb[0], vbh: vb[1], geo: geo, len: geo.getTotalLength(),
      road: $('[data-road]', map), scooter: $('[data-scooter]', map), stops: stops,
      ats: stops.map(function (s) { return parseFloat(s.getAttribute('data-at')); })
    };
  });
  scroll(function (p) {
    var q = clamp((p - 0.04) / 0.88);
    var step = 0;
    maps.forEach(function (m) {
      var w = m.el.clientWidth, h = m.el.clientHeight;
      if (!w) return; // hidden layout
      m.road.style.strokeDashoffset = String(1 - q);
      var pt = m.geo.getPointAtLength(q * m.len);
      m.scooter.style.transform = 'translate3d(' + (pt.x / m.vbw * w).toFixed(1) + 'px,' + (pt.y / m.vbh * h).toFixed(1) + 'px,0)';
      var i = 0;
      for (var k = 0; k < m.ats.length; k++) if (q >= m.ats[k] - 0.02) i = k;
      for (var s = 0; s < m.stops.length; s++) m.stops[s].classList.toggle('is-on', s <= i);
      step = i;
    });
    setActive(step);
  }, { target: route, offset: ['start start', 'end end'] });

  /* ---------- section headings ---------- */
  each('.lp-up', function (el) {
    inView(el, function () {
      animate(el, { opacity: [0, 1], transform: ['translateY(24px)', 'translateY(0px)'] }, { duration: 0.9, ease: EASE_OUT });
    }, { amount: 0.3 });
  });

  /* ---------- 5. kitchens: image reveal + column parallax (Spyker) ---------- */
  each('[data-reveal]', function (fig) {
    // Observe the card, not the clipped figure: a fully clipped element never reports as visible.
    inView(fig.parentElement, function () {
      var img = fig.querySelector('img');
      animate(fig, { clipPath: ['inset(100% 0% 0% 0% round 1.25rem)', 'inset(0% 0% 0% 0% round 1.25rem)'] },
        { duration: 1.1, ease: EASE_IN_OUT });
      if (img) {
        animate(img, { transform: ['scale(1.25)', 'scale(1)'] }, { duration: 1.4, ease: EASE_OUT })
          .finished.then(function () { img.style.transform = ''; });
      }
    }, { amount: 0.2 });
  });

  each('[data-parallax]', function (el) {
    var k = parseFloat(el.getAttribute('data-parallax')) || 0;
    var isColumn = el.classList.contains('lp-kitchens__col');
    scroll(function (p) {
      if (isColumn && !desktop.matches) { el.style.transform = ''; return; }
      el.style.transform = 'translate3d(0,' + ((p - 0.5) * k * 420).toFixed(1) + 'px,0)';
    }, { target: el.closest('section'), offset: ['start end', 'end start'] });
  });

  /* ---------- 6. motto: line reveal + expanding frame (Spyker) ---------- */
  var motto = $('[data-motto]');
  inView(motto, function () {
    animate('.lp-motto .lp-line > span', { transform: ['translateY(105%)', 'translateY(0%)'] },
      { duration: 1, delay: stagger(0.12), ease: EASE_OUT });
    animate('.lp-motto .lp-fade', { opacity: [0, 1] }, { duration: 0.8, delay: 0.4, ease: EASE_OUT });
  }, { amount: 0.15 });

  var frame = $('[data-motto-frame]');
  var frameImg = frame.querySelector('img');
  scroll(function (p) {
    var v = 1 - p;
    var side = desktop.matches ? 16 : 5;
    frame.style.clipPath = 'inset(' + (v * 10).toFixed(2) + '% ' + (v * side).toFixed(2) + '% 0% ' + (v * side).toFixed(2) + '% round ' + (v * 28).toFixed(1) + 'px)';
    // the photo has dark bars on both sides: keep it zoomed past them
    frameImg.style.transform = 'scale(' + (1.36 - p * 0.14).toFixed(4) + ')';
  }, { target: frame, offset: ['start end', 'end end'] });

  /* ---------- 7. collage photos fade in, then drift with parallax ---------- */
  inView('.lp-collage', function () {
    animate('.lp-collage__p', { opacity: [0, 1] }, { duration: 0.9, delay: stagger(0.07), ease: EASE_OUT });
  }, { amount: 0.15 });
})();
