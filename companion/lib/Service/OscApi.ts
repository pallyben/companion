import { CoreBase } from '../Core/Base.js'
import { parseColorToNumber, rgb } from '../Resources/Util.js'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import { RegexRouter } from './RegexRouter.js'
import type { Registry } from '../Registry.js'
import type { OscReceivedMessage } from 'osc'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'

/**
 * Class providing the OSC API.
 *
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 1.2.0
 * @copyright 2022 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 */
export class ServiceOscApi extends CoreBase {
	/**
	 * Message router
	 */
	readonly #router: RegexRouter

	get router(): RegexRouter {
		return this.#router
	}

	constructor(registry: Registry) {
		super(registry, 'Service/OscApi')

		this.#router = new RegexRouter()

		this.#setupLegacyOscRoutes()
		this.#setupNewOscRoutes()
	}

	#isLegacyRouteAllowed(): boolean {
		return !!this.userconfig.getKey('osc_legacy_api_enabled')
	}

	#setupLegacyOscRoutes(): void {
		this.#router.addPath('/press/bank/:page/:bank', (match: Record<string, string>, message: OscReceivedMessage) => {
			if (!this.#isLegacyRouteAllowed()) return

			const controlId = this.page.getControlIdAtOldBankIndex(Number(match.page), Number(match.bank))
			if (!controlId) return

			if (message.args.length > 0 && message.args[0].type == 'i' && message.args[0].value == 1) {
				this.logger.info(`Got /press/bank/ (press) for ${controlId}`)
				this.controls.pressControl(controlId, true, undefined)
			} else if (message.args.length > 0 && message.args[0].type == 'i' && message.args[0].value == 0) {
				this.logger.info(`Got /press/bank/ (release) for ${controlId}`)
				this.controls.pressControl(controlId, false, undefined)
			} else {
				this.logger.info(`Got /press/bank/ (trigger)${controlId}`)
				this.controls.pressControl(controlId, true, undefined)

				setTimeout(() => {
					this.logger.info(`Auto releasing /press/bank/ (trigger)${controlId}`)
					this.controls.pressControl(controlId, false, undefined)
				}, 20)
			}
		})

		this.#router.addPath('/style/bgcolor/:page/:bank', (match: Record<string, string>, message: OscReceivedMessage) => {
			if (!this.#isLegacyRouteAllowed()) return

			if (message.args.length > 2) {
				const r = message.args[0].value
				const g = message.args[1].value
				const b = message.args[2].value
				if (typeof r === 'number' && typeof g === 'number' && typeof b === 'number') {
					const controlId = this.page.getControlIdAtOldBankIndex(Number(match.page), Number(match.bank))
					if (!controlId) return

					const control = this.controls.getControl(controlId)
					if (control && control.supportsStyle) {
						this.logger.info(`Got /style/bgcolor for ${controlId}`)
						control.styleSetFields({ bgcolor: rgb(r, g, b) })
					} else {
						this.logger.info(`Got /style/bgcolor for unknown control: ${controlId}`)
					}
				}
			}
		})

		this.#router.addPath('/style/color/:page/:bank', (match: Record<string, string>, message: OscReceivedMessage) => {
			if (!this.#isLegacyRouteAllowed()) return

			if (message.args.length > 2) {
				const r = message.args[0].value
				const g = message.args[1].value
				const b = message.args[2].value
				if (typeof r === 'number' && typeof g === 'number' && typeof b === 'number') {
					const controlId = this.page.getControlIdAtOldBankIndex(Number(match.page), Number(match.bank))
					if (!controlId) return

					const control = this.controls.getControl(controlId)
					if (control && control.supportsStyle) {
						this.logger.info(`Got /style/color for ${controlId}`)
						control.styleSetFields({ color: rgb(r, g, b) })
					} else {
						this.logger.info(`Got /style/color for unknown control: ${controlId}`)
					}
				}
			}
		})

		this.#router.addPath('/style/text/:page/:bank', (match: Record<string, string>, message: OscReceivedMessage) => {
			if (!this.#isLegacyRouteAllowed()) return

			if (message.args.length > 0) {
				const text = message.args[0].value
				if (typeof text === 'string') {
					const controlId = this.page.getControlIdAtOldBankIndex(Number(match.page), Number(match.bank))
					if (!controlId) return

					const control = this.controls.getControl(controlId)
					if (control && control.supportsStyle) {
						this.logger.info(`Got /style/text for ${controlId}`)
						control.styleSetFields({ text: text })
					} else {
						this.logger.info(`Got /style/color for unknown control: ${controlId}`)
					}
				}
			}
		})

		this.#router.addPath('/rescan', (_match: Record<string, string>, _message: OscReceivedMessage) => {
			if (!this.#isLegacyRouteAllowed()) return

			this.logger.info('Got /rescan 1')
			this.surfaces.triggerRefreshDevices().catch(() => {
				this.logger.debug('Scan failed')
			})
		})
	}

	#setupNewOscRoutes() {
		// controls by location
		this.#router.addPath('/location/:page/:row/:column/press', this.#locationPress)
		this.#router.addPath('/location/:page/:row/:column/down', this.#locationDown)
		this.#router.addPath('/location/:page/:row/:column/up', this.#locationUp)
		this.#router.addPath('/location/:page/:row/:column/rotate-left', this.#locationRotateLeft)
		this.#router.addPath('/location/:page/:row/:column/rotate-right', this.#locationRotateRight)
		this.#router.addPath('/location/:page/:row/:column/step', this.#locationStep)

		this.#router.addPath('/location/:page/:row/:column/style/text', this.#locationSetStyleText)
		this.#router.addPath('/location/:page/:row/:column/style/color', this.#locationSetStyleColor)
		this.#router.addPath('/location/:page/:row/:column/style/bgcolor', this.#locationSetStyleBgcolor)

		// custom variables
		this.#router.addPath('/custom-variable/:name/value', this.#customVariableSetValue)

		// surfaces
		this.#router.addPath('/surfaces/rescan', this.#surfacesRescan)
	}

	/**
	 * Perform surfaces rescan
	 */
	#surfacesRescan = (): void => {
		this.logger.info('Got OSC surface rescan')
		this.surfaces.triggerRefreshDevices().catch(() => {
			this.logger.debug('Scan failed')
		})
	}

	/**
	 * Parse the location and controlId from a request
	 */
	#locationParse = (match: Record<string, string>): { location: ControlLocation; controlId: string | null } => {
		const location = {
			pageNumber: Number(match.page),
			row: Number(match.row),
			column: Number(match.column),
		}

		const controlId = this.page.getControlIdAt(location)

		return {
			location,
			controlId,
		}
	}

	/**
	 * Perform control press
	 */
	#locationPress = (match: Record<string, string>, _message: OscReceivedMessage): void => {
		const { location, controlId } = this.#locationParse(match)
		this.logger.info(`Got OSC control press ${formatLocation(location)} - ${controlId}`)
		if (!controlId) return

		this.controls.pressControl(controlId, true, 'osc')

		setTimeout(() => {
			this.logger.info(`Auto releasing OSC control press ${formatLocation(location)} - ${controlId}`)

			this.controls.pressControl(controlId, false, 'osc')
		}, 20)
	}

	/**
	 * Perform control down
	 */
	#locationDown = (match: Record<string, string>, _message: OscReceivedMessage): void => {
		const { location, controlId } = this.#locationParse(match)
		this.logger.info(`Got OSC control down ${formatLocation(location)} - ${controlId}`)
		if (!controlId) return

		this.controls.pressControl(controlId, true, 'osc')
	}

	/**
	 * Perform control up
	 */
	#locationUp = (match: Record<string, string>, _message: OscReceivedMessage): void => {
		const { location, controlId } = this.#locationParse(match)
		this.logger.info(`Got OSC control up ${formatLocation(location)} - ${controlId}`)
		if (!controlId) return

		this.controls.pressControl(controlId, false, 'osc')
	}

	/**
	 * Perform control rotate left
	 */
	#locationRotateLeft = (match: Record<string, string>, _message: OscReceivedMessage): void => {
		const { location, controlId } = this.#locationParse(match)
		this.logger.info(`Got OSC control rotate left ${formatLocation(location)} - ${controlId}`)
		if (!controlId) return

		this.controls.rotateControl(controlId, false, 'osc')
	}

	/**
	 * Perform control rotate right
	 */
	#locationRotateRight = (match: Record<string, string>, _message: OscReceivedMessage): void => {
		const { location, controlId } = this.#locationParse(match)
		this.logger.info(`Got OSC control rotate right ${formatLocation(location)} - ${controlId}`)
		if (!controlId) return

		this.controls.rotateControl(controlId, true, 'osc')
	}

	/**
	 * Set control step
	 */
	#locationStep = (match: Record<string, string>, message: OscReceivedMessage): void => {
		if (message.args.length === 0) return

		const { location, controlId } = this.#locationParse(match)
		const step = Number(message.args[0]?.value)

		this.logger.info(`Got OSC control step ${formatLocation(location)} - ${controlId} to ${step}`)
		if (!controlId) return

		const control = this.controls.getControl(controlId)
		if (!control || !control.supportsActionSets) {
			return
		}

		control.actionSets.stepMakeCurrent(step)
	}

	/**
	 * Perform control style text change
	 */
	#locationSetStyleText = (match: Record<string, string>, message: OscReceivedMessage): void => {
		if (message.args.length === 0) return

		const text = message.args[0]?.value
		const { location, controlId } = this.#locationParse(match)
		this.logger.info(`Got OSC control set text ${formatLocation(location)} - ${controlId}`)
		if (!controlId) return

		const control = this.controls.getControl(controlId)
		if (!control || !control.supportsStyle) return

		control.styleSetFields({ text: text })
	}

	/**
	 * Perform control style color change
	 */
	#locationSetStyleColor = (match: Record<string, string>, message: OscReceivedMessage): void => {
		if (message.args.length === 0) return

		const { location, controlId } = this.#locationParse(match)
		this.logger.info(`Got OSC control set color ${formatLocation(location)} - ${controlId}`)
		if (!controlId) return

		const control = this.controls.getControl(controlId)
		if (!control || !control.supportsStyle) return

		let color: number | false = false
		if (message.args.length === 3) {
			const r = message.args[0].value
			const g = message.args[1].value
			const b = message.args[2].value
			if (typeof r === 'number' && typeof g === 'number' && typeof b === 'number') {
				color = rgb(r, g, b)
			}
		} else {
			color = parseColorToNumber(message.args[0].value)
		}

		if (color !== false) {
			control.styleSetFields({ color })
		}
	}
	/**
	 * Perform control style bgcolor change
	 */
	#locationSetStyleBgcolor = (match: Record<string, string>, message: OscReceivedMessage): void => {
		if (message.args.length === 0) return

		const { location, controlId } = this.#locationParse(match)
		this.logger.info(`Got OSC control set bgcolor ${formatLocation(location)} - ${controlId}`)
		if (!controlId) return

		const control = this.controls.getControl(controlId)
		if (!control || !control.supportsStyle) return

		let color: number | false = false
		if (message.args.length === 3) {
			const r = message.args[0].value
			const g = message.args[1].value
			const b = message.args[2].value
			if (typeof r === 'number' && typeof g === 'number' && typeof b === 'number') {
				color = rgb(r, g, b)
			}
		} else {
			color = parseColorToNumber(message.args[0].value)
		}

		if (color !== false) {
			control.styleSetFields({ bgcolor: color })
		}
	}

	/**
	 * Perform custom variable set value
	 */
	#customVariableSetValue = (match: Record<string, string>, message: OscReceivedMessage): void => {
		const variableName = match.name
		const variableValue = message.args?.[0]?.value

		this.logger.debug(`Got HTTP custom variable set value name "${variableName}" to value "${variableValue}"`)
		if (variableValue === undefined) return

		this.variablesController.custom.setValue(variableName, variableValue.toString())
	}
}
