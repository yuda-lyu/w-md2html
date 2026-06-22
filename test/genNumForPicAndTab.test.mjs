import assert from 'assert'
import fs from 'fs'
import WMd2html from '../src/WMd2html.mjs'


//圖表自動編號(圖n/表n→圖1/表1…, 圖表各自獨立計數)與內文 {名稱} 交叉引用之回歸測試,
//守護 cvItemNum 之 async/await html2str 修正(交叉引用之名稱抽取依賴 html2str, 漏 await 會使 {名稱} 失效)
describe('genNumForPicAndTab 圖表自動編號與交叉引用(回歸)', function() {

    let fdTmp = './tmp'
    let fpIn = `${fdTmp}/genNumForPicAndTab.md`
    let fpOut = `${fdTmp}/genNumForPicAndTab.html`
    let h = ''

    //測試輸入: 圖題行刻意涵蓋多種包裝(純文字/單div/置中外框內含縮排div/全形標點),
    //交叉引用涵蓋前向引用(引用在圖題之前)與重複引用(同名多處), 圖題行不含<img>使測試不依賴圖檔
    let md = [
        '# 圖表編號與交叉引用測試',
        '',
        '## A. 圖(前向引用 + 重複引用 + 多種圖題包裝)',
        '',
        '整體架構如{系統架構圖}所示；資料流程如{資料流程圖}所示；樹狀選單如{特徵、事件、作用資料樹狀選單}所示。',
        '',
        '圖n 系統架構圖',
        '',
        '<div style="margin:1rem 0;">圖n 資料流程圖</div>',
        '',
        '<div style="text-align:center;">',
        '    <div style="margin:0.6rem 0 0;">圖n 部署拓樸圖</div>',
        '</div>',
        '',
        '<div style="margin:1rem 0;">圖n 特徵、事件、作用資料樹狀選單</div>',
        '',
        '回顧整體架構如{系統架構圖}所示，部署拓樸如{部署拓樸圖}所示。',
        '',
        '## B. 表(與圖各自獨立計數)',
        '',
        '硬體需求如{硬體環境需求}所示；交付文件如{各階段交付文件}所示。',
        '',
        '表n 硬體環境需求',
        '',
        '| 項目 | 規格 |',
        '|------|------|',
        '| CPU | 4 核以上 |',
        '',
        '表n 各階段交付文件',
        '',
        '| 階段 | 文件 |',
        '|------|------|',
        '| T1 | 專案管理計畫書 |',
        '',
    ].join('\n')

    before(async function() {
        if (!fs.existsSync(fdTmp)) {
            fs.mkdirSync(fdTmp, { recursive: true })
        }
        fs.writeFileSync(fpIn, md, 'utf8')
        await WMd2html(fpIn, fpOut, {})
        h = fs.readFileSync(fpOut, 'utf8')
    })

    after(function() {
        if (fs.existsSync(fpIn)) {
            fs.unlinkSync(fpIn)
        }
        if (fs.existsSync(fpOut)) {
            fs.unlinkSync(fpOut)
        }
    })

    it('圖題依出現順序自動編號 圖1~圖4(涵蓋純文字/單div/置中外框縮排div/全形標點)', function() {
        assert.strict.ok(h.includes('圖1 系統架構圖'), '圖1 系統架構圖')
        assert.strict.ok(h.includes('圖2 資料流程圖'), '圖2 資料流程圖')
        assert.strict.ok(h.includes('圖3 部署拓樸圖'), '圖3 部署拓樸圖')
        assert.strict.ok(h.includes('圖4 特徵、事件、作用資料樹狀選單'), '圖4 特徵、事件、作用資料樹狀選單')
    })

    it('表題依出現順序自動編號 表1~表2(與圖各自獨立計數)', function() {
        assert.strict.ok(h.includes('表1 硬體環境需求'), '表1 硬體環境需求')
        assert.strict.ok(h.includes('表2 各階段交付文件'), '表2 各階段交付文件')
    })

    it('內文 {名稱} 交叉引用全部解析(前向/重複/跨圖表)', function() {
        assert.strict.ok(h.includes('如圖1所示'), '{系統架構圖}->圖1')
        assert.strict.ok((h.match(/如圖1所示/g) || []).length >= 2, '{系統架構圖} 重複引用 2 處皆圖1')
        assert.strict.ok(h.includes('如圖2所示'), '{資料流程圖}->圖2')
        assert.strict.ok(h.includes('如圖3所示'), '{部署拓樸圖}->圖3')
        assert.strict.ok(h.includes('如圖4所示'), '{特徵、事件、作用資料樹狀選單}->圖4')
        assert.strict.ok(h.includes('如表1所示'), '{硬體環境需求}->表1')
        assert.strict.ok(h.includes('如表2所示'), '{各階段交付文件}->表2')
    })

    it('無序號標記與未解析引用殘留(圖n/表n/{名稱})', function() {
        assert.strict.ok(!h.includes('圖n'), '無 圖n 殘留')
        assert.strict.ok(!h.includes('表n'), '無 表n 殘留')
        for (let name of ['系統架構圖', '資料流程圖', '部署拓樸圖', '特徵、事件、作用資料樹狀選單', '硬體環境需求', '各階段交付文件']) {
            assert.strict.ok(!h.includes(`{${name}}`), `無 {${name}} 殘留`)
        }
    })

})
