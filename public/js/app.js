// Ask before submitting forms that can't be undone.
document.addEventListener('submit', function (e) {
  var msg = e.target.getAttribute('data-confirm');
  if (msg && !window.confirm(msg)) e.preventDefault();
});

// Job form: show which suburb will be public as the address is typed, and fill in the area tag.
(function () {
  var input = document.querySelector('[data-locate]');
  if (!input) return;
  var preview = document.getElementById('locate-preview');
  var region = document.getElementById('region');
  var autoFilled = !region.value;
  var timer;

  region.addEventListener('change', function () {
    autoFilled = false;
  });

  function check() {
    var value = input.value.trim();
    if (value.length < 3) {
      preview.textContent = '';
      return;
    }
    fetch('/api/locate?address=' + encodeURIComponent(value))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (input.value.trim() !== value) return;
        preview.className = 'locate-preview' + (data.ok ? '' : ' is-error');
        if (!data.ok) {
          preview.textContent = data.message;
          return;
        }
        preview.textContent = 'Shown publicly as ';
        var strong = document.createElement('strong');
        strong.textContent = data.suburb;
        preview.appendChild(strong);
        preview.appendChild(document.createTextNode(' · Area: ' + data.regionName));
        if (autoFilled) region.value = data.region;
      })
      .catch(function () {});
  }

  input.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(check, 350);
  });
  if (input.value) check();
})();

// Team page: copy invite links, and save a role change as soon as it's picked.
document.addEventListener('click', function (e) {
  var btn = e.target.closest('[data-copy-btn]');
  var link = e.target.closest('[data-copy-link]');
  if (!btn && !link) return;
  e.preventDefault();
  var text = btn ? btn.parentNode.querySelector('[data-copy]').value : link.href;
  var done = function () {
    var el = btn || link;
    var old = el.textContent;
    el.textContent = 'Copied';
    setTimeout(function () { el.textContent = old; }, 1500);
  };
  if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () {});
});

document.addEventListener('change', function (e) {
  if (e.target.matches('[data-autosubmit]')) e.target.form.submit();
});

document.addEventListener('click', function (e) {
  if (e.target.closest('[data-print]')) window.print();
});

// Chart tooltips: anything with data-tip shows it on hover or keyboard focus.
(function () {
  var tip = null;
  function show(el) {
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'chart-tip';
      tip.setAttribute('role', 'status');
      document.body.appendChild(tip);
    }
    tip.textContent = el.getAttribute('data-tip');
    var r = el.getBoundingClientRect();
    tip.style.display = 'block';
    var left = r.left + r.width / 2 + window.scrollX - tip.offsetWidth / 2;
    left = Math.max(8, Math.min(left, window.scrollX + document.documentElement.clientWidth - tip.offsetWidth - 8));
    tip.style.left = left + 'px';
    tip.style.top = r.top + window.scrollY - tip.offsetHeight - 8 + 'px';
  }
  function hide() {
    if (tip) tip.style.display = 'none';
  }
  document.addEventListener('mouseover', function (e) {
    var el = e.target.closest && e.target.closest('[data-tip]');
    if (el) show(el);
    else hide();
  });
  document.addEventListener('focusin', function (e) {
    var el = e.target.closest && e.target.closest('[data-tip]');
    if (el) show(el);
  });
  document.addEventListener('focusout', hide);
})();

// Photo pickers: show previews of the chosen photos before the form is sent.
document.querySelectorAll('input[type=file][data-preview]').forEach(function (input) {
  var box = document.getElementById(input.getAttribute('data-preview'));
  if (!box) return;
  input.addEventListener('change', function () {
    box.innerHTML = '';
    var max = Number(input.getAttribute('data-max') || 6);
    Array.prototype.slice.call(input.files, 0, max).forEach(function (f) {
      var fig = document.createElement('figure');
      var img = document.createElement('img');
      img.alt = '';
      img.src = URL.createObjectURL(f);
      img.onload = function () { URL.revokeObjectURL(img.src); };
      var cap = document.createElement('figcaption');
      cap.textContent = f.name.length > 22 ? f.name.slice(0, 20) + '…' : f.name;
      fig.appendChild(img);
      fig.appendChild(cap);
      box.appendChild(fig);
    });
    if (input.files.length > max) {
      var note = document.createElement('p');
      note.className = 'small muted';
      note.textContent = 'Only the first ' + max + ' will be added.';
      box.appendChild(note);
    }
    var label = input.closest('.drop');
    if (label) label.classList.toggle('has-files', input.files.length > 0);
  });
});
