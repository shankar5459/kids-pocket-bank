/* Pocket Money Bank — CSV export & print */
var PocketBank = PocketBank || {};

PocketBank.exportUtil = (function () {
  function escapeCsv(val) {
    var s = String(val == null ? '' : val);
    if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function exportStatementCsv(kid, rows) {
    var lines = ['Date,Description,Category,Credit,Debit,Balance'];
    rows.forEach(function (r) {
      lines.push([
        r.date,
        escapeCsv(r.description),
        escapeCsv(r.category),
        r.type === 'credit' ? (r.amountPaise / 100).toFixed(2) : '',
        r.type === 'debit' ? (r.amountPaise / 100).toFixed(2) : '',
        (r.runningBalance / 100).toFixed(2)
      ].join(','));
    });
    var blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = PocketBank.sanitizeFilename(kid.name) + '-statement-' + PocketBank.todayDate() + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function printStatement() {
    window.print();
  }

  return {
    exportStatementCsv: exportStatementCsv,
    printStatement: printStatement
  };
})();
