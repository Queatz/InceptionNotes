import {getTimeZones, TimeZone} from '@vvo/tzdb'

export default class Util {

  private static div = document.createElement('div')

  static htmlToText(html: string, newlineToSpace = false) {
    this.div.innerHTML = (newlineToSpace ? html.replace('<br>', ' ') : html)
    return this.div.textContent || this.div.innerText || ''
  }

  static isEmptyStr(str?: string) {
    return !str?.replace(/<(?:.|\n)*?>/gm, '').trim()
  }

  static newKey() {
    return Array.from(Array(10)).reduce(a => a + Math.random().toString(36).substring(2, 15), '')
  }

  static convertRemToPixels(rem: number) {
    return rem * parseFloat(window.getComputedStyle(document.documentElement).fontSize)
  }

  static localTimeZone(): TimeZone {
    const name = Intl.DateTimeFormat().resolvedOptions().timeZone
    return getTimeZones().find(x => x.name === name)
  }
}
