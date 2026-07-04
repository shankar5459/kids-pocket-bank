/* Pocket Money Bank — Firestore transactions sync (Phase 3) */
var PocketBank = PocketBank || {};

PocketBank.transactionsService = (function () {
  var transactions = [];
  var ready = false;
  var unsubscribe = null;
  var familyId = null;
  var BATCH_SIZE = 450;

  function getDb() {
    return PocketBank.firebaseService.getFirestore();
  }

  function currentUid() {
    var user = PocketBank.firebaseService.getCurrentUser();
    return user ? user.uid : null;
  }

  function isoToTimestamp(value) {
    if (value && value.toDate) return value;
    if (typeof value === 'string' && value) {
      return firebase.firestore.Timestamp.fromDate(new Date(value));
    }
    return firebase.firestore.FieldValue.serverTimestamp();
  }

  function normalizeTransaction(docId, data) {
    return {
      id: data.id || docId,
      kidId: data.kidId,
      type: data.type,
      amountPaise: data.amountPaise,
      date: data.date,
      description: data.description || '',
      category: data.category,
      createdAt: data.createdAt && data.createdAt.toDate
        ? data.createdAt.toDate().toISOString()
        : (data.createdAt || new Date().toISOString()),
      updatedAt: data.updatedAt && data.updatedAt.toDate
        ? data.updatedAt.toDate().toISOString()
        : (data.updatedAt || null),
      createdBy: data.createdBy || null,
      updatedBy: data.updatedBy || null
    };
  }

  function sortTransactions(list) {
    list.sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
    });
  }

  function subscribe(fid, onChange) {
    unsubscribeTransactions();
    familyId = fid;
    ready = false;

    unsubscribe = getDb()
      .collection('families').doc(fid).collection('transactions')
      .onSnapshot(function (snapshot) {
        transactions = [];
        snapshot.forEach(function (doc) {
          transactions.push(normalizeTransaction(doc.id, doc.data()));
        });
        sortTransactions(transactions);
        ready = true;
        if (onChange) onChange(transactions.slice());
      }, function (err) {
        console.error('Transactions listener error:', err);
        ready = false;
      });
  }

  function unsubscribeTransactions() {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    transactions = [];
    ready = false;
    familyId = null;
  }

  function transactionsCollection() {
    if (!familyId) throw new Error('No family selected.');
    return getDb().collection('families').doc(familyId).collection('transactions');
  }

  function runBatches(items, applyToBatch) {
    if (!items.length) return Promise.resolve();
    var chunks = [];
    for (var i = 0; i < items.length; i += BATCH_SIZE) {
      chunks.push(items.slice(i, i + BATCH_SIZE));
    }
    return chunks.reduce(function (chain, chunk) {
      return chain.then(function () {
        var batch = getDb().batch();
        chunk.forEach(function (item) {
          applyToBatch(batch, item);
        });
        return batch.commit();
      });
    }, Promise.resolve());
  }

  function docPayload(txn, uid, isNew) {
    var payload = {
      id: txn.id,
      kidId: txn.kidId,
      type: txn.type,
      amountPaise: txn.amountPaise,
      date: txn.date,
      description: (txn.description || '').trim(),
      category: txn.category,
      createdAt: isNew ? isoToTimestamp(txn.createdAt) : isoToTimestamp(txn.createdAt),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: txn.createdBy || uid,
      updatedBy: uid
    };
    return payload;
  }

  function addTransaction(kidId, type, amountPaise, date, description, category) {
    var uid = currentUid();
    var txnId = PocketBank.generateId();
    var now = firebase.firestore.FieldValue.serverTimestamp();
    var txn = {
      id: txnId,
      kidId: kidId,
      type: type,
      amountPaise: amountPaise,
      date: date,
      description: description.trim(),
      category: category,
      createdAt: now,
      updatedAt: now,
      createdBy: uid,
      updatedBy: uid
    };

    return transactionsCollection().doc(txnId).set(txn).then(function () {
      return Object.assign({}, txn, {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });
  }

  function updateTransaction(id, fields) {
    var uid = currentUid();
    var allowed = ['type', 'amountPaise', 'date', 'description', 'category'];
    var updates = {
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: uid
    };
    allowed.forEach(function (key) {
      if (fields[key] !== undefined) {
        updates[key] = key === 'description' ? fields[key].trim() : fields[key];
      }
    });
    return transactionsCollection().doc(id).update(updates).then(function () {
      var existing = transactions.find(function (t) { return t.id === id; });
      if (!existing) return null;
      return Object.assign({}, existing, updates, {
        updatedAt: new Date().toISOString()
      });
    });
  }

  function deleteTransaction(id) {
    return transactionsCollection().doc(id).delete().then(function () {
      return true;
    });
  }

  function importTransactions(txns) {
    var uid = currentUid();
    return runBatches(txns, function (batch, txn) {
      var ref = transactionsCollection().doc(txn.id);
      batch.set(ref, docPayload(txn, uid, true));
    });
  }

  function deleteAllTransactions() {
    var refs = transactions.map(function (t) {
      return transactionsCollection().doc(t.id);
    });
    return runBatches(refs, function (batch, ref) {
      batch.delete(ref);
    });
  }

  function replaceAll(txns) {
    return deleteAllTransactions().then(function () {
      return importTransactions(txns);
    });
  }

  function getTransactions(kidId) {
    return transactions.filter(function (t) { return t.kidId === kidId; }).slice();
  }

  function getAllTransactions() {
    return transactions.slice();
  }

  function getTransaction(id) {
    return transactions.find(function (t) { return t.id === id; }) || null;
  }

  function isReady() {
    return ready;
  }

  return {
    subscribe: subscribe,
    unsubscribeTransactions: unsubscribeTransactions,
    addTransaction: addTransaction,
    updateTransaction: updateTransaction,
    deleteTransaction: deleteTransaction,
    importTransactions: importTransactions,
    deleteAllTransactions: deleteAllTransactions,
    replaceAll: replaceAll,
    getTransactions: getTransactions,
    getAllTransactions: getAllTransactions,
    getTransaction: getTransaction,
    isReady: isReady
  };
})();
