/* Pocket Money Bank — data store (transactions & kids via Firestore) */
var PocketBank = PocketBank || {};

PocketBank.STORAGE_KEY = 'pocketbank.v1';
PocketBank.LEGACY_MIGRATED_KEY = 'pocketbank.legacyMigrated';

PocketBank.store = (function () {
  function readLegacyPayload() {
    try {
      var raw = localStorage.getItem(PocketBank.STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      var kids = Array.isArray(parsed.kids) ? parsed.kids : [];
      var transactions = Array.isArray(parsed.transactions) ? parsed.transactions : [];
      if (!kids.length && !transactions.length) return null;
      return { kids: kids, transactions: transactions };
    } catch (e) {
      console.warn('Failed to read legacy local data', e);
      return null;
    }
  }

  function getLegacyLocalData() {
    return readLegacyPayload();
  }

  function hasLegacyLocalData() {
    if (localStorage.getItem(PocketBank.LEGACY_MIGRATED_KEY)) return false;
    return readLegacyPayload() !== null;
  }

  function markLegacyMigrated() {
    localStorage.setItem(PocketBank.LEGACY_MIGRATED_KEY, new Date().toISOString());
  }

  function clearLocalCache() {
    localStorage.removeItem(PocketBank.STORAGE_KEY);
    localStorage.removeItem(PocketBank.LEGACY_MIGRATED_KEY);
    sessionStorage.removeItem('pocketbank.lastCategory');
    if ('caches' in window) {
      return caches.keys().then(function (keys) {
        return Promise.all(
          keys.filter(function (k) { return k.indexOf('pocketbank') === 0; })
            .map(function (k) { return caches.delete(k); })
        );
      });
    }
    return Promise.resolve();
  }

  function getRawData() {
    return {
      kids: getKids(),
      transactions: getAllTransactions()
    };
  }

  function replaceAll(newData) {
    if (!PocketBank.transactionsService || !PocketBank.transactionsService.isReady()) {
      return Promise.reject(new Error('Transaction sync is not ready. Check your connection.'));
    }
    var kids = (newData.kids || []).slice();
    var txns = (newData.transactions || []).slice();
    var kidImports = kids.map(function (kid) {
      if (PocketBank.kidsService && PocketBank.kidsService.isReady()) {
        return PocketBank.kidsService.importKid(kid);
      }
      return Promise.resolve();
    });
    return Promise.all(kidImports).then(function () {
      return PocketBank.transactionsService.replaceAll(txns);
    });
  }

  function clearAll() {
    if (!PocketBank.transactionsService || !PocketBank.transactionsService.isReady()) {
      return Promise.reject(new Error('Transaction sync is not ready. Check your connection.'));
    }
    return PocketBank.transactionsService.deleteAllTransactions();
  }

  function migrateLegacyToFirestore() {
    var legacy = readLegacyPayload();
    if (!legacy) return Promise.reject(new Error('No local data found to migrate.'));

    if (!PocketBank.kidsService || !PocketBank.kidsService.isReady()) {
      return Promise.reject(new Error('Kids sync is not ready. Check your connection.'));
    }
    if (!PocketBank.transactionsService || !PocketBank.transactionsService.isReady()) {
      return Promise.reject(new Error('Transaction sync is not ready. Check your connection.'));
    }

    var kidIds = {};
    PocketBank.kidsService.getKids().forEach(function (k) { kidIds[k.id] = true; });

    var kidImports = legacy.kids.map(function (kid) {
      return PocketBank.kidsService.importKid(kid).then(function () {
        kidIds[kid.id] = true;
      });
    });

    return Promise.all(kidImports).then(function () {
      var txns = legacy.transactions.filter(function (t) {
        return kidIds[t.kidId];
      });
      var skipped = legacy.transactions.length - txns.length;
      return PocketBank.transactionsService.importTransactions(txns).then(function () {
        markLegacyMigrated();
        return {
          kidsImported: legacy.kids.length,
          transactionsImported: txns.length,
          transactionsSkipped: skipped
        };
      });
    });
  }

  /* --- Kids (delegated to Firestore kidsService) --- */

  function getKids() {
    if (PocketBank.kidsService && PocketBank.kidsService.isReady()) {
      return PocketBank.kidsService.getKids();
    }
    return [];
  }

  function getKid(id) {
    if (PocketBank.kidsService && PocketBank.kidsService.isReady()) {
      return PocketBank.kidsService.getKid(id);
    }
    return null;
  }

  function addKid(name, avatar, color) {
    if (PocketBank.kidsService && PocketBank.kidsService.isReady()) {
      return PocketBank.kidsService.addKid(name, avatar, color);
    }
    return Promise.reject(new Error('Kids sync is not ready. Check your connection.'));
  }

  function kidNameExists(name, excludeId) {
    if (PocketBank.kidsService && PocketBank.kidsService.isReady()) {
      return PocketBank.kidsService.kidNameExists(name, excludeId);
    }
    return false;
  }

  function deleteKid(id) {
    if (PocketBank.kidsService && PocketBank.kidsService.isReady()) {
      return PocketBank.kidsService.deleteKid(id);
    }
    return Promise.reject(new Error('Kids sync is not ready. Check your connection.'));
  }

  function getTransactionCountForKid(kidId) {
    return getTransactions(kidId).length;
  }

  /* --- Transactions (delegated to Firestore transactionsService) --- */

  function ensureTransactionsReady() {
    if (!PocketBank.transactionsService || !PocketBank.transactionsService.isReady()) {
      throw new Error('Transaction sync is not ready. Check your connection.');
    }
  }

  function getTransactions(kidId) {
    if (PocketBank.transactionsService && PocketBank.transactionsService.isReady()) {
      return PocketBank.transactionsService.getTransactions(kidId);
    }
    return [];
  }

  function getAllTransactions() {
    if (PocketBank.transactionsService && PocketBank.transactionsService.isReady()) {
      return PocketBank.transactionsService.getAllTransactions();
    }
    return [];
  }

  function getTransaction(id) {
    if (PocketBank.transactionsService && PocketBank.transactionsService.isReady()) {
      return PocketBank.transactionsService.getTransaction(id);
    }
    return null;
  }

  function addTransaction(kidId, type, amountPaise, date, description, category) {
    ensureTransactionsReady();
    return PocketBank.transactionsService.addTransaction(kidId, type, amountPaise, date, description, category);
  }

  function updateTransaction(id, fields) {
    ensureTransactionsReady();
    return PocketBank.transactionsService.updateTransaction(id, fields);
  }

  function deleteTransaction(id) {
    ensureTransactionsReady();
    return PocketBank.transactionsService.deleteTransaction(id);
  }

  /* --- Derived balances & stats --- */

  function getBalance(kidId) {
    return getTransactions(kidId).reduce(function (sum, t) {
      return sum + (t.type === 'credit' ? t.amountPaise : -t.amountPaise);
    }, 0);
  }

  function getBalanceExcluding(kidId, excludeTxnId) {
    return getTransactions(kidId)
      .filter(function (t) { return t.id !== excludeTxnId; })
      .reduce(function (sum, t) {
        return sum + (t.type === 'credit' ? t.amountPaise : -t.amountPaise);
      }, 0);
  }

  function getKidStats(kidId) {
    var txns = getTransactions(kidId);
    var totalCredited = 0;
    var totalSpent = 0;
    var lastTxnDate = null;

    txns.forEach(function (t) {
      if (t.type === 'credit') totalCredited += t.amountPaise;
      else totalSpent += t.amountPaise;
      if (!lastTxnDate || t.date > lastTxnDate) lastTxnDate = t.date;
    });

    return {
      balance: totalCredited - totalSpent,
      totalCredited: totalCredited,
      totalSpent: totalSpent,
      lastTxnDate: lastTxnDate,
      txnCount: txns.length
    };
  }

  function getStatementRows(kidId, filters) {
    filters = filters || {};
    var txns = getTransactions(kidId).slice();

    txns.sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
    });

    var running = 0;
    var rows = txns.map(function (t) {
      running += t.type === 'credit' ? t.amountPaise : -t.amountPaise;
      return Object.assign({}, t, { runningBalance: running });
    });

    var filtered = rows.filter(function (r) {
      if (filters.dateFrom && r.date < filters.dateFrom) return false;
      if (filters.dateTo && r.date > filters.dateTo) return false;
      if (filters.type && filters.type !== 'all' && r.type !== filters.type) return false;
      if (filters.category && filters.category !== 'all' && r.category !== filters.category) return false;
      if (filters.search) {
        var q = filters.search.toLowerCase();
        if (r.description.toLowerCase().indexOf(q) === -1) return false;
      }
      return true;
    });

    filtered.reverse();
    return filtered;
  }

  /* --- Import validation --- */

  function validateBackupStructure(raw) {
    var envelope = raw;
    var payload = raw;

    if (raw.format === 'pocketbank-backup' || raw.format === 'kidbank-backup') {
      if (typeof raw.version !== 'number') return { ok: false, error: 'Missing backup version' };
      if (!raw.data || typeof raw.data !== 'object') return { ok: false, error: 'Missing data section' };
      payload = raw.data;
    } else if (raw.kids && raw.transactions) {
      payload = raw;
    } else {
      return { ok: false, error: 'Unrecognized backup format' };
    }

    if (!Array.isArray(payload.kids)) return { ok: false, error: 'Invalid kids data' };
    if (!Array.isArray(payload.transactions)) return { ok: false, error: 'Invalid transactions data' };

    var kidIds = {};
    for (var i = 0; i < payload.kids.length; i++) {
      var k = payload.kids[i];
      if (!k.id || typeof k.name !== 'string' || !k.name.trim()) {
        return { ok: false, error: 'Invalid kid record' };
      }
      if (kidIds[k.id]) return { ok: false, error: 'Duplicate IDs found' };
      kidIds[k.id] = true;
    }

    var txnIds = {};
    for (var j = 0; j < payload.transactions.length; j++) {
      var t = payload.transactions[j];
      if (!t.id || !t.kidId || !t.type || !t.date || typeof t.description !== 'string') {
        return { ok: false, error: 'Invalid transaction record' };
      }
      if (t.type !== 'credit' && t.type !== 'debit') {
        return { ok: false, error: 'Invalid transaction type' };
      }
      if (!Number.isInteger(t.amountPaise) || t.amountPaise <= 0) {
        return { ok: false, error: 'Invalid amount' };
      }
      if (PocketBank.CATEGORIES.indexOf(t.category) === -1) {
        return { ok: false, error: 'Invalid category' };
      }
      if (!kidIds[t.kidId]) {
        return { ok: false, error: 'Transaction references unknown kid' };
      }
      if (txnIds[t.id]) return { ok: false, error: 'Duplicate IDs found' };
      txnIds[t.id] = true;
    }

    return {
      ok: true,
      data: payload,
      exportedAt: envelope.exportedAt || null
    };
  }

  return {
    getLegacyLocalData: getLegacyLocalData,
    hasLegacyLocalData: hasLegacyLocalData,
    migrateLegacyToFirestore: migrateLegacyToFirestore,
    clearLocalCache: clearLocalCache,
    getRawData: getRawData,
    replaceAll: replaceAll,
    clearAll: clearAll,
    getKids: getKids,
    getKid: getKid,
    addKid: addKid,
    deleteKid: deleteKid,
    getTransactionCountForKid: getTransactionCountForKid,
    kidNameExists: kidNameExists,
    getTransactions: getTransactions,
    getAllTransactions: getAllTransactions,
    getTransaction: getTransaction,
    addTransaction: addTransaction,
    updateTransaction: updateTransaction,
    deleteTransaction: deleteTransaction,
    getBalance: getBalance,
    getBalanceExcluding: getBalanceExcluding,
    getKidStats: getKidStats,
    getStatementRows: getStatementRows,
    validateBackupStructure: validateBackupStructure
  };
})();
