var stream = require('stream')
  , util = require('util')
  , bl = require('bl')
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

    // This sucks but transform streams won't push any chunks until the next tick
    // so if you write() in a loop we'll break without this.
    var self = this
    self.tail = bl()
    self.tail.append(tail)
    process.nextTick(function () {
      self.sources.forEach(function (src) {
        src.unpipe(self)
      })
      if (self.cb) self.cb(null, self.tail.slice()) // strange errors passing a direct bl object.
      cb()
      self.currentLength = self.fixedLength
      self.end()
    })
  }
}
Fixed.prototype.write = function () {
  if (this._ended) throw new Error('This stream has ended')
  if (this.tail) {
    this.tail.append(arguments[0])
  } else {
    stream.Transform.prototype.write.apply(this, arguments)
  }
}

Fixed.prototype.end = function () {
  if (this.currentLength !== this.fixedLength) {
    this.emit('error', new Error('Fixed stream ended before receiving complete length.'))
  }
  stream.Transform.prototype.end.apply(this, arguments)
  this._ended = true
}

module.exports = function (length, cb) {return new Fixed(length, cb)}
