# Fixed Length Stream

This is a useful stream for parsing protocols. It will only pass through data until the specified length is reached, end(), and then pass any data past the specified length to a callback.

`npm install fixed-length-stream`

## fixed(length[, cb])

```javascript
var fixed = require('fixed-length-stream')
  , assert = require('assert')
  , f = fixed(10, function (err, tail) { assert.ok(tail.toString() === 'ok') })
  ;
f.write(new Buffer('0123456789ok'))
f.end()
```

You'll get an error if the stream is ended without satisfying the total length.

The stream takes care of ending itself and will also unpipe itself from any streams you've previously piped to it.
