export default class Util {

    private static div = document.createElement('div');    

    public static htmlToText(html: string) {
        this.div.innerHTML = html;
        return this.div.textContent || this.div.innerText || '';
    }
}