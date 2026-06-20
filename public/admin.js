document.addEventListener('DOMContentLoaded', function () {
  var tabs = document.querySelectorAll('.admin-tab');
  var panels = document.querySelectorAll('.admin-panel');

  function activate(name) {
    tabs.forEach(function (t) {
      t.classList.toggle('active', t.dataset.tab === name);
    });
    panels.forEach(function (p) {
      p.classList.toggle('active', p.dataset.panel === name);
    });
  }

  tabs.forEach(function (t) {
    t.addEventListener('click', function (e) {
      e.preventDefault();
      activate(t.dataset.tab);
      history.replaceState(null, '', '#' + t.dataset.tab);
    });
  });

  var initial = (location.hash || '#menu').replace('#', '');
  if (!document.querySelector('.admin-panel[data-panel="' + initial + '"]')) {
    initial = 'menu';
  }
  activate(initial);

  // confirm before any delete form submit
  document.querySelectorAll('form[data-confirm]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      if (!confirm(f.dataset.confirm)) e.preventDefault();
    });
  });
});
