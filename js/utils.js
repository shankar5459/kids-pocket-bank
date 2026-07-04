/* Pocket Money Bank — utilities */
var PocketBank = PocketBank || {};

PocketBank.CATEGORIES = [
  'Pocket Money',
  'Allowance',
  'Gift',
  'Reward',
  'Food',
  'Toys',
  'Books',
  'Savings',
  'Other'
];

PocketBank.CATEGORY_OTHER = 'Other';

PocketBank.isPresetCategory = function (cat) {
  return PocketBank.CATEGORIES.indexOf(cat) !== -1;
};

PocketBank.getFilterCategories = function (kidId) {
  var ordered = PocketBank.CATEGORIES.slice();
  var seen = {};
  ordered.forEach(function (c) { seen[c] = true; });
  if (kidId && PocketBank.store) {
    PocketBank.store.getTransactions(kidId).forEach(function (t) {
      if (t.category && !seen[t.category]) {
        seen[t.category] = true;
        ordered.push(t.category);
      }
    });
  }
  return ordered;
};

PocketBank.KID_COLORS = ['#1E3A5F', '#059669', '#7C3AED', '#DC2626', '#D97706', '#0891B2'];
PocketBank.KID_AVATARS = [
  'icons/avatar-girl-short.png',
  'icons/avatar-girl-ponytail.png',
  '🧒',
  '👶',
  '🧑',
  '👤'
];

PocketBank.isAvatarImage = function (avatar) {
  return avatar && /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(avatar);
};

PocketBank.renderAvatarHtml = function (avatar, className) {
  className = className || 'kid-avatar';
  if (PocketBank.isAvatarImage(avatar)) {
    return '<img src="' + PocketBank.escapeHtml(avatar) + '" alt="" class="' + className + ' kid-avatar-img">';
  }
  return '<span class="' + className + '">' + (avatar || PocketBank.KID_AVATARS[0]) + '</span>';
};

PocketBank.generateId = function () {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
};

PocketBank.todayDate = function () {
  return new Date().toISOString().slice(0, 10);
};

PocketBank.formatDate = function (dateStr) {
  if (!dateStr) return '—';
  var parts = dateStr.split('-');
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return parts[2] + ' ' + months[parseInt(parts[1], 10) - 1] + ' ' + parts[0];
};

PocketBank.formatMoney = function (paise) {
  var rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(rupees);
};

PocketBank.parseAmountToPaise = function (str) {
  if (!str || typeof str !== 'string') return null;
  var trimmed = str.trim().replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  var parts = trimmed.split('.');
  var rupees = parseInt(parts[0], 10);
  var paise = parts[1] ? parseInt((parts[1] + '00').slice(0, 2), 10) : 0;
  if (rupees < 0 || paise < 0) return null;
  var total = rupees * 100 + paise;
  return total > 0 ? total : null;
};

PocketBank.paiseToInput = function (paise) {
  return (paise / 100).toFixed(2);
};

PocketBank.escapeHtml = function (str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

PocketBank.sanitizeFilename = function (name) {
  return name.replace(/[^a-z0-9\-_]/gi, '-').replace(/-+/g, '-').toLowerCase();
};

PocketBank.formatDateTime = function (iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  } catch (e) {
    return iso;
  }
};

PocketBank.formatAuditUser = function (uid) {
  var user = PocketBank.firebaseService && PocketBank.firebaseService.getCurrentUser();
  if (user && uid === user.uid) return 'you';
  if (!uid) return 'unknown';
  return 'a family member';
};

PocketBank.formatAuditMeta = function (txn) {
  if (!txn) return '';
  var lines = [];
  if (txn.createdAt) {
    lines.push('Added ' + PocketBank.formatDateTime(txn.createdAt) + ' by ' + PocketBank.formatAuditUser(txn.createdBy));
  }
  if (txn.updatedAt && txn.updatedAt !== txn.createdAt) {
    lines.push('Updated ' + PocketBank.formatDateTime(txn.updatedAt) + ' by ' + PocketBank.formatAuditUser(txn.updatedBy));
  }
  return lines.join(' · ');
};

PocketBank.txnEffect = function (txn) {
  return txn.type === 'credit' ? txn.amountPaise : -txn.amountPaise;
};
