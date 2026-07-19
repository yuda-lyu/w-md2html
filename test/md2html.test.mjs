import assert from 'assert'
import md2html from '../src/md2html.mjs'


//md2html之DOM後處理(原htmlConvert併入): display:none移除 / for=br / for=tab / linkBlank / tableHorizontalAlignmentCenter
describe('md2html DOM後處理', function() {

    let zwsp = String.fromCharCode(0x200B) //零寬空格 U+200B

    let conv = async (md, opt = {}) => {
        let r = await md2html(md, { mergeStyle: false, ...opt })
        return r.html
    }

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
