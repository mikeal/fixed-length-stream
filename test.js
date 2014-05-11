var fixed = require('./')
  , tape = require('tape')
  , stream = require('stream')
  , util = require('util')
  , bl = require('bl')
  ;

function head (blob) {
  var b = new Buffer(100)
    , size = blob.length.toString()
    ;
  b.write(size)
  b.fill('@', size.length)
  return b
}

function Parser () {
  stream.Transform.call(this)
  this.buff = bl()
  this.passthrough = false
}
util.inherits(Parser, stream.Transform)
Parser.prototype._transform = function (chunk, encoding, cb) {
  var self = this
  function parse () {
    if (self.buff.length < 100) return

    var head = self.buff.slice(0, 100).toString()
      , size = parseInt(head.slice(0, head.indexOf('@')))
      ;

    // reset state
    var excess = self.buff.slice(100)
    self.buff = bl()
    self.passthrough = true

    // create a fixed stream for this entry
    var entry = fixed(size, function (err, chunk) {
      if (err) throw err

      // listen for tail to throw back in to the parser
      self.passthrough = false
      self.buff.append(chunk)
      parse()
    })

    self.emit('entry', entry)

    entry.write(excess)
    self.pipe(entry)
  }


  if (this.passthrough) {
    this.push(chunk)
  } else {
    this.buff.append(chunk)
    parse()
  }
  cb()
}

var ends = 0

tape('basic', function (t) {
  var pass = new stream.PassThrough()
    , b = bl()
    ;
  t.plan(5)
  ;[12, 45, 3453, 456463, 2322].forEach(function (length) {
    var buff = new Buffer(length)
    buff.fill('A')

    b.append(head(buff))
    b.append(buff)
  })

  var parser = new Parser()
  parser.on('entry', function (entry) {
    entry.on('data', function (chunk) {
      var test = new Buffer(chunk.length)
      test.fill('A')
      t.equals(chunk.toString(), test.toString())
    })
    entry.on('end', function () {
      ends = ends + 1
    })
  })
  pass.pipe(parser)
  pass.write(b.slice(0, b.length))
})

tape('entries', function (t) {
  t.equals(ends, 5)
  t.end()
})
