/* Pocket Money Bank — data store */
var PocketBank = PocketBank || {};

PocketBank.STORAGE_KEY = 'pocketbank.v1';

PocketBank.store = (function () {
  var data = { kids: [], transactions: [] };

  function load() {
    try {
      var raw = localStorage.getItem(PocketBank.STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.kids) && Array.isArray(parsed.transactions)) {
          data = parsed;
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to load data, starting fresh', e);
    }
    data = { kids: [], transactions: [] };
  }

  function save() {
    localStorage.setItem(PocketBank.STORAGE_KEY, JSON.stringify(data));
  }

  function getRawData() {
    return { kids: data.kids.slice(), transactions: data.transactions.slice() };
  }

  function replaceAll(newData) {
    data = {
      kids: newData.kids.slice(),
      transactions: newData.transactions.slice()
    };
    save();
  }

  function clearAll() {
    data = { kids: [], transactions: [] };
    save();
  }

  /* --- Kids --- */

  function getKids() {
    return data.kids.slice();
  }

  function getKid(id) {
    return data.kids.find(function (k) { return k.id === id; }) || null;
  }

  function addKid(name, avatar, color) {
    var kid = {
      id: PocketBank.generateId(),
      name: name.trim(),
      avatar: avatar || PocketBank.KID_AVATARS[0],
      color: color || PocketBank.KID_COLORS[data.kids.length % PocketBank.KID_COLORS.length],
      createdAt: new Date().toISOString()
    };
    data.kids.push(kid);
    save();
    return kid;
  }

  function kidNameExists(name, excludeId) {
    var lower = name.trim().toLowerCase();
    return data.kids.some(function (k) {
      return k.name.toLowerCase() === lower && k.id !== excludeId;
    });
  }

  /* --- Transactions --- */

  function getTransactions(kidId) {
    return data.transactions
      .filter(function (t) { return t.kidId === kidId; })
      .slice();
  }

  function getAllTransactions() {
    return data.transactions.slice();
  }

  function getTransaction(id) {
    return data.transactions.find(function (t) { return t.id === id; }) || null;
  }

  function addTransaction(kidId, type, amountPaise, date, description, category) {
    var txn = {
      id: PocketBank.generateId(),
      kidId: kidId,
      type: type,
      amountPaise: amountPaise,
      date: date,
      description: description.trim(),
      category: category,
      createdAt: new Date().toISOString()
    };
    data.transactions.push(txn);
    save();
    return txn;
  }

  function updateTransaction(id, fields) {
    var idx = data.transactions.findIndex(function (t) { return t.id === id; });
    if (idx === -1) return null;
    var allowed = ['type', 'amountPaise', 'date', 'description', 'category'];
    allowed.forEach(function (key) {
      if (fields[key] !== undefined) {
        data.transactions[idx][key] = key === 'description' ? fields[key].trim() : fields[key];
      }
    });
    save();
    return data.transactions[idx];
  }

  function deleteTransaction(id) {
    var idx = data.transactions.findIndex(function (t) { return t.id === id; });
    if (idx === -1) return false;
    data.transactions.splice(idx, 1);
    save();
    return true;
  }

  /* --- Derived balances & stats --- */

  function getBalance(kidId) {
    return data.transactions
      .filter(function (t) { return t.kidId === kidId; })
      .reduce(function (sum, t) {
        return sum + (t.type === 'credit' ? t.amountPaise : -t.amountPaise);
      }, 0);
  }

  function getBalanceExcluding(kidId, excludeTxnId) {
    return data.transactions
      .filter(function (t) { return t.kidId === kidId && t.id !== excludeTxnId; })
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

  load();

  return {
    load: load,
    save: save,
    getRawData: getRawData,
    replaceAll: replaceAll,
    clearAll: clearAll,
    getKids: getKids,
    getKid: getKid,
    addKid: addKid,
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
