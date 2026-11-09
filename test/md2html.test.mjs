import assert from 'assert'
import md2html from '../src/md2html.mjs'


//conv, md轉html字串(mergeStyle:false, 不含套件樣式)
let conv = async (md, opt = {}) => {
    let r = await md2html(md, { mergeStyle: false, ...opt })
    return r.html
}


//md2html之DOM後處理(原htmlConvert併入): display:none移除 / for=br / for=tab / linkBlank / tableHorizontalAlignmentCenter
describe('md2html DOM後處理', function() {

    let zwsp = String.fromCharCode(0x200B) //零寬空格 U+200B

    it('data-for=br: 空 div 插入單一 U+200B 佔位', async function() {
        let out = await conv('<div data-for="br"></div>')
        let m = out.match(/<div data-for="br">([\s\S]*?)<\/div>/)
        assert.strict.equal(m[1], zwsp)
    })

    it('data-for=br: 有內容的 div 不被覆蓋', async function() {
        let out = await conv('<div data-for="br">x</div>')
        assert.strict.equal(out.includes(zwsp), false)
    })

    it('data-for=tab: data-style-th/data-style-td 套用至往下第一張 table 之 th/td 且移除標記', async function() {
        let md = [
            '<div data-for="tab" data-style-th="font-size:16pt;" data-style-td="font-size:13pt;"></div>',
            '',
            '| 項目 | 值 |',
            '|---|---|',
            '| a | 1 |',
        ].join('\n')
        let out = await conv(md)
        assert.strict.equal(out.includes('data-for="tab"'), false) //標記已移除
        assert.strict.equal(/<th style="font-size:16pt;">項目<\/th>/.test(out), true)
        assert.strict.equal(/<td style="font-size:13pt;">a<\/td>/.test(out), true)
    })

    it('data-for=tab: 僅設 data-style-td 時 th 不受影響', async function() {
        let md = [
            '<div data-for="tab" data-style-td="font-size:8pt;"></div>',
            '',
            '| 代號 | 數量 |',
            '|---|---|',
            '| A | 1 |',
        ].join('\n')
        let out = await conv(md)
        assert.strict.equal(/<th>代號<\/th>/.test(out), true) //th 維持無 style
        assert.strict.equal(/<td style="font-size:8pt;">A<\/td>/.test(out), true)
    })

    it('data-for=tab: 與置中外包並存時仍正確套用 th/td', async function() {
        let md = [
            '<div data-for="tab" data-style-th="font-size:16pt;"></div>',
            '',
            '| 項目 | 值 |',
            '|---|---|',
            '| a | 1 |',
        ].join('\n')
        let out = await conv(md, { tableHorizontalAlignmentCenter: true })
        assert.strict.equal(out.includes('data-for="tab"'), false)
        assert.strict.equal(/<th style="font-size:16pt;">項目<\/th>/.test(out), true)
        assert.strict.equal(/text-align:\s*center/.test(out), true) //外包置中仍生效
    })

    it('data-style-td-{n}: 逐欄語意為「第n欄各列」, 未指定欄不受影響', async function() {
        let md = [
            '<div data-for="tab" data-style-td-0="white-space:nowrap;"></div>',
            '',
            '| 代號 | 狀態 |',
            '|---|---|',
            '| A-001 | 完成 |',
            '| B-002 | 進行中 |',
        ].join('\n')
        let out = await conv(md)
        //第0欄之兩列皆套用(逐欄非逐cell)
        assert.strict.equal(/<td style="white-space:nowrap;">A-001<\/td>/.test(out), true)
        assert.strict.equal(/<td style="white-space:nowrap;">B-002<\/td>/.test(out), true)
        //第1欄不受影響
        assert.strict.equal(/<td>完成<\/td>/.test(out), true)
        assert.strict.equal(/<td>進行中<\/td>/.test(out), true)
    })

    it('data-style-th-{n}: 僅套用至指定欄之 th', async function() {
        let md = [
            '<div data-for="tab" data-style-th-1="text-align:center;"></div>',
            '',
            '| 代號 | 狀態 | 備註 |',
            '|---|---|---|',
            '| A | 完成 | x |',
        ].join('\n')
        let out = await conv(md)
        assert.strict.equal(/<th>代號<\/th>/.test(out), true) //第0欄未指定
        assert.strict.equal(/<th style="text-align:center;">狀態<\/th>/.test(out), true) //第1欄
        assert.strict.equal(/<th>備註<\/th>/.test(out), true) //第2欄未指定
    })

    it('逐欄與全域併用: 全域先套, 逐欄後套(可覆寫)', async function() {
        let md = [
            '<div data-for="tab" data-style-td="font-size:10pt;" data-style-td-0="white-space:nowrap;" data-style-td-1="font-size:8pt;"></div>',
            '',
            '| 代號 | 狀態 |',
            '|---|---|',
            '| A | 完成 |',
        ].join('\n')
        let out = await conv(md)
        //第0欄: 全域字級 + 逐欄不換行
        assert.strict.equal(/<td style="font-size:10pt;white-space:nowrap;">A<\/td>/.test(out), true)
        //第1欄: 全域字級後接逐欄字級, 後宣告優先故實際為8pt
        assert.strict.equal(/<td style="font-size:10pt;font-size:8pt;">完成<\/td>/.test(out), true)
    })

    it('data-style-td-{n}: 索引超出欄數時不報錯且無副作用', async function() {
        let md = [
            '<div data-for="tab" data-style-td-9="color:red;"></div>',
            '',
            '| 代號 | 狀態 |',
            '|---|---|',
            '| A | 完成 |',
        ].join('\n')
        let out = await conv(md)
        assert.strict.equal(out.includes('color:red'), false)
        assert.strict.equal(/<td>A<\/td>/.test(out), true)
    })

    it('display:none 元素被移除', async function() {
        let md = '<div>顯示A</div>\n\n<div style="display:none;">隱藏B</div>'
        let out = await conv(md)
        assert.strict.equal(out.includes('顯示A'), true)
        assert.strict.equal(out.includes('隱藏B'), false)
    })

    it('linkBlank: 外部連結加 target=_blank, 同頁錨點(#開頭)不加', async function() {
        let md = '<a href="https://x.com">外</a><a href="#fn1">錨</a>'
        let out = await conv(md, { linkBlank: true })
        assert.strict.equal(/<a href="https:\/\/x\.com"[^>]*target="_blank"[^>]*>外<\/a>/.test(out), true)
        assert.strict.equal(/<a href="#fn1">錨<\/a>/.test(out), true) //同頁錨點不加target
    })

    it('linkBlank 預設關閉時不加 target', async function() {
        let out = await conv('<a href="https://x.com">外</a>')
        assert.strict.equal(out.includes('target="_blank"'), false)
    })

    it('tableHorizontalAlignmentCenter: table 外包 text-align:center 之 div 且設 inline-table', async function() {
        let md = [
            '| 項目 | 值 |',
            '|---|---|',
            '| a | 1 |',
        ].join('\n')
        let out = await conv(md, { tableHorizontalAlignmentCenter: true })
        assert.strict.equal(/text-align:\s*center/.test(out), true)
        assert.strict.equal(/display:\s*inline-table/.test(out), true)
    })

})


//表格標記之行內 code 字級: 對應規則帳本 R-CODEFONT-01(styleDef)、R-TABLE-01(3)(4)(code 繼承儲存格、data-style-code)
describe('md2html 表格標記: 行內 code 字級', function() {

    it('styleDef: 行內 code 明訂為所在元素(清單、表格、段落、h1~h6)之字級 [R-CODEFONT-01]', async function() {
        let r = await md2html('x', { mergeStyle: false, fontSizeDef: '11pt', fontSizeTab: '9pt', fontSizeP: '13pt', fontSizeH1: '21pt', fontSizeH2: '15pt', fontSizeH3: '14pt', fontSizeH4: '12.5pt', fontSizeH5: '11.5pt', fontSizeH6: '10.5pt' })
        let sd = r.styleDef.replace(/\s+/g, ' ')
        assert.strict.equal(sd.includes('.md li code { font-size: 11pt; }'), true) //清單項目內之code同fontSizeDef
        assert.strict.equal(sd.includes('.md table code { font-size: 9pt; }'), true) //表格內之code同fontSizeTab
        assert.strict.equal(sd.includes('.md p code { font-size: 13pt; }'), true) //段落內之code同fontSizeP
        assert.strict.equal(sd.includes('.md h1 code { font-size: 21pt; }'), true)
        assert.strict.equal(sd.includes('.md h2 code { font-size: 15pt; }'), true)
        assert.strict.equal(sd.includes('.md h3 code { font-size: 14pt; }'), true)
        assert.strict.equal(sd.includes('.md h4 code { font-size: 12.5pt; }'), true)
        assert.strict.equal(sd.includes('.md h5 code { font-size: 11.5pt; }'), true)
        assert.strict.equal(sd.includes('.md h6 code { font-size: 10.5pt; }'), true)
    })

    it('styleDef: 後宣告優先, 儲存格與清單項目內之p內code隨p, 區塊程式碼(pre code)於li與table內維持fontSizeCode [R-CODEFONT-01]', async function() {
        let r = await md2html('x', { mergeStyle: false, fontSizeCode: '8pt' })
        let sd = r.styleDef.replace(/\s+/g, ' ')
        assert.strict.equal(sd.includes('.md li pre code { font-size: 8pt; }'), true)
        assert.strict.equal(sd.includes('.md table pre code { font-size: 8pt; }'), true)
        //li、table規則須先於p規則(同特異度, 後宣告優先): td/li內之p之文字為fontSizeP, 其內code須同
        assert.strict.equal(sd.indexOf('.md p code') > sd.indexOf('.md li code'), true)
        assert.strict.equal(sd.indexOf('.md p code') > sd.indexOf('.md table code'), true)
        //pre規則須後於li、table規則, 才能蓋過之
        assert.strict.equal(sd.indexOf('.md li pre code') > sd.indexOf('.md li code'), true)
        assert.strict.equal(sd.indexOf('.md table pre code') > sd.indexOf('.md table code'), true)
    })

    it('styleDef: mergeStyle 為 true 時行內 code 規則隨 <style> 內嵌於 html [R-CODEFONT-01]', async function() {
        let r = await md2html('x', { mergeStyle: true })
        assert.strict.equal(r.html.includes('.md table code {'), true)
        assert.strict.equal(r.styleDef, '')
    })

    it('data-for=tab: 行內 code 繼承所在 th/td 最終 style 之字級與行高(同名取最後者) [R-TABLE-01(3)]', async function() {
        let md = [
            '<div data-for="tab" data-style-th="font-size:9pt;" data-style-td="font-size:10pt; mso-line-height-rule:exactly; line-height:11pt;" data-style-td-1="font-size:9pt;"></div>',
            '',
            '| 代號 `h_a` | 模組 |',
            '|---|---|',
            '| `a_b` | 之 `c_d` |',
        ].join('\n')
        let out = await conv(md)
        assert.strict.equal(out.includes('<code style="font-size:9pt;">h_a</code>'), true) //th內之code取th之字級
        assert.strict.equal(out.includes('<code style="font-size:10pt;mso-line-height-rule:exactly;line-height:11pt;">a_b</code>'), true) //第0欄: 取全域之字級與行高
        assert.strict.equal(out.includes('<code style="font-size:9pt;mso-line-height-rule:exactly;line-height:11pt;">c_d</code>'), true) //第1欄: 逐欄後宣告之9pt優先
    })

    it('data-style-code: 附加於表內全部 code, 位於繼承值之後; 儲存格無字級時只附加此值 [R-TABLE-01(4)]', async function() {
        let md = [
            '<div data-for="tab" data-style-code="background:#eeeeee; color:#b03060"></div>',
            '',
            '| 代號 `h_a` |',
            '|---|',
            '| `a_b` |',
            '',
            '<div data-for="tab" data-style-td="font-size:9pt;" data-style-code="background:#eeeeee;"></div>',
            '',
            '| 代號 |',
            '|---|',
            '| `c_d` |',
        ].join('\n')
        let out = await conv(md)
        assert.strict.equal(out.includes('<code style="background:#eeeeee; color:#b03060;">a_b</code>'), true) //無字級: 只附加(缺;者補之)
        assert.strict.equal(out.includes('<code style="background:#eeeeee; color:#b03060;">h_a</code>'), true) //表頭內之code亦附加
        assert.strict.equal(out.includes('<code style="font-size:9pt;background:#eeeeee;">c_d</code>'), true) //繼承值在前, data-style-code 在後
    })

    it('行內 code 自帶之 style 排在繼承值之後(自帶者優先) [R-TABLE-01(3)]', async function() {
        let md = [
            '<div data-for="tab" data-style-td="font-size:9pt;"></div>',
            '',
            '| 代號 |',
            '|---|',
            '| <code style="font-size:7pt;">z</code> |',
        ].join('\n')
        let out = await conv(md)
        assert.strict.equal(out.includes('<code style="font-size:9pt;font-size:7pt;">z</code>'), true)
    })

    it('未使用字級與 data-style-code 時, 表內 code 不加 style(輸出不變) [R-TABLE-01(3)(4)]', async function() {
        let md = [
            '| 代號 |',
            '|---|',
            '| `a_b` |',
            '',
            '<div data-for="tab" data-style-td="color:red;" data-style-td-0="text-align:right;"></div>',
            '',
            '| 代號 |',
            '|---|',
            '| `c_d` |',
        ].join('\n')
        let out = await conv(md)
        assert.strict.equal(out.includes('<code>a_b</code>'), true) //無標記之表
        assert.strict.equal(out.includes('<code>c_d</code>'), true) //標記無字級行高之表
        assert.strict.equal(out.includes('<code style'), false)
    })

    it('表外之 code 不受 data-for=tab 影響 [R-TABLE-01(3)]', async function() {
        let md = [
            '<div data-for="tab" data-style-td="font-size:9pt;" data-style-code="color:red;"></div>',
            '',
            '| 代號 |',
            '|---|',
            '| a |',
            '',
            '表外段落含 `p_c` 程式碼',
        ].join('\n')
        let out = await conv(md)
        assert.strict.equal(out.includes('<code>p_c</code>'), true)
    })

})


//逐欄樣式之定位: 對應規則帳本 R-TABLE-01(1)(2)
describe('md2html 表格標記: 逐欄樣式依邏輯欄', function() {

    it('data-style-td-{n}: 已有 rowspan 之表依邏輯欄定位, 不因下方列少一格而錯欄 [R-TABLE-01(1)]', async function() {
        let md = [
            '<div data-for="tab" data-style-td-2="text-align:right;"></div>',
            '',
            '<table><thead><tr><th>甲</th><th>乙</th><th>丙</th></tr></thead>',
            '<tbody><tr><td rowspan="2">合</td><td>b1</td><td>c1</td></tr>',
            '<tr><td>b2</td><td>c2</td></tr></tbody></table>',
        ].join('\n')
        let out = await conv(md)
        assert.strict.equal(out.includes('<td style="text-align:right;">c1</td>'), true)
        assert.strict.equal(out.includes('<td style="text-align:right;">c2</td>'), true) //過去以「該列第2個td」定位, 第2列無第2個td而漏套
        assert.strict.equal(out.includes('<td>b2</td>'), true) //第1欄不受影響
        assert.strict.equal(out.includes('<td rowspan="2">合</td>'), true) //第0欄之跨列格不受影響
    })

    it('data-style-th/td-{n}: 含 colspan 之表依邏輯欄定位, 跨欄之格只在起始欄套用 [R-TABLE-01(1)]', async function() {
        let md = [
            '<div data-for="tab" data-style-th-0="color:red;" data-style-th-1="color:blue;" data-style-td-1="color:green;" data-style-td-2="text-align:right;"></div>',
            '',
            '<table><thead><tr><th colspan="2">AB</th><th>C</th></tr></thead>',
            '<tbody><tr><td>a</td><td>b</td><td>c</td></tr>',
            '<tr><td colspan="2">ab</td><td>c2</td></tr></tbody></table>',
        ].join('\n')
        let out = await conv(md)
        assert.strict.equal(out.includes('<th colspan="2" style="color:red;">AB</th>'), true) //th跨第0~1欄, 起始欄為0
        assert.strict.equal(out.includes('color:blue'), false) //第1欄被跨欄之th佔住, 無起始於第1欄之th
        assert.strict.equal(out.includes('<td style="color:green;">b</td>'), true)
        assert.strict.equal(out.includes('<td colspan="2">ab</td>'), true) //跨欄之td起始於第0欄, 非第1欄
        assert.strict.equal(out.includes('<td style="text-align:right;">c</td>'), true)
        assert.strict.equal(out.includes('<td style="text-align:right;">c2</td>'), true) //過去第2列只有2個td而漏套
    })

    it('逐欄樣式: rowspan 不跨 thead/tbody 區段(超出區段末列者截至區段末) [R-TABLE-01(1)]', async function() {
        let md = [
            '<div data-for="tab" data-style-td-0="color:red;" data-style-td-2="color:blue;"></div>',
            '',
            '<table><thead><tr><th rowspan="2">甲</th><th>乙</th><th>丙</th></tr></thead>',
            '<tbody><tr><td>a</td><td>b</td><td>c</td></tr>',
            '<tr><td colspan="2">ab</td><td>c2</td></tr></tbody></table>',
        ].join('\n')
        let out = await conv(md)
        assert.strict.equal(out.includes('<td style="color:red;">a</td>'), true) //thead僅1列, th之rowspan=2不佔tbody第1列之第0欄
        assert.strict.equal(out.includes('<td colspan="2" style="color:red;">ab</td>'), true) //跨欄之格於起始欄(第0欄)套用
        assert.strict.equal(out.includes('<td>b</td>'), true)
        assert.strict.equal(out.includes('<td style="color:blue;">c</td>'), true)
        assert.strict.equal(out.includes('<td style="color:blue;">c2</td>'), true) //過去第2列只有2個td而漏套
    })

    it('逐欄樣式: rowspan=0(至區段末列)、超大或無效之 rowspan/colspan 依 HTML 表格模型定位且不致失控 [R-TABLE-01(1)]', async function() {
        let mk = (tbl) => `<div data-for="tab" data-style-td-1="color:red;"></div>\n\n${tbl}`
        //rowspan=0: 佔住其後各列之第0欄
        let o1 = await conv(mk('<table><tbody><tr><td rowspan="0">A</td><td>b1</td></tr><tr><td>b2</td></tr><tr><td>b3</td></tr></tbody></table>'))
        assert.strict.equal((o1.match(/<td style="color:red;">b[123]<\/td>/g) || []).length, 3)
        //rowspan 超大: 截至區段末列, 不逐列配置超大陣列
        let o2 = await conv(mk('<table><tbody><tr><td rowspan="9999999">A</td><td>b1</td></tr><tr><td>b2</td></tr></tbody></table>'))
        assert.strict.equal((o2.match(/<td style="color:red;">b[12]<\/td>/g) || []).length, 2)
        //rowspan 非數字或負值: 視為 1
        let o3 = await conv(mk('<table><tbody><tr><td rowspan="abc">A</td><td>b1</td></tr><tr><td rowspan="-1">A2</td><td>b2</td></tr></tbody></table>'))
        assert.strict.equal((o3.match(/<td style="color:red;">b[12]<\/td>/g) || []).length, 2)
        assert.strict.equal(o3.includes('color:red;">A'), false)
        //colspan 超過 1000 依表格模型限縮為 1000: 第1欄不是 b1(其起始欄為 1000), 第2列之 d 才是第1欄
        let o4 = await conv(mk('<table><tbody><tr><td colspan="99999">A</td><td>b1</td></tr><tr><td>c</td><td>d</td></tr></tbody></table>'))
        assert.strict.equal(o4.includes('<td>b1</td>'), true)
        assert.strict.equal(o4.includes('<td style="color:red;">d</td>'), true)
    })

    it('逐欄樣式: 無 rowspan/colspan 之表維持過去定位(同列第n個同標籤之cell, 混用 th/td 之列照舊) [R-TABLE-01(2)]', async function() {
        let md = [
            '<div data-for="tab" data-style-th-0="color:red;" data-style-td-0="color:blue;" data-style-td-1="color:green;"></div>',
            '',
            '<table><tbody>',
            '<tr><th>列甲</th><td>a1</td><td>a2</td></tr>',
            '<tr><th>列乙</th><td>b1</td><td>b2</td></tr>',
            '</tbody></table>',
        ].join('\n')
        let out = await conv(md)
        assert.strict.equal(out.includes('<th style="color:red;">列甲</th>'), true)
        assert.strict.equal(out.includes('<td style="color:blue;">a1</td>'), true) //td-0為該列第0個td(非邏輯第0欄)
        assert.strict.equal(out.includes('<td style="color:green;">a2</td>'), true)
        assert.strict.equal(out.includes('<td style="color:blue;">b1</td>'), true)
        assert.strict.equal(out.includes('<td style="color:green;">b2</td>'), true)
    })

})


//合併儲存格: 對應規則帳本 R-TABLE-01(5)~(10)
describe('md2html 表格標記: 合併儲存格', function() {

    it('data-merge-v: 指定欄上下相鄰且內容相同者合併(rowspan), 不相鄰者不合併, 逐欄樣式保留於合併格 [R-TABLE-01(6)(8)]', async function() {
        let md = [
            '<div data-for="tab" data-style-td-0="vertical-align:middle;" data-merge-v="0"></div>',
            '',
            '| 系統 | 項目 |',
            '|---|---|',
            '| A | 1 |',
            '| A | 2 |',
            '| B | 3 |',
            '| A | 4 |',
        ].join('\n')
        let out = await conv(md)
        assert.strict.equal(out.includes('<td style="vertical-align:middle;" rowspan="2">A</td>'), true)
        assert.strict.equal((out.match(/<td[^>]*>A<\/td>/g) || []).length, 2) //第1、2列合併為1格, 第4列之A不相鄰另成1格
        assert.strict.equal((out.match(/rowspan=/g) || []).length, 1)
        assert.strict.equal((out.match(/<td[^>]*>[1-4]<\/td>/g) || []).length, 4) //未指定之欄不合併
    })

    it('data-merge-v: 依列出順序為階層, 後列之欄不跨前列之欄之區塊合併 [R-TABLE-01(6)]', async function() {
        let md = [
            '<div data-for="tab" data-merge-v="0,1"></div>',
            '',
            '| 系統 | 子系統 | 模組 |',
            '|---|---|---|',
            '| A | x | m1 |',
            '| A | x | m2 |',
            '| B | x | m3 |',
        ].join('\n')
        let out = await conv(md)
        assert.strict.equal(out.includes('<td rowspan="2">A</td>'), true)
        assert.strict.equal(out.includes('<td rowspan="2">x</td>'), true) //第1、2列之x同屬A區塊而合併
        assert.strict.equal((out.match(/<td[^>]*>x<\/td>/g) || []).length, 2) //第3列之x屬B區塊, 不與上方合併
    })

    it('data-merge-v: 階層之上下由列出順序決定("1,0" 以第1欄為上層) [R-TABLE-01(6)]', async function() {
        let md = [
            '<div data-for="tab" data-merge-v="1,0"></div>',
            '',
            '| 系統 | 子系統 |',
            '|---|---|',
            '| A | x |',
            '| A | x |',
            '| B | x |',
        ].join('\n')
        let out = await conv(md)
        assert.strict.equal(out.includes('<td rowspan="3">x</td>'), true) //第1欄為上層: 3列之x同屬一區塊
        assert.strict.equal(out.includes('<td rowspan="2">A</td>'), true) //第0欄於x區塊內再合併前2列
        assert.strict.equal(out.includes('<td>B</td>'), true)
    })

    it('data-merge-v: 只處理 tbody, 各 tbody 獨立 [R-TABLE-01(6)]', async function() {
        let md = [
            '<div data-for="tab" data-merge-v="0"></div>',
            '',
            '<table><thead><tr><th>H</th></tr><tr><th>H</th></tr></thead>',
            '<tbody><tr><td>A</td></tr><tr><td>A</td></tr></tbody>',
            '<tbody><tr><td>A</td></tr></tbody></table>',
        ].join('\n')
        let out = await conv(md)
        assert.strict.equal((out.match(/<th>H<\/th>/g) || []).length, 2) //thead不合併
        assert.strict.equal(out.includes('<td rowspan="2">A</td>'), true) //第1個tbody內合併
        assert.strict.equal((out.match(/rowspan=/g) || []).length, 1) //第2個tbody之A不與第1個tbody合併
        assert.strict.equal(out.includes('<td>A</td>'), true)
    })

    it('data-merge-v: 以邏輯欄判定, 已有 rowspan 之格不參與, 下方列少一格仍依欄對齊 [R-TABLE-01(6)]', async function() {
        let md = [
            '<div data-for="tab" data-merge-v="1"></div>',
            '',
            '<table><thead><tr><th>甲</th><th>乙</th></tr></thead>',
            '<tbody><tr><td rowspan="2">A</td><td>x</td></tr>',
            '<tr><td>x</td></tr>',
            '<tr><td>A</td><td>x</td></tr></tbody></table>',
        ].join('\n')
        let out = await conv(md)
        assert.strict.equal(out.includes('<td rowspan="3">x</td>'), true) //第2、3列之x雖為該列第0個td, 邏輯欄為第1欄, 與第1列之x相鄰
        assert.strict.equal((out.match(/>x</g) || []).length, 1)
        assert.strict.equal(out.includes('<td rowspan="2">A</td>'), true) //既有rowspan之格不變
        assert.strict.equal(out.includes('<td>A</td>'), true)
        let md2 = md.replace('data-merge-v="1"', 'data-merge-v="0"')
        let out2 = await conv(md2)
        assert.strict.equal((out2.match(/rowspan=/g) || []).length, 1) //第0欄: 既有rowspan之A不參與, 與第3列之A不相鄰
    })

    it('data-merge-keep: 第一個合併欄之區塊內各列不斷開, 非末列與下一列同頁 [R-TABLE-01(7)]', async function() {
        let md = [
            '<div data-for="tab" data-merge-v="0" data-merge-keep="true"></div>',
            '',
            '| 系統 | 項目 |',
            '|---|---|',
            '| A | 1 |',
            '| A | 2 |',
        ].join('\n')
        let out = await conv(md)
        assert.strict.equal((out.match(/<tr style="page-break-inside:avoid;">/g) || []).length, 2)
        assert.strict.equal(out.includes('<td rowspan="2"><div style="page-break-after:avoid;">A</div></td>'), true)
        assert.strict.equal(out.includes('<td><div style="page-break-after:avoid;">1</div></td>'), true)
        assert.strict.equal(out.includes('<td>2</td>'), true) //區塊末列不加
    })

    it('data-merge-keep: 各區塊獨立, 單列區塊只加不斷開 [R-TABLE-01(7)]', async function() {
        let md = [
            '<div data-for="tab" data-merge-v="0" data-merge-keep="true"></div>',
            '',
            '| 系統 | 項目 |',
            '|---|---|',
            '| A | 1 |',
            '| A | 2 |',
            '| B | 3 |',
            '| C | 4 |',
            '| C | 5 |',
        ].join('\n')
        let out = await conv(md)
        assert.strict.equal((out.match(/<tr style="page-break-inside:avoid;">/g) || []).length, 5) //表身5列皆不斷開, 表頭列不加
        assert.strict.equal((out.match(/page-break-after:avoid/g) || []).length, 4) //A區塊首列2格、C區塊首列2格; 各區塊末列與單列區塊B不加
        assert.strict.equal(out.includes('<td>B</td>'), true)
        assert.strict.equal(out.includes('<td>3</td>'), true)
    })

    it('data-merge-keep: 非 true 或無有效之 data-merge-v 時不作用 [R-TABLE-01(7)(9)]', async function() {
        let mk = (attrs) => [
            `<div data-for="tab" ${attrs}></div>`,
            '',
            '| 系統 | 項目 |',
            '|---|---|',
            '| A | 1 |',
            '| A | 2 |',
        ].join('\n')
        let o1 = await conv(mk('data-merge-v="0" data-merge-keep="yes"'))
        assert.strict.equal(o1.includes('page-break'), false) //值不是true視為未給
        assert.strict.equal(o1.includes('<td rowspan="2">A</td>'), true) //合併照常
        let o2 = await conv(mk('data-merge-v="0" data-merge-keep="TRUE"'))
        assert.strict.equal(o2.includes('page-break'), false) //須全小寫(同廣義布林)
        let o3 = await conv(mk('data-merge-keep="true"'))
        assert.strict.equal(o3.includes('page-break'), false) //無合併欄則無區塊
        let o4 = await conv(mk('data-merge-v="0" data-merge-keep=" true "'))
        assert.strict.equal(o4.includes('page-break-inside:avoid'), true) //去頭尾空白
    })

    it('data-merge-v/h: 無效之欄索引略過且無副作用, 有效者照常 [R-TABLE-01(9)]', async function() {
        let md = (attrs) => [
            `<div data-for="tab" ${attrs}></div>`,
            '',
            '| 系統 | 項目 |',
            '|---|---|',
            '| A | A |',
            '| A | A |',
        ].join('\n')
        let bad = ['a', '-1', '9', '1.5', '1e1', '', ' ', '0x1', '99999999999999999999']
        let out = await conv(md(`data-merge-v="${bad.join(',')}" data-merge-h="${bad.join(',')}"`))
        assert.strict.equal(out.includes('rowspan'), false)
        assert.strict.equal(out.includes('colspan'), false)
        assert.strict.equal((out.match(/<td>A<\/td>/g) || []).length, 4)
        let out2 = await conv(md('data-merge-v="x, 0 ,7,0" data-merge-h="y,,1"'))
        assert.strict.equal(out2.includes('<td rowspan="2">A</td>'), true) //"x, 0 ,7,0": 去空白去重, 只第0欄有效
        assert.strict.equal(out2.includes('colspan'), false) //"y,,1": 只第1欄有效, 單一欄無相鄰可併
    })

    it('data-merge-v/h: 空值或標記後無表格時不拋錯, 標記照常移除 [R-TABLE-01(9)]', async function() {
        let out = await conv('<div data-for="tab" data-merge-v="0" data-merge-h="0" data-merge-keep="true" data-style-code="color:red;"></div>\n\n只有文字')
        assert.strict.equal(out.includes('data-for="tab"'), false)
        assert.strict.equal(out.includes('只有文字'), true)
        let out2 = await conv('<div data-for="tab" data-merge-v="" data-merge-h="" data-merge-keep=""></div>\n\n| a |\n|---|\n| 1 |')
        assert.strict.equal(out2.includes('data-for="tab"'), false)
        assert.strict.equal(out2.includes('<td>1</td>'), true)
    })

    it('data-merge-v/h: 空白格不合併, th 與 td 不互併 [R-TABLE-01(10)]', async function() {
        let md = [
            '<div data-for="tab" data-merge-v="0" data-merge-h="1,2"></div>',
            '',
            '| 系統 | 甲 | 乙 |',
            '|---|---|---|',
            '|  | 1 |  |',
            '|  | 2 |  |',
        ].join('\n')
        let out = await conv(md)
        assert.strict.equal(out.includes('rowspan'), false) //第0欄兩個空白格不併
        assert.strict.equal(out.includes('colspan'), false) //第2欄之空白格不併
        let md2 = [
            '<div data-for="tab" data-merge-v="0" data-merge-h="0,1"></div>',
            '',
            '<table><tbody><tr><th>X</th><td>X</td></tr>',
            '<tr><td>X</td><td>y</td></tr></tbody></table>',
        ].join('\n')
        let out2 = await conv(md2)
        assert.strict.equal(out2.includes('rowspan'), false) //上下: 第1列為th、第2列為td, 不併
        assert.strict.equal(out2.includes('colspan'), false) //左右: 第1列之th與td不併
    })

    it('data-merge-h: 同一列內指定欄左右相鄰且內容相同者合併(colspan), 合併格保留最左格之樣式 [R-TABLE-01(5)]', async function() {
        let md = [
            '<div data-for="tab" data-style-td-1="text-align:center;" data-merge-h="1,2,3"></div>',
            '',
            '| 類別 | 甲 | 乙 | 丙 |',
            '|---|---|---|---|',
            '| A | 共同說明 | 共同說明 | 共同說明 |',
            '| B | 1 | 1 | 2 |',
        ].join('\n')
        let out = await conv(md)
        assert.strict.equal(out.includes('<td style="text-align:center;" colspan="3">共同說明</td>'), true)
        assert.strict.equal((out.match(/共同說明/g) || []).length, 1)
        assert.strict.equal(out.includes('<td style="text-align:center;" colspan="2">1</td>'), true) //第2列之甲乙相同而合併, 丙不同不併
        assert.strict.equal(out.includes('<td>2</td>'), true)
    })

    it('data-merge-h: 未指定之欄與不相鄰者不合併 [R-TABLE-01(5)]', async function() {
        let md = [
            '<div data-for="tab" data-merge-h="1,2,3"></div>',
            '',
            '| 類別 | 甲 | 乙 | 丙 |',
            '|---|---|---|---|',
            '| x | x | y | x |',
        ].join('\n')
        let out = await conv(md)
        assert.strict.equal(out.includes('colspan'), false) //第0欄未指定故不與第1欄併; 第1、3欄不相鄰
        assert.strict.equal((out.match(/<td>x<\/td>/g) || []).length, 3)
    })

    it('data-merge-h: 欄索引去頭尾空白、去重, 與列出順序無關 [R-TABLE-01(5)(9)]', async function() {
        let md = [
            '<div data-for="tab" data-merge-h=" 2 , 1 ,1"></div>',
            '',
            '| 類別 | 甲 | 乙 |',
            '|---|---|---|',
            '| x | y | y |',
        ].join('\n')
        let out = await conv(md)
        assert.strict.equal(out.includes('<td colspan="2">y</td>'), true)
        assert.strict.equal(out.includes('<td>x</td>'), true)
    })

    it('data-merge-h: 表頭列亦可合併 [R-TABLE-01(5)]', async function() {
        let md = [
            '<div data-for="tab" data-merge-h="0,1"></div>',
            '',
            '| 說明 | 說明 | 值 |',
            '|---|---|---|',
            '| a | b | 1 |',
        ].join('\n')
        let out = await conv(md)
        assert.strict.equal(out.includes('<th colspan="2">說明</th>'), true)
        assert.strict.equal(out.includes('<td>a</td>'), true)
        assert.strict.equal(out.includes('<td>b</td>'), true)
    })

    it('data-merge-h: 以邏輯欄判定相鄰, 被上方 rowspan 佔住之欄不算相鄰 [R-TABLE-01(5)]', async function() {
        let md = [
            '<div data-for="tab" data-merge-h="0,1,2"></div>',
            '',
            '<table><tbody><tr><td>a</td><td rowspan="2">x</td><td>a</td></tr>',
            '<tr><td>a</td><td>a</td></tr></tbody></table>',
        ].join('\n')
        let out = await conv(md)
        assert.strict.equal(out.includes('colspan'), false) //第2列之兩個a於DOM相鄰, 但邏輯欄為0與2, 中間被x佔住
        assert.strict.equal(out.includes('<td rowspan="2">x</td>'), true)
        let md2 = [
            '<div data-for="tab" data-merge-h="1,2"></div>',
            '',
            '<table><tbody><tr><td rowspan="2">x</td><td>a</td><td>a</td></tr>',
            '<tr><td>b</td><td>b</td></tr></tbody></table>',
        ].join('\n')
        let out2 = await conv(md2)
        assert.strict.equal(out2.includes('<td colspan="2">a</td>'), true)
        assert.strict.equal(out2.includes('<td colspan="2">b</td>'), true) //第2列之b為邏輯第1、2欄(第0欄被x佔住)
        assert.strict.equal(out2.includes('<td rowspan="2">x</td>'), true)
    })

    it('data-merge-h: 已有 colspan/rowspan 之格不參與 [R-TABLE-01(5)]', async function() {
        let md = [
            '<div data-for="tab" data-merge-h="0,1,2"></div>',
            '',
            '<table><tbody><tr><td colspan="2">a</td><td>a</td></tr></tbody></table>',
        ].join('\n')
        let out = await conv(md)
        assert.strict.equal((out.match(/colspan=/g) || []).length, 1)
        assert.strict.equal(out.includes('<td colspan="2">a</td>'), true)
        assert.strict.equal(out.includes('<td>a</td>'), true)
    })

    it('data-merge-h 先於 data-merge-v: 左右合併後之格不再參與上下合併 [R-TABLE-01(8)]', async function() {
        let md = [
            '<div data-for="tab" data-merge-h="0,1" data-merge-v="0"></div>',
            '',
            '| 系統 | 項目 |',
            '|---|---|',
            '| A | A |',
            '| A | 1 |',
            '| A | 2 |',
        ].join('\n')
        let out = await conv(md)
        assert.strict.equal(out.includes('<td colspan="2">A</td>'), true) //第1列左右合併
        assert.strict.equal(out.includes('<td rowspan="2">A</td>'), true) //第2、3列上下合併, 不併入第1列之左右合併格
        assert.strict.equal((out.match(/rowspan=/g) || []).length, 1)
    })

    it('表頭跨欄、分類列跨整列並切斷上下合併, 與 data-merge-keep、逐欄樣式併用 [R-TABLE-01(5)(6)(7)(8)]', async function() {
        let md = [
            '<div data-for="tab" data-style-td="font-size:9pt;" data-style-td-0="text-align:center; vertical-align:middle;" data-merge-h="0,1,2" data-merge-v="0" data-merge-keep="true"></div>',
            '',
            '| 系統 | 內容 | 內容 |',
            '|------|------|------|',
            '| 第一類 | 第一類 | 第一類 |',
            '| 系統甲 | `unit01` | 說明一 |',
            '| 系統甲 | `unit02` | 說明二 |',
            '| 第二類 | 第二類 | 第二類 |',
            '| 系統乙 | `unit03` | 說明三 |',
        ].join('\n')
        let out = await conv(md)
        assert.strict.equal(out.includes('<th colspan="2">內容</th>'), true) //表頭「內容」跨2欄
        assert.strict.equal((out.match(/colspan="3"/g) || []).length, 2) //兩個分類列各跨3欄
        assert.strict.equal(out.includes('<td style="font-size:9pt;text-align:center; vertical-align:middle;" colspan="3">第一類</td>'), true) //合併格保留最左格(第0欄)之樣式
        assert.strict.equal((out.match(/第一類/g) || []).length, 1)
        assert.strict.equal((out.match(/rowspan=/g) || []).length, 1) //只有「系統甲」之2列合併, 分類列切斷上下合併
        assert.strict.equal(out.includes('rowspan="2"><div style="page-break-after:avoid;">系統甲</div></td>'), true)
        assert.strict.equal((out.match(/<tr style="page-break-inside:avoid;">/g) || []).length, 5) //表身5列皆不斷開
        assert.strict.equal(out.includes('<code style="font-size:9pt;">unit01</code>'), true) //code先繼承儲存格字級, 再合併
    })

    it('合併以 innerHTML 比對: 同字而行內 code 樣式因欄而異者不合併 [R-TABLE-01(5)(8)]', async function() {
        let md = [
            '<div data-for="tab" data-style-td-1="font-size:9pt;" data-style-td-2="font-size:8pt;" data-merge-h="1,2"></div>',
            '',
            '| 類別 | 甲 | 乙 |',
            '|---|---|---|',
            '| x | `a_b` | `a_b` |',
            '| y | c | c |',
        ].join('\n')
        let out = await conv(md)
        assert.strict.equal(out.includes('<code style="font-size:9pt;">a_b</code>'), true) //code先繼承各欄字級再比對, 兩格之 innerHTML 不同
        assert.strict.equal(out.includes('<code style="font-size:8pt;">a_b</code>'), true)
        assert.strict.equal((out.match(/colspan=/g) || []).length, 1) //只有第2列之c合併
        assert.strict.equal(out.includes('<td style="font-size:9pt;" colspan="2">c</td>'), true)
    })

    it('code 繼承先於合併: 合併格內之 code 帶儲存格字級 [R-TABLE-01(8)]', async function() {
        let md = [
            '<div data-for="tab" data-style-td="font-size:9pt;" data-merge-v="0"></div>',
            '',
            '| 代號 | 項目 |',
            '|---|---|',
            '| `a_b` | 1 |',
            '| `a_b` | 2 |',
        ].join('\n')
        let out = await conv(md)
        assert.strict.equal(out.includes('<td style="font-size:9pt;" rowspan="2"><code style="font-size:9pt;">a_b</code></td>'), true)
        assert.strict.equal((out.match(/<code/g) || []).length, 1)
    })

    it('合併與 tableHorizontalAlignmentCenter 並存 [R-TABLE-01(8)]', async function() {
        let md = [
            '<div data-for="tab" data-merge-v="0"></div>',
            '',
            '| 系統 | 項目 |',
            '|---|---|',
            '| A | 1 |',
            '| A | 2 |',
        ].join('\n')
        let out = await conv(md, { tableHorizontalAlignmentCenter: true })
        assert.strict.equal(out.includes('<td rowspan="2">A</td>'), true)
        assert.strict.equal(/text-align:\s*center/.test(out), true)
    })

})
