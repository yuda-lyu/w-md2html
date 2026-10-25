import assert from 'assert'
import fs from 'fs'
import WMd2html from '../src/WMd2html.mjs'


//圖表名取法與未解析引用警告(建議檔 建議w-md2html修正.md §1 與 §2 之三項驗證建議):
//圖題與<img>同一行(單行)與分多行(多行)的圖區塊/表區塊, 內文 {圖表名} 皆須取代為對應編號;
//取代後輸出之可見文字(排除程式碼, 行內程式碼, 數學式)中仍有對不上圖表名之 {…} 須輸出警告並列出該字串(不中斷轉換, 回傳值仍為'ok')
describe('unit-genNumRefs 圖表名取法與未解析引用警告', function() {

    let fdTmp = './test/_tmp/unit-genNumRefs'

    //單行: 圖題與<img>寫在同一行(建議檔 §1 範例)
    let figOne = (name) => `<div style="padding:2rem 0; text-align:center;"><img style="width:100%; max-width:700px;" src="pics/a.png" /><div style="padding-top:0.5rem;">圖n ${name}</div></div>`

    //多行: 圖片與圖題分行(建議檔 §1 範例)
    let figMul = (name) => [
        '<div style="padding:2rem 0; text-align:center;">',
        '    <img style="width:100%; max-width:700px;" src="pics/a.png" />',
        `    <div style="padding-top:0.5rem;">圖n ${name}</div>`,
        '</div>',
    ].join('\n')

    //表區塊, 表題與<img>(此處以圖示代表表內附圖)同一行
    let tabOne = (name) => `<div style="padding:1rem 0;"><div style="padding-bottom:0.5rem;">表n ${name}</div><img style="max-width:300px;" src="pics/a.png" /></div>`

    //表區塊, 分多行
    let tabMul = (name) => [
        '<div style="padding:1rem 0;">',
        `    <div style="padding-bottom:0.5rem;">表n ${name}</div>`,
        '    <img style="max-width:300px;" src="pics/a.png" />',
        '</div>',
    ].join('\n')

    //轉換並擷取console.log輸出(警告走console.log, 同套件既有非致命訊息之慣例)
    let conv = async (name, md, opt = {}) => {
        let fpIn = `${fdTmp}/${name}.md`
        let fpOut = `${fdTmp}/${name}.html`
        fs.writeFileSync(fpIn, md, 'utf8')
        let logs = []
        let logOri = console.log
        console.log = (...args) => {
            logs.push(args.map(String).join(' '))
        }
        let ret = null
        try {
            ret = await WMd2html(fpIn, fpOut, opt)
        }
        finally {
            console.log = logOri
        }
        let h = fs.readFileSync(fpOut, 'utf8')
        let ws = logs.filter((v) => v.startsWith('warning:'))
        return { ret, h, logs, ws }
    }

    //警告所列之字串(依輸出內首次出現順序); 無警告回傳[]
    let refsOf = (ws) => {
        assert.strict.ok(ws.length <= 1, `最多輸出一則警告: ${ws.length}`)
        if (ws.length === 0) {
            return []
        }
        let w = ws[0]
        let ms = w.slice(w.indexOf('name: ') + 'name: '.length).match(/\{[^{}]*\}/g)
        assert.strict.equal(Number(w.match(/^warning: (\d+) reference/)[1]), ms.length, `警告中的數量等於所列字串數: ${w}`)
        return ms
    }

    //內文第一段(供斷言訊息帶出實際值)
    let pOf = (h) => String((h.match(/<p>[^]*?<\/p>/) || [''])[0])

    before(function() {
        fs.mkdirSync(`${fdTmp}/pics`, { recursive: true })
        //1x1 png
        fs.writeFileSync(`${fdTmp}/pics/a.png`, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'))
    })

    after(function() {
        fs.rmSync(fdTmp, { recursive: true, force: true })
    })

    it('圖區塊單行與多行並存: 內文兩個引用皆取代為對應圖號(建議檔§2-1)', async function() {
        let md = [
            '單行之架構如{單行圖}所示，多行之架構如{多行圖}所示。',
            '',
            figOne('單行圖'),
            '',
            figMul('多行圖'),
            '',
        ].join('\n')
        let { ret, h, ws } = await conv('fig', md)
        assert.strict.equal(ret, 'ok')
        assert.strict.ok(h.includes('單行之架構如圖1所示'), '{單行圖}->圖1')
        assert.strict.ok(h.includes('多行之架構如圖2所示'), '{多行圖}->圖2')
        assert.strict.ok(h.includes('圖1 單行圖'), '單行圖題編為圖1')
        assert.strict.ok(h.includes('圖2 多行圖'), '多行圖題編為圖2')
        assert.strict.ok(!h.includes('{單行圖}') && !h.includes('{多行圖}'), '無未取代引用')
        assert.strict.deepEqual(refsOf(ws), [], '引用皆解析時不警告')
    })

    it('表區塊單行與多行並存(多行在前): 內文兩個引用皆取代為對應表號(建議檔§2-2)', async function() {
        let md = [
            '多行表如{多行表}所示，單行表如{單行表}所示。',
            '',
            tabMul('多行表'),
            '',
            tabOne('單行表'),
            '',
        ].join('\n')
        let { ret, h, ws } = await conv('tab', md)
        assert.strict.equal(ret, 'ok')
        assert.strict.ok(h.includes('多行表如表1所示'), '{多行表}->表1')
        assert.strict.ok(h.includes('單行表如表2所示'), '{單行表}->表2')
        assert.strict.ok(h.includes('表1 多行表'), '多行表題編為表1')
        assert.strict.ok(h.includes('表2 單行表'), '單行表題編為表2')
        assert.strict.ok(!h.includes('{多行表}') && !h.includes('{單行表}'), '無未取代引用')
        assert.strict.deepEqual(refsOf(ws), [], '引用皆解析時不警告')
    })

    it('單行圖題之圖片帶alt、屬性值含 > 、屬性不帶引號、包在連結內: 圖名皆不受圖片影響, 與多行寫法一致', async function() {
        let md = [
            '如{帶alt圖}、{屬性含大於圖}、{不帶引號圖}、{連結圖}、{連結包span圖}、{連結含註解圖}所示。',
            '',
            '<div><img alt="示意圖 A" src="pics/a.png" /><div>圖n 帶alt圖</div></div>',
            '',
            '<div><div>圖n 屬性含大於圖</div><img alt="a > b" title=\'c > d\' src="pics/a.png"></div>',
            '',
            '<div><IMG SRC=pics/a.png ALT=x><div>圖n 不帶引號圖</div></div>',
            '',
            //可點擊之圖片: 移除 img 後留下之空連結 html2str 會輸出其 href, 須一併移除
            '<div><a href="pics/a.png"><img src="pics/a.png" /></a><div>圖n 連結圖</div></div>',
            '',
            '<div><a href="pics/a.png"><span><img src="pics/a.png" /></span></a><div>圖n 連結包span圖</div></div>',
            '',
            '<div><a href="pics/a.png"><!--圖片--><img src="pics/a.png" /></a><div>圖n 連結含註解圖</div></div>',
            '',
        ].join('\n')
        let { h, ws } = await conv('figimg', md)
        assert.strict.ok(h.includes('如圖1、圖2、圖3、圖4、圖5、圖6所示'), `六個引用依序取代為圖1~圖6: ${pOf(h)}`)
        assert.strict.deepEqual(refsOf(ws), [], '引用皆解析時不警告')
    })

    it('無圖片之圖題與無src(含src為空)之img維持修前取名: 圖題內svg文字、同一文字行內「圖n」之前的字、alt為圖題文字者', async function() {
        let md = [
            '如{svg內文字圖}、{補充： 前綴圖}、{丙}、{丁}、{戊\n 己}、{庚 src=y}、{辛}、{壬}、{癸}、{pics/a.png 子}、{寅}、{卯}、{pics/b.png 丑}所示。',
            '',
            '<div><img src="pics/a.png" /><div>圖n <svg><text>svg內文字圖</text></svg></div></div>',
            '',
            '<div>補充：圖n 前綴圖</div>',
            '',
            '<div><img alt="圖n 丙" srcset="pics/a.png 1x"></div>',
            '',
            '<div><img alt="圖n 丁" src=\'\'></div>',
            '',
            //圖名含區塊邊界之換行(修前即如此登記), 不得被截斷
            '<div>戊</div><div>圖n 己</div>',
            '',
            //alt 值內出現「 src=」字樣不是 src 屬性
            '<div><img alt="圖n 庚 src=y"></div>',
            '',
            //重複屬性以第一個為準(src 為空 → 視為無 src, alt 屬圖題文字)
            '<div><img alt="圖n 辛" src=\'\' src=\'pics/a.png\'></div>',
            '',
            //屬性之間若是 U+00A0(不是 html 空白), 其後的「src=x」是屬性名稱的一部分, 不是 src 屬性
            '<div><img alt="圖n 壬"' + String.fromCharCode(0xA0) + 'src=x></div>',
            '',
            //其他標籤之屬性值內出現「<img」字樣不是圖片標籤
            '<span title="<img src=x">圖n 癸</span><i title=">"></i>',
            '',
            //沒有移除任何 img 之行, 空連結不移除(html2str 輸出其 href, 同修前)
            '<div><a href="pics/a.png"></a>圖n 子</div>',
            '',
            //註解內的「<img」字樣不是圖片標籤
            '<div><!-- <img src=x -->圖n 寅</div>',
            '',
            //無引號屬性值含等號(data-x 的值為「a=src=x」), 不存在 src 屬性
            '<div><img alt="圖n 卯" data-x=a=src=x></div>',
            '',
            //有移除 img 之行, 與圖片無關且本來就沒有文字之連結不移除(html2str 輸出其 href, 同無 img 之寫法)
            '<div><img src="pics/a.png" /><span>圖n <a href="pics/b.png"></a> 丑</span></div>',
            '',
        ].join('\n')
        let { h, ws } = await conv('figold', md)
        assert.strict.ok(h.includes('如圖1、圖2、圖3、圖4、圖5、圖6、圖7、圖8、圖9、圖10、圖11、圖12、圖13所示'), `十三個引用依序取代為圖1~圖13: ${pOf(h)}`)
        assert.strict.deepEqual(refsOf(ws), [], '引用皆解析時不警告')
    })

    it('「圖n」只存在於有src之img之alt: 非圖題, 不登記(不得以空名稱或他字覆寫真正的圖題, 內文之 {} 不被取代成圖號), 仍佔用編號(同修前)', async function() {
        let md = [
            '見{甲}、{乙}。內文保留 {} 與 { } 原樣。',
            '',
            figMul('甲'),
            '',
            '<img alt="圖n" src="pics/a.png" /><span>甲</span>',
            '',
            '<div><img alt="圖n" src="pics/a.png" /></div>',
            '',
            //「圖n」移到其他標籤的屬性內(移除圖片後純文字已不含圖n), 同樣不是圖題
            '<div data-note="圖n"><img src="pics/a.png" />甲</div>',
            '',
            figOne('乙'),
            '',
        ].join('\n')
        let { ret, h, ws } = await conv('altonly', md)
        assert.strict.equal(ret, 'ok')
        assert.strict.ok(h.includes('見圖1、圖5。'), `{甲} 仍對應真正的圖題(圖1), 三個非圖題行仍佔用編號故其後的 {乙} 為圖5: ${pOf(h)}`)
        assert.strict.ok(h.includes('內文保留 {} 與 { } 原樣。'), `{} 原樣保留: ${pOf(h)}`)
        assert.strict.ok(h.includes('圖5 乙'), '其後之圖題編為圖5')
        assert.strict.deepEqual(refsOf(ws), [], '引用皆解析時不警告')
    })

    it('引用不存在之圖名: 轉換完成(回傳ok、仍輸出html)並警告, 只列出對不上之字串(重複引用只列一次, 已解析者不列)(建議檔§2-3)', async function() {
        let md = [
            '正常引用{單行圖}，不存在之引用{不存在之圖}，再引用一次{不存在之圖}，表亦然{不存在之表}。',
            '',
            figOne('單行圖'),
            '',
        ].join('\n')
        let { ret, h, ws } = await conv('miss', md)
        assert.strict.equal(ret, 'ok', '回傳型態不變')
        assert.strict.ok(h.includes('正常引用圖1'), '存在之引用仍取代')
        assert.strict.ok(h.includes('{不存在之圖}'), '不存在之引用原樣保留')
        assert.strict.equal(ws.length, 1, '只輸出一則警告')
        assert.strict.deepEqual(refsOf(ws), ['{不存在之圖}', '{不存在之表}'], '警告列出字串(去重, 不含已解析者)')
    })

    it('程式碼區塊/縮排式程式碼/行內程式碼/數學式內之大括號不誤報, 其旁之正文未解析引用被列出(段落/表格儲存格/清單)', async function() {
        let md = [
            '行內程式碼 `{行內碼}` 與 `{{雙層}}` 不報。行內數學 $x^{2}+y_{1}$ 不報。',
            '',
            '```js',
            'let o = {圍欄碼}',
            '```',
            '',
            '~~~',
            '{波浪圍欄}',
            '~~~',
            '',
            '    {縮排碼}',
            '',
            '$$',
            '\\frac{a}{b}',
            '$$',
            '',
            '| 欄 | 值 |',
            '|----|----|',
            '| 表格 | {表格內未解析} |',
            '',
            '- 清單 {清單內未解析}',
            '',
            '真的未解析 {真未解析}。',
            '',
        ].join('\n')
        let { ret, ws } = await conv('excl', md)
        assert.strict.equal(ret, 'ok')
        assert.strict.deepEqual(refsOf(ws), ['{表格內未解析}', '{清單內未解析}', '{真未解析}'])
    })

    it('標題與引用區塊內之正文大括號照常檢查; 引用區塊與清單內之程式碼區塊、使用者之 style/script 不誤報', async function() {
        let md = [
            '## 標題 {標題內未解析}',
            '',
            '> 引用 {引用內未解析}',
            '>',
            '> ```',
            '> {引用內碼}',
            '> ```',
            '',
            '- 清單項',
            '',
            '  ```',
            '  {清單內碼}',
            '  ```',
            '',
            '<style>.a { color: red; }</style>',
            '',
            '<script>function f() { return 1 }</script>',
            '',
        ].join('\n')
        let { ret, ws } = await conv('struct', md)
        assert.strict.equal(ret, 'ok')
        assert.strict.deepEqual(refsOf(ws), ['{標題內未解析}', '{引用內未解析}'])
    })

    it('html 程式碼(pre/code)與未閉合 pre(含外層容器)不誤報; 被Markdown修飾字元包住之引用列其可見文字; 行內碼提到 <pre> 不影響其後正文', async function() {
        let md = [
            '<pre><code>{html範例}</code></pre>',
            '',
            '文字 <code>{html行內碼}</code>。',
            '',
            '如{**缺圖**}所示。',
            '',
            '行內程式碼提到 `<pre>` 標籤, 其後之 {提及標籤後缺圖} 照樣列出。',
            '',
            '<div>',
            '<pre>{未閉合範例}',
            '',
        ].join('\n')
        let { ret, ws } = await conv('htmlmix', md)
        assert.strict.equal(ret, 'ok')
        assert.strict.deepEqual(refsOf(ws), ['{缺圖}', '{提及標籤後缺圖}'])
    })

    it('以輸出之可見文字為準: 逸出之大括號仍列出(輸出中是可見文字); 連結 title、圖片 alt 為屬性不是可見文字不列出', async function() {
        let md = [
            '逸出 \\{逸出字面\\} 輸出為可見文字。',
            '',
            '[說明](#x "見{連結title}") 與 ![替代 {圖片alt}](pics/a.png)。',
            '',
        ].join('\n')
        let { ret, ws } = await conv('visible', md)
        assert.strict.equal(ret, 'ok')
        assert.strict.deepEqual(refsOf(ws), ['{逸出字面}'])
    })

    it('同一段落內之軟換行是空白(列出折疊後之可見文字); 巢狀大括號列最內層; 跨段落、跨區塊、跨br、跨程式碼之大括號不拼出原文不存在之字串', async function() {
        let md = [
            '軟換行 {跨行',
            '引用} 輸出為一個空白。',
            '',
            '巢狀 {{內層}} 報最內層。',
            '',
            '跨段落 {前段',
            '',
            '後段} 不報。',
            '',
            //使用者 html 之區塊間無換行字元, 仍須視為不同行
            '<div>跨區塊 {前段</div><div>後段} 不報。</div>',
            '',
            '<article>{甲段</article><article>乙段}</article>',
            '',
            '<div><search>{丙段</search><search>丁段}</search></div>',
            '',
            '<p>跨br {前段<br>後段} 不報。</p>',
            '',
            '<p>字元參照 {戊&#10;己} 為軟換行。</p>',
            '',
            '<p>空白 {庚 辛}／{庚 <span></span> 辛} 折疊後相同只列一次。</p>',
            '',
            '跨行內碼 {甲`x',
            'y`乙} 不報。',
            '',
            '夾兩個行內碼 `{`甲`}` 不報。',
            '',
        ].join('\n')
        let { ret, ws } = await conv('braces', md)
        assert.strict.equal(ret, 'ok')
        assert.strict.deepEqual(refsOf(ws), ['{跨行 引用}', '{內層}', '{戊 己}', '{庚 辛}'])
    })

    it('同字串同時在程式碼與正文: 程式碼內者不影響正文內者之警告; 只在程式碼內者不警告', async function() {
        let md = [
            '`{缺圖}`',
            '',
            '正文 {缺圖}。',
            '',
            '~~~',
            '`x` {僅程式碼內}',
            '~~~',
            '',
            '`x`',
            '',
            '| 範例 |',
            '| --- |',
            '| `{a\\|b}` |',
            '',
        ].join('\n')
        let { ret, ws } = await conv('samext', md)
        assert.strict.equal(ret, 'ok')
        assert.strict.deepEqual(refsOf(ws), ['{缺圖}'])
    })

    it('數學式(強調字元、單$跨行、$$)與註腳內行內碼不誤報; 註腳正文內之引用照樣列出; CRLF 檔之圍欄碼與行內碼不誤報', async function() {
        let md = [
            '強調內含數學 $*x*^{2}$ 不報; 無法解析之數學式 $x_{1}_{2}$ 與顯示層含字面大括號之 $\\{x\\}$ 亦不報。',
            '',
            '$',
            'y^{3}',
            '$',
            '',
            '$$',
            'z^{4}',
            '$$',
            '',
            '註腳[^a]。',
            '',
            '[^a]: `{註腳碼}` 與 {註腳正文}',
            '',
            '```js',
            'let o = {CRLF圍欄碼}',
            '```',
            '',
            '行內 `{甲\r乙}` 與 `{CRLF行內碼}` 不報。',
            '',
        ].join('\r\n')
        let { ret, ws } = await conv('mathfoot', md)
        assert.strict.equal(ret, 'ok')
        assert.strict.deepEqual(refsOf(ws), ['{註腳正文}'])
    })

    it('使用者之 MathML 視為數學式不警告; 套件自身樣式含選項值(fontFamilies)之單行大括號不警告', async function() {
        let md = [
            '<math><mtext>{a}</mtext></math>',
            '',
        ].join('\n')
        let { ret, h, ws } = await conv('mathml', md, { fontFamilies: ['{字型}'] })
        assert.strict.equal(ret, 'ok')
        assert.strict.ok(h.includes('\'{字型}\''), '選項值確實進入輸出之樣式(使本案例能檢驗 style 之排除)')
        assert.strict.deepEqual(refsOf(ws), [])
    })

    it('自訂模板(htmlTemp)中的 script 不是可見文字, 不警告', async function() {
        let { ret, h, ws } = await conv('tplscript', '本文', { htmlTemp: '<!DOCTYPE html><html><body>{html}<script type="application/json">{"a":1}</script></body></html>' })
        assert.strict.equal(ret, 'ok')
        assert.strict.ok(h.includes('{"a":1}'), '模板中的 script 確實在輸出內(使本案例能檢驗 script 之排除)')
        assert.strict.deepEqual(refsOf(ws), [])
    })

    it('以取代模板符號後之最終輸出為準: 內文之 {title} 被換成檔名故不警告; 取代後仍殘留(被格式包住、取代後才形成)者照樣列出', async function() {
        let md = [
            '標題符號 {title} 不報。',
            '',
            '{**title**}',
            '',
            '{甲{title}乙}',
            '',
        ].join('\n')
        let { ret, h, ws } = await conv('tpl', md)
        assert.strict.equal(ret, 'ok')
        assert.strict.ok(h.includes('標題符號 tpl 不報。'), `{title} 被取代為檔名: ${pOf(h)}`)
        assert.strict.deepEqual(refsOf(ws), ['{title}', '{甲tpl乙}'])
    })

    it('只有程式碼與數學式含大括號時不警告', async function() {
        let md = [
            '行內 `{a}` 與 $x^{2}$。',
            '',
            '```',
            '{b}',
            '```',
            '',
        ].join('\n')
        let { ret, ws } = await conv('clean', md)
        assert.strict.equal(ret, 'ok')
        assert.strict.deepEqual(refsOf(ws), [])
    })

})
