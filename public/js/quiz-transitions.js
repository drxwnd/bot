// Sets the slide direction for quiz page transitions: forward when moving to a later step,
// back when going to an earlier one (Back link or the browser's back button).
// Loaded in <head> so the listeners are ready before the new page is first shown.
(function () {
  var stepOf = function () {
    var meta = document.querySelector('meta[name="quiz-step"]');
    return meta ? Number(meta.content) : 0;
  };

  window.addEventListener('pageswap', function () {
    try {
      sessionStorage.setItem('quiz-step', String(stepOf()));
    } catch (e) {}
  });

  window.addEventListener('pagereveal', function (event) {
    if (!event.viewTransition) return;
    var previous = 0;
    try {
      previous = Number(sessionStorage.getItem('quiz-step') || 0);
      sessionStorage.removeItem('quiz-step');
    } catch (e) {}
    var root = document.documentElement;
    root.dataset.quizDir = previous && stepOf() < previous ? 'back' : 'forward';
    event.viewTransition.finished.finally(function () {
      delete root.dataset.quizDir;
    });
  });

  // Light up the tapped answer so it's clear what was picked as the page moves on.
  document.addEventListener('click', function (e) {
    var opt = e.target.closest('.quiz a.opt');
    if (opt) opt.classList.add('is-chosen');
  });
})();
