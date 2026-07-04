/* Pocket Money Bank — Firebase initialization & auth (Phase 1) */
var PocketBank = PocketBank || {};

PocketBank.firebaseService = (function () {
  var auth = null;
  var initialized = false;

  function isConfigReady() {
    var cfg = PocketBank.firebaseConfig;
    if (!cfg) return false;
    return cfg.apiKey && cfg.apiKey !== 'YOUR_API_KEY' && cfg.projectId && cfg.projectId !== 'YOUR_PROJECT_ID';
  }

  function init() {
    if (initialized) return auth;
    if (typeof firebase === 'undefined') {
      throw new Error('Firebase SDK not loaded');
    }
    if (!isConfigReady()) {
      throw new Error('Firebase is not configured. Update js/firebase-config.js with your project settings.');
    }
    firebase.initializeApp(PocketBank.firebaseConfig);
    auth = firebase.auth();
    // Default persistence (LOCAL) keeps session across browser restarts.
    initialized = true;
    return auth;
  }

  function onAuthStateChanged(callback) {
    if (!auth) init();
    return auth.onAuthStateChanged(callback);
  }

  function login(email, password) {
    if (!auth) init();
    return auth.signInWithEmailAndPassword(email, password);
  }

  function logout() {
    if (!auth) return Promise.resolve();
    return auth.signOut();
  }

  function getCurrentUser() {
    return auth ? auth.currentUser : null;
  }

  function mapAuthError(error) {
    var code = error && error.code ? error.code : '';
    var messages = {
      'auth/invalid-email': 'Please enter a valid email address.',
      'auth/user-disabled': 'This account has been disabled. Contact the admin.',
      'auth/user-not-found': 'No account found with this email.',
      'auth/wrong-password': 'Incorrect password. Please try again.',
      'auth/invalid-credential': 'Invalid email or password. Please try again.',
      'auth/invalid-login-credentials': 'Invalid email or password. Please try again.',
      'auth/too-many-requests': 'Too many failed attempts. Please wait and try again.',
      'auth/network-request-failed': 'Network error. Check your connection and try again.',
      'auth/missing-password': 'Please enter your password.',
      'auth/missing-email': 'Please enter your email address.',
      'auth/weak-password': 'Password is too weak.',
      'auth/operation-not-allowed': 'Email/password sign-in is not enabled in Firebase.'
    };
    return messages[code] || (error && error.message) || 'Login failed. Please try again.';
  }

  return {
    init: init,
    isConfigReady: isConfigReady,
    onAuthStateChanged: onAuthStateChanged,
    login: login,
    logout: logout,
    getCurrentUser: getCurrentUser,
    mapAuthError: mapAuthError
  };
})();
