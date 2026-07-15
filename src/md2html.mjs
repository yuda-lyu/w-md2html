import get from 'lodash-es/get.js'
import each from 'lodash-es/each.js'
import map from 'lodash-es/map.js'
import join from 'lodash-es/join.js'
import isestr from 'wsemi/src/isestr.mjs'
import isnum from 'wsemi/src/isnum.mjs'
import isbol from 'wsemi/src/isbol.mjs'
import isearr from 'wsemi/src/isearr.mjs'
import isfun from 'wsemi/src/isfun.mjs'
import isWindow from 'wsemi/src/isWindow.mjs'
import cdbl from 'wsemi/src/cdbl.mjs'
import replace from 'wsemi/src/replace.mjs'
import { Marked } from 'marked'
import markedKatex from 'marked-katex-extension'
import markedFootnote from 'marked-footnote'
import hljs from 'highlight.js'
import { markedHighlight } from 'marked-highlight'
import DOMPurify from 'dompurify'


/**
 * Markdown轉Html
 *
 * @param {String} md 輸入Markdown字串
 * @param {Object} [opt={}] 輸入設定物件，預設{}
 * @param {Boolean} [opt.linkBlank=false] 輸入連結是否為另開新頁布林值，預設false
 * @param {Boolean} [opt.tableHorizontalAlignmentCenter=false] 輸入表格是否水平置中布林值，預設false
 * @param {String} [opt.tableBorderColor='#666'] 輸入表格邊框顏色 (CSS color)
 * @param {string[]} [opt.fontFamilies=['Microsoft JhengHei','Avenir','Helvetica','Arial','sans-serif']] 輸入內文字型優先順序列表
 * @param {String} [opt.fontSizeUnit='pt'] 輸入字型大小單位字串，可使用例如'pt'、'px'等，預設'pt'
 * @param {Number} [opt.fontSizeScale=1] 輸入字型大小縮放倍率數字，預設1
 * @param {Number|String} [opt.fontSizeDef] 輸入內文字型大小數字或字串，預設為12，自動轉字型為12*fontSizeScale+fontSizeUnit
 * @param {Number|String} [opt.fontSizeH1] 輸入h1字型大小數字或字串，預設為20，自動轉字型為20*fontSizeScale+fontSizeUnit
 * @param {Number|String} [opt.fontSizeH2] 輸入h2字型大小數字或字串，預設為16，自動轉字型為16*fontSizeScale+fontSizeUnit
 * @param {Number|String} [opt.fontSizeH3] 輸入h3字型大小數字或字串，預設為14，自動轉字型為14*fontSizeScale+fontSizeUnit
 * @param {Number|String} [opt.fontSizeH4] 輸入h4字型大小數字或字串，預設為12，自動轉字型為12*fontSizeScale+fontSizeUnit
 * @param {Number|String} [opt.fontSizeH5] 輸入h5字型大小數字或字串，預設為12，自動轉字型為12*fontSizeScale+fontSizeUnit
 * @param {Number|String} [opt.fontSizeH6] 輸入h6字型大小數字或字串，預設為12，自動轉字型為12*fontSizeScale+fontSizeUnit
 * @param {Number|String} [opt.fontSizeP] 輸入p字型大小數字或字串，預設為12，自動轉字型為12*fontSizeScale+fontSizeUnit
 * @param {Number|String} [opt.fontSizeTab] 輸入表格文字字型大小數字或字串，預設為11，自動轉字型為11*fontSizeScale+fontSizeUnit
 * @param {Number|String} [opt.fontSizeCode] 輸入程式碼區塊字型大小數字或字串，預設為10，自動轉字型為10*fontSizeScale+fontSizeUnit
 * @param {String} [opt.textAlignH1='left'] 輸入h1對齊方式，可使用'left'、'center'、'right'，預設'left'
 * @param {String} [opt.textAlignH2='left'] 輸入h2對齊方式，可使用'left'、'center'、'right'，預設'left'
 * @param {String} [opt.textAlignH3='left'] 輸入h3對齊方式，可使用'left'、'center'、'right'，預設'left'
 * @param {String} [opt.textAlignH4='left'] 輸入h4對齊方式，可使用'left'、'center'、'right'，預設'left'
 * @param {String} [opt.textAlignH5='left'] 輸入h5對齊方式，可使用'left'、'center'、'right'，預設'left'
 * @param {String} [opt.textAlignH6='left'] 輸入h6對齊方式，可使用'left'、'center'、'right'，預設'left'
 * @param {Number|String} [opt.imgWidthMax=null] 輸入圖片樣式給予最大寬度，可輸入數字500單位為px，或是字串例如'100%'，預設null
 * @param {Function} [opt.funWalkTokens=null] 輸入marked轉換時的walkTokens函數，可執行進階處理，預設null
 * @param {Boolean} [opt.mergeStyle=false] 輸入是否將style放入html內布林值，預設false
 * @returns {Promise} 回傳Promise，resolve回傳轉換後物件，包含html、styleSrcs、styleDef，reject回傳錯誤訊息
 * @example
 *
 * let markdown = `...`
 * md2html(markdown,{mergeStyle:true})
 *     .then((res)=>{
 *         console.log(res)
 *         ele.innerHTML = res.html
 *     })
 *     .catch((err)=>{
 *         console.log(err)
 *     })
 *
 */
async function md2html(md, opt = {}) {

    //linkBlank
    let linkBlank = get(opt, 'linkBlank', null)
    if (!isbol(linkBlank)) {
        linkBlank = false
    }

    //tableHorizontalAlignmentCenter
    let tableHorizontalAlignmentCenter = get(opt, 'tableHorizontalAlignmentCenter', null)
    if (!isbol(tableHorizontalAlignmentCenter)) {
        tableHorizontalAlignmentCenter = false
    }

    //tableBorderColor
    let tableBorderColor = get(opt, 'tableBorderColor', '')
    if (!isestr(tableBorderColor)) {
        tableBorderColor = '#666'
    }

    //fontFamilies
    let fontFamilies = get(opt, 'fontFamilies', [])
    if (!isearr(fontFamilies)) {
        fontFamilies = ['Microsoft JhengHei', 'Avenir', 'Helvetica', 'Arial', 'sans-serif']
        // fontFamilies = ['Times New Roman', '標楷體'] //網頁使用, 因由左往右設定可不覆蓋無字元, 故可先設定Times New Roman再設定標楷體
    }
    fontFamilies = join(map(fontFamilies, (v) => {
        return `'${v}'`
    }), ', ')

    //fontSizeUnit
    let fontSizeUnit = get(opt, 'fontSizeUnit', '')
    if (!isestr(fontSizeUnit)) {
        fontSizeUnit = 'pt'
    }

    //fontSizeScale
    let fontSizeScale = get(opt, 'fontSizeScale', '')
    if (!isnum(fontSizeScale)) {
        fontSizeScale = 1
    }
    fontSizeScale = cdbl(fontSizeScale)

    //fontSizeDef
    let fontSizeDef = get(opt, 'fontSizeDef', '')
    if (!isestr(fontSizeDef)) {
        fontSizeDef = 12 * fontSizeScale + fontSizeUnit
    }

    //fontSizeH1
    let fontSizeH1 = get(opt, 'fontSizeH1', '')
    if (!isestr(fontSizeH1)) {
        fontSizeH1 = 20 * fontSizeScale + fontSizeUnit
    }

    //fontSizeH2
    let fontSizeH2 = get(opt, 'fontSizeH2', '')
    if (!isestr(fontSizeH2)) {
        fontSizeH2 = 16 * fontSizeScale + fontSizeUnit
    }

    //fontSizeH3
    let fontSizeH3 = get(opt, 'fontSizeH3', '')
    if (!isestr(fontSizeH3)) {
        fontSizeH3 = 14 * fontSizeScale + fontSizeUnit
    }

    //fontSizeH4
    let fontSizeH4 = get(opt, 'fontSizeH4', '')
    if (!isestr(fontSizeH4)) {
        fontSizeH4 = 12 * fontSizeScale + fontSizeUnit
    }

    //fontSizeH5
    let fontSizeH5 = get(opt, 'fontSizeH5', '')
    if (!isestr(fontSizeH5)) {
        fontSizeH5 = 12 * fontSizeScale + fontSizeUnit
    }

    //fontSizeH6
    let fontSizeH6 = get(opt, 'fontSizeH6', '')
    if (!isestr(fontSizeH6)) {
        fontSizeH6 = 12 * fontSizeScale + fontSizeUnit
    }

    //fontSizeP
    let fontSizeP = get(opt, 'fontSizeP', '')
    if (!isestr(fontSizeP)) {
        fontSizeP = 12 * fontSizeScale + fontSizeUnit
    }

    //fontSizeTab
    let fontSizeTab = get(opt, 'fontSizeTab', '')
    if (!isestr(fontSizeTab)) {
        fontSizeTab = 11 * fontSizeScale + fontSizeUnit
    }

    //fontSizeCode
    let fontSizeCode = get(opt, 'fontSizeCode', '')
    if (!isestr(fontSizeCode)) {
        fontSizeCode = 10 * fontSizeScale + fontSizeUnit
    }

    //textAlignH1
    let textAlignH1 = get(opt, 'textAlignH1', '')
    if (!isestr(textAlignH1)) {
        textAlignH1 = 'left'
    }

    //textAlignH2
    let textAlignH2 = get(opt, 'textAlignH2', '')
    if (!isestr(textAlignH2)) {
        textAlignH2 = 'left'
    }

    //textAlignH3
    let textAlignH3 = get(opt, 'textAlignH3', '')
    if (!isestr(textAlignH3)) {
        textAlignH3 = 'left'
    }

    //textAlignH4
    let textAlignH4 = get(opt, 'textAlignH4', '')
    if (!isestr(textAlignH4)) {
        textAlignH4 = 'left'
    }

    //textAlignH5
    let textAlignH5 = get(opt, 'textAlignH5', '')
    if (!isestr(textAlignH5)) {
        textAlignH5 = 'left'
    }

    //textAlignH6
    let textAlignH6 = get(opt, 'textAlignH6', '')
    if (!isestr(textAlignH6)) {
        textAlignH6 = 'left'
    }

    //imgWidthMax
    let imgWidthMax = get(opt, 'imgWidthMax', null)
    if (isnum(imgWidthMax)) {
        imgWidthMax = `${imgWidthMax}px`
    }
    if (!isestr(imgWidthMax)) {
        imgWidthMax = ''
    }

    //funWalkTokens
    let funWalkTokens = get(opt, 'funWalkTokens', null)

    //mergeStyle
    let mergeStyle = get(opt, 'mergeStyle', null)
    if (!isbol(mergeStyle)) {
        mergeStyle = false
    }

    //marked
    let marked = new Marked()

    //擴充KaTeX
    marked.use(markedKatex({
        throwOnError: false, //不要遇錯就丟例外
        nonStandard: true, //允許單行公式$...$可支援沒有空白格式
    }))

    //擴充註腳Footnote
    marked.use(markedFootnote())

    //擴充highlight
    marked.use(markedHighlight({
        langPrefix: 'hljs language-', //指定給code用的class為'hljs language-js'
        emptyLangClass: 'hljs', //沒指定語言時的class
        highlight(code, lang) {
            let language = lang && hljs.getLanguage(lang) ? lang : 'plaintext'
            return hljs.highlight(code, { language }).value
        },
    }))

    //renderer
    let renderer = {
        image: ({ href, title, text }) => {
            // console.log('href', href, 'title', title, 'text', text)

            //attrTitle
            let attrTitle = isestr(title) ? `title="${title}"` : ''

            //st
            let st = ''
            if (isestr(imgWidthMax)) {
                st = `max-width:${imgWidthMax}; height:auto;`
            }

            //h
            let h = `<img src="${href}" alt="${text}" ${attrTitle} style="${st}">`

            return h
        },
    }

    //optMd
    let optMd = {
        async: true,
        renderer, //無法使用async
    }
    if (isfun(funWalkTokens)) {
        optMd.walkTokens = funWalkTokens //可用async, 圖片轉成base64時因svg轉換須async, 故只能通過walkTokens攔截進行轉換
    }

    //其他擴充
    marked.use(optMd)

    //h
    let h = await marked.parse(md)
    // console.log('h', h)

    //封裝h
    h = `
        <div class="md" style="contain:layout;">
            ${h}
        </div>
    `

    //styleSrcs
    let styleSrcs = [
        `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css`, //highlight
        `https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css`, //KaTeX
    ]

    //styleDef
    let styleDef = `

.md {
    font-family: {fontFamilies};
    font-size: {fontSizeDef};
}

.md table {
    border-collapse: collapse;
    margin: 0;
    padding: 0;
    word-break: initial;
    font-family: {fontFamilies};
    font-size: {fontSizeTab};
}

.md tr {
    margin: 0;
    padding: 0;
}

.md table tr th {
    font-weight: bold;
    background: #eee;
    border: 1px solid {tableBorderColor};
    border-bottom: 0;
    margin: 0;
    padding: 6px 13px;
}

.md table tr td {
    border: 1px solid {tableBorderColor};
    margin: 0;
    padding: 6px 13px;
}

.md h1 {
    display: block;
    font-size: {fontSizeH1};
    margin: 1rem 0;
    padding: 0;
    font-weight: bold;
    text-align: {textAlignH1};
}

.md h2 {
    display: block;
    font-size: {fontSizeH2};
    margin: 1rem 0;
    padding: 0;
    font-weight: bold;
    text-align: {textAlignH2};
}

.md h3 {
    display: block;
    font-size: {fontSizeH3};
    margin: 1rem 0;
    padding: 0;
    font-weight: bold;
    text-align: {textAlignH3};
}

.md h4 {
    display: block;
    font-size: {fontSizeH4};
    margin: 1rem 0;
    padding: 0;
    font-weight: bold;
    text-align: {textAlignH4};
}

.md h5 {
    display: block;
    font-size: {fontSizeH5};
    margin: 1rem 0;
    padding: 0;
    font-weight: bold;
    text-align: {textAlignH5};
}

.md h6 {
    display: block;
    font-size: {fontSizeH6};
    margin: 1rem 0;
    padding: 0;
    font-weight: bold;
    text-align: {textAlignH6};
}

.md p {
    display: block;
    font-size: {fontSizeP};
    margin: 1rem 0;
    padding: 0;
} 

.md ol {
    display: block;
    list-style-type: decimal;
    margin: 1rem 0;
    padding: 0;
    padding-inline-start: 40px;
} 

.md li {
    display: list-item;
    /* margin: 0.4rem 0; */ /* 須個別元素用style給予才能用於docx */
    padding: 0;
}

.md blockquote {
    font-style: italic;
    border-left: 5px solid #debc76;
    background: #f9f2e3;
    margin: 1rem 0;
    padding: 0.1rem 1.0rem 0.1rem 1.0rem;
}

.md pre {
    display: block;
    font-size: {fontSizeCode};
    overflow: auto;
    background: #eee;
    margin: 1rem 0;
    padding: 0;
}
.md pre code.hljs {
    background: transparent !important;
    line-height: 1.6 !important;
}

.md code {
    font-family: Consolas, "Courier New", monospace;
}

.md a {
    color: #0066cc;
    cursor: pointer;
}

.md a[data-footnote-ref]::before {
    content: "[";
}
.md a[data-footnote-ref]::after {
    content: "]";
}
.md sup:has(a[data-footnote-ref]) {
    position: relative;
    vertical-align: baseline; /* 不要推高行距 */
    top: -0.5em;              /* 往上移動看起來像上標 */
    line-height: 0;           /* 避免影響行距 */
}

.md hr {
    margin: 2rem 0;
    padding: 0;
}

.md section {
    margin: 0;
    padding: 0;
}

    `

    //replace
    styleDef = replace(styleDef, '{fontFamilies}', fontFamilies)
    styleDef = replace(styleDef, '{fontSizeDef}', fontSizeDef)
    styleDef = replace(styleDef, '{fontSizeH1}', fontSizeH1)
    styleDef = replace(styleDef, '{fontSizeH2}', fontSizeH2)
    styleDef = replace(styleDef, '{fontSizeH3}', fontSizeH3)
    styleDef = replace(styleDef, '{fontSizeH4}', fontSizeH4)
    styleDef = replace(styleDef, '{fontSizeH5}', fontSizeH5)
    styleDef = replace(styleDef, '{fontSizeH6}', fontSizeH6)
    styleDef = replace(styleDef, '{fontSizeP}', fontSizeP)
    styleDef = replace(styleDef, '{fontSizeTab}', fontSizeTab)
    styleDef = replace(styleDef, '{fontSizeCode}', fontSizeCode)
    styleDef = replace(styleDef, '{textAlignH1}', textAlignH1)
    styleDef = replace(styleDef, '{textAlignH2}', textAlignH2)
    styleDef = replace(styleDef, '{textAlignH3}', textAlignH3)
    styleDef = replace(styleDef, '{textAlignH4}', textAlignH4)
    styleDef = replace(styleDef, '{textAlignH5}', textAlignH5)
    styleDef = replace(styleDef, '{textAlignH6}', textAlignH6)
    styleDef = replace(styleDef, '{tableBorderColor}', tableBorderColor)

    //dp, doc
    let dp = null
    let doc = null
    if (isWindow()) {
        dp = DOMPurify
        doc = document
    }
    else {
        let clib = 'jsdom'
        let { JSDOM } = await import(clib)
        let { window } = new JSDOM('')
        dp = DOMPurify(window)
        doc = window.document
    }

    //sanitize
    h = dp.sanitize(h)

    //DOM後處理: 於sanitize之後以DOM補處理(原htmlConvert之處理併入此處, 消除重複解析)
    //  why DOM: DOMPurify預設會洗掉<a target>, 不可只靠marked renderer; 用已建立之DOM(瀏覽器document / Node端jsdom)避免引入cheerio與addHook全域污染
    //  display:none / data-for="br" / data-for="tab" 為無條件處理; linkBlank / tableHorizontalAlignmentCenter 依opt有條件處理
    let zwsp = String.fromCharCode(0x200B) //零寬空格U+200B, 以ASCII碼點建構避免原始碼出現隱形字元
    let box = doc.createElement('div')
    box.innerHTML = h

    //移除display:none元素
    each(box.querySelectorAll('[style*="display:none"]'), (el) => {
        el.remove()
    })

    //data-for="br": 空div之「換行/空段落」語意標記, 於div內插入零寬空格(U+200B)佔位,
    //使轉docx時段落不被Word匯入丟棄(由w-html2docx端還原移除); 僅對內容為空者處理避免覆蓋既有內容
    //  why data-for(非for): DOMPurify 3.4.12起將for視為label限定屬性, 於div會被洗掉; data-*屬性預設保留故改用data-for承載標記
    each(box.querySelectorAll('div[data-for="br"]'), (el) => {
        if (el.textContent === '') {
            el.textContent = zwsp
        }
    })

    //data-for="tab": 表格字型大小標記, 空div之data-style-th/data-style-td分別為th/td之style, 套用至往下第一張table之th/td再移除此標記
    //  why data-*: 標記(data-for)與樣式(data-style-th/td)皆用data-*承載, DOMPurify預設保留; 空div於md預覽不顯示且處理後移除, 與data-for="br"同慣例
    //  why inline於th/td元素: 對應w-html2docx(Word匯入)實測生效寫法, 直接置於th/td元素上(非cell內span)可避免殘留多餘run
    //  須先於tableHorizontalAlignmentCenter外包置中之前執行, 否則table被包入div後不再為此標記div之兄弟節點抓不到
    each(box.querySelectorAll('div[data-for="tab"]'), (el) => {
        let styleTh = el.getAttribute('data-style-th') || ''
        let styleTd = el.getAttribute('data-style-td') || ''
        let tab = el.nextElementSibling
        while (tab && tab.tagName !== 'TABLE') {
            tab = tab.nextElementSibling
        }
        if (tab) {
            let addStyle = (cell, add) => {
                if (add === '') {
                    return
                }
                let prev = cell.getAttribute('style') || ''
                if (prev !== '' && !/;\s*$/.test(prev)) {
                    prev += ';'
                }
                cell.setAttribute('style', prev + add)
            }
            if (styleTh !== '') {
                each(tab.querySelectorAll('th'), (th) => {
                    addStyle(th, styleTh)
                })
            }
            if (styleTd !== '') {
                each(tab.querySelectorAll('td'), (td) => {
                    addStyle(td, styleTd)
                })
            }
        }
        el.remove()
    })

    //linkBlank: 外部連結另開新頁, 排除同頁錨點(footnote之#fnX)避免註腳連結誤開新分頁
    if (linkBlank) {
        each(box.querySelectorAll('a[href]'), (el) => {
            let href = el.getAttribute('href') || ''
            if (href.slice(0, 1) !== '#') {
                el.setAttribute('target', '_blank')
                el.setAttribute('rel', 'noopener noreferrer')
            }
        })
    }

    //tableHorizontalAlignmentCenter: table設inline-table並外包text-align:center之div, 使html/docx皆可水平置中(block table用margin:auto無法帶入docx)
    if (tableHorizontalAlignmentCenter) {
        each(box.querySelectorAll('table'), (el) => {
            el.style.display = 'inline-table' //table變inline-level才吃父層text-align置中(內層仍維持表格排版), 用inline-table而非inline-block以保留border-collapse與欄寬
            let wrap = doc.createElement('div')
            wrap.style.textAlign = 'center'
            el.parentNode.insertBefore(wrap, el)
            wrap.appendChild(el)
        })
    }

    h = box.innerHTML

    //r
    let r = {}
    if (mergeStyle) {
        let _h = `\n`
        each(styleSrcs, (v) => {
            let t = `<link rel="stylesheet" href="${v}">\n`
            _h += t
        })
        _h += `<style>${styleDef}</style>\n`
        _h += h
        r = {
            html: _h,
            styleSrcs: [],
            styleDef: '',
        }
    }
    else {
        r = {
            html: h,
            styleSrcs,
            styleDef,
        }
    }

    return r
}


export default md2html
