/* Pocket Money Bank — family setup UI (Phase 2) */
var PocketBank = PocketBank || {};

PocketBank.familySetup = (function () {
  var pending = false;
  var createdInviteCode = null;

  function $(id) {
    return document.getElementById(id);
  }

  function setError(message) {
    var el = $('family-setup-error');
    if (!el) return;
    if (message) {
      el.textContent = message;
      el.classList.remove('hidden');
    } else {
      el.textContent = '';
      el.classList.add('hidden');
    }
  }

  function setLoading(loading) {
    pending = loading;
    var buttons = document.querySelectorAll('#family-setup-screen button[type="submit"]');
    buttons.forEach(function (btn) {
      btn.disabled = loading;
    });
  }

  function showPanel(name) {
    ['create', 'join', 'success'].forEach(function (p) {
      var el = $('family-panel-' + p);
      if (el) el.classList.toggle('hidden', p !== name);
    });
    document.querySelectorAll('.family-tab').forEach(function (tab) {
      tab.classList.toggle('active', tab.dataset.panel === name);
    });
    setError('');
  }

  function show() {
    $('family-setup-screen').classList.remove('hidden');
    $('app-shell').classList.add('hidden');
    showPanel('create');
    $('family-create-name').value = '';
    $('family-join-code').value = '';
  }

  function hide() {
    $('family-setup-screen').classList.add('hidden');
  }

  function showSuccess(inviteCode, familyName) {
    createdInviteCode = inviteCode;
    $('family-success-name').textContent = familyName;
    $('family-success-code').textContent = inviteCode;
    showPanel('success');
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (pending) return;
    setError('');

    var user = PocketBank.firebaseService.getCurrentUser();
    if (!user) return;

    var name = ($('family-create-name').value || '').trim();
    if (!name) {
      setError('Please enter a family name.');
      return;
    }

    setLoading(true);
    try {
      var family = await PocketBank.familyService.createFamily(name, user.uid);
      showSuccess(family.inviteCode, family.name);
    } catch (err) {
      setError(PocketBank.familyService.mapError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    if (pending) return;
    setError('');

    var user = PocketBank.firebaseService.getCurrentUser();
    if (!user) return;

    var code = ($('family-join-code').value || '').trim();
    if (!code) {
      setError('Please enter an invite code.');
      return;
    }

    setLoading(true);
    try {
      await PocketBank.familyService.joinFamily(code, user.uid);
      await PocketBank.auth.enterApp();
    } catch (err) {
      setError(err.message || PocketBank.familyService.mapError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleContinue() {
    await PocketBank.auth.enterApp();
  }

  function copyInviteCode() {
    if (!createdInviteCode) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(createdInviteCode).then(function () {
        PocketBank.views.showToast('Invite code copied');
      }).catch(function () {
        fallbackCopy(createdInviteCode);
      });
    } else {
      fallbackCopy(createdInviteCode);
    }
  }

  function fallbackCopy(text) {
    var input = document.createElement('input');
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    PocketBank.views.showToast('Invite code copied');
  }

  function bindEvents() {
    $('family-create-form').addEventListener('submit', handleCreate);
    $('family-join-form').addEventListener('submit', handleJoin);
    $('family-continue-btn').addEventListener('click', handleContinue);
    $('family-copy-code').addEventListener('click', copyInviteCode);

    document.querySelectorAll('.family-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        showPanel(tab.dataset.panel);
      });
    });
  }

  return {
    bindEvents: bindEvents,
    show: show,
    hide: hide
  };
})();

document.addEventListener('DOMContentLoaded', function () {
  if (document.getElementById('family-setup-screen')) {
    PocketBank.familySetup.bindEvents();
  }
});
