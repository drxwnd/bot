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
