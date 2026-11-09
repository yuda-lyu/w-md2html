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
import katex from 'katex'
import markedKatex from 'marked-katex-extension'
import markedFootnote from 'marked-footnote'
import hljs from 'highlight.js'
import { markedHighlight } from 'marked-highlight'
import DOMPurify from 'dompurify'


//表格標記(div[data-for="tab"])之輔助函數, 皆為內部函數(R-SYNTAX-01、R-TABLE-01)

//addStyle, 於node之style屬性末尾附加style字串, 前值未以;結尾則先補;
let addStyle = (node, add) => {
    if (add === '') {
        return
    }
    let prev = node.getAttribute('style') || ''
    if (prev !== '' && !/;\s*$/.test(prev)) {
        prev += ';'
    }
    node.setAttribute('style', prev + add)
}

//getColMap, 取得表格各cell之邏輯欄索引(cell為key, 值為其起始欄, 0起算), 計入上方rowspan與左方colspan所佔之格
//  rowspan不跨區段(thead/tbody/tfoot), 換區段時重置佔用表; rowspan=0為至區段末列; 跨度取DOM之rowSpan/colSpan(已限縮於合法範圍), 再限縮於區段列數
//  hasSpan為表內是否有實際跨列或跨欄之cell
let getColMap = (tab) => {
    let kpCol = new Map()
    let hasSpan = false
    let occ = [] //occ[列][欄]為該格是否已被佔用
    let r = 0 //列於區段內之序
    let secPrev = null
    each(tab.rows, (tr) => {
        let sec = tr.parentNode
        if (sec !== secPrev) {
            secPrev = sec
            occ = []
            r = 0
        }
        let nLeft = sec.rows.length - r //含本列, 區段內剩餘列數
        occ[r] = occ[r] || []
        let c = 0
        each(tr.cells, (cell) => {
            while (occ[r][c]) {
                c++
            }
            kpCol.set(cell, c)
            let rs = cell.rowSpan === 0 ? nLeft : Math.min(Math.max(cell.rowSpan, 1), nLeft)
            let cs = Math.max(cell.colSpan, 1)
            if (rs > 1 || cs > 1) {
                hasSpan = true
            }
            for (let i = 0; i < rs; i++) {
                occ[r + i] = occ[r + i] || []
                for (let j = 0; j < cs; j++) {
                    occ[r + i][c + j] = true //含本列, 下一格由上方while跳過已佔用者
                }
            }
        })
        r++
    })
    return { kpCol, hasSpan }
}

//parseCols, 解析欄索引清單(0起算, 逗號分隔, 各項去頭尾空白後須為非負整數), 依出現順序去重, 無效之項略過
let parseCols = (t) => {
    let cols = []
    each(t.split(','), (s) => {
        s = s.trim()
        if (!/^\d+$/.test(s)) {
            return
        }
        let n = parseInt(s, 10)
        if (Number.isSafeInteger(n) && cols.indexOf(n) < 0) {
            cols.push(n)
        }
    })
    return cols
}

//pickProps, 自style字串取指定屬性(依keys之順序輸出, 同名取最後者, 與CSS後宣告優先一致), 回傳'k:v;k:v;'
let pickProps = (st, keys) => {
    let kp = {}
    each(st.split(';'), (s) => {
        let i = s.indexOf(':')
        if (i < 0) {
            return
        }
        let k = s.slice(0, i).trim().toLowerCase()
        if (keys.indexOf(k) >= 0) {
            kp[k] = s.slice(i + 1).trim()
        }
    })
    let t = ''
    each(keys, (k) => {
        if (kp[k] !== undefined) {
            t += `${k}:${kp[k]};`
        }
    })
    return t
}

//cellKey, cell之內容鍵(innerHTML去頭尾空白)
let cellKey = (cell) => {
    return cell.innerHTML.trim()
}

//canMerge, cell是否可參與合併: 存在, 無既有rowspan/colspan, 有內容(空白格不視為相同而合併)
let canMerge = (cell) => {
    return cell !== null && cell.rowSpan === 1 && cell.colSpan === 1 && cellKey(cell) !== ''
}

//sameCell, 兩cell是否相同而可合併: 皆可參與合併, 同為th或同為td, 內容相同
let sameCell = (a, b) => {
    return canMerge(a) && canMerge(b) && a.tagName === b.tagName && cellKey(a) === cellKey(b)
}

//mergeCellsH, 左右合併(data-merge-h): 同一列內指定欄之間邏輯欄相鄰且相同之cell合併為一格(colspan), 刪除右側之格, 保留最左格之內容與樣式
//  適用thead/tbody/tfoot之各列; 相鄰以邏輯欄連續判定, 被上方rowspan佔住之欄不算相鄰
let mergeCellsH = (tab, kpCol, cols) => {
    each(tab.rows, (tr) => {
        let cells = Array.from(tr.cells).filter((cell) => cols.indexOf(kpCol.get(cell)) >= 0 && canMerge(cell))
        let s = 0
        for (let i = 1; i <= cells.length; i++) {
            let same = i < cells.length && kpCol.get(cells[i]) === kpCol.get(cells[i - 1]) + 1 && sameCell(cells[s], cells[i])
            if (!same) {
                if (i - 1 > s) {
                    cells[s].setAttribute('colspan', String(i - s))
                    for (let k = s + 1; k < i; k++) {
                        cells[k].remove()
                    }
                }
                s = i
            }
        }
    })
}

//mergeCellsV, 上下合併(data-merge-v): 各tbody內, 指定欄上下相鄰且相同之cell合併為一格(rowspan), 刪除下方之格
//  cols之順序為階層: 後列之欄只在前列各欄之同一合併區塊內才合併; 先左右後上下, 故已左右合併(colspan)之格不參與
//  keep為true: 第一個合併欄之各區塊不跨頁, 區塊內各列加page-break-inside:avoid(Word之cantSplit), 非末列各格內容外包page-break-after:avoid之div(Word之keepNext)
let mergeCellsV = (tab, kpCol, cols, keep, doc) => {
    each(tab.tBodies, (tb) => {
        let rows = Array.from(tb.rows)
        let cellAt = (row, c) => {
            let hit = null
            each(row.cells, (v) => {
                if (kpCol.get(v) === c) {
                    hit = v
                }
            })
            return hit
        }
        let keys = rows.map(() => '') //各列所屬之上層區塊鍵
        let blocksTop = null
        each(cols, (c) => {
            let keysNew = rows.map(() => '')
            let blocks = []
            let s = 0
            for (let i = 1; i <= rows.length; i++) {
                let same = i < rows.length && keys[i] === keys[s] && sameCell(cellAt(rows[s], c), cellAt(rows[i], c))
                if (!same) {

                    //區塊[s, i-1]
                    blocks.push([s, i - 1])
                    for (let k = s; k < i; k++) {
                        keysNew[k] = `${keys[s]}|${s}`
                    }
                    if (i - 1 > s) {
                        cellAt(rows[s], c).setAttribute('rowspan', String(i - s))
                        for (let k = s + 1; k < i; k++) {
                            cellAt(rows[k], c).remove()
                        }
                    }
                    s = i
                }
            }
            keys = keysNew
            if (blocksTop === null) {
                blocksTop = blocks
            }
        })
        if (keep && blocksTop) {
            each(blocksTop, ([s, e]) => {
                for (let i = s; i <= e; i++) {
                    addStyle(rows[i], 'page-break-inside:avoid;')
                    if (i < e) {
                        each(rows[i].cells, (cell) => {
                            let wrap = doc.createElement('div')
                            wrap.setAttribute('style', 'page-break-after:avoid;')
                            while (cell.firstChild) {
                                wrap.appendChild(cell.firstChild)
                            }
                            cell.appendChild(wrap)
                        })
                    }
                }
            })
        }
    })
}


/**
 * Markdown轉Html
 *
 * 輸出之html經DOMPurify清洗，並移除內容中之style元素(置入頁面後會作用於整頁)；mergeStyle為true時套件自身之樣式於清洗之後加入，不受影響
 *
 * 表格標記：於表格前以空div(data-for="tab")之屬性指定表格樣式與合併，data-style-th/data-style-td/data-style-th-{n}/data-style-td-{n}/data-style-code為樣式，data-merge-h/data-merge-v/data-merge-keep為合併儲存格(欄索引0起算)，詳見README之Table Markup
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
        `https://cdn.jsdelivr.net/npm/katex@${katex.version}/dist/katex.min.css`, //KaTeX, CSS版本須與產出html之katex一致(0.18起內部class加katex-前綴, 版本不符會跑版), 故由katex.version取得
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

/* 行內code明訂為所在元素之字級(Word匯入html時code不繼承父層字級, font-size:inherit亦無效, 會沿用文件預設字級而與周圍文字不一) */
/* 後宣告優先: li、table先於p, 使清單項目與儲存格內之p內code隨p; 區塊程式碼(pre code)於li、table內維持fontSizeCode */
.md li code {
    font-size: {fontSizeDef};
}
.md table code {
    font-size: {fontSizeTab};
}
.md p code {
    font-size: {fontSizeP};
}
.md h1 code {
    font-size: {fontSizeH1};
}
.md h2 code {
    font-size: {fontSizeH2};
}
.md h3 code {
    font-size: {fontSizeH3};
}
.md h4 code {
    font-size: {fontSizeH4};
}
.md h5 code {
    font-size: {fontSizeH5};
}
.md h6 code {
    font-size: {fontSizeH6};
}
.md li pre code {
    font-size: {fontSizeCode};
}
.md table pre code {
    font-size: {fontSizeCode};
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
    //  FORBID_TAGS style: DOMPurify預設允許<style>且不檢查其中之CSS, 輸出以innerHTML(如v-html)置入頁面後會作用於整頁(改整頁背景、隱藏他處區塊), 故移除使用者內容中之style元素(其內CSS一併捨棄, 不外漏為文字)
    //  套件自身之樣式(styleDef)於mergeStyle為true時在清洗之後才加入, 不受影響
    h = dp.sanitize(h, { FORBID_TAGS: ['style'] })

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

    //data-for="tab": 表格標記, 空div之屬性套用至往下第一張table再移除此標記(R-SYNTAX-01、R-TABLE-01)
    //  data-style-th/data-style-td: 分別為th/td之style; data-style-th-{n}/data-style-td-{n}: 逐欄之style; data-style-code: 表內全部行內code之style
    //  data-merge-h/data-merge-v: 左右/上下合併之欄索引; data-merge-keep: 上下合併之區塊不跨頁
    //  處理順序: 全域樣式 → 逐欄樣式 → code繼承 → 左右合併 → 上下合併 → 不跨頁(逐欄樣式先於合併, 合併格保留其欄之樣式; 左右合併後之格不再參與上下合併, 故分類列會切斷上下合併)
    //  why data-*: 標記(data-for)與樣式(data-style-th/td)皆用data-*承載, DOMPurify預設保留; 空div於md預覽不顯示且處理後移除, 與data-for="br"同慣例
    //  why inline於th/td元素: 對應w-html2docx(Word匯入)實測生效寫法, 直接置於th/td元素上(非cell內span)可避免殘留多餘run
    //  無效之屬性值(非欄索引之項、非'true'之data-merge-keep)視為未給, 不拋錯且不影響其餘處理
    //  須先於tableHorizontalAlignmentCenter外包置中之前執行, 否則table被包入div後不再為此標記div之兄弟節點抓不到
    each(box.querySelectorAll('div[data-for="tab"]'), (el) => {
        let styleTh = el.getAttribute('data-style-th') || ''
        let styleTd = el.getAttribute('data-style-td') || ''
        let styleCode = el.getAttribute('data-style-code') || ''
        let colsH = parseCols(el.getAttribute('data-merge-h') || '')
        let colsV = parseCols(el.getAttribute('data-merge-v') || '')
        let mergeKeep = (el.getAttribute('data-merge-keep') || '').trim() === 'true'
        let tab = el.nextElementSibling
        while (tab && tab.tagName !== 'TABLE') {
            tab = tab.nextElementSibling
        }
        if (tab) {
            let { kpCol, hasSpan } = getColMap(tab)
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

            //逐欄樣式: data-style-th-{n} / data-style-td-{n}, n為0起算之欄索引(4欄則n=0~3)
            //  語意為「第n欄」非「整表第n個cell」, 使該欄各列皆生效(如white-space:nowrap讓整欄不換行)
            //  定位: 表內有rowspan/colspan時依邏輯欄(kpCol, 計入上方rowspan與左方colspan所佔之格, 跨欄之格只在起始欄套用), 否則逐列取該列第n個同標籤(th/td)之cell(與過去相同, 混用th/td之列照舊)
            //  why 邏輯欄: 以「該列第n個」定位時, 遇rowspan之表(下方列少了左側cell)會錯欄
            //  置於全域data-style-th/td之後, 使逐欄可於全域基礎上追加或覆寫(CSS後宣告優先)
            each(el.attributes, (attr) => {
                let ms = attr.name.match(/^data-style-(th|td)-(\d+)$/) //屬性名經HTML解析已小寫化
                if (!ms) {
                    return
                }
                let add = attr.value || ''
                if (add === '') {
                    return
                }
                let tag = ms[1].toUpperCase()
                let idx = cdbl(ms[2])
                if (hasSpan) {
                    each(tab.rows, (tr) => {
                        each(tr.cells, (cell) => {
                            if (cell.tagName === tag && kpCol.get(cell) === idx) {
                                addStyle(cell, add)
                            }
                        })
                    })
                    return
                }
                each(tab.querySelectorAll('tr'), (tr) => {
                    let cells = []
                    each(tr.children, (c) => {
                        if (c.tagName === tag) {
                            cells.push(c)
                        }
                    })
                    let cell = cells[idx]
                    if (cell) {
                        addStyle(cell, add)
                    }
                })
            })

            //code繼承所在儲存格之字級與行高, 再附加data-style-code
            //  why: Word匯入html時行內code不繼承所在th/td之inline字級(沿用文件預設字級), 於固定行高下被裁切
            //  取所在cell最終style之font-size、mso-line-height-rule、line-height(同名取最後者)寫入code, 置於code自帶style之前(自帶者優先)
            each(tab.querySelectorAll('code'), (code) => {
                let cell = code.closest('th, td')
                let inh = ''
                if (cell && tab.contains(cell)) {
                    inh = pickProps(cell.getAttribute('style') || '', ['font-size', 'mso-line-height-rule', 'line-height'])
                }
                let st = inh + styleCode
                if (st !== '') {
                    if (!/;\s*$/.test(st)) {
                        st += ';'
                    }
                    code.setAttribute('style', st + (code.getAttribute('style') || ''))
                }
            })

            //左右合併, 再上下合併(含不跨頁)
            if (colsH.length > 0) {
                mergeCellsH(tab, kpCol, colsH)
            }
            if (colsV.length > 0) {
                mergeCellsV(tab, kpCol, colsV, mergeKeep, doc)
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
