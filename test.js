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
  this.totalSize = 0
}
util.inherits(Parser, stream.Transform)
Parser.prototype._transform = function (chunk, encoding, cb) {
  var self = this

  this.totalSize += chunk.length

  function parse () {
    if (self.buff.length < 100) return

    var head = self.buff.slice(0, 100).toString()
      , size = parseInt(head.slice(0, head.indexOf('@')))
      ;
    if (typeof size !== 'number' || isNaN(size)) throw new Error(size+' is not a number.')

    // reset state
    var excess = self.buff.slice(100)
    self.buff = bl()
    self.passthrough = true

    // create a fixed stream for this entry
    var entry = fixed(size, function (err, chunk) {
      if (err) throw err
      // listen for tail to throw back in to the parser
      self.passthrough = false
      // console.log(self.buff.length, chunk.length, self.totalSize - chunk.length)
      // console.log(chunk.slice(0, 5).toString())
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

function getTestBuffer () {
  var b = bl()

  ;[12, 45, 3453, 456463, 2322].forEach(function (length) {
    var buff = new Buffer(length)
    buff.fill('A')

    b.append(head(buff))
    b.append(buff)
  })

  return b
}

tape('basic', function (t) {
  var pass = new stream.PassThrough()

  t.plan(10)

  var b = getTestBuffer()

  var parser = new Parser()
  parser.on('entry', function (entry) {
    entry.on('data', function (chunk) {
      var test = new Buffer(chunk.length)
      test.fill('A')
      t.equals(chunk.toString(), test.toString())
    })
    entry.on('end', function () {
      t.ok(true)
    })
  })
  pass.pipe(parser)
  pass.write(b.slice(0, b.length))
})

tape('fixed chunks', function (t) {
  var pass = new stream.PassThrough()

  t.plan(10)

  var buffers = []

  ;[12, 45, 3453, 456463, 2322].forEach(function (length) {
    var buff = new Buffer(length)
    buff.fill('A')

    buffers.push(head(buff))
    buffers.push(buff)
  })

  var parser = new Parser()
  parser.on('entry', function (entry) {
    entry.on('data', function (chunk) {
      var test = new Buffer(chunk.length)
      test.fill('A')
      t.equals(chunk.toString(), test.toString())
    })
    entry.on('end', function () {
      t.ok(true)
    })
  })
  pass.pipe(parser)

  buffers.forEach(function (buff) {
    pass.write(buff)
  })
})

// tape('small chunks', function (t) {
//   var pass = new stream.PassThrough()
//
//   t.plan(10)
//
//   var b = bl()
//
//   ;[12, 45, 3453, 456463, 2322].forEach(function (length) {
//     var buff = new Buffer(length)
//     buff.fill('A')
//
//     b.append(head(buff))
//     b.append(buff)
//   })
//
//   b = b.slice()
//
//   var parser = new Parser()
//   parser.on('entry', function (entry) {
//     entry.on('data', function (chunk) {
//       var test = new Buffer(chunk.length)
//       test.fill('A')
//       t.equals(chunk.toString(), test.toString())
//     })
//     entry.on('end', function () {
//       t.ok(true)
//     })
//   })
//   pass.pipe(parser)
//
//   console.log('asdf', b.slice(112, 120).toString())
//
//   var checker = bl()
//
//   var i = 0
//   function ch () {
//     var size = 7
//     if (i + size > b.length) size = b.length - i
//     pass.write(b.slice(i, size))
//     checker.append(b.slice(i, size))
//     i = i + size
//     if (i > 120) console.log('testing', checker.slice(112, 120).toString())
//     setTimeout(function () {
//       ch()
//     }, 0)
//   }
//   ch()
// })
