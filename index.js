var stream = require('stream')
  , util = require('util')
  ;

function Fixed (length, cb) {
  var self = this
  this.fixedLength = length
  this.currentLength = 0
  this.sources = []
  stream.Transform.call(this)
  this.on('pipe', function (src) {
    self.sources.push(src)
  })
  this.cb = cb
  if (cb) this.on('error', cb)
}
util.inherits(Fixed, stream.Transform)
Fixed.prototype._transform = function (chunk, encoding, cb) {
  if (this.currentLength + chunk.length < this.fixedLength) {
    this.push(chunk)
    this.currentLength += chunk.length
    cb()
  } else {
    var last = chunk.slice(0, this.fixedLength - this.currentLength)
      , tail = chunk.slice(this.fixedLength - this.currentLength)
      , self = this
      ;
    this.push(last)
    this.sources.forEach(function (src) {
      src.unpipe(self)
    })
    if (this.cb) this.cb(null, tail)
    cb()
    this.currentLength = this.fixedLength
    this.end()
  }
}
Fixed.prototype.end = function () {
  if (this.currentLength !== this.fixedLength) {
    this.emit('error', new Error('Fixed stream ended before receiving complete length.'))
  }
  stream.Transform.prototype.end.apply(this, arguments)
}

module.exports = function (length, cb) {return new Fixed(length, cb)}
