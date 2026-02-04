/**
 * IGServiceAPI - Standalone API wrapper for IG/DT webservice.jsp backend
 *
 * No jQuery required. No dependency on existing IGPlugin/DTPlugin code.
 * Uses native fetch() and returns Promises.
 *
 * Usage:
 *   var api = new IGServiceAPI('//localhost:8010', { rowsPerPage: 50, startRow: 1 });
 *   api.view('MyTransaction').then(function(result) { ... }); // uses 50 rows, start at 1
 *   api.create('MyTransaction', { Name: 'John', Age: '30' }).then(function(result) { ... });
 *   api.app('appMyCustomFunc', { key: 'val' }).then(function(result) { ... });
 */
(function(root) {
  'use strict';

  // ---- Filter delimiter constants (must match backend expectations) ----
  var FILTER_EQUALS  = '|^;.C.|^;';
  var FILTER_EXACT   = '|^;.IET.|^;';
  var FILTER_AND     = '|$;';
  var FILTER_OR      = '|#;';

  // ---- URL path constants ----
  var CONNECT_SUBD        = '/apps/';
  var CONNECT_WEBSVC      = 'webservice.jsp?';
  var CONNECT_NOSESSIONFN = CONNECT_SUBD + CONNECT_WEBSVC + 'wsrvformat=json&wsrvfunc=';

  /**
   * @constructor
   * @param {string} baseUrl - Server origin, e.g. '//localhost:8010'
   * @param {object} [opts]
   * @param {number} [opts.rowsPerPage=25] - Default rows per page for view/app calls
   * @param {number} [opts.startRow=1] - Default starting row for view/app calls
   */
  function IGServiceAPI(baseUrl, opts) {
    opts = opts || {};
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.rowsPerPage = opts.rowsPerPage || 25;
    this.startRow = opts.startRow || 1;
  }

  // ---- Internal helpers ----

  function buildFilterString(filter, paramName) {
    if (!filter || !filter.length) return '';
    var str = '';
    for (var i = 0; i < filter.length; i++) {
      if (i === 0)
        str += paramName;
      else
        str += FILTER_AND;

      var z = filter[i];
      var filterType = FILTER_EQUALS;
      if (z.length > 2 && z[2] === 'exact')
        filterType = FILTER_EXACT;
      str += z[0] + filterType + z[1];
    }
    return str;
  }

  function serializeData(dataObj) {
    if (!dataObj) return '';
    var str = '';
    for (var key in dataObj) {
      if (dataObj.hasOwnProperty(key)) {
        str += '&' + key + '=' + dataObj[key];
      }
    }
    return str;
  }

  function buildFieldSet(dataDef) {
    var fs = {};
    if (!dataDef) return fs;
    for (var i = 0; i < dataDef.length; i++) {
      var name = dataDef[i]['DisplayName'];
      fs[name] = dataDef[i]['ColNum'];
      fs[name.replace(/ /g, '')] = dataDef[i]['ColNum'];
    }
    return fs;
  }

  /**
   * Core request method.
   *
   * @param {string} type - Operation type
   * @param {string} transaction - Transaction/function name
   * @param {object} [opts]
   * @param {object} [opts.data] - Key/value data object
   * @param {Array|string} [opts.filter] - Filter array or eid string (for edit)
   * @param {number} [opts.rowsPerPage=25]
   * @param {number} [opts.startRow=1]
   * @param {boolean} [opts.silent=false]
   * @param {FormData} [opts.formData] - For file uploads (attach type)
   * @returns {Promise}
   */
  IGServiceAPI.prototype.request = function(type, transaction, opts) {
    opts = opts || {};
    var rpp      = opts.rowsPerPage || this.rowsPerPage;
    var frow     = opts.startRow || this.startRow;
    var silent   = opts.silent || false;
    var data     = opts.data || {};
    var filter   = opts.filter || null;
    var formData = opts.formData || null;

    var url = this.baseUrl + CONNECT_NOSESSIONFN;
    var submitStr = '';

    // Build URL based on operation type
    switch (type.toLowerCase()) {
      case 'login':
        url += 'signin';
        break;
      case 'view':
        url += '&action=display&pagename=list.jsp&func=display&tran=' + transaction + '&frow=' + frow + '&rpp=' + rpp + '&silentfunc=true';
        break;
      case 'edit':
        url += '&action=display&pagename=edit.jsp&func=edit&tran=' + transaction + '&silentfunc=true';
        break;
      case 'editall':
        url += '&action=display&pagename=edit.jsp&func=editall&tran=' + transaction + '&silentfunc=true';
        break;
      case 'create':
      case 'new':
        url += '&action=display&pagename=edit.jsp&func=editadd&tran=' + transaction + '&silentfunc=true';
        break;
      case 'delete':
        url += '&action=display&pagename=list.jsp&func=delete&tran=' + transaction + '&silentfunc=true';
        break;
      case 'app':
        url += '&func=' + transaction + '&frow=' + frow + '&rpp=' + rpp + '&silentfunc=true';
        break;
      case 'attach':
        url += '&func=' + transaction + '&silentfunc=true';
        break;
      case 'rowcount':
        url += 'func=displayrowct&tran=' + transaction + '&silentfunc=true';
        break;
      case 'custom':
        url = this.baseUrl + CONNECT_SUBD + transaction;
        break;
    }

    // Serialize data fields
    submitStr += serializeData(data);

    // Build filter / eid portion
    if (type === 'edit' || type === 'editall') {
      if (typeof filter === 'string') {
        submitStr += '&eid=' + filter;
      } else if (filter && filter.length) {
        submitStr += '&eid=' + filter[0] + FILTER_EXACT + filter[1];
      }
    } else if (type !== 'login') {
      var filterParam = (type === 'delete') ? '&eid=' : '&rtfilter=';
      submitStr += buildFilterString(filter, filterParam);
    }

    // Execute request
    if (type.toLowerCase() === 'attach' && formData) {
      return fetch(url + submitStr, {
        method: 'POST',
        body: formData
      }).then(function(response) {
        return response.json();
      });
    }

    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: submitStr
    })
    .then(function(response) {
      return response.json();
    })
    .then(function(DATA) {
      if (DATA.rsp.stat !== 'ok') {
        var err = new Error(DATA.rsp.errormsg || 'Unknown server error');
        err.response = DATA;
        throw err;
      }

      var fieldSet = buildFieldSet(DATA.rsp.DataDef);

      return {
        raw: DATA,
        data: DATA.rsp.Data || null,
        fieldSet: fieldSet,
        transaction: DATA.rsp.Transaction || null,
        view: DATA.rsp.CurrViewName || null,
        sql: DATA.rsp.SQL || null
      };
    });
  };

  // ---- Convenience methods ----

  IGServiceAPI.prototype.view = function(transaction, opts) {
    return this.request('view', transaction, opts);
  };

  IGServiceAPI.prototype.create = function(transaction, data, opts) {
    opts = opts || {};
    opts.data = data;
    return this.request('create', transaction, opts);
  };

  IGServiceAPI.prototype.edit = function(transaction, data, eid, opts) {
    opts = opts || {};
    opts.data = data;
    opts.filter = eid;
    return this.request('edit', transaction, opts);
  };

  IGServiceAPI.prototype.editAll = function(transaction, data, eid, opts) {
    opts = opts || {};
    opts.data = data;
    opts.filter = eid;
    return this.request('editall', transaction, opts);
  };

  IGServiceAPI.prototype.del = function(transaction, filter, opts) {
    opts = opts || {};
    opts.filter = filter;
    return this.request('delete', transaction, opts);
  };

  IGServiceAPI.prototype.app = function(funcName, data, opts) {
    opts = opts || {};
    opts.data = data || {};
    return this.request('app', funcName, opts);
  };

  IGServiceAPI.prototype.rowCount = function(transaction, opts) {
    return this.request('rowcount', transaction, opts);
  };

  IGServiceAPI.prototype.attach = function(funcName, formData, opts) {
    opts = opts || {};
    opts.formData = formData;
    return this.request('attach', funcName, opts);
  };

  IGServiceAPI.prototype.custom = function(path, data, opts) {
    opts = opts || {};
    opts.data = data || {};
    return this.request('custom', path, opts);
  };

  // ---- Expose filter constants for advanced usage ----
  IGServiceAPI.FILTER_EQUALS = FILTER_EQUALS;
  IGServiceAPI.FILTER_EXACT  = FILTER_EXACT;
  IGServiceAPI.FILTER_AND    = FILTER_AND;
  IGServiceAPI.FILTER_OR     = FILTER_OR;

  // ---- Export ----
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = IGServiceAPI;
  } else {
    root.IGServiceAPI = IGServiceAPI;
  }

})(typeof window !== 'undefined' ? window : this);
