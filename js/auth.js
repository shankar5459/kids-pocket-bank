/* Pocket Money Bank — login screen & auth gate (Phase 1) */
var PocketBank = PocketBank || {};

PocketBank.auth = (function () {
  var appInitialized = false;
  var loginPending = false;

  function $(id) {
    return document.getElementById(id);
  }

  function showLogin() {
    $('auth-screen').classList.remove('hidden');
    $('app-shell').classList.add('hidden');
    document.body.classList.remove('modal-open');
  }

  function showApp(user) {
    $('auth-screen').classList.add('hidden');
    $('app-shell').classList.remove('hidden');
    updateUserDisplay(user);
    if (!appInitialized) {
      PocketBank.app.init();
      appInitialized = true;
    }
  }

  function updateUserDisplay(user) {
    var email = user && user.email ? user.email : '';
    var headerEl = $('header-user-email');
    var settingsEl = $('settings-user-email');
    if (headerEl) headerEl.textContent = email;
    if (settingsEl) settingsEl.textContent = email;
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
    });
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

    try {
      if (!PocketBank.firebaseService.isConfigReady()) {
        showConfigError('Firebase is not configured yet. Update js/firebase-config.js with your project settings.');
        return;
      }

      PocketBank.firebaseService.init();

      PocketBank.firebaseService.onAuthStateChanged(function (user) {
        if (user) {
          setLoginError('');
          showApp(user);
        } else {
          showLogin();
        }
      });
    } catch (err) {
      showConfigError(err.message || 'Failed to initialize Firebase.');
    }
  }

  return {
    start: start,
    handleLogout: handleLogout
  };
})();

document.addEventListener('DOMContentLoaded', function () {
  PocketBank.auth.start();
});
