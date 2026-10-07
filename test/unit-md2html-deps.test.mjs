import fs from 'fs'
import path from 'path'
import assert from 'assert'
import { createRequire } from 'module'
import md2html from '../src/md2html.mjs'
import WMd2html from '../src/WMd2html.mjs'


//依賴契約回歸測試: 鎖住 md2html/WMd2html 依賴第三方套件(katex、marked-katex-extension、marked、marked-footnote、
//marked-highlight、highlight.js、dompurify)之行為, 升版時若契約改變可直接定位到套件, 不必只靠 reportTrue.html 逐字比對
//每條斷言註明對應之規格出處(src 註解/JSDoc、套件官方說明、下游依賴之保證)

let require = createRequire(import.meta.url)
let katexVer = require('katex/package.json').version //已安裝之katex版本, 獨立於實作取得
let katexCss = `https://cdn.jsdelivr.net/npm/katex@${katexVer}/dist/katex.min.css`

let conv = async (md, opt = {}) => {
    let r = await md2html(md, { mergeStyle: false, ...opt })
    return r.html
}


describe('md2html 依賴契約(升版回歸)', function() {

    //規格: KaTeX 官方 README 之 CDN 用法, katex.min.css 須與 katex 同版; katex 0.18 起內部 class 加 katex- 前綴, 版本不符即跑版
    it('KaTeX CSS 版本與已安裝 katex 一致(mergeStyle:false 回傳之 styleSrcs)', async function() {
        let r = await md2html('$x$', { mergeStyle: false })
        let srcs = r.styleSrcs.filter((v) => v.includes('katex'))
        assert.strict.deepEqual(srcs, [katexCss])
        assert.strict.equal(fs.existsSync(require.resolve('katex/dist/katex.min.css')), true) //所引用之路徑存在於該版套件
    })

    //規格: 同上; mergeStyle:true 時 styleSrcs 改為內嵌 <link> 且回傳空陣列(md2html.mjs JSDoc)
    it('KaTeX CSS 版本與已安裝 katex 一致(mergeStyle:true 內嵌 link)', async function() {
        let r = await md2html('$x$', { mergeStyle: true })
        let links = (r.html.match(/<link[^>]*katex[^>]*>/g) || [])
        assert.strict.deepEqual(links, [`<link rel="stylesheet" href="${katexCss}">`])
        assert.strict.deepEqual(r.styleSrcs, [])
    })

    //規格: 擴充KaTeX(md2html.mjs), 行內公式 $...$ 以 KaTeX 呈現且非區塊
    it('KaTeX: 行內公式 $...$ 轉為 KaTeX 且非區塊', async function() {
        let out = await conv('行內 $E = mc^2$ 結束')
        assert.strict.equal(out.includes('class="katex"'), true)
        assert.strict.equal(out.includes('katex-display'), false)
        assert.strict.equal(out.includes('$E = mc^2$'), false) //無未轉換之原文殘留
    })

    //規格: 擴充KaTeX(md2html.mjs), 區塊公式 $$...$$ 以 displayMode 呈現
    it('KaTeX: 區塊公式 $$...$$ 轉為 katex-display', async function() {
        let out = await conv('$$\ny = ax^2\n$$')
        assert.strict.equal(out.includes('class="katex-display"'), true)
    })

    //規格: nonStandard:true「允許單行公式$...$可支援沒有空白格式」(md2html.mjs)
    it('KaTeX: nonStandard, 公式前後無空白仍轉換', async function() {
        let out = await conv('價格$x$元')
        assert.strict.equal(out.includes('class="katex"'), true)
        assert.strict.equal(out.includes('$x$'), false)
        assert.strict.equal(out.includes('價格'), true)
        assert.strict.equal(out.includes('元'), true)
    })

    //規格: throwOnError:false「不要遇錯就丟例外」(md2html.mjs); KaTeX 官方說明: 無效 LaTeX 以其原始碼呈現
    it('KaTeX: throwOnError:false, 錯誤 TeX 不拋例外並以原始碼呈現', async function() {
        let out = await conv('$\\frac{1$')
        assert.strict.equal(out.includes('\\frac{1'), true)
    })

    //規格: 擴充highlight(md2html.mjs), langPrefix 'hljs language-', 已知語言以 highlight.js 上色
    it('highlight: 已知語言之 class 為 hljs language-{lang} 且有語法 span', async function() {
        let out = await conv('```js\nconst a = 1\n```')
        assert.strict.equal(out.includes('<code class="hljs language-js">'), true)
        assert.strict.equal(/<span class="hljs-keyword">const<\/span>/.test(out), true)
    })

    //規格: 擴充highlight(md2html.mjs), 未知語言改用 'plaintext', 內容須跳脫
    it('highlight: 未知語言不拋例外, 以 plaintext 輸出並跳脫', async function() {
        let out = await conv('```xyz\nconst a = 1 < 2\n```')
        assert.strict.equal(out.includes('<code class="hljs language-xyz">'), true)
        assert.strict.equal(out.includes('<span class="hljs-'), false) //plaintext 無語法 span
        assert.strict.equal(out.includes('1 &lt; 2'), true)
    })

    //規格: 擴充highlight(md2html.mjs), emptyLangClass 'hljs'
    it('highlight: 未指定語言之 class 為 hljs', async function() {
        let out = await conv('```\nconst a = 1\n```')
        assert.strict.equal(out.includes('<code class="hljs">'), true)
    })

    //規格: styleDef 以 a[data-footnote-ref] 與 sup:has(a[data-footnote-ref]) 加上方括號與上標(md2html.mjs), 依賴 marked-footnote 之屬性名
    it('footnote: 註腳引用帶 data-footnote-ref, 註腳區為 section.footnotes', async function() {
        let out = await conv('本文[^1]\n\n[^1]: 註腳內容')
        assert.strict.equal(/<sup><a [^>]*data-footnote-ref[^>]*>1<\/a><\/sup>/.test(out), true)
        assert.strict.equal(out.includes('<section class="footnotes"'), true)
        assert.strict.equal(out.includes('註腳內容'), true)
    })

    //規格: JSDoc opt.imgWidthMax「可輸入數字500單位為px，或是字串例如'100%'」; renderer.image 保留 title(md2html.mjs), 依賴 marked renderer 之 token 物件介面
    it('marked renderer: image 之 imgWidthMax 數字轉 px、字串照用, 並保留 title', async function() {
        let outNum = await conv('![替代](x.png "標題")', { imgWidthMax: 500 })
        assert.strict.equal(/<img src="x\.png" alt="替代" title="標題" style="max-width:500px; height:auto;">/.test(outNum), true)
        let outStr = await conv('![替代](x.png)', { imgWidthMax: '100%' })
        assert.strict.equal(outStr.includes('max-width:100%'), true)
    })

    //規格: opt.funWalkTokens「可用async」, WMd2html 之圖片轉 base64 依賴此路徑(md2html.mjs), 依賴 marked async walkTokens
    it('marked walkTokens: funWalkTokens 可為 async 並改寫 token', async function() {
        let out = await conv('![替代](x.png)', {
            funWalkTokens: async (token) => {
                if (token.type === 'image') {
                    await new Promise((resolve) => setTimeout(resolve, 10))
                    token.href = 'y.png'
                }
            },
        })
        assert.strict.equal(out.includes('src="y.png"'), true)
        assert.strict.equal(out.includes('src="x.png"'), false)
    })

    //規格: 輸出經 DOMPurify sanitize(md2html.mjs); 下游 w-web-api 之 v-html 依此保證「會剝 onerror / javascript: / <script>」
    it('DOMPurify: 移除 on* 事件屬性', async function() {
        let out = await conv('<img src="x" onerror="alert(1)">')
        assert.strict.equal(/onerror/i.test(out), false)
        assert.strict.equal(out.includes('<img src="x">'), true) //元素本身保留
    })

    //規格: 同上
    it('DOMPurify: 移除 script 與 iframe', async function() {
        let out = await conv('<script>alert(1)</script>文字A\n\n<iframe src="https://example.com"></iframe>文字B')
        assert.strict.equal(/<script/i.test(out), false)
        assert.strict.equal(/<iframe/i.test(out), false)
        assert.strict.equal(out.includes('alert(1)'), false)
        assert.strict.equal(out.includes('文字A'), true)
        assert.strict.equal(out.includes('文字B'), true)
    })

    //規格: 同上
    it('DOMPurify: 移除 javascript: 連結(md 語法與 html 語法)', async function() {
        let out = await conv('[連結A](javascript:alert(1)) <a href="javascript:alert(2)">連結B</a>')
        assert.strict.equal(/javascript:/i.test(out), false)
        assert.strict.equal(out.includes('連結A'), true)
        assert.strict.equal(out.includes('連結B'), true)
    })

})


describe('WMd2html 依賴契約(升版回歸)', function() {

    let fdTmp = './test/_tmp/unit-md2html-deps'
    let fpIn = `${fdTmp}/deps.md`
    let fpOut = `${fdTmp}/deps.html`
    let h = ''

    before(async function() {
        fs.mkdirSync(fdTmp, { recursive: true })
        let md = [
            '# 依賴契約',
            '',
            '行內 $x^2$',
            '',
            '本文[^1]',
            '',
            '![圖](../../cocktail.svg)', //相對於本md所在資料夾, 指向 test/cocktail.svg
            '',
            '[^1]: 註腳內容',
            '',
        ].join('\n')
        fs.writeFileSync(fpIn, md, 'utf8')
        await WMd2html(fpIn, fpOut, {})
        h = fs.readFileSync(fpOut, 'utf8')
    })

    after(function() {
        fs.rmSync(fdTmp, { recursive: true, force: true })
    })

    //規格: 同 md2html; WMd2html 以 mergeStyle:true 內嵌 link
    it('KaTeX CSS 版本與已安裝 katex 一致', function() {
        let links = (h.match(/<link[^>]*katex[^>]*>/g) || [])
        assert.strict.deepEqual(links, [`<link rel="stylesheet" href="${katexCss}">`])
    })

    //規格: 「隱藏markedFootnote會自動添加的h2...於style設定強制隱藏, 避免轉docx時仍會出現」(WMd2html.mjs), 依賴 marked-footnote 之 h2 標記字串
    it('marked-footnote 之 Footnotes 標題被隱藏', function() {
        assert.strict.equal(/<h2 id="footnote-label" class="sr-only" style="[^"]*height:0px;[^"]*overflow:hidden;">Footnotes<\/h2>/.test(h), true)
        assert.strict.equal(h.includes('<h2 id="footnote-label" class="sr-only">'), false) //無未隱藏之標題殘留
    })

    //規格: opt.imgConvertToBase64 預設 true「圖片是否自動轉Base64」(WMd2html.mjs), 經 async walkTokens 轉換
    it('md 圖片經 async walkTokens 轉 base64', function() {
        assert.strict.equal(/<img src="data:image\/png;base64,[A-Za-z0-9+/=]+" alt="圖"/.test(h), true)
        assert.strict.equal(h.includes('cocktail.svg'), false)
        assert.strict.equal(fs.existsSync(path.resolve(fpOut)), true)
    })

})
