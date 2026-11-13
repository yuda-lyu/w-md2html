import fs from 'fs'
import assert from 'assert'
import { createRequire } from 'module'
import { JSDOM } from 'jsdom'
import md2html from '../src/md2html.mjs'
import WMd2html from '../src/WMd2html.mjs'


//jsdom依賴契約回歸測試(R-JSDOM-01): 鎖住本套件對jsdom(Node端DOM, 供DOMPurify清洗、DOM後處理與未解析引用警告)之依賴行為,
//升版(30.1.3 → 31.0.0, 其CSS引擎重寫、HTML解析改非同步)時若契約改變可直接定位到jsdom, 不必只靠reportTrue.html逐字比對
//每條斷言註明對應之規格出處(規則帳本R-JSDOM-01之子項、src註解)

let require = createRequire(import.meta.url)

let conv = async (md, opt = {}) => {
    let r = await md2html(md, { mergeStyle: false, ...opt })
    return r.html
}

//取出輸出中第一張table之style屬性值(無style屬性回傳null)
let tabStyle = (out) => {
    let m = out.match(/<table(?: style="([^"]*)")?>/)
    return m ? (m[1] === undefined ? null : m[1]) : undefined
}


//R-JSDOM-01(1)~(3): tableHorizontalAlignmentCenter將table設inline-table時, 只附加display宣告, 不改寫使用者於table之style既有宣告
//why: jsdom 31起CSS引擎重寫, 以el.style賦值後整串style屬性由引擎重新序列化, 序列化結果隨版本而異: page-break-*被改寫為break-*(Word匯入只認page-break-*),
//     -webkit-前綴被移除, 小寫化以外之大小寫與引號被改動; 30.x則整條丟棄大寫之屬性名. 故以字串附加, 使用者宣告原樣保留
describe('md2html table之inline-table設定不改寫使用者既有style宣告 [R-JSDOM-01(1)~(3)]', function() {

    let tab = (style) => `<table style="${style}"><tr><td>a</td></tr></table>`
    let center = { tableHorizontalAlignmentCenter: true }

    it('(3)無style屬性之table: style="display: inline-table;" 且外包 text-align: center 之div', async function() {
        let out = await conv('| a |\n|---|\n| 1 |', center)
        assert.strict.equal(tabStyle(out), 'display: inline-table;') //與修前(jsdom 30.1.3)逐字相同
        assert.strict.equal(out.includes('<div style="text-align: center;"><table style="display: inline-table;">'), true)
    })

    it('(1)page-break-inside/before/after 原樣保留, 不被改寫為 break-*', async function() {
        let o1 = await conv(tab('page-break-inside:avoid;width:100%'), center)
        assert.strict.equal(tabStyle(o1), 'page-break-inside:avoid;width:100%;display: inline-table;')
        let o2 = await conv(tab('page-break-before:always'), center)
        assert.strict.equal(tabStyle(o2), 'page-break-before:always;display: inline-table;')
        let o3 = await conv(tab('page-break-after:avoid'), center)
        assert.strict.equal(tabStyle(o3), 'page-break-after:avoid;display: inline-table;')
        for (let o of [o1, o2, o3]) {
            assert.strict.equal(/(^|[^-])break-(inside|before|after)/.test(o), false) //無break-*
        }
    })

    it('(1)-webkit-/-ms- 前綴、mso-* 與 !important 原樣保留', async function() {
        let out = await conv(tab('mso-table-lspace:0pt;-webkit-text-size-adjust:none;-ms-text-size-adjust:none;width:100% !important'), center)
        assert.strict.equal(tabStyle(out), 'mso-table-lspace:0pt;-webkit-text-size-adjust:none;-ms-text-size-adjust:none;width:100% !important;display: inline-table;')
    })

    it('(1)font-family 之引號、空白、值之寫法原樣保留(不去引號、不重排簡寫)', async function() {
        let out = await conv(tab(`font-family:'Microsoft JhengHei',Arial;border:1px solid #666;border-collapse:collapse;transition:all .2s ease;border-radius:4px 4px 0 0`), center)
        assert.strict.equal(tabStyle(out), `font-family:'Microsoft JhengHei',Arial;border:1px solid #666;border-collapse:collapse;transition:all .2s ease;border-radius:4px 4px 0 0;display: inline-table;`)
    })

    it('(1)大寫之屬性名與屬性值原樣保留(CSS屬性名不分大小寫, 修前jsdom 30.x 會整條丟棄)', async function() {
        let out = await conv(tab('WIDTH:100%;COLOR:RED'), center)
        assert.strict.equal(tabStyle(out), 'WIDTH:100%;COLOR:RED;display: inline-table;')
    })

    it('(1)前值已以分號結尾不重複補分號, 否則補一個(DOMPurify已去除屬性值之頭尾空白)', async function() {
        let o1 = await conv(tab('width:100%;'), center)
        assert.strict.equal(tabStyle(o1), 'width:100%;display: inline-table;')
        let o2 = await conv(tab('width:100%; '), center)
        assert.strict.equal(tabStyle(o2), 'width:100%;display: inline-table;')
        let o3 = await conv(tab('width:100%'), center)
        assert.strict.equal(tabStyle(o3), 'width:100%;display: inline-table;')
    })

    it('(2)使用者於table設其他display: 以後宣告之 display: inline-table 覆寫(與修前結果相同: 表可水平置中)', async function() {
        let out = await conv(tab('display:block;width:50%'), center)
        assert.strict.equal(tabStyle(out), 'display:block;width:50%;display: inline-table;')
        let ms = [...tabStyle(out).matchAll(/display:\s*([a-z-]+)/g)].map((m) => m[1])
        assert.strict.equal(ms[ms.length - 1], 'inline-table') //最後一個display為生效者
    })

    it('(2)使用者之display帶 !important: 附加之宣告亦帶 !important 才能覆寫', async function() {
        let out = await conv(tab('display:block !important;width:50%'), center)
        assert.strict.equal(tabStyle(out), 'display:block !important;width:50%;display: inline-table !important;')
    })

    it('(2)使用者已設 display:inline-table(含 !important): 不重複附加', async function() {
        let o1 = await conv(tab('display:inline-table;width:50%'), center)
        assert.strict.equal(tabStyle(o1), 'display:inline-table;width:50%')
        let o2 = await conv(tab('display:inline-table !important'), center)
        assert.strict.equal(tabStyle(o2), 'display:inline-table !important')
    })

    it('(2)display:none(無空白)之table先被移除; 有空白之 display: none 保留並被覆寫為 inline-table(與修前相同)', async function() {
        let o1 = await conv(tab('display:none') + '\n\nx', center)
        assert.strict.equal(o1.includes('<table'), false)
        let o2 = await conv(tab('display: none'), center)
        assert.strict.equal(tabStyle(o2), 'display: none;display: inline-table;')
    })

    it('tableHorizontalAlignmentCenter 為 false: table 之 style 屬性不動, 不外包', async function() {
        let out = await conv(tab('page-break-inside:avoid;WIDTH:100%'), { tableHorizontalAlignmentCenter: false })
        assert.strict.equal(tabStyle(out), 'page-break-inside:avoid;WIDTH:100%')
        assert.strict.equal(out.includes('text-align'), false)
    })

    it('多張table各自處理, 巢狀table之內外層皆處理, 外包之div只含 text-align: center', async function() {
        let md = [
            tab('page-break-inside:avoid'),
            '',
            '<table><tr><td><table style="WIDTH:50%"><tr><td>in</td></tr></table></td></tr></table>',
        ].join('\n')
        let out = await conv(md, center)
        let ts = [...out.matchAll(/<table style="([^"]*)">/g)].map((m) => m[1])
        assert.strict.deepEqual(ts, ['page-break-inside:avoid;display: inline-table;', 'display: inline-table;', 'WIDTH:50%;display: inline-table;'])
        assert.strict.equal((out.match(/<div style="text-align: center;">/g) || []).length, 3)
    })

    it('data-merge-keep 於 tr 加之 page-break-inside:avoid 與置中並存時原樣輸出', async function() {
        let md = [
            '<div data-for="tab" data-merge-v="0" data-merge-keep="true"></div>',
            '',
            '| 類 | 值 |', '|---|---|', '| a | 1 |', '| a | 2 |',
        ].join('\n')
        let out = await conv(md, center)
        assert.strict.equal((out.match(/<tr style="page-break-inside:avoid;">/g) || []).length, 2)
        assert.strict.equal(tabStyle(out), 'display: inline-table;')
    })
})


//R-JSDOM-01(4)~(5): src使用之jsdom行為
describe('jsdom 行為契約(Node端DOM) [R-JSDOM-01(4)~(5)]', function() {

    //(4)WMd2html之getUnresolvedRefs以 new JSDOM(html) 解析最終html後立即同步讀取文字:
    //  jsdom 31起HTML解析改非同步(遇阻塞式script暫停), 建構子可能回傳部分解析之文件; 預設選項(未設runScripts與resources)下script不執行亦不載入,
    //  故建構子回傳之文件須已完整(內文與script之後之內容皆在); 本套件不讀readyState與load事件(30.x為'loading', 31為'interactive', 不屬契約)
    it('(4)預設選項: 含阻塞式外部script/行內script/async/defer/module/document.write之html, 建構子回傳即完整解析, 且不載入資源', function() {
        let shapes = {
            inline: '<!DOCTYPE html><html><head><script>var a=1</script></head><body><p>before</p><p>END</p></body></html>',
            externalHead: '<!DOCTYPE html><html><head><script src="http://127.0.0.1:9/b.js"></script></head><body><p>END</p></body></html>',
            externalBody: '<!DOCTYPE html><html><body><p>before</p><script src="http://127.0.0.1:9/b.js"></script><p>END</p></body></html>',
            asyncDeferModule: '<!DOCTYPE html><html><body><script async src="http://127.0.0.1:9/a.js"></script><script defer src="http://127.0.0.1:9/b.js"></script><script type="module" src="http://127.0.0.1:9/c.mjs"></script><p>END</p></body></html>',
            docWrite: '<!DOCTYPE html><html><body><script>document.write("<p>w</p>")</script><p>END</p></body></html>',
            chain: '<!DOCTYPE html><html><body><script src="http://127.0.0.1:9/1.js"></script><script>var x=1</script><script src="http://127.0.0.1:9/2.js"></script><p>END</p></body></html>',
            linkStyleImport: '<!DOCTYPE html><html><head><link rel="stylesheet" href="http://127.0.0.1:9/a.css"><style>@import url("http://127.0.0.1:9/b.css");</style></head><body><p>END</p></body></html>',
            iframeImgObject: '<!DOCTYPE html><html><body><iframe src="http://127.0.0.1:9/f"></iframe><img src="http://127.0.0.1:9/i.png"><object data="http://127.0.0.1:9/o"></object><p>END</p></body></html>',
        }
        for (let [k, h] of Object.entries(shapes)) {
            let { window } = new JSDOM(h)
            let doc = window.document
            assert.strict.equal(doc.body.textContent.includes('END'), true, `${k}: script之後之內容須在`)
            assert.strict.equal(doc.body.innerHTML.includes('<script'), k === 'externalBody' || k === 'asyncDeferModule' || k === 'docWrite' || k === 'chain', `${k}: script元素之有無依原文`)
            assert.strict.equal(doc.querySelectorAll('script').length, (h.match(/<script/g) || []).length, `${k}: script元素皆在(不因未載入而缺)`)
            window.close()
        }
    })

    it('(4)new JSDOM(\'\') 之window.document可建立元素並以innerHTML解析片段(md2html之DOMPurify與DOM後處理所用)', function() {
        let { window } = new JSDOM('')
        let box = window.document.createElement('div')
        box.innerHTML = '<table><tr><td rowspan="2">a</td><td>b</td></tr><tr><td>c</td></tr></table><p>x &amp; y</p>'
        assert.strict.equal(box.innerHTML, '<table><tbody><tr><td rowspan="2">a</td><td>b</td></tr><tr><td>c</td></tr></tbody></table><p>x &amp; y</p>')
        window.close()
    })

    //(5)getColMap以DOM之rowSpan/colSpan(IDL值)取跨度, 不自行parseInt(src註解與規則帳本R-TABLE-01之表格模型)
    it('(5)rowSpan/colSpan之IDL值: 0、負值、非數字、超大值皆由jsdom夾限(rowspan=0回0, colspan=0回1, 無效回1, colspan上限1000, rowspan上限65534)', function() {
        let { window } = new JSDOM('')
        let box = window.document.createElement('div')
        box.innerHTML = '<table><thead><tr><th rowspan="0">a</th><th colspan="0">b</th><th rowspan="abc">c</th><th colspan="1001">d</th><th rowspan="-1">e</th><th colspan="5000">f</th><th rowspan="65535">g</th><th rowspan="65536">h</th></tr></thead><tbody><tr><td rowspan="2">x</td></tr><tr><td>y</td></tr></tbody><tbody></tbody><tfoot><tr><td>z</td></tr></tfoot></table>'
        let tab = box.querySelector('table')
        let cells = []
        for (let tr of tab.rows) {
            for (let c of tr.cells) {
                cells.push(`${c.tagName}:${c.rowSpan}:${c.colSpan}`)
            }
        }
        assert.strict.deepEqual(cells, ['TH:0:1', 'TH:1:1', 'TH:1:1', 'TH:1:1000', 'TH:1:1', 'TH:1:1000', 'TH:65534:1', 'TH:65534:1', 'TD:2:1', 'TD:1:1', 'TD:1:1'])
        assert.strict.equal(tab.rows.length, 4) //thead 1列 + tbody 2列 + tfoot 1列
        window.close()
    })

    it('(5)md2html: 畸形 rowspan/colspan 值之表經 data-merge 與逐欄樣式處理不丟錯', async function() {
        let md = [
            '<div data-for="tab" data-style-td-1="color:red;" data-merge-h="0,1" data-merge-v="0"></div>',
            '',
            '<table><tr><td rowspan="abc">a</td><td colspan="0">a</td><td rowspan="65536">b</td></tr><tr><td colspan="5000">c</td></tr></table>',
        ].join('\n')
        let out = await conv(md)
        assert.strict.equal(out.includes('data-for="tab"'), false)
        assert.strict.equal(out.includes('<table'), true)
    })

    it('(8)package.json 宣告之 jsdom 主版號與已安裝者一致, 且 Node 版本符合其 engines', function() {
        let pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'))
        let range = pkg.dependencies.jsdom //如 ^31.0.0
        let majDecl = Number(range.match(/(\d+)\./)[1])
        let ins = require('jsdom/package.json')
        assert.strict.equal(Number(ins.version.split('.')[0]), majDecl, `宣告 ${range} 與已安裝 ${ins.version} 主版號須一致`)
        //engines形如 "^22.22.2 || ^24.15.0 || >=26.0.0"; 取與目前Node同主版號之下限(或>=項)檢查
        let nodeVer = process.versions.node.split('.').map(Number)
        let ok = ins.engines.node.split('||').map((s) => s.trim()).some((s) => {
            let m = s.match(/^(\^|>=)(\d+)\.(\d+)\.(\d+)$/)
            if (!m) {
                return false
            }
            let [maj, min, pat] = [Number(m[2]), Number(m[3]), Number(m[4])]
            let ge = nodeVer[0] > maj || (nodeVer[0] === maj && (nodeVer[1] > min || (nodeVer[1] === min && nodeVer[2] >= pat)))
            return m[1] === '>=' ? ge : (nodeVer[0] === maj && ge)
        })
        assert.strict.equal(ok, true, `Node ${process.versions.node} 須符合 jsdom engines: ${ins.engines.node}`)
    })

    //(7)深度: 轉換遞迴上限在jsdom/parse5之innerHTML序列化(兩版皆於約2200層之未預熱行程丟Maximum call stack size exceeded, 屬既有限制)
    it('(7)1000層巢狀div可轉換(兩種選項)', async function() {
        let md = '<div>'.repeat(1000) + 'x' + '</div>'.repeat(1000)
        for (let opt of [{ mergeStyle: false }, { mergeStyle: true, linkBlank: true, tableHorizontalAlignmentCenter: true }]) {
            let r = await md2html(md, opt)
            assert.strict.equal((r.html.match(/<div>/g) || []).length, 1000)
        }
    })
})


//R-JSDOM-01(6): 自訂模板含阻塞式script或外部資源時, 未解析引用警告仍涵蓋script之後之內容(getUnresolvedRefs, 見R-FIGREF-01)
describe('WMd2html 未解析引用警告於含script/外部資源之自訂模板 [R-JSDOM-01(6)]', function() {

    let fdTmp = './test/_tmp/unit-md2html-jsdom'
    let head = '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8" />\n<title>{title}</title>\n'
    let tpl = (headExtra, bodyExtra = '', bodyAttr = '') => `${head}${headExtra}</head>\n<body${bodyAttr}>\n{html}\n${bodyExtra}</body>\n</html>\n`

    //轉換並擷取警告所列之字串(依輸出內首次出現順序), 無警告回傳[]
    let refsOf = async (name, htmlTemp, md = 'text {u}\n') => {
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
            ret = await WMd2html(fpIn, fpOut, { htmlTemp })
        }
        finally {
            console.log = logOri
        }
        assert.strict.equal(ret, 'ok')
        let ws = logs.filter((v) => v.startsWith('warning:'))
        assert.strict.ok(ws.length <= 1, `最多一則警告: ${ws.length}`)
        if (ws.length === 0) {
            return []
        }
        return ws[0].slice(ws[0].indexOf('name: ') + 'name: '.length).match(/\{[^{}]*\}/g)
    }

    before(function() {
        fs.mkdirSync(fdTmp, { recursive: true })
    })

    after(function() {
        fs.rmSync(fdTmp, { recursive: true, force: true })
    })

    it('(6)head內之行內script: script內之大括號不列, 其後內文照列', async function() {
        let refs = await refsOf('inline-head', tpl('<script>var x = "{notref}"; document.write("<p>{dw}</p>")</script>\n'))
        assert.strict.deepEqual(refs, ['{u}'])
    })

    it('(6)head內之外部阻塞式script: 其後內文照列', async function() {
        let refs = await refsOf('ext-head', tpl('<script src="http://127.0.0.1:9/blocking.js"></script>\n'))
        assert.strict.deepEqual(refs, ['{u}'])
    })

    it('(6)body內之外部阻塞式script: script之後之模板文字亦照列(解析不因阻塞式script而中止)', async function() {
        let refs = await refsOf('ext-body', tpl('', '<script src="http://127.0.0.1:9/blocking.js"></script>\n<p>{after-script}</p>\n'))
        assert.strict.deepEqual(refs, ['{u}', '{after-script}'])
    })

    it('(6)async/defer/module script之後之模板文字照列', async function() {
        let refs = await refsOf('async-defer-module', tpl('<script async src="http://127.0.0.1:9/a.js"></script><script defer src="http://127.0.0.1:9/b.js"></script><script type="module" src="http://127.0.0.1:9/c.mjs"></script>\n', '<p>{after-mod}</p>\n'))
        assert.strict.deepEqual(refs, ['{u}', '{after-mod}'])
    })

    it('(6)外部script與行內script與document.write相鄰成串: 串後之模板文字照列, script內大括號不列', async function() {
        let refs = await refsOf('chain', tpl('<script src="http://127.0.0.1:9/1.js"></script><script>document.write("<p>{w1}</p>")</script><script src="http://127.0.0.1:9/2.js"></script>\n', '<p>{tail}</p>\n'))
        assert.strict.deepEqual(refs, ['{u}', '{tail}'])
    })

    it('(6)body之onload屬性、base與iframe/img/object指向外部: 不載入資源, 內文照列', async function() {
        let refs = await refsOf('onload-iframe', tpl('<base href="http://127.0.0.1:9/">', '<iframe src="http://127.0.0.1:9/f.html"></iframe><img src="http://127.0.0.1:9/i.png"><object data="http://127.0.0.1:9/o"></object>\n', ' onload="document.title=\'x\'"'))
        assert.strict.deepEqual(refs, ['{u}'])
    })

    it('(6)link樣式表、@import之style、noscript內之內容: noscript內文字列入(無script環境下為可見文字)', async function() {
        let refs = await refsOf('link-style-noscript', tpl('<link rel="stylesheet" href="http://127.0.0.1:9/a.css"><style>@import url("http://127.0.0.1:9/b.css"); body{font:12px Arial} .x{color:red}</style><noscript><style>.a{b:c}</style><p>{ns-head}</p></noscript>\n', '<noscript><p>{ns-body}</p></noscript>\n'))
        assert.strict.deepEqual(refs, ['{ns-head}', '{u}', '{ns-body}'])
    })

    it('(6)svg內之文字列入、其內script與math不列(math另有KaTeX之排除)', async function() {
        let refs = await refsOf('svg-math', tpl('', '<svg><script>1</script><text>{svgtext}</text></svg><math><mi>{m}</mi></math>\n'))
        assert.strict.deepEqual(refs, ['{u}', '{svgtext}'])
    })
})
