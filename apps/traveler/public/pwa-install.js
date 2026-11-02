// Loaded before the Expo bundle so an install offer survives navigation to Profile.
// Installation is online-only: no service worker caches availability or account data.
(function () {
  var offer = null;
  var busy = false;
  var installed = Boolean(navigator.standalone);
  var displayMode = window.matchMedia('(display-mode: standalone)');

  function state() {
    return {
      supported: window.isSecureContext,
      installed: installed || displayMode.matches,
      canPrompt: Boolean(offer),
      busy: busy,
      isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
    };
  }

  function notify() {
    window.dispatchEvent(new Event('hoysii:pwa-change'));
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    offer = event;
    notify();
  });
  window.addEventListener('appinstalled', function () {
    installed = true;
    offer = null;
    notify();
  });
  displayMode.addEventListener('change', notify);

  window.hoysiiPwa = {
    getState: state,
    install: async function () {
      if (!offer || busy || state().installed) return 'unavailable';
      var currentOffer = offer;
      // A browser's offer can only be used once, including after dismissal.
      offer = null;
      busy = true;
      notify();
      try {
        await currentOffer.prompt();
        var choice = await currentOffer.userChoice;
        if (choice.outcome === 'accepted') installed = true;
        return choice.outcome;
      } catch (_) {
        return 'unavailable';
      } finally {
        busy = false;
        notify();
      }
    },
  };
})();
