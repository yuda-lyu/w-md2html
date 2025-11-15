import path from 'path'
import fs from 'fs'
import get from 'lodash-es/get.js'
import each from 'lodash-es/each.js'
import map from 'lodash-es/map.js'
import split from 'lodash-es/split.js'
import trim from 'lodash-es/trim.js'
import join from 'lodash-es/join.js'
import drop from 'lodash-es/drop.js'
import dropRight from 'lodash-es/dropRight.js'
import size from 'lodash-es/size.js'
import isbol from 'wsemi/src/isbol.mjs'
import isestr from 'wsemi/src/isestr.mjs'
import isearr from 'wsemi/src/isearr.mjs'
import isnum from 'wsemi/src/isnum.mjs'
import isfun from 'wsemi/src/isfun.mjs'
import cdbl from 'wsemi/src/cdbl.mjs'
import replace from 'wsemi/src/replace.mjs'
import getFileName from 'wsemi/src/getFileName.mjs'
import getFileNameExt from 'wsemi/src/getFileNameExt.mjs'
import getPathParent from 'wsemi/src/getPathParent.mjs'
import fsIsFile from 'wsemi/src/fsIsFile.mjs'
import { Marked } from 'marked'
import markedKatex from 'marked-katex-extension'
import markedFootnote from 'marked-footnote'
import hljs from 'highlight.js'
import { markedHighlight } from 'marked-highlight'


/**
 * Markdown檔轉Html檔
 *
 * @param {String} fpIn 輸入來源Markdown檔位置字串
 * @param {String} fpOut 輸入轉出Html檔位置字串
 * @param {Object} [opt={}] 輸入設定物件，預設{}
 * @param {String} [opt.fpInTemp=] 輸入模板位置字串，預設'./node_modules/w-md2html/src/html.tmp'
 * @param {Number|String} [opt.imgWidthMax=null] 輸入圖片樣式給予最大寬度，可輸入數字500單位為px，或是字串例如'100%'，預設null
 * @param {Boolean} [opt.imgConvertToBase64=true] 輸入圖片是否自動轉Base64布林值，預設true
 * @param {Function} [opt.funProcFpOut=null] 輸入處理輸出檔名函數，預設null
 * @returns {Promise} 回傳Promise，resolve回傳成功訊息，reject回傳錯誤訊息
 * @example
 *
 * import w from 'wsemi'
 * import WMd2html from './src/WMd2html.mjs'
 * //import WMd2html from 'w-md2html/src/WMd2html.mjs'
 * //import WMd2html from 'w-md2html'
 *
 * async function test() {
 *
 *     let fpIn = `./test/report.md`
 *     let fpOut = `./test/report.html`
 *     let opt = {
 *         imgWidthMax: '500px',
 *         funProcFpOut: (msg) => {
 *             console.log('msg', msg)
 *             return msg.fpOut
 *         },
 *     }
 *
 *     let r = await WMd2html(fpIn, fpOut, opt)
 *     console.log(r)
 *     // => ok
 *
 *     w.fsDeleteFile(fpOut)
 *
 * }
 * test()
 *     .catch((err) => {
 *         console.log('catch', err)
 *     })
 *
 */
async function WMd2html(fpIn, fpOut, opt = {}) {

    //check
    if (!fsIsFile(fpIn)) {
        return Promise.reject(`fpIn[${fpIn}] does not exist`)
    }

    //轉絕對路徑
    fpIn = path.resolve(fpIn)
    // console.log('fpIn', fpIn)

    //fdIn
    let fdIn = getPathParent(fpIn)

    //fpInTemp
    let fpInTemp = get(opt, 'fpInTemp')
    if (!fsIsFile(fpInTemp)) {

        //fpInTempSelf
        let fpInTempSelf = `./src/html.tmp`

        //fpInTempPkg
        let fpInTempPkg = `./node_modules/w-md2html/src/html.tmp`

        if (fsIsFile(fpInTempSelf)) {
            fpInTemp = fpInTempSelf
        }
        else if (fsIsFile(fpInTempPkg)) {
            fpInTemp = fpInTempPkg
        }
        else {
            throw new Error(`fpInTemp[${fpInTemp}] does not exist`)
        }
        // console.log('fpInTemp', fpInTemp)

    }

    //轉絕對路徑
    fpInTemp = path.resolve(fpInTemp)
    // console.log('fpInTemp', fpInTemp)

    //imgWidthMax
    let imgWidthMax = get(opt, 'imgWidthMax', null)
    if (isnum(imgWidthMax)) {
        imgWidthMax = `${imgWidthMax}px`
    }

    //imgConvertToBase64
    let imgConvertToBase64 = get(opt, 'imgConvertToBase64', null)
    if (!isbol(imgConvertToBase64)) {
        imgConvertToBase64 = true
    }

    //funProcFpOut
    let funProcFpOut = get(opt, 'funProcFpOut')

    let getPretitle = (md) => {
        let s = split(md, '\n')
        let pretitle = ''
        each(s, (v, k) => {
            if (v.indexOf(' pretitle ') >= 0) {
                pretitle = get(s, k + 1, '') //取有pretitle的下一列
                pretitle = trim(pretitle) //因整行須trim
                return false //跳出
            }
        })
        return pretitle
    }

    let cvItemNum = (md, type) => {
        let s = split(md, '\n') //不能用sep避免md內手動分行消失
        let i = 0
        let rs = []
        let kp = {}
        each(s, (v) => {
            let vv = v
            if (v.indexOf(`${type}n`) >= 0) {
                i++
                let t

                //填入圖表號
                vv = replace(v, `${type}n`, `${type}${i}`)

                //儲存圖表名對應圖表號
                t = v
                t = replace(t, '<div style="margin:1rem 0;">', '')
                t = replace(t, '</div>', '')
                t = replace(t, `${type}n`, '')
                t = trim(t)
                t = `{${t}}`
                kp[t] = `${type}${i}`
                // console.log(t, '-->', kp[t])

            }
            rs.push(vv)
        })

        //取代圖表名為對應圖表號
        let h = join(rs, '\n')
        each(kp, (v, k) => {
        // h = replace(h, k, v)
            h = h.replaceAll(k, v)
        })

        return h
    }

    let getFileB64 = (fp) => {
        let bitmap = fs.readFileSync(fp)
        return Buffer.from(bitmap).toString('base64')
    }

    let cvExtToMime = (ext) => {
        ext = ext.toLowerCase()
        if (ext === 'png') return 'image/png'
        if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
        if (ext === 'gif') return 'image/gif'
        if (ext === 'svg') return 'image/svg+xml'
        if (ext === 'webp') return 'image/webp'
        return 'application/octet-stream'
    }

    let readPicB64 = (fp) => {

        //b64
        let b64 = getFileB64(fp)

        //mime
        let mime = cvExtToMime(getFileNameExt(fp))

        //pb64
        let pb64 = `data:${mime};base64,${b64}`
        // console.log(fp, 'b64', b64)

        return pb64
    }

    let cvPicB64 = (fd, md) => {

        let gsrc = (c) => {

            let s = split(c, 'src="')
            if (size(s) !== 2) {
                throw new Error(`size(s)!==2`)
            }
            let s0 = s[0]
            let s1 = s[1]
            let s1s = split(s1, '"')

            //fp
            let fnp = s1s[0]
            // console.log('fnp', fnp)
            let fp = `${fd}/${fnp}`
            // console.log('fp', fp)

            //pb64
            let pb64 = readPicB64(fp)
            // console.log(fp, 'b64', b64)

            s1s = drop(s1s)

            //merge
            let r = s0 + 'src="' + pb64 + '"' + join(s1s, '"')

            return r
        }

        let tt = []
        let s = split(md, '\n')
        each(s, (v) => {
            let b = v.indexOf('src="') >= 0
            if (b) {
                v = gsrc(v)
            // console.log(v)
            }
            tt.push(v)
        })
        tt = join(tt, '\n')

        return tt
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

    //tmp
    let tmp = fs.readFileSync(fpInTemp, 'utf8')

    //title
    let title = getFileName(fpIn)
    title = title.replace('.md', '')
    // console.log('title', title)

    //fdInMd
    let fdInMd = split(fpIn, '\\')
    fdInMd = dropRight(fdInMd)
    fdInMd = join(fdInMd, '\\')
    // console.log('fdInMd', fdInMd)

    //md
    let md = fs.readFileSync(fpIn, 'utf8')

    //getPretitle
    let pretitle = getPretitle(md)
    // console.log(fpIn, 'pretitle', pretitle)

    //cvItemNum 圖
    md = cvItemNum(md, '圖')
    // console.log(md)

    //cvItemNum 表
    md = cvItemNum(md, '表')
    // console.log(md)

    //cvPicB64
    md = cvPicB64(fdInMd, md)

    //marked
    let marked = new Marked()

    //擴充KaTeX
    marked.use(markedKatex({
        throwOnError: false, //不要遇錯就丟例外
        nonStandard: true, //允許沒有空白的$...$
    }))

    //擴充註腳Footnote
    marked.use(markedFootnote())

    //擴充highlight
    marked.use(markedHighlight({
        langPrefix: 'hljs language-', //指定給code用的class: class="hljs language-js"
        emptyLangClass: 'hljs', //沒指定語言時的 class
        highlight(code, lang) {
            let language = lang && hljs.getLanguage(lang) ? lang : 'plaintext'
            return hljs.highlight(code, { language }).value
        },
    }))

    //擴充renderer
    let renderer = {
        image({ href, title, text }) {
            // console.log('href', href, 'title', title, 'text', text)

            //attrTitle
            let attrTitle = isestr(title) ? `title="${title}"` : ''

            //st
            let st = ''
            if (isestr(imgWidthMax)) {
                st = `max-width:${imgWidthMax}; height:auto;`
            }

            //hf
            let hf = href
            if (imgConvertToBase64) {

                //fpHref
                let fpHref = path.resolve(fdIn, href)
                // console.log('fpHref', fpHref)

                //check
                if (fsIsFile(fpHref)) {

                    //readPicB64
                    hf = readPicB64(fpHref)
                    // console.log('hf', hf)

                }
                else {
                    console.log(`href[${href}] does not exist`)
                }

            }

            //h
            let h = `<img src="${hf}" alt="${text}" ${attrTitle} style="${st}">`

            return h
        }
    }
    marked.use({ renderer })

    //mdh
    let mdh = marked.parse(md)
    // console.log('h', h)

    //tmp
    let h = tmp
    h = replace(h, '{html}', mdh)
    h = replace(h, '{title}', title)
    h = replace(h, '{fontFamilies}', fontFamilies)
    h = replace(h, '{fontSizeDef}', fontSizeDef)
    h = replace(h, '{fontSizeH1}', fontSizeH1)
    h = replace(h, '{fontSizeH2}', fontSizeH2)
    h = replace(h, '{fontSizeH3}', fontSizeH3)
    h = replace(h, '{fontSizeH4}', fontSizeH4)
    h = replace(h, '{fontSizeH5}', fontSizeH5)
    h = replace(h, '{fontSizeH6}', fontSizeH6)
    h = replace(h, '{fontSizeP}', fontSizeP)
    h = replace(h, '{fontSizeTab}', fontSizeTab)
    h = replace(h, '{fontSizeCode}', fontSizeCode)
    h = replace(h, '{textAlignH1}', textAlignH1)
    h = replace(h, '{textAlignH2}', textAlignH2)
    h = replace(h, '{textAlignH3}', textAlignH3)
    h = replace(h, '{textAlignH4}', textAlignH4)
    h = replace(h, '{textAlignH5}', textAlignH5)
    h = replace(h, '{textAlignH6}', textAlignH6)
    // console.log('h', h)

    //funProcFpOut
    if (isfun(funProcFpOut)) {
        fpOut = funProcFpOut({ fpOut, pretitle })
    }
    // console.log('fpOut', fpOut)

    //writeFileSync
    fs.writeFileSync(fpOut, h, 'utf8')

    // //writeFileSync
    // fs.writeFileSync(fpOutMd, md, 'utf8')

    return 'ok'
}


export default WMd2html
