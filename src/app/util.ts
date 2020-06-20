export default class Util {

    private static div = document.createElement('div');    

    public static htmlToText(html: string) {
        this.div.innerHTML = html;
        return this.div.textContent || this.div.innerText || '';
    }

    public static isEmptyStr(str: string) {
    return !str.replace(/<(?:.|\n)*?>/gm, '').trim();
    }

    public static newKey() {
        return Array.from(Array(10)).reduce(a => a + Math.random().toString(36).substring(2, 15), '');
    }

    public static convertRemToPixels(rem: number) {    
        return rem * parseFloat(window.getComputedStyle(document.documentElement).fontSize);
    }
}