/* Pocket Money Bank — Firebase initialization & auth */
var PocketBank = PocketBank || {};

PocketBank.firebaseService = (function () {
  var auth = null;
  var db = null;
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
    db = firebase.firestore();
    db.enablePersistence({ synchronizeTabs: true }).catch(function (err) {
      if (err.code === 'failed-precondition') {
        console.warn('Firestore persistence unavailable: multiple tabs open.');
      } else if (err.code === 'unimplemented') {
        console.warn('Firestore persistence is not supported in this browser.');
      } else {
        console.warn('Firestore persistence failed:', err.message);
      }
    });
    initialized = true;
    return auth;
  }

  function getFirestore() {
    if (!db) init();
    return db;
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

  function mapFirestoreError(error) {
    var code = error && error.code ? error.code : '';
    var messages = {
      'permission-denied': 'You do not have permission for this action. Make sure you are signed in and part of this family.',
      'unavailable': 'Could not reach the server. Check your connection — offline changes will sync when you are back online.',
      'failed-precondition': 'This action could not be completed. Try refreshing the page.',
      'resource-exhausted': 'Too many requests. Please wait a moment and try again.',
      'unauthenticated': 'Your session expired. Please sign in again.',
      'not-found': 'This record was not found. It may have been deleted on another device.',
      'already-exists': 'This record already exists.',
      'cancelled': 'The operation was cancelled.',
      'deadline-exceeded': 'The request timed out. Check your connection and try again.'
    };
    return messages[code] || (error && error.message) || 'Something went wrong. Please try again.';
  }

  function wrapFirestoreError(err) {
    return new Error(mapFirestoreError(err));
  }

  return {
    init: init,
    isConfigReady: isConfigReady,
    getFirestore: getFirestore,
    onAuthStateChanged: onAuthStateChanged,
    login: login,
    logout: logout,
    getCurrentUser: getCurrentUser,
    mapAuthError: mapAuthError,
    mapFirestoreError: mapFirestoreError,
    wrapFirestoreError: wrapFirestoreError
  };
})();
