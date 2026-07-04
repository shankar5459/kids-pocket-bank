/* Pocket Money Bank — Firestore family operations (Phase 2) */
var PocketBank = PocketBank || {};

PocketBank.FAMILY_ID_KEY = 'pocketbank.familyId';

PocketBank.familyService = (function () {
  var currentFamily = null;

  function getDb() {
    return PocketBank.firebaseService.getFirestore();
  }

  function getFamilyId() {
    return localStorage.getItem(PocketBank.FAMILY_ID_KEY);
  }

  function setFamilyId(id) {
    localStorage.setItem(PocketBank.FAMILY_ID_KEY, id);
  }

  function clearFamilyId() {
    localStorage.removeItem(PocketBank.FAMILY_ID_KEY);
  }

  function clearCurrentFamily() {
    currentFamily = null;
  }

  function getCurrentFamily() {
    return currentFamily;
  }

  function normalizeFamily(data) {
    return {
      id: data.id,
      name: data.name,
      inviteCode: data.inviteCode,
      members: data.members || [],
      createdAt: data.createdAt && data.createdAt.toDate
        ? data.createdAt.toDate().toISOString()
        : (data.createdAt || null),
      updatedAt: data.updatedAt && data.updatedAt.toDate
        ? data.updatedAt.toDate().toISOString()
        : (data.updatedAt || null)
    };
  }

  function generateInviteCode() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var code = '';
    for (var i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  function createFamily(name, uid) {
    var trimmed = (name || '').trim();
    if (!trimmed) return Promise.reject(new Error('Family name is required.'));

    var familyId = PocketBank.generateId();
    var inviteCode = generateInviteCode();
    var db = getDb();
    var now = firebase.firestore.FieldValue.serverTimestamp();
    var familyRef = db.collection('families').doc(familyId);
    var inviteRef = db.collection('inviteCodes').doc(inviteCode);

    return db.runTransaction(function (transaction) {
      transaction.set(familyRef, {
        id: familyId,
        name: trimmed,
        inviteCode: inviteCode,
        members: [uid],
        createdAt: now,
        updatedAt: now
      });
      transaction.set(inviteRef, {
        familyId: familyId,
        createdAt: now
      });
      return Promise.resolve();
    }).then(function () {
      setFamilyId(familyId);
      currentFamily = {
        id: familyId,
        name: trimmed,
        inviteCode: inviteCode,
        members: [uid],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      return currentFamily;
    });
  }

  function joinFamily(inviteCode, uid) {
    var code = (inviteCode || '').trim().toUpperCase();
    if (!code) return Promise.reject(new Error('Please enter an invite code.'));

    var db = getDb();

    return db.collection('inviteCodes').doc(code).get().then(function (snap) {
      if (!snap.exists) {
        throw new Error('Invalid invite code. Please check and try again.');
      }

      var familyId = snap.data().familyId;
      var familyRef = db.collection('families').doc(familyId);

      return familyRef.update({
        members: firebase.firestore.FieldValue.arrayUnion(uid),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }).then(function () {
        setFamilyId(familyId);
        return validateAndLoadFamily(familyId, uid);
      });
    });
  }

  function validateAndLoadFamily(familyId, uid) {
    return getDb().collection('families').doc(familyId).get().then(function (snap) {
      if (!snap.exists) {
        clearFamilyId();
        throw new Error('Family not found. It may have been deleted.');
      }

      var data = snap.data();
      if (!data.members || data.members.indexOf(uid) === -1) {
        clearFamilyId();
        throw new Error('You are not a member of this family.');
      }

      currentFamily = normalizeFamily(data);
      return currentFamily;
    });
  }

  function mapError(error) {
    var code = error && error.code ? error.code : '';
    var messages = {
      'permission-denied': 'You do not have permission for this family action.',
      'not-found': 'Family or invite code not found.',
      'unavailable': 'Firestore is temporarily unavailable. Try again.',
      'failed-precondition': 'Could not complete the request. Try again.'
    };
    return messages[code] || (error && error.message) || 'Something went wrong. Please try again.';
  }

  return {
    getFamilyId: getFamilyId,
    setFamilyId: setFamilyId,
    clearFamilyId: clearFamilyId,
    clearCurrentFamily: clearCurrentFamily,
    getCurrentFamily: getCurrentFamily,
    createFamily: createFamily,
    joinFamily: joinFamily,
    validateAndLoadFamily: validateAndLoadFamily,
    mapError: mapError
  };
})();
