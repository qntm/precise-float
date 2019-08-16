// Parse and stringify JavaScript numbers with full precision. Throw an
// exception if this cannot be done

'use strict'

const Decimal = require('decimal.js')

Decimal.set({
  precision: 10000
})

const _decodeFloat = positiveNumber => {
  const float64Array = new Float64Array([positiveNumber])
  const uint8Array = new Uint8Array(float64Array.buffer)

  const exponent =
    ((uint8Array[7] & 0b01111111) << 4) +
    ((uint8Array[6] & 0b11110000) >> 4)

  // Can't use bit shifts here because JS bitwise operations are 32-bit
  const mantissa =
    ((uint8Array[6] & 0b00001111) * Math.pow(1 << 8, 6)) +
    ((uint8Array[5] & 0b11111111) * Math.pow(1 << 8, 5)) +
    ((uint8Array[4] & 0b11111111) * Math.pow(1 << 8, 4)) +
    ((uint8Array[3] & 0b11111111) * Math.pow(1 << 8, 3)) +
    ((uint8Array[2] & 0b11111111) * Math.pow(1 << 8, 2)) +
    ((uint8Array[1] & 0b11111111) * Math.pow(1 << 8, 1)) +
    ((uint8Array[0] & 0b11111111) * Math.pow(1 << 8, 0))

  return { exponent, mantissa }
}

const _getExactDecimal = positiveNumber => {
  const { exponent, mantissa } = _decodeFloat(positiveNumber)

  // Note special cases for `exponent` 0 (subnormals)

  const fraction = new Decimal(mantissa)
    .dividedBy(Math.pow(2, 52))
    .plus(exponent === 0 ? 0 : 1)

  const power = new Decimal(2)
    .toPower((exponent === 0 ? 1 : exponent) - 1023)

  return fraction.times(power)
}

const stringify = (...params) => {
  if (params.length !== 1) {
    throw Error(`Expected 1 parameter, received ${params.length}`)
  }

  const value = params[0]

  if (typeof value !== 'number') {
    throw Error(`Expected value type of "number", received ${JSON.stringify(typeof value)}`)
  }

  if (Number.isNaN(value)) {
    return 'NaN'
  }

  if (value === Infinity) {
    return 'Infinity'
  }

  if (value === -Infinity) {
    return '-Infinity'
  }

  // A `Decimal` instance with value -0 doesn't preserve the leading
  // unary minus sign on `toFixed` for some reason, so we have to do this

  const isNegative = value < 0 || Object.is(-0, value)

  const positiveNumber = isNegative ? -value : value

  return (isNegative ? '-' : '') + _getExactDecimal(positiveNumber).toFixed()
}

const parse = (...params) => {
  if (params.length !== 1) {
    throw Error(`Expected 1 parameter, received ${params.length}`)
  }

  const value = params[0]

  if (typeof value !== 'string') {
    throw Error(`Expected value type of "string", received ${JSON.stringify(typeof value)}`)
  }

  if (value === 'NaN') {
    return NaN
  }

  if (value === 'Infinity') {
    return Infinity
  }

  if (value === '-Infinity') {
    return -Infinity
  }

  if (!/^-?(0|([1-9][0-9]*))(\.[0-9]+)?([eE][+-]?[0-9]+)?$/.test(value)) {
    throw Error(`Expected a numeric string, received ${JSON.stringify(value)}`)
  }

  const isNegative = value.startsWith('-')

  const positiveNumericString = isNegative ? value.substring('-'.length) : value

  const positiveDecimal = new Decimal(positiveNumericString)
  // This will be precise

  const positiveNumber = positiveDecimal.toNumber()
  // This may have lost some precision and could even be infinite. How can we tell?

  if (!Number.isFinite(positiveNumber)) {
    // `positiveNumber` cannot be NaN but in any case this condition would catch this
    throw Error(`Number ${positiveNumericString} is too large to be precisely represented as a JavaScript number`)
  }

  const positiveDecimal2 = _getExactDecimal(positiveNumber)
  if (!positiveDecimal2.equals(positiveDecimal)) {
    throw Error(`Number ${positiveNumericString} cannot be precisely represented as a JavaScript number; the closest we can get is ${positiveDecimal2.toFixed()}`)
  }

  return isNegative ? -positiveNumber : positiveNumber
}

module.exports = {
  _decodeFloat,
  _getExactDecimal,
  parse,
  stringify
}
