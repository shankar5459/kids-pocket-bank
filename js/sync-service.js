/* Pocket Money Bank — sync status & offline UX (Phase 4) */
var PocketBank = PocketBank || {};

PocketBank.syncService = (function () {
  var STATUS_LABELS = {
    online: 'Online',
    offline: 'Offline',
    syncing: 'Syncing',
    synced: 'Synced',
    error: 'Error'
  };

  var kidsMeta = { hasPendingWrites: false, fromCache: false };
  var txnMeta = { hasPendingWrites: false, fromCache: false };
  var pendingWrites = 0;
  var lastError = null;
  var listeners = [];
  var initialized = false;

  function computeStatus() {
    if (lastError) return 'error';
    if (kidsMeta.hasPendingWrites || txnMeta.hasPendingWrites || pendingWrites > 0) return 'syncing';
    if (!navigator.onLine) return 'offline';
    return 'synced';
  }

  function getStatusMessage(status) {
    if (status === 'error' && lastError) {
      return PocketBank.firebaseService.mapFirestoreError(lastError);
    }
    if (status === 'offline') {
      return 'You are offline. Cached data is shown; changes will sync when back online.';
    }
    if (status === 'syncing') {
      return 'Saving changes to the cloud…';
    }
    if (status === 'synced') {
      return 'All changes saved to the cloud.';
    }
    return STATUS_LABELS[status] || '';
  }

  function notify() {
    var status = computeStatus();
    listeners.forEach(function (fn) {
      fn(status, getStatusMessage(status), lastError);
    });
    renderIndicator(status);
  }

  function renderIndicator(status) {
    var el = document.getElementById('sync-status');
    if (!el) return;
    el.className = 'sync-status sync-status-' + status;
    el.title = getStatusMessage(status);
    var label = el.querySelector('.sync-label');
    if (label) label.textContent = STATUS_LABELS[status] || status;
  }

  function reportKidsSnapshot(metadata) {
    kidsMeta.hasPendingWrites = !!(metadata && metadata.hasPendingWrites);
    kidsMeta.fromCache = !!(metadata && metadata.fromCache);
    if (!lastError) notify();
  }

  function reportTransactionsSnapshot(metadata) {
    txnMeta.hasPendingWrites = !!(metadata && metadata.hasPendingWrites);
    txnMeta.fromCache = !!(metadata && metadata.fromCache);
    if (!lastError) notify();
  }

  function reportListenerError(source, err) {
    console.error(source + ' listener error:', err);
    lastError = err;
    notify();
  }

  function reportError(err) {
    lastError = err;
    notify();
  }

  function clearError() {
    lastError = null;
    notify();
  }

  function trackWrite(promise) {
    pendingWrites++;
    notify();
    return promise.then(function (result) {
      pendingWrites = Math.max(0, pendingWrites - 1);
      lastError = null;
      notify();
      return result;
    }, function (err) {
      pendingWrites = Math.max(0, pendingWrites - 1);
      lastError = err;
      notify();
      return Promise.reject(err);
    });
  }

  function subscribe(fn) {
    listeners.push(fn);
    fn(computeStatus(), getStatusMessage(computeStatus()), lastError);
  }

  function init() {
    if (initialized) return;
    initialized = true;

    window.addEventListener('online', function () {
      lastError = null;
      notify();
    });
    window.addEventListener('offline', notify);

    notify();
  }

  function reset() {
    kidsMeta = { hasPendingWrites: false, fromCache: false };
    txnMeta = { hasPendingWrites: false, fromCache: false };
    pendingWrites = 0;
    lastError = null;
    notify();
  }

  return {
    init: init,
    reset: reset,
    subscribe: subscribe,
    reportKidsSnapshot: reportKidsSnapshot,
    reportTransactionsSnapshot: reportTransactionsSnapshot,
    reportListenerError: reportListenerError,
    reportError: reportError,
    clearError: clearError,
    trackWrite: trackWrite,
    computeStatus: computeStatus,
    getStatusMessage: getStatusMessage
  };
})();
