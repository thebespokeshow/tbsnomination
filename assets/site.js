(function () {
  'use strict';

  /* ── Meta Pixel (only loads if an ID is set in config.js) ── */
  var pid = window.TBS_PIXEL_ID;
  if (pid) {
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', pid);
    window.fbq('track', 'PageView');
  }
  window.tbsTrackLead = function (kind) {
    if (window.fbq) window.fbq('track', 'Lead', { content_name: kind });
  };

  /* ── YouTube click-to-load ── */
  document.querySelectorAll('[data-yt]').forEach(function (btn) {
    var id = btn.getAttribute('data-yt');
    btn.style.backgroundImage = 'url(https://img.youtube.com/vi/' + id + '/hqdefault.jpg)';
    btn.addEventListener('click', function () {
      var frame = btn.parentNode;
      var iframe = document.createElement('iframe');
      iframe.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0';
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      iframe.allowFullscreen = true;
      iframe.title = btn.getAttribute('aria-label') || 'TBS video';
      frame.innerHTML = '';
      frame.appendChild(iframe);
    });
  });

  /* ── Gallery lightbox ── */
  var lb = document.getElementById('lightbox');
  if (lb) {
    var lbImg = lb.querySelector('img');
    document.querySelectorAll('[data-lightbox]').forEach(function (fig) {
      fig.addEventListener('click', function () {
        var img = fig.querySelector('img');
        lbImg.src = img.currentSrc || img.src;
        lbImg.alt = img.alt;
        lb.classList.add('open');
      });
    });
    lb.addEventListener('click', function () { lb.classList.remove('open'); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') lb.classList.remove('open'); });
  }

  /* ── Generic form helper used by nominate.js and host.js ── */
  window.tbsForm = function (opts) {
    var btn = document.getElementById('btn-submit');
    var banner = document.getElementById('form-error-banner');
    var msgEl = document.getElementById('form-error-msg');
    var form = document.getElementById('tbsForm');

    function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
    function showError(msg) { msgEl.textContent = msg; banner.classList.add('visible'); }
    function clearErrors() {
      document.querySelectorAll('.field-error').forEach(function (el) { el.classList.remove('field-error'); });
      banner.classList.remove('visible');
    }
    function setLoading(on) {
      btn.disabled = on;
      btn.classList.toggle('loading', on);
      btn.querySelector('.btn-label').textContent = on ? 'Submitting…' : opts.label;
    }
    function isEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

    opts.required.concat(opts.emailField ? [opts.emailField] : []).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', function () { el.classList.remove('field-error'); banner.classList.remove('visible'); });
    });

    btn.addEventListener('click', async function () {
      clearErrors();
      var data = opts.collect(val);
      var bad = false;
      opts.required.forEach(function (id) {
        if (!val(id)) { document.getElementById(id).classList.add('field-error'); bad = true; }
      });
      if (opts.emailField && !isEmail(val(opts.emailField))) {
        document.getElementById(opts.emailField).classList.add('field-error'); bad = true;
      }
      if (bad) {
        showError('Please fill in all required fields correctly.');
        var first = document.querySelector('.field-error'); if (first) first.focus();
        return;
      }
      setLoading(true);
      try {
        var res = await fetch(opts.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        var json = {};
        try { json = await res.json(); } catch (_) {}
        if (!res.ok) throw new Error(json.error || ('Server error (' + res.status + ').'));
        form.classList.add('submitted');
        window.tbsTrackLead(opts.kind);
        window.scrollTo({ top: form.offsetTop - 120, behavior: 'smooth' });
      } catch (err) {
        showError(err.message || 'Unexpected error. Please try again shortly.');
        setLoading(false);
      }
    });
  };
})();
