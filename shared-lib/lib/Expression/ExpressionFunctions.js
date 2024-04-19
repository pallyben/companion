import { pad } from '../Util.js'
import { JSONPath } from 'jsonpath-plus'

// Note: when adding new functions, make sure to update the docs!
/** @type {Record<string, (...args: any[]) => any>} */
export const ExpressionFunctions = {
	// Number operations
	// TODO: round to fractionals, without fp issues
	round: (v) => Math.round(v),
	floor: (v) => Math.floor(v),
	ceil: (v) => Math.ceil(v),
	abs: (v) => Math.abs(v),
	fromRadix: (v, radix) => parseInt(v, radix || 10),
	toRadix: (v, radix) => v.toString(radix || 10),
	toFixed: (v, dp) => Number(v).toFixed(Math.max(0, dp || 0)),
	isNumber: (v) => !isNaN(v),
	max: (...args) => Math.max(...args),
	min: (...args) => Math.min(...args),
	unixNow: () => Date.now(),
	timestampToSeconds: (str) => {
		const match = (str + '').match(/^(\d+)\:(\d+)\:(\d+)$/i)
		if (match) {
			return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
		} else {
			return 0
		}
	},
	randomInt: (min = 0, max = 10) => {
		min = Number(min)
		max = Number(max)
		return min + Math.round(Math.random() * (max - min))
	},

	// String operations
	trim: (v) => (v + '').trim(),
	strlen: (v) => (v + '').length,
	substr: (str, start, end) => {
		return (str + '').slice(start, end)
	},
	split: (str, separator) => {
		return (str + '').split(separator)
	},
	join: (arr = [], separator = ',') => {
		return (arr.constructor === Array ? arr : [arr]).join(separator)
	},
	concat: (...strs) => ''.concat(...strs),
	includes: (str, arg) => {
		return (str + '').includes(arg)
	},
	indexOf: (str, arg, offset) => {
		return (str + '').indexOf(arg, offset)
	},
	lastIndexOf: (str, arg, offset) => {
		return (str + '').lastIndexOf(arg, offset)
	},
	toUpperCase: (str) => {
		return (str + '').toUpperCase()
	},
	toLowerCase: (str) => {
		return (str + '').toLowerCase()
	},
	replaceAll: (str, find, replace) => {
		return (str + '').replaceAll(find, replace)
	},
	secondsToTimestamp: (v, type) => {
		v = Math.max(0, v)

		const seconds = pad(Math.floor(v) % 60, '0', 2)
		const minutes = pad(Math.floor(v / 60) % 60, '0', 2)
		const hours = pad(Math.floor(v / 3600), '0', 2)

		if (!type) return `${hours}:${minutes}:${seconds}`

		const timestamp = []
		if (type.includes('HH') || type.includes('hh')) timestamp.push(hours)
		if (type.includes('mm')) timestamp.push(minutes)
		if (type.includes('ss')) timestamp.push(seconds)

		return timestamp.join(':')
	},
	msToTimestamp: (v, type) => {
		v = Math.max(0, v)

		const ms = v % 1000
		const seconds = pad(Math.floor(v / 1000) % 60, '0', 2)
		const minutes = pad(Math.floor(v / 60000) % 60, '0', 2)
		const hours = pad(Math.floor(v / 3600000), '0', 2)

		if (!type) return `${minutes}:${seconds}.${Math.floor(ms / 100)}`

		const timestamp = []
		if (type.includes('HH') || type.includes('hh')) timestamp.push(hours)
		if (type.includes('mm')) timestamp.push(minutes)
		if (type.includes('ss')) timestamp.push(seconds)

		let timestampStr = timestamp.join(':')
		if (type.endsWith('.ms') || type.endsWith('.S')) {
			timestampStr += `.${Math.floor(ms / 100)}`
		} else if (type.endsWith('.SS')) {
			timestampStr += `.${pad(Math.floor(ms / 10), '0', 2)}`
		} else if (type.endsWith('.SSS')) {
			timestampStr += `.${pad(ms, '0', 3)}`
		}

		return timestampStr
	},
	// parseVariables is filled in from the caller

	// Bool operations
	bool: (v) => !!v && v !== 'false' && v !== '0',

	// Object operations
	jsonpath: (obj, path) => {
		const shouldParseInput = typeof obj === 'string'
		if (shouldParseInput) {
			try {
				obj = JSON.parse(obj)
			} catch (_e) {
				// Ignore
			}
		}

		const value = JSONPath({
			wrap: false,
			path: path,
			json: obj,
		})

		if (shouldParseInput && typeof value !== 'number' && typeof value !== 'string' && value) {
			try {
				return JSON.stringify(value)
			} catch (/** @type {any} */ e) {
				// Ignore
			}
		}

		return value
	},

	jsonparse: (str) => {
		try {
			return JSON.parse(str + '')
		} catch (_e) {
			return null
		}
	},

	jsonstringify: (obj) => {
		try {
			return JSON.stringify(obj)
		} catch (_e) {
			return null
		}
	},
}
