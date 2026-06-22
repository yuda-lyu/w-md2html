
import * as cheerio from 'cheerio'


let htmlConvert = (html) => {

    let $ = cheerio.load(html)

    $('[style*="display:none"]').remove()

    //for="br": 空div之「換行/空段落」語意標記, 於div內插入零寬空格(U+200B)佔位,
    //使轉docx時段落不被Word匯入丟棄(由w-html2docx端還原移除); 僅對內容為空者處理避免覆蓋既有內容
    let zwsp = String.fromCharCode(0x200B) //零寬空格 U+200B, 以ASCII碼點建構避免原始碼出現隱形字元
    $('div[for="br"]').each((i, el) => {
        let $el = $(el)
        if ($el.text() === '') {
            $el.text(zwsp)
        }
    })

    return $.html()
}


export default htmlConvert
