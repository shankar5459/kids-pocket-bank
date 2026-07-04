/* Pocket Money Bank — Firestore kids sync (Phase 2) */
var PocketBank = PocketBank || {};

PocketBank.kidsService = (function () {
  var kids = [];
  var ready = false;
  var unsubscribe = null;
  var familyId = null;

  function getDb() {
    return PocketBank.firebaseService.getFirestore();
  }

  function normalizeKid(docId, data) {
    return {
      id: data.id || docId,
      name: data.name,
      avatar: data.avatar || PocketBank.KID_AVATARS[0],
      color: data.color || PocketBank.KID_COLORS[0],
      createdAt: data.createdAt && data.createdAt.toDate
        ? data.createdAt.toDate().toISOString()
        : (data.createdAt || new Date().toISOString()),
      updatedAt: data.updatedAt && data.updatedAt.toDate
        ? data.updatedAt.toDate().toISOString()
        : (data.updatedAt || null)
    };
  }

  function subscribe(fid, onChange) {
    unsubscribeKids();
    familyId = fid;
    ready = false;

    unsubscribe = getDb()
      .collection('families').doc(fid).collection('kids')
      .onSnapshot(function (snapshot) {
        kids = [];
        snapshot.forEach(function (doc) {
          kids.push(normalizeKid(doc.id, doc.data()));
        });
        kids.sort(function (a, b) {
          return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
        });
        ready = true;
        if (onChange) onChange(kids.slice());
      }, function (err) {
        console.error('Kids listener error:', err);
        ready = false;
      });
  }

  function unsubscribeKids() {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    kids = [];
    ready = false;
    familyId = null;
  }

  function kidsCollection() {
    if (!familyId) throw new Error('No family selected.');
    return getDb().collection('families').doc(familyId).collection('kids');
  }

  function addKid(name, avatar, color) {
    var trimmed = name.trim();
    var kidId = PocketBank.generateId();
    var now = firebase.firestore.FieldValue.serverTimestamp();
    var kid = {
      id: kidId,
      name: trimmed,
      avatar: avatar || PocketBank.KID_AVATARS[kids.length % PocketBank.KID_AVATARS.length],
      color: color || PocketBank.KID_COLORS[kids.length % PocketBank.KID_COLORS.length],
      createdAt: now,
      updatedAt: now
    };

    return kidsCollection().doc(kidId).set(kid).then(function () {
      return Object.assign({}, kid, {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });
  }

  function updateKid(id, fields) {
    var allowed = ['name', 'avatar', 'color'];
    var updates = { updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
    allowed.forEach(function (key) {
      if (fields[key] !== undefined) {
        updates[key] = key === 'name' ? fields[key].trim() : fields[key];
      }
    });
    return kidsCollection().doc(id).update(updates);
  }

  function deleteKid(id) {
    return kidsCollection().doc(id).delete();
  }

  function getKids() {
    return kids.slice();
  }

  function getKid(id) {
    return kids.find(function (k) { return k.id === id; }) || null;
  }

  function kidNameExists(name, excludeId) {
    var lower = name.trim().toLowerCase();
    return kids.some(function (k) {
      return k.name.toLowerCase() === lower && k.id !== excludeId;
    });
  }

  function importKid(kid) {
    var now = firebase.firestore.FieldValue.serverTimestamp();
    var payload = {
      id: kid.id,
      name: (kid.name || '').trim(),
      avatar: kid.avatar || PocketBank.KID_AVATARS[0],
      color: kid.color || PocketBank.KID_COLORS[0],
      createdAt: kid.createdAt ? isoToTimestamp(kid.createdAt) : now,
      updatedAt: now
    };
    return kidsCollection().doc(kid.id).set(payload, { merge: true });
  }

  function isoToTimestamp(value) {
    if (value && value.toDate) return value;
    if (typeof value === 'string' && value) {
      return firebase.firestore.Timestamp.fromDate(new Date(value));
    }
    return firebase.firestore.FieldValue.serverTimestamp();
  }

  function isReady() {
    return ready;
  }

  return {
    subscribe: subscribe,
    unsubscribeKids: unsubscribeKids,
    addKid: addKid,
    updateKid: updateKid,
    deleteKid: deleteKid,
    importKid: importKid,
    getKids: getKids,
    getKid: getKid,
    kidNameExists: kidNameExists,
    isReady: isReady
  };
})();
