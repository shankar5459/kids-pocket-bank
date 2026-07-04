/* Pocket Money Bank — login, family gate & auth flow */
var PocketBank = PocketBank || {};

PocketBank.auth = (function () {
  var appInitialized = false;
  var loginPending = false;

  function $(id) {
    return document.getElementById(id);
  }

  function showLogin() {
    $('auth-screen').classList.remove('hidden');
    $('family-setup-screen').classList.add('hidden');
    $('app-shell').classList.add('hidden');
    document.body.classList.remove('app-active');
    document.body.classList.remove('modal-open');
    PocketBank.kidsService.unsubscribeKids();
    PocketBank.transactionsService.unsubscribeTransactions();
    PocketBank.familyService.clearCurrentFamily();
  }

  function updateUserDisplay(user) {
    var email = user && user.email ? user.email : '';
    var headerEl = $('header-user-email');
    var settingsEl = $('settings-user-email');
    if (headerEl) headerEl.textContent = email;
    if (settingsEl) settingsEl.textContent = email;
  }

  function enterApp() {
    var familyId = PocketBank.familyService.getFamilyId();
    if (!familyId) {
      PocketBank.familySetup.show();
      return Promise.resolve();
    }

    PocketBank.familySetup.hide();
    $('auth-screen').classList.add('hidden');
    $('app-shell').classList.remove('hidden');
    document.body.classList.add('app-active');

    return new Promise(function (resolve) {
      var kidsReady = false;
      var transactionsReady = false;
      var resolved = false;

      function onDataChange() {
        if (appInitialized) {
          PocketBank.app.refresh();
        }
      }

      function tryInit() {
        if (resolved || !kidsReady || !transactionsReady) return;
        resolved = true;
        if (!appInitialized) {
          PocketBank.app.init();
          appInitialized = true;
        } else {
          PocketBank.app.refresh();
        }
        resolve();
      }

      PocketBank.kidsService.subscribe(familyId, function () {
        onDataChange();
        if (!kidsReady) {
          kidsReady = true;
          tryInit();
        }
      });
      PocketBank.transactionsService.subscribe(familyId, function () {
        onDataChange();
        if (!transactionsReady) {
          transactionsReady = true;
          tryInit();
        }
      });

      setTimeout(function () {
        if (resolved) return;
        resolved = true;
        if (!appInitialized) {
          PocketBank.app.init();
          appInitialized = true;
        } else {
          PocketBank.app.refresh();
        }
        resolve();
      }, 300);
    });
  }

  async function handleAuthenticatedUser(user) {
    setLoginError('');
    updateUserDisplay(user);

    var familyId = PocketBank.familyService.getFamilyId();

    if (familyId) {
      try {
        await PocketBank.familyService.validateAndLoadFamily(familyId, user.uid);
        await enterApp();
        return;
      } catch (err) {
        console.warn('Family validation failed:', err.message);
      }
    }

    $('auth-screen').classList.add('hidden');
    PocketBank.familySetup.show();
  }

  function setLoginError(message) {
    var el = $('login-error');
    if (!el) return;
    if (message) {
      el.textContent = message;
      el.classList.remove('hidden');
    } else {
      el.textContent = '';
      el.classList.add('hidden');
    }
  }

  function setLoginLoading(loading) {
    loginPending = loading;
    var btn = $('login-submit');
    var emailInput = $('login-email');
    var passwordInput = $('login-password');
    if (btn) {
      btn.disabled = loading;
      btn.textContent = loading ? 'Signing in…' : 'Sign in';
    }
    if (emailInput) emailInput.disabled = loading;
    if (passwordInput) passwordInput.disabled = loading;
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();
    if (loginPending) return;

    setLoginError('');

    var email = ($('login-email').value || '').trim();
    var password = $('login-password').value || '';

    if (!email) {
      setLoginError('Please enter your email address.');
      return;
    }
    if (!password) {
      setLoginError('Please enter your password.');
      return;
    }

    setLoginLoading(true);
    try {
      await PocketBank.firebaseService.login(email, password);
      $('login-password').value = '';
    } catch (err) {
      setLoginError(PocketBank.firebaseService.mapAuthError(err));
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleLogout() {
    try {
      PocketBank.kidsService.unsubscribeKids();
      PocketBank.transactionsService.unsubscribeTransactions();
      PocketBank.familyService.clearCurrentFamily();
      await PocketBank.firebaseService.logout();
    } catch (err) {
      if (PocketBank.views && PocketBank.views.showToast) {
        PocketBank.views.showToast('Could not sign out. Try again.');
      }
    }
  }

  function bindEvents() {
    var form = $('login-form');
    if (form) {
      form.addEventListener('submit', handleLoginSubmit);
    }

    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action="logout"]');
      if (btn) {
        e.preventDefault();
        handleLogout();
      }
      if (e.target.closest('[data-action="copy-invite"]')) {
        e.preventDefault();
        var family = PocketBank.familyService.getCurrentFamily();
        if (family && family.inviteCode) {
          copyText(family.inviteCode);
        }
      }
    });
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        PocketBank.views.showToast('Invite code copied');
      });
    }
  }

  function showConfigError(message) {
    showLogin();
    setLoginError(message);
    var form = $('login-form');
    if (form) {
      form.querySelectorAll('input, button').forEach(function (el) {
        el.disabled = true;
      });
    }
  }

  function start() {
    bindEvents();
    PocketBank.views.init(function () {});

    try {
      if (!PocketBank.firebaseService.isConfigReady()) {
        showConfigError('Firebase is not configured yet. Update js/firebase-config.js with your project settings.');
        return;
      }

      PocketBank.firebaseService.init();

      PocketBank.firebaseService.onAuthStateChanged(function (user) {
        if (user) {
          handleAuthenticatedUser(user);
        } else {
          appInitialized = false;
          showLogin();
        }
      });
    } catch (err) {
      showConfigError(err.message || 'Failed to initialize Firebase.');
    }
  }

  return {
    start: start,
    enterApp: enterApp,
    handleLogout: handleLogout
  };
})();

document.addEventListener('DOMContentLoaded', function () {
  PocketBank.auth.start();
});
