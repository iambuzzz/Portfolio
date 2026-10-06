// Vercel serves this for any /assets/*.js that doesn't exist (see vercel.json).
// That only happens when the page itself is an old copy: the DevTinder page
// this domain used to serve, still in a visitor's browser cache, or a portfolio
// tab left open across a deploy. Either way it was a white screen. Load the
// current page once, at a fresh URL the browser can't answer from its cache.
(function () {
  try {
    var key = "stale-asset-reload";
    var last = Number(sessionStorage.getItem(key) || 0);
    if (Date.now() - last < 15000) return; // just did this: don't loop
    sessionStorage.setItem(key, String(Date.now()));
  } catch (e) {
    /* storage blocked: still worth one reload */
  }
  var url = new URL(location.href);
  url.searchParams.set("_r", String(Date.now()));
  location.replace(url.toString());
})();
