/* Pocket Money Bank — app controller */
var PocketBank = PocketBank || {};

PocketBank.app = (function () {
  var state = {
    view: 'dashboard',
    statementKidId: null,
    filters: {},
    filtersOpen: false
  };

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
    var form = document.getElementById('txn-form');
    var mode = form.dataset.mode;
    var txnId = form.dataset.txnId;
    var kidId = mode === 'edit' ? form.dataset.kidId : document.getElementById('txn-kid').value;

    var data = validateTxnForm(mode, txnId, kidId);
    if (!data) return;

    var ok = await checkOverdraft(kidId, data.type, data.amountPaise, mode === 'edit' ? txnId : null);
    if (!ok) return;

    if (mode === 'edit') {
      PocketBank.store.updateTransaction(txnId, {
        type: data.type,
        amountPaise: data.amountPaise,
        date: data.date,
        description: data.description,
        category: data.category
      });
      PocketBank.views.closeModals();
      PocketBank.views.showToast('Transaction updated');
    } else {
      PocketBank.store.addTransaction(kidId, data.type, data.amountPaise, data.date, data.description, data.category);
      sessionStorage.setItem('pocketbank.lastCategory', data.category);
      PocketBank.views.closeModals();
      PocketBank.views.showToast('Transaction saved');
    }
    refresh();
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

    PocketBank.store.deleteTransaction(txnId);
    PocketBank.views.showToast('Transaction deleted');
    refresh();
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

    PocketBank.store.addKid(name, avatar);
    PocketBank.views.closeModals();
    PocketBank.views.showToast('Kid added');
    refresh();
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
        '<p><strong>This will REPLACE all data currently stored in this browser.</strong></p>' +
        '<p>Current data: ' + current.kids.length + ' kid(s), ' + current.transactions.length + ' transaction(s).</p>';

      var ok = await PocketBank.views.showConfirm(msg, 'Replace & Import', 'btn-danger');
      if (!ok) return;

      PocketBank.store.replaceAll(incoming);
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
      '<p><strong>Delete all kids and transactions?</strong></p>' +
      '<p>This will remove ' + data.kids.length + ' kid(s) and ' + data.transactions.length + ' transaction(s).</p>' +
      '<p>This cannot be undone. Export a backup first.</p>';

    var ok = await PocketBank.views.showConfirm(msg, 'Delete All', 'btn-danger');
    if (!ok) return;

    PocketBank.store.clearAll();
    state.statementKidId = null;
    state.filters = {};
    navigate('dashboard');
    PocketBank.views.showSettingsStatus('All data cleared.', 'success');
  }

  function bindEvents() {
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
        case 'clear-all':
          clearAllData();
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
    PocketBank.views.init(function () {
      bindEvents();
      navigate('dashboard');
    });
  }

  return { init: init };
})();
