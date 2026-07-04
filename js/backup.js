/* Pocket Money Bank — JSON backup export/import */
var PocketBank = PocketBank || {};

PocketBank.backup = (function () {
  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportBackup() {
    var envelope = {
      format: 'pocketbank-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: PocketBank.store.getRawData()
    };
    var json = JSON.stringify(envelope, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    downloadBlob(blob, 'pocketbank-backup-' + PocketBank.todayDate() + '.json');
  }

  function importBackup(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var parsed = JSON.parse(reader.result);
          var result = PocketBank.store.validateBackupStructure(parsed);
          if (!result.ok) {
            reject(new Error(result.error));
            return;
          }
          resolve(result);
        } catch (e) {
          reject(new Error('File is not valid JSON'));
        }
      };
      reader.onerror = function () {
        reject(new Error('Failed to read file'));
      };
      reader.readAsText(file);
    });
  }

  return {
    exportBackup: exportBackup,
    importBackup: importBackup
  };
})();
