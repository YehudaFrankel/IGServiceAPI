# ig-service-api

Standalone API client for the Infograsp webservice backend. No jQuery or other dependencies required. Works with any webapp via a `<script>` tag or `require()`.

## Install

**Script tag (any webapp):**
```html
<script src="https://cdn.jsdelivr.net/gh/YehudaFrankel/ig-service-api/IGServiceAPI.js"></script>
```

Or from GitHub Pages (enable in repo settings):
```html
<script src="https://yehudafrankel.github.io/ig-service-api/IGServiceAPI.js"></script>
```

**npm:**
```bash
npm install YehudaFrankel/ig-service-api
```

## Setup

```javascript
var api = new IGServiceAPI('//customer.infograsp.com');
```

## API

### Login / Logout

```javascript
api.login('username', 'password').then(function(result) {
  console.log('Session:', result.sessionID);
});

api.logout(); // clears session cookie, no server call
```

### View (list records)

```javascript
api.view('Customers', {
  filter: [['Status', 'Active', 'exact'], ['Region', 'East']],
  rowsPerPage: 25,
  startRow: 1
}).then(function(result) {
  console.log(result.data);      // array of row arrays
  console.log(result.fieldSet);  // { "Name": 0, "Email": 1, ... }
});
```

### Create

```javascript
api.create('Customers', {
  Name: 'John Doe',
  Email: 'john@example.com'
}).then(function(result) {
  console.log('Created:', result.data);
});
```

### Edit

```javascript
// eid as [field, value] pair
api.edit('Customers', { Name: 'Jane Doe' }, ['EntityID', '123']);

// eid as pre-built string
api.edit('Customers', { Name: 'Jane Doe' }, 'EntityID|^;.IET.|^;123');
```

### Edit All

```javascript
api.editAll('Customers', { Status: 'Archived' }, ['Region', 'West']);
```

### Delete

```javascript
api.del('Customers', [['EntityID', '123', 'exact']]);
```

### App (custom server function)

```javascript
api.app('appSubmitMiniForm', { FormID: '5', Value: 'test' })
  .then(function(result) {
    console.log(result.data);
  });
```

### Row Count

```javascript
api.rowCount('Customers').then(function(result) {
  console.log(result.data);
});
```

### File Upload

```javascript
var fd = new FormData();
fd.append('file', document.getElementById('fileInput').files[0]);

api.attach('appUploadDocument', fd).then(function(result) {
  console.log('Uploaded:', result);
});
```

### Custom Endpoint

```javascript
api.custom('myCustomEndpoint.jsp?param=value', { key: 'val' });
```

## Response Shape

All methods resolve to:

```javascript
{
  raw:         { ... },   // full server response object
  data:        [...],     // DATA.rsp.Data row arrays (or null)
  fieldSet:    { ... },   // DisplayName -> ColNum lookup
  sessionID:   '...',
  transaction: '...',
  view:        '...',
  sql:         '...'
}
```

## Error Handling

Server errors (`stat !== 'ok'`) reject the promise. The error object has a `.response` property with the full server payload:

```javascript
api.view('BadTransaction').catch(function(err) {
  console.log(err.message);            // error message string
  console.log(err.response.rsp);       // full rsp object
});
```

## Filter Constants

For advanced filter building:

```javascript
IGServiceAPI.FILTER_EQUALS  // '|^;.C.|^;'    (contains)
IGServiceAPI.FILTER_EXACT   // '|^;.IET.|^;'  (exact match)
IGServiceAPI.FILTER_AND     // '|$;'
IGServiceAPI.FILTER_OR      // '|#;'
```

## Requirements

- A running Infograsp backend server with `webservice.jsp`
- Browser with `fetch()` support (all modern browsers, IE needs a polyfill)
