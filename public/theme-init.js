// Resolves the theme (light / dark) and the style before first paint, to avoid a flash. Loaded by index.html
// as a classic, blocking script (not a module: it has to run before the page is drawn), and a file of its own
// rather than inline, so the Content-Security-Policy needs no 'unsafe-inline' (vercel.json).
// Keep in sync with src/lib/theme.ts.
(function () {
  var pref = 'system';
  var look = 'classic';
  try {
    pref = localStorage.getItem('somos-theme') || 'system';
    look = localStorage.getItem('somos-look') || 'classic';
  } catch {}
  var page = {
    classic: ['#F4F1EC', '#161614'],
    talavera: ['#F2F5FB', '#0B1124'],
    barragan: ['#FAF2EF', '#190E16'],
    agave: ['#F2F5F2', '#0C191A'],
  };
  if (!page[look]) look = 'classic';
  var dark = pref === 'dark' ||
    (pref !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.look = look;
  document.querySelector('meta[name="theme-color"]')
    .setAttribute('content', page[look][dark ? 1 : 0]);
})();
