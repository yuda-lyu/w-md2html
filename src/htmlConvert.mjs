import get from 'lodash-es/get.js'
import isbol from 'wsemi/src/isbol.mjs'
import * as cheerio from 'cheerio'


let htmlConvert = (html, opt = {}) => {

    //linkBlank
    let linkBlank = get(opt, 'linkBlank', null)
    if (!isbol(linkBlank)) {
        linkBlank = true
    }

    //tableHorizontalAlignmentCenter
    let tableHorizontalAlignmentCenter = get(opt, 'tableHorizontalAlignmentCenter', null)
    if (!isbol(tableHorizontalAlignmentCenter)) {
        tableHorizontalAlignmentCenter = true
    }

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

    //linkBlank
    if (linkBlank) {
        //a連結轉成 target="_blank" rel="noopener noreferrer" 以避免跨站攻擊
        $('a[href]').each((i, el) => {
            let $el = $(el)
            let href = $el.attr('href') || ''
            if (href.slice(0, 1) !== '#') {
                $el.attr('target', '_blank')
                $el.attr('rel', 'noopener noreferrer')
            }
        })
    }

    //tableHorizontalAlignmentCenter: 將table外包div且text-align:center, 使轉docx時表格可水平置中(block table用margin:auto無法帶入docx)
    if (tableHorizontalAlignmentCenter) {
        $('table').each((i, el) => {
            $(el)
                .css('display', 'inline-table') //HTML: table變inline-level才吃父層text-align置中(內層仍維持表格排版), 用inline-table而非inline-block以保留border-collapse與欄寬
                .wrap('<div style="text-align:center;"></div>') //docx: Word靠父層div之text-align:center置中表格
        })
    }

    return $.html()
}


export default htmlConvert
