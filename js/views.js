/* Pocket Money Bank — UI rendering */
var PocketBank = PocketBank || {};

PocketBank.views = (function () {
  var els = {};

  function cacheElements() {
    els.app = document.getElementById('app');
    els.viewDashboard = document.getElementById('view-dashboard');
    els.viewStatement = document.getElementById('view-statement');
    els.viewSettings = document.getElementById('view-settings');
    els.kidCards = document.getElementById('kid-cards');
    els.emptyState = document.getElementById('empty-state');
    els.statementContent = document.getElementById('statement-content');
    els.statementHeader = document.getElementById('statement-header');
    els.filterPanel = document.getElementById('filter-panel');
    els.settingsStatus = document.getElementById('settings-status');
    els.toast = document.getElementById('toast');
    els.modalOverlay = document.getElementById('modal-overlay');
    els.modalKid = document.getElementById('modal-kid');
    els.modalTxn = document.getElementById('modal-txn');
    els.modalConfirm = document.getElementById('modal-confirm');
    els.confirmMessage = document.getElementById('confirm-message');
    els.confirmOk = document.getElementById('confirm-ok');
    els.confirmCancel = document.getElementById('confirm-cancel');
    els.navItems = document.querySelectorAll('.nav-item');
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(function () {
      els.toast.classList.remove('show');
    }, 2500);
  }

  function showView(name) {
    ['dashboard', 'statement', 'settings'].forEach(function (v) {
      var el = document.getElementById('view-' + v);
      if (el) el.classList.toggle('hidden', v !== name);
    });
    els.navItems.forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.view === name);
    });
  }

  function openModal(id) {
    els.modalOverlay.classList.remove('hidden');
    document.getElementById(id).classList.remove('hidden');
    document.body.classList.add('modal-open');
  }

  function closeModals() {
    els.modalOverlay.classList.add('hidden');
    ['modal-kid', 'modal-txn', 'modal-confirm'].forEach(function (id) {
      document.getElementById(id).classList.add('hidden');
    });
    document.body.classList.remove('modal-open');
  }

  function showConfirm(message, okLabel, okClass) {
    return new Promise(function (resolve) {
      els.confirmMessage.innerHTML = message;
      els.confirmOk.textContent = okLabel || 'Confirm';
      els.confirmOk.className = 'btn ' + (okClass || 'btn-primary');
      els.confirmCancel.textContent = 'Cancel';
      openModal('modal-confirm');

      function cleanup(result) {
        els.confirmOk.onclick = null;
        els.confirmCancel.onclick = null;
        closeModals();
        resolve(result);
      }

      els.confirmOk.onclick = function () { cleanup(true); };
      els.confirmCancel.onclick = function () { cleanup(false); };
    });
  }

  function renderDashboard() {
    var kids = PocketBank.store.getKids();
    els.emptyState.classList.toggle('hidden', kids.length > 0);
    els.kidCards.classList.toggle('hidden', kids.length === 0);
    var addKidBtn = document.getElementById('btn-add-kid-extra');
    if (addKidBtn) addKidBtn.classList.toggle('hidden', kids.length === 0);

    if (kids.length === 0) {
      els.kidCards.innerHTML = '';
      return;
    }

    els.kidCards.innerHTML = kids.map(function (kid) {
      var stats = PocketBank.store.getKidStats(kid.id);
      return (
        '<div class="kid-card" style="--kid-color:' + kid.color + '">' +
          '<div class="kid-card-header">' +
            '<span class="kid-avatar">' + kid.avatar + '</span>' +
            '<div><h2 class="kid-name">' + PocketBank.escapeHtml(kid.name) + '</h2>' +
            '<p class="kid-balance">' + PocketBank.formatMoney(stats.balance) + '</p></div>' +
          '</div>' +
          '<div class="kid-stats">' +
            '<div class="stat"><span class="stat-label">Credited</span><span class="stat-value credit">' + PocketBank.formatMoney(stats.totalCredited) + '</span></div>' +
            '<div class="stat"><span class="stat-label">Spent</span><span class="stat-value debit">' + PocketBank.formatMoney(stats.totalSpent) + '</span></div>' +
            '<div class="stat"><span class="stat-label">Last txn</span><span class="stat-value">' + (stats.lastTxnDate ? PocketBank.formatDate(stats.lastTxnDate) : '—') + '</span></div>' +
          '</div>' +
          '<div class="kid-actions">' +
            '<button type="button" class="btn btn-outline btn-block" data-action="statement" data-kid-id="' + kid.id + '">Statement</button>' +
            '<button type="button" class="btn btn-primary btn-block" data-action="add-txn" data-kid-id="' + kid.id + '">+ Transaction</button>' +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  function renderStatement(kidId, filters, filtersOpen) {
    var kid = PocketBank.store.getKid(kidId);
    if (!kid) return;

    filters = filters || {};
    var stats = PocketBank.store.getKidStats(kidId);
    var rows = PocketBank.store.getStatementRows(kidId, filters);

    els.statementHeader.innerHTML =
      '<button type="button" class="btn-back" data-action="back-dashboard" aria-label="Back">&larr;</button>' +
      '<div class="statement-kid-info">' +
        '<span class="kid-avatar">' + kid.avatar + '</span>' +
        '<div><h2>' + PocketBank.escapeHtml(kid.name) + '</h2>' +
        '<p class="statement-balance">' + PocketBank.formatMoney(stats.balance) + '</p></div>' +
      '</div>';

    var filterHtml =
      '<div class="filter-bar">' +
        '<button type="button" class="btn btn-outline btn-sm filter-toggle" data-action="toggle-filters">' +
          'Filters' + (countActiveFilters(filters) > 0 ? ' (' + countActiveFilters(filters) + ')' : '') + ' &#9662;' +
        '</button>' +
        '<div class="filter-actions">' +
          '<button type="button" class="btn btn-outline btn-sm" data-action="export-csv" data-kid-id="' + kidId + '">CSV</button>' +
          '<button type="button" class="btn btn-outline btn-sm" data-action="print-statement">Print</button>' +
        '</div>' +
      '</div>' +
      '<div class="filter-panel' + (filtersOpen ? '' : ' hidden') + '" id="filter-panel-inner">' +
        '<div class="form-row">' +
          '<label>From<input type="date" id="filter-date-from" value="' + (filters.dateFrom || '') + '"></label>' +
          '<label>To<input type="date" id="filter-date-to" value="' + (filters.dateTo || '') + '"></label>' +
        '</div>' +
        '<label>Type<select id="filter-type">' +
          '<option value="all"' + (filters.type === 'all' || !filters.type ? ' selected' : '') + '>All</option>' +
          '<option value="credit"' + (filters.type === 'credit' ? ' selected' : '') + '>Credit</option>' +
          '<option value="debit"' + (filters.type === 'debit' ? ' selected' : '') + '>Debit</option>' +
        '</select></label>' +
        '<label>Category<select id="filter-category">' +
          '<option value="all"' + (!filters.category || filters.category === 'all' ? ' selected' : '') + '>All</option>' +
          PocketBank.CATEGORIES.map(function (c) {
            return '<option value="' + c + '"' + (filters.category === c ? ' selected' : '') + '>' + c + '</option>';
          }).join('') +
        '</select></label>' +
        '<label>Search<input type="search" id="filter-search" placeholder="Description..." value="' + PocketBank.escapeHtml(filters.search || '') + '"></label>' +
        '<div class="filter-btns">' +
          '<button type="button" class="btn btn-primary btn-sm" data-action="apply-filters" data-kid-id="' + kidId + '">Apply</button>' +
          '<button type="button" class="btn btn-outline btn-sm" data-action="clear-filters" data-kid-id="' + kidId + '">Clear</button>' +
        '</div>' +
      '</div>';

    var listHtml;
    if (rows.length === 0) {
      listHtml = '<p class="empty-msg">No transactions found.</p>';
    } else {
      listHtml =
        '<div class="stmt-table-wrap">' +
          '<table class="stmt-table">' +
            '<thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Credit</th><th>Debit</th><th>Balance</th><th></th></tr></thead>' +
            '<tbody>' + rows.map(renderStatementRow).join('') + '</tbody>' +
          '</table>' +
        '</div>' +
        '<div class="stmt-cards">' + rows.map(renderStatementCard).join('') + '</div>';
    }

    els.statementContent.innerHTML = filterHtml + listHtml;
  }

  function renderStatementRow(r) {
    return (
      '<tr>' +
        '<td>' + PocketBank.formatDate(r.date) + '</td>' +
        '<td>' + PocketBank.escapeHtml(r.description) + '</td>' +
        '<td><span class="badge">' + PocketBank.escapeHtml(r.category) + '</span></td>' +
        '<td class="credit">' + (r.type === 'credit' ? PocketBank.formatMoney(r.amountPaise) : '') + '</td>' +
        '<td class="debit">' + (r.type === 'debit' ? PocketBank.formatMoney(r.amountPaise) : '') + '</td>' +
        '<td class="amount">' + PocketBank.formatMoney(r.runningBalance) + '</td>' +
        '<td class="row-actions">' +
          '<button type="button" class="btn-icon" data-action="edit-txn" data-txn-id="' + r.id + '" title="Edit">&#9998;</button>' +
          '<button type="button" class="btn-icon btn-icon-danger" data-action="delete-txn" data-txn-id="' + r.id + '" title="Delete">&#128465;</button>' +
        '</td>' +
      '</tr>'
    );
  }

  function renderStatementCard(r) {
    var amtClass = r.type === 'credit' ? 'credit' : 'debit';
    var sign = r.type === 'credit' ? '+' : '−';
    return (
      '<div class="stmt-card">' +
        '<div class="stmt-card-top">' +
          '<span class="stmt-date">' + PocketBank.formatDate(r.date) + '</span>' +
          '<span class="badge">' + PocketBank.escapeHtml(r.category) + '</span>' +
        '</div>' +
        '<p class="stmt-desc">' + PocketBank.escapeHtml(r.description) + '</p>' +
        '<div class="stmt-card-bottom">' +
          '<span class="stmt-amt ' + amtClass + '">' + sign + ' ' + PocketBank.formatMoney(r.amountPaise) + '</span>' +
          '<span class="stmt-bal">Balance: ' + PocketBank.formatMoney(r.runningBalance) + '</span>' +
        '</div>' +
        '<div class="stmt-card-actions">' +
          '<button type="button" class="btn btn-outline btn-sm" data-action="edit-txn" data-txn-id="' + r.id + '">Edit</button>' +
          '<button type="button" class="btn btn-outline btn-sm btn-danger-text" data-action="delete-txn" data-txn-id="' + r.id + '">Delete</button>' +
        '</div>' +
      '</div>'
    );
  }

  function countActiveFilters(f) {
    var n = 0;
    if (f.dateFrom) n++;
    if (f.dateTo) n++;
    if (f.type && f.type !== 'all') n++;
    if (f.category && f.category !== 'all') n++;
    if (f.search) n++;
    return n;
  }

  function renderSettings() {
    var data = PocketBank.store.getRawData();
    var kidCount = data.kids.length;
    var txnCount = data.transactions.length;
    document.getElementById('settings-data-summary').textContent =
      'Current data: ' + kidCount + ' kid' + (kidCount !== 1 ? 's' : '') + ', ' + txnCount + ' transaction' + (txnCount !== 1 ? 's' : '');

    var family = PocketBank.familyService && PocketBank.familyService.getCurrentFamily();
    var familyNameEl = document.getElementById('settings-family-name');
    var inviteCodeEl = document.getElementById('settings-invite-code');
    if (familyNameEl) familyNameEl.textContent = family ? family.name : '—';
    if (inviteCodeEl) inviteCodeEl.textContent = family ? family.inviteCode : '—';

    var migrationEl = document.getElementById('legacy-migration-notice');
    if (migrationEl) {
      if (PocketBank.store.hasLegacyLocalData()) {
        migrationEl.classList.remove('hidden');
      } else {
        migrationEl.classList.add('hidden');
      }
    }
  }

  function showSettingsStatus(message, type) {
    els.settingsStatus.textContent = message;
    els.settingsStatus.className = 'settings-status ' + type;
    els.settingsStatus.classList.remove('hidden');
    clearTimeout(showSettingsStatus._timer);
    showSettingsStatus._timer = setTimeout(function () {
      els.settingsStatus.classList.add('hidden');
    }, 5000);
  }

  function openKidModal() {
    document.getElementById('kid-name').value = '';
    document.getElementById('kid-name-error').textContent = '';
    var avatarPicker = document.getElementById('kid-avatar-picker');
    avatarPicker.innerHTML = PocketBank.KID_AVATARS.map(function (a, i) {
      return '<button type="button" class="avatar-opt' + (i === 0 ? ' selected' : '') + '" data-avatar="' + a + '">' + a + '</button>';
    }).join('');
    openModal('modal-kid');
  }

  function openTxnModal(mode, kidId, txnId) {
    mode = mode || 'add';
    var form = document.getElementById('txn-form');
    form.dataset.mode = mode;
    form.dataset.txnId = txnId || '';

    document.getElementById('txn-modal-title').textContent =
      mode === 'edit' ? 'Edit Transaction' : 'Add Transaction';

    var kidSelectWrap = document.getElementById('txn-kid-select-wrap');
    var kidReadonlyWrap = document.getElementById('txn-kid-readonly-wrap');

    if (mode === 'edit') {
      var txn = PocketBank.store.getTransaction(txnId);
      var kid = txn ? PocketBank.store.getKid(txn.kidId) : null;
      kidSelectWrap.classList.add('hidden');
      kidReadonlyWrap.classList.remove('hidden');
      document.getElementById('txn-kid-readonly').textContent = kid ? kid.avatar + ' ' + kid.name : '—';
      form.dataset.kidId = txn ? txn.kidId : '';
      fillTxnForm(txn);
    } else {
      kidSelectWrap.classList.remove('hidden');
      kidReadonlyWrap.classList.add('hidden');
      var kids = PocketBank.store.getKids();
      var select = document.getElementById('txn-kid');
      select.innerHTML = kids.map(function (k) {
        return '<option value="' + k.id + '"' + (k.id === kidId ? ' selected' : '') + '>' + PocketBank.escapeHtml(k.name) + '</option>';
      }).join('');
      if (!kidId && kids.length) form.dataset.kidId = kids[0].id;

      var lastCat = sessionStorage.getItem('pocketbank.lastCategory') || 'Pocket Money';
      fillTxnForm({
        type: 'credit',
        amountPaise: null,
        date: PocketBank.todayDate(),
        description: '',
        category: lastCat
      });
    }

    renderCategoryPills(form.querySelector('[name=category]').value || 'Pocket Money');
    clearTxnErrors();
    openModal('modal-txn');
  }

  function fillTxnForm(txn) {
    if (!txn) return;
    setTxnType(txn.type || 'credit');
    document.getElementById('txn-amount').value = txn.amountPaise ? PocketBank.paiseToInput(txn.amountPaise) : '';
    document.getElementById('txn-date').value = txn.date || PocketBank.todayDate();
    document.getElementById('txn-description').value = txn.description || '';
    document.querySelector('#txn-form [name=category]').value = txn.category || 'Pocket Money';
  }

  function setTxnType(type) {
    document.querySelectorAll('.type-toggle button').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.type === type);
    });
    document.getElementById('txn-type').value = type;
  }

  function renderCategoryPills(selected) {
    var container = document.getElementById('category-pills');
    container.innerHTML = PocketBank.CATEGORIES.map(function (c) {
      return '<button type="button" class="pill' + (c === selected ? ' active' : '') + '" data-category="' + c + '">' + c + '</button>';
    }).join('');
  }

  function clearTxnErrors() {
    ['txn-amount-error', 'txn-date-error', 'txn-desc-error'].forEach(function (id) {
      document.getElementById(id).textContent = '';
    });
  }

  function init(onReady) {
    cacheElements();
    if (onReady) onReady();
  }

  return {
    init: init,
    showView: showView,
    showToast: showToast,
    openModal: openModal,
    closeModals: closeModals,
    showConfirm: showConfirm,
    renderDashboard: renderDashboard,
    renderStatement: renderStatement,
    renderSettings: renderSettings,
    showSettingsStatus: showSettingsStatus,
    openKidModal: openKidModal,
    openTxnModal: openTxnModal,
    setTxnType: setTxnType,
    renderCategoryPills: renderCategoryPills,
    clearTxnErrors: clearTxnErrors,
    countActiveFilters: countActiveFilters
  };
})();
