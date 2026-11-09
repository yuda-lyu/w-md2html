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

//同conv, 但轉換期間吞掉katex以console.warn輸出之strict警告(避免污染測試輸出; 警告之有無與文字依katex版本而異, 不屬契約, 不斷言), 結束後還原console.warn
let convQuiet = async (md, opt = {}) => {
    let warnOri = console.warn
    console.warn = () => {}
    try {
        return await conv(md, opt)
    }
    finally {
        console.warn = warnOri
    }
}

//取出KaTeX之顯示層(.katex-html)以後之html, 驗字元確實排進顯示層而非只存在於MathML內之原文
let katexHtmlPart = (out) => {
    return out.split('class="katex-html"')[1] || ''
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

    //規格: 同上, 且md2html.mjs未明設strict, 依KaTeX預設('warn'): math內含中文等非數學字元屬非LaTeX相容輸入, 僅console.warn,
    //  不丟錯且仍以公式呈現(中文排入顯示層); 若strict變為'error', throwOnError:false會使其變成.katex-error之紅字原文, 本案即轉紅
    it('KaTeX: 含中文字元之公式(行內math模式、區塊\\text)正常渲染, 不丟錯, 不轉為 .katex-error', async function() {
        let out = await convQuiet('面積 $面積 = x^2$ 之式\n\n$$\n\\text{單位：公尺} = x^2\n$$')
        assert.strict.equal(out.includes('class="katex"'), true) //以公式呈現
        assert.strict.equal(out.includes('class="katex-display"'), true) //區塊公式仍為顯示模式
        assert.strict.equal(out.includes('katex-error'), false) //不是出錯呈現
        assert.strict.equal(out.includes('$面積'), false) //無未轉換之原文殘留
        let html = katexHtmlPart(out)
        assert.strict.equal(html.includes('面積'), true) //中文排入顯示層
        assert.strict.equal(html.includes('單位：公尺'), true)
    })

    //規格: 同上; KaTeX 0.19.0 起缺字元度量改經strict回報(symbolNotInFont), 'error'時丟錯; 本案之符號(emoji、☃)不在KaTeX字型內,
    //  預設('warn')下仍須渲染, 不丟錯, 不轉為.katex-error, 符號保留於顯示層
    it('KaTeX: 含不在字型內之符號(emoji、☃)之公式正常渲染, 不丟錯, 不轉為 .katex-error', async function() {
        let out = await convQuiet('甲 $x = 😀$ 乙 $☃$ 丙')
        assert.strict.equal(out.split('class="katex"').length - 1, 2) //兩個公式皆以公式呈現
        assert.strict.equal(out.includes('katex-error'), false)
        let html = katexHtmlPart(out)
        assert.strict.equal(html.includes('😀'), true)
        assert.strict.equal(html.includes('☃'), true)
        assert.strict.equal(out.includes('甲'), true) //前後文不受影響
        assert.strict.equal(out.includes('丙'), true)
    })

    //規格: 同上, throwOnError:false「不要遇錯就丟例外」: 真正之TeX語法錯誤(ParseError)才以.katex-error呈現原始碼,
    //  與上列strict警告類輸入(中文、字型外符號)分界; 同文件內錯誤式不影響其餘公式
    it('KaTeX: 語法錯誤之公式以 .katex-error 呈現原始碼, 同文件之中文公式不受影響', async function() {
        let out = await convQuiet('$\\frac{1$ 與 $面積$')
        assert.strict.equal(out.split('class="katex-error"').length - 1, 1) //只有語法錯誤者為錯誤呈現
        assert.strict.equal(/<span class="katex-error" title="ParseError:[^"]*"[^>]*>\\frac\{1<\/span>/.test(out), true) //原始碼, 紅字
        assert.strict.equal(out.split('class="katex"').length - 1, 1) //中文公式正常
        assert.strict.equal(katexHtmlPart(out).includes('面積'), true)
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

    //規格: 輸出以 innerHTML(如 v-html)置入頁面後不得改變區塊以外之樣式; <style> 會作用於整頁, 故清洗時移除(元素與其內之 CSS 皆不留, 其餘文字保留)
    it('DOMPurify: 移除使用者內容中之 <style>, 其餘文字保留', async function() {
        let out = await conv('說明文字\n\n<style>body{background:rgb(255,0,0) !important} .other{display:none !important}</style>')
        assert.strict.equal(/<style/i.test(out), false)
        assert.strict.equal(out.includes('background'), false) //CSS 不外漏成可見文字
        assert.strict.equal(out.includes('說明文字'), true)
    })

    //規格: 同上; <style> 不論位於開頭、行內、表格儲存格、svg 內或含 @import, 皆移除
    it('DOMPurify: 開頭、行內、表格內、svg 內與含 @import 之 <style> 皆移除', async function() {
        let cases = [
            ['<style>body{background:red}</style>\n\n說明文字', '說明文字'],
            ['前文<style>p{color:red}</style>後文', '後文'],
            ['| 欄 |\n|---|\n| <style>body{background:red}</style>格 |', '格</td>'],
            ['<svg width="10" height="10"><style>body{background:red}</style><circle r="5"></circle></svg>', '<circle'],
            ['說明\n\n<style>@import url(https://example.com/x.css);</style>', '說明'],
        ]
        for (let [md, keep] of cases) {
            let out = await conv(md)
            assert.strict.equal(/<style/i.test(out), false, md)
            assert.strict.equal(/background|color:red|@import/.test(out), false, md)
            assert.strict.equal(out.includes(keep), true, md)
        }
    })

    //規格: 移除對象為 style 元素; 程式碼區塊與行內程式碼中之 <style> 字樣為內容, 照常顯示
    it('DOMPurify: 程式碼區塊與行內程式碼中之 <style> 字樣照常顯示', async function() {
        let outBlock = await conv('```\n<style>body{background:red}</style>\n```')
        assert.strict.equal(outBlock.includes('&lt;style&gt;body{background:red}&lt;/style&gt;'), true)
        let outInline = await conv('`<style>x{}</style>`')
        assert.strict.equal(outInline.includes('<code>&lt;style&gt;x{}&lt;/style&gt;</code>'), true)
    })

    //規格: mergeStyle:true 時套件自身之樣式(styleDef)於清洗之後才加入, 不受影響; 同一輸出只留套件之 <style>
    it('DOMPurify: mergeStyle:true 仍保留套件自身之 <style>, 使用者之 <style> 移除', async function() {
        let r = await md2html('說明文字\n\n<style>body{background:red}</style>', { mergeStyle: true })
        let styles = r.html.match(/<style>[\s\S]*?<\/style>/g) || []
        assert.strict.equal(styles.length, 1)
        assert.strict.equal(styles[0].includes('.md {'), true) //套件自身之樣式
        assert.strict.equal(r.html.includes('background:red'), false) //套件樣式為 background: #eee 等(冒號後有空白), 不會誤判
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
            '<style>body{background:rgb(255,0,0) !important}</style>', //使用者內容中之 style 元素, 應被移除
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

    //規格: 同 md2html 之 <style> 移除; WMd2html 以 mergeStyle:true 輸出, 只留套件自身之 <style>
    it('使用者內容中之 <style> 移除, 只留套件自身之 <style>', function() {
        let styles = h.match(/<style>[\s\S]*?<\/style>/g) || []
        assert.strict.equal(styles.length, 1)
        assert.strict.equal(styles[0].includes('.md {'), true)
        assert.strict.equal(h.includes('background:rgb(255,0,0)'), false)
    })

    //規格: opt.imgConvertToBase64 預設 true「圖片是否自動轉Base64」(WMd2html.mjs), 經 async walkTokens 轉換
    it('md 圖片經 async walkTokens 轉 base64', function() {
        assert.strict.equal(/<img src="data:image\/png;base64,[A-Za-z0-9+/=]+" alt="圖"/.test(h), true)
        assert.strict.equal(h.includes('cocktail.svg'), false)
        assert.strict.equal(fs.existsSync(path.resolve(fpOut)), true)
    })

})
