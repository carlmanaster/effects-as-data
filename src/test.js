const assert = require('assert')
const { deepEqual } = assert
const {
  map,
  prop,
  curry,
  normalizeToSuccess
} = require('./util')
const { runTest } = require('./run')
const jsondiffpatch = require('jsondiffpatch')
const { format: logFormatter } = require('jsondiffpatch/src/formatters/console')
const chalk = require('chalk')

const testHandlers = async (fn, payload, actionHandlers, expectedOutput) => {
  return runTest(actionHandlers, fn, payload).then(({log}) => {
    const outputPicker = prop(1)
    const actualOutput = map(outputPicker, log)
    deepEqual(actualOutput, expectedOutput)
  })
}

const testFn = (fn, expected, index = 0, previousOutput = null) => {
  checkForExpectedTypeMismatches(expected)

  assert(fn, 'The function you are trying to test is undefined.')

  const step = expected[index]

  if (step === undefined) {
    throw new Error('Your spec does not have as many steps as your function.  Are you missing a return line?')
  }

  const [input, expectedOutput] = step
  let g
  if (fn.next) {
    g = fn
  } else {
    g = fn(input)
  }

  let normalizedInput
  if (Array.isArray(previousOutput)) {
    normalizedInput = map(normalizeToSuccess, input)
  } else {
    normalizedInput = normalizeToSuccess(input)
  }
  let { value: actualOutput, done } = g.next(normalizedInput)
  try {
    deepEqual(actualOutput, expectedOutput)
  } catch (e) {
    const isMocha = process.argv.some((s) => s.match(/mocha/))
    let errorMessage = []

    const delta = jsondiffpatch.diff(actualOutput, expectedOutput)

    errorMessage.push(`Error on Step ${index + 1}`)

    if (!isMocha) {
      errorMessage.push(`${chalk.red('actual')} ${chalk.green('expected')}`)
      errorMessage.push('')
      errorMessage.push(logFormatter(delta, actualOutput))
    }

    e.name = ''
    e.message = errorMessage.join('\n')

    throw e
  }
  if (!done || index + 1 < expected.length) {
    testFn(g, expected, index + 1, actualOutput)
  }
}

const checkForExpectedTypeMismatches = (expected) => {
  if (!Array.isArray(expected)) {
    throw new Error(`Your spec must return an array of tuples.  It is currently returning a value of type "${typeof expected}".`)
  }
  for (let i = 0; i < expected.length; i++) {
    if (i + 1 >= expected.length) return
    let output = expected[i][1]
    let nextInput = expected[i + 1][0]

    if (Array.isArray(output)) {
      assert(Array.isArray(nextInput), 'If an array of actions is yielded, it should return an array of results.')
    }
  }
}

const testIt = (fn, expected) => {
  return function () {
    let expectedLog = expected()
    testFn(fn, expectedLog)
  }
}

module.exports = {
  testHandlers: curry(testHandlers),
  testFn: curry(testFn),
  testIt: curry(testIt)
}
