/* Pocket Money Bank — app controller */
var PocketBank = PocketBank || {};

PocketBank.app = (function () {
  var state = {
    view: 'dashboard',
    statementKidId: null,
    filters: {},
    filtersOpen: false
  };
  var eventsBound = false;
  var savingTxn = false;

  function refresh() {
    PocketBank.views.renderDashboard();
    PocketBank.views.renderSettings();
    if (state.view === 'statement' && state.statementKidId) {
      PocketBank.views.renderStatement(state.statementKidId, state.filters, state.filtersOpen);
    }
  }

  function navigate(view, kidId) {
    state.view = view;
    if (kidId) state.statementKidId = kidId;
    PocketBank.views.showView(view);
    refresh();
  }

  function readFiltersFromDom() {
    var dateFrom = document.getElementById('filter-date-from');
    var dateTo = document.getElementById('filter-date-to');
    var type = document.getElementById('filter-type');
    var category = document.getElementById('filter-category');
    var search = document.getElementById('filter-search');
    return {
      dateFrom: dateFrom ? dateFrom.value : '',
      dateTo: dateTo ? dateTo.value : '',
      type: type ? type.value : 'all',
      category: category ? category.value : 'all',
      search: search ? search.value.trim() : ''
    };
  }

  function validateTxnForm(mode, txnId, kidId) {
    PocketBank.views.clearTxnErrors();
    var type = document.getElementById('txn-type').value;
    var amountStr = document.getElementById('txn-amount').value;
    var date = document.getElementById('txn-date').value;
    var description = document.getElementById('txn-description').value.trim();
    var category = document.querySelector('#txn-form [name=category]').value;
    var valid = true;

    var amountPaise = PocketBank.parseAmountToPaise(amountStr);
    if (!amountPaise) {
      document.getElementById('txn-amount-error').textContent = 'Enter a valid amount greater than 0';
      valid = false;
    }
    if (!date) {
      document.getElementById('txn-date-error').textContent = 'Date is required';
      valid = false;
    }
    if (!description) {
      document.getElementById('txn-desc-error').textContent = 'Description is required';
      valid = false;
    }
    if (!category || PocketBank.CATEGORIES.indexOf(category) === -1) {
      valid = false;
    }

    if (!valid) return null;

    return { type: type, amountPaise: amountPaise, date: date, description: description, category: category, kidId: kidId, txnId: txnId, mode: mode };
  }

  function checkOverdraft(kidId, type, amountPaise, excludeTxnId) {
    if (type !== 'debit') return Promise.resolve(true);

    var balance = excludeTxnId
      ? PocketBank.store.getBalanceExcluding(kidId, excludeTxnId)
      : PocketBank.store.getBalance(kidId);

    if (amountPaise <= balance) return Promise.resolve(true);

    var kid = PocketBank.store.getKid(kidId);
    var newBal = balance - amountPaise;
    var msg =
      '<p><strong>This will take ' + PocketBank.escapeHtml(kid.name) + ' to ' + PocketBank.formatMoney(newBal) + '.</strong></p>' +
      '<p>Continue anyway?</p>';

    return PocketBank.views.showConfirm(msg, 'Continue', 'btn-primary');
  }

  async function saveTransaction() {
    if (savingTxn) return;

    var form = document.getElementById('txn-form');
    var mode = form.dataset.mode;
    var txnId = form.dataset.txnId;
    var kidId = mode === 'edit' ? form.dataset.kidId : document.getElementById('txn-kid').value;

    var data = validateTxnForm(mode, txnId, kidId);
    if (!data) return;

    savingTxn = true;
    var submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      var ok = await checkOverdraft(kidId, data.type, data.amountPaise, mode === 'edit' ? txnId : null);
      if (!ok) return;

      if (mode === 'edit') {
        await PocketBank.store.updateTransaction(txnId, {
          type: data.type,
          amountPaise: data.amountPaise,
          date: data.date,
          description: data.description,
          category: data.category
        });
        PocketBank.views.closeModals();
        PocketBank.views.showToast('Transaction updated');
      } else {
        await PocketBank.store.addTransaction(kidId, data.type, data.amountPaise, data.date, data.description, data.category);
        sessionStorage.setItem('pocketbank.lastCategory', data.category);
        PocketBank.views.closeModals();
        PocketBank.views.showToast('Transaction saved');
      }
      refresh();
    } catch (err) {
      PocketBank.views.showToast(err.message || 'Failed to save transaction.');
    } finally {
      savingTxn = false;
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  async function deleteTransaction(txnId) {
    var txn = PocketBank.store.getTransaction(txnId);
    if (!txn) return;

    var kid = PocketBank.store.getKid(txn.kidId);
    var typeLabel = txn.type === 'credit' ? 'credit' : 'debit';
    var msg =
      '<p><strong>Delete this transaction?</strong></p>' +
      '<p>' + PocketBank.formatMoney(txn.amountPaise) + ' ' + typeLabel + ' — "' + PocketBank.escapeHtml(txn.description) + '" on ' + PocketBank.formatDate(txn.date) + '</p>' +
      '<p>This will update ' + PocketBank.escapeHtml(kid.name) + '\'s balance.</p>';

    var ok = await PocketBank.views.showConfirm(msg, 'Delete', 'btn-danger');
    if (!ok) return;

    try {
      await PocketBank.store.deleteTransaction(txnId);
      PocketBank.views.showToast('Transaction deleted');
      refresh();
    } catch (err) {
      PocketBank.views.showToast(err.message || 'Failed to delete transaction.');
    }
  }

  async function saveKid() {
    var name = document.getElementById('kid-name').value.trim();
    var errEl = document.getElementById('kid-name-error');
    errEl.textContent = '';

    if (!name) {
      errEl.textContent = 'Name is required';
      return;
    }
    if (PocketBank.store.kidNameExists(name)) {
      errEl.textContent = 'A kid with this name already exists';
      return;
    }

    var selectedAvatar = document.querySelector('.avatar-opt.selected');
    var avatar = selectedAvatar ? selectedAvatar.dataset.avatar : PocketBank.KID_AVATARS[0];

    try {
      await PocketBank.store.addKid(name, avatar);
      PocketBank.views.closeModals();
      PocketBank.views.showToast('Kid added');
      refresh();
    } catch (err) {
      errEl.textContent = err.message || 'Failed to add kid. Try again.';
    }
  }

  async function handleImport(file) {
    try {
      var result = await PocketBank.backup.importBackup(file);
      var incoming = result.data;
      var current = PocketBank.store.getRawData();
      var dateLabel = result.exportedAt ? new Date(result.exportedAt).toLocaleDateString('en-IN') : 'unknown date';

      var msg =
        '<p><strong>Import backup from ' + dateLabel + '?</strong></p>' +
        '<p>This backup contains ' + incoming.kids.length + ' kid(s) and ' + incoming.transactions.length + ' transaction(s).</p>' +
        '<p><strong>This will REPLACE all kids and transactions in your family cloud.</strong></p>' +
        '<p>Current data: ' + current.kids.length + ' kid(s), ' + current.transactions.length + ' transaction(s).</p>' +
        '<p>This cannot be undone. Export a backup first if you are unsure.</p>';

      var ok = await PocketBank.views.showConfirm(msg, 'Replace & Import', 'btn-danger');
      if (!ok) return;

      await PocketBank.store.replaceAll(incoming);
      state.statementKidId = null;
      state.filters = {};
      navigate('dashboard');
      PocketBank.views.showSettingsStatus('Backup imported successfully.', 'success');
    } catch (e) {
      PocketBank.views.showSettingsStatus(e.message || 'Import failed', 'error');
    }
  }

  async function clearAllData() {
    var data = PocketBank.store.getRawData();
    var msg =
      '<p><strong>Delete all family transactions?</strong></p>' +
      '<p>This will remove ' + data.transactions.length + ' transaction(s) from your family cloud.</p>' +
      '<p>Kid profiles are not deleted.</p>' +
      '<p>This cannot be undone. Export a backup first.</p>';

    var ok = await PocketBank.views.showConfirm(msg, 'Delete All', 'btn-danger');
    if (!ok) return;

    try {
      await PocketBank.store.clearAll();
      state.statementKidId = null;
      state.filters = {};
      navigate('dashboard');
      PocketBank.views.showSettingsStatus('All transactions deleted.', 'success');
    } catch (err) {
      PocketBank.views.showSettingsStatus(err.message || 'Failed to clear transactions.', 'error');
    }
  }

  async function migrateLegacyData() {
    var legacy = PocketBank.store.getLegacyLocalData();
    if (!legacy) return;

    var msg =
      '<p><strong>Migrate local data to your family cloud?</strong></p>' +
      '<p>Found ' + legacy.kids.length + ' kid(s) and ' + legacy.transactions.length + ' transaction(s) stored locally in this browser.</p>' +
      '<p>This will upload them to Firestore. Your local copy will <strong>not</strong> be deleted automatically.</p>' +
      '<p>Transactions for unknown kids will be skipped.</p>';

    var ok = await PocketBank.views.showConfirm(msg, 'Migrate to Cloud', 'btn-primary');
    if (!ok) return;

    try {
      var result = await PocketBank.store.migrateLegacyToFirestore();
      var status =
        'Migrated ' + result.kidsImported + ' kid(s) and ' + result.transactionsImported + ' transaction(s).';
      if (result.transactionsSkipped) {
        status += ' Skipped ' + result.transactionsSkipped + ' transaction(s) with unknown kids.';
      }
      PocketBank.views.showSettingsStatus(status, 'success');
      refresh();
    } catch (err) {
      PocketBank.views.showSettingsStatus(err.message || 'Migration failed.', 'error');
    }
  }

  async function deleteKid(kidId) {
    var kid = PocketBank.store.getKid(kidId);
    if (!kid) return;

    var txnCount = PocketBank.store.getTransactionCountForKid(kidId);
    var msg;
    if (txnCount > 0) {
      msg =
        '<p><strong>Delete ' + PocketBank.escapeHtml(kid.name) + '?</strong></p>' +
        '<p>This kid has <strong>' + txnCount + ' transaction(s)</strong> in the cloud.</p>' +
        '<p>Deleting the kid will <strong>not</strong> delete those transactions — they will become orphaned.</p>' +
        '<p>Are you sure you want to delete this kid profile?</p>';
    } else {
      msg =
        '<p><strong>Delete ' + PocketBank.escapeHtml(kid.name) + '?</strong></p>' +
        '<p>This kid has no transactions. The profile will be removed from your family.</p>';
    }

    var ok = await PocketBank.views.showConfirm(msg, 'Delete Kid', 'btn-danger');
    if (!ok) return;

    try {
      await PocketBank.store.deleteKid(kidId);
      if (state.statementKidId === kidId) {
        state.statementKidId = null;
        navigate('dashboard');
      } else {
        refresh();
      }
      PocketBank.views.showToast('Kid deleted');
    } catch (err) {
      PocketBank.views.showToast(err.message || 'Failed to delete kid.');
    }
  }

  async function clearLocalCache() {
    var msg =
      '<p><strong>Clear local cache?</strong></p>' +
      '<p>This removes legacy localStorage data and cached app files on this device.</p>' +
      '<p>Your cloud data in Firestore is <strong>not</strong> deleted.</p>' +
      '<p>You stay signed in. Reload the app after clearing.</p>';

    var ok = await PocketBank.views.showConfirm(msg, 'Clear Cache', 'btn-primary');
    if (!ok) return;

    try {
      await PocketBank.store.clearLocalCache();
      PocketBank.views.showSettingsStatus('Local cache cleared. Reloading…', 'success');
      setTimeout(function () { window.location.reload(); }, 1200);
    } catch (err) {
      PocketBank.views.showSettingsStatus(err.message || 'Failed to clear cache.', 'error');
    }
  }

  async function offerLegacyMigration() {
    if (!PocketBank.store.hasLegacyLocalData()) return;
    await migrateLegacyData();
  }

  function bindEvents() {
    if (eventsBound) return;
    eventsBound = true;

    document.getElementById('app').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var action = btn.dataset.action;

      switch (action) {
        case 'statement':
          state.filters = {};
          state.filtersOpen = false;
          navigate('statement', btn.dataset.kidId);
          break;
        case 'add-txn':
          if (PocketBank.store.getKids().length === 0) {
            PocketBank.views.showToast('Add a kid first');
            return;
          }
          PocketBank.views.openTxnModal('add', btn.dataset.kidId);
          break;
        case 'back-dashboard':
          navigate('dashboard');
          break;
        case 'toggle-filters':
          state.filtersOpen = !state.filtersOpen;
          refresh();
          break;
        case 'apply-filters':
          state.filters = readFiltersFromDom();
          refresh();
          break;
        case 'clear-filters':
          state.filters = {};
          state.filtersOpen = state.filtersOpen;
          refresh();
          break;
        case 'export-csv': {
          var kid = PocketBank.store.getKid(btn.dataset.kidId);
          var rows = PocketBank.store.getStatementRows(btn.dataset.kidId, state.filters);
          PocketBank.exportUtil.exportStatementCsv(kid, rows);
          break;
        }
        case 'print-statement':
          PocketBank.exportUtil.printStatement();
          break;
        case 'edit-txn':
          PocketBank.views.openTxnModal('edit', null, btn.dataset.txnId);
          break;
        case 'delete-txn':
          deleteTransaction(btn.dataset.txnId);
          break;
        case 'add-kid':
          PocketBank.views.openKidModal();
          break;
        case 'export-backup':
          PocketBank.backup.exportBackup();
          PocketBank.views.showSettingsStatus('Backup downloaded.', 'success');
          break;
        case 'delete-kid':
          deleteKid(btn.dataset.kidId);
          break;
        case 'clear-all':
          clearAllData();
          break;
        case 'clear-cache':
          clearLocalCache();
          break;
        case 'migrate-legacy':
          migrateLegacyData();
          break;
      }
    });

    document.querySelectorAll('.nav-item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var view = btn.dataset.view;
        if (view === 'add') {
          if (PocketBank.store.getKids().length === 0) {
            PocketBank.views.showToast('Add a kid first');
            return;
          }
          PocketBank.views.openTxnModal('add');
          return;
        }
        navigate(view);
      });
    });

    document.getElementById('modal-overlay').addEventListener('click', function (e) {
      if (e.target === document.getElementById('modal-overlay')) {
        PocketBank.views.closeModals();
      }
    });

    document.querySelectorAll('.modal-close').forEach(function (btn) {
      btn.addEventListener('click', function () {
        PocketBank.views.closeModals();
      });
    });

    document.getElementById('kid-form').addEventListener('submit', function (e) {
      e.preventDefault();
      saveKid();
    });

    document.getElementById('txn-form').addEventListener('submit', function (e) {
      e.preventDefault();
      saveTransaction();
    });

    document.getElementById('app').addEventListener('click', function (e) {
      if (e.target.closest('.type-toggle button')) {
        var tbtn = e.target.closest('.type-toggle button');
        PocketBank.views.setTxnType(tbtn.dataset.type);
      }
      if (e.target.closest('.pill')) {
        var pill = e.target.closest('.pill');
        document.querySelector('#txn-form [name=category]').value = pill.dataset.category;
        PocketBank.views.renderCategoryPills(pill.dataset.category);
      }
      if (e.target.closest('.avatar-opt')) {
        document.querySelectorAll('.avatar-opt').forEach(function (a) { a.classList.remove('selected'); });
        e.target.closest('.avatar-opt').classList.add('selected');
      }
    });

    document.getElementById('import-file').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (file) handleImport(file);
      e.target.value = '';
    });

    document.getElementById('btn-import').addEventListener('click', function () {
      document.getElementById('import-file').click();
    });
  }

  function init() {
    if (PocketBank.syncService) PocketBank.syncService.init();
    PocketBank.views.init(function () {
      if (!eventsBound) {
        bindEvents();
        navigate('dashboard');
        offerLegacyMigration();
      }
    });
  }

  return { init: init, refresh: refresh, offerLegacyMigration: offerLegacyMigration };
})();
