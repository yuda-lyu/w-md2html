import assert from 'assert'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import sharp from 'sharp'
import { JSDOM } from 'jsdom'
import wi from 'w-image-proc/src/WImageProc.mjs'
import WMd2html from '../src/WMd2html.mjs'


//圖片引用之處理(建議檔 建議w-md2html調整.md §2、§3):
//  imgConvertToBase64=false: md語法圖與原始<img src="">行一律改寫為以md所在資料夾解析之絕對路徑(Windows為Word可解析之反斜線形式), 不轉碼, 輸出無data URL
//  兩種模式: 圖片檔不存在一律reject且訊息列出全部缺圖路徑; 具通訊協定之網址不處理
//  imgConvertToBase64=true(預設): 轉換前統計圖片總量, 超過上限以明確訊息reject(不得使行程因堆積超限中止), 未超者各圖重新編碼為PNG內嵌
describe('unit-imgPath 圖片引用之處理(路徑模式, 缺圖, base64總量上限)', function() {

    let fdBase = path.resolve('./test/_tmp/unit-imgPath')
    let isWin = process.platform === 'win32'

    //1x1 PNG
    let png1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

    //於案資料夾下寫檔, 回傳絕對路徑
    let put = (fd, rel, buf = png1) => {
        let fp = path.join(fd, rel)
        fs.mkdirSync(path.dirname(fp), { recursive: true })
        fs.writeFileSync(fp, buf)
        return fp
    }

    //轉換, 回傳{fd, fpOut, html}; md內圖片相對路徑以案資料夾(md所在資料夾)解析
    let conv = async (name, md, opt = {}, setup = null) => {
        let fd = path.join(fdBase, name)
        fs.rmSync(fd, { recursive: true, force: true })
        fs.mkdirSync(fd, { recursive: true })
        if (setup) {
            setup(fd)
        }
        let fpIn = path.join(fd, 'in.md')
        let fpOut = path.join(fd, 'out.html')
        fs.writeFileSync(fpIn, typeof md === 'function' ? md(fd) : md, 'utf8')
        await WMd2html(fpIn, fpOut, opt)
        return { fd, fpOut, html: fs.readFileSync(fpOut, 'utf8') }
    }

    //轉換並取得reject之訊息(未reject則斷言失敗); 另回傳輸出檔是否存在
    let convErr = async (name, md, opt = {}, setup = null) => {
        let fd = path.join(fdBase, name)
        let fpOut = path.join(fd, 'out.html')
        let msg = null
        try {
            await conv(name, md, opt, setup)
        }
        catch (err) {
            msg = String(err && err.message ? err.message : err)
        }
        assert.strict.notEqual(msg, null, 'should reject')
        return { msg, outExists: fs.existsSync(fpOut) }
    }

    //以DOM取各標籤(預設<img>)之指定屬性值(與逸出方式無關, 為使用者端實際解析之值), 無此屬性者為null
    let attrsOf = (html, attr, tag = 'img') => {
        let { window } = new JSDOM(html)
        let r = Array.from(window.document.querySelectorAll(tag)).map((el) => el.getAttribute(attr))
        window.close()
        return r
    }

    //以DOM取各<img>之src屬性值
    let srcs = (html) => attrsOf(html, 'src')

    before(function() {
        fs.rmSync(fdBase, { recursive: true, force: true })
        fs.mkdirSync(fdBase, { recursive: true })
    })

    after(function() {
        fs.rmSync(fdBase, { recursive: true, force: true })
    })

    describe('imgConvertToBase64=false 改寫為絕對路徑', function() {

        let opt = { imgConvertToBase64: false }

        //規格§2.1: md語法圖改寫為「以md所在資料夾解析之絕對路徑」, 不轉碼; 中文與空白路徑
        it('md語法圖: 相對路徑(./、子夾、中文與空白)改寫為絕對路徑, 無data URL', async function() {
            let r = await conv('md-rel', [
                '![a](pics/a.png)',
                '',
                '![b](./pics/b.png)',
                '',
                '![c](<圖 資料夾/圖 c.png>)',
            ].join('\n'), opt, (fd) => {
                put(fd, 'pics/a.png')
                put(fd, 'pics/b.png')
                put(fd, '圖 資料夾/圖 c.png')
            })
            assert.strict.deepEqual(srcs(r.html), [
                path.join(r.fd, 'pics', 'a.png'),
                path.join(r.fd, 'pics', 'b.png'),
                path.join(r.fd, '圖 資料夾', '圖 c.png'),
            ])
            assert.strict.equal(r.html.includes('data:'), false)
        })

        //規格§2.1: 原始<img>行(cvPicB64路徑)亦同
        it('原始<img src>行: 相對路徑(子夾、中文與空白)改寫為絕對路徑, 無data URL', async function() {
            let r = await conv('raw-rel', [
                '<div><img src="pics/a.png" style="width:100px;"></div>',
                '',
                '<div><img src="圖 資料夾/圖 c.png"></div>',
            ].join('\n'), opt, (fd) => {
                put(fd, 'pics/a.png')
                put(fd, '圖 資料夾/圖 c.png')
            })
            assert.strict.deepEqual(srcs(r.html), [
                path.join(r.fd, 'pics', 'a.png'),
                path.join(r.fd, '圖 資料夾', '圖 c.png'),
            ])
            assert.strict.equal(r.html.includes('data:'), false)
        })

        //規格§2.1: 絕對路徑照用(以md語法與原始<img>各一, 含中文與空白); 清洗(DOMPurify)不得移除絕對路徑之src
        it('絕對路徑(md語法與原始<img>): 照用且不被清洗移除', async function() {
            let r = await conv('abs', (fd) => {
                let fpA = path.join(fd, '絕對 資料夾', 'a b.png')
                let fpB = path.join(fd, '絕對 資料夾', 'c d.png')
                return [
                    `![a](<${fpA.replaceAll('\\', '/')}>)`, //md語法之反斜線為逸出字元, 以正斜線書寫
                    '',
                    `<img src="${fpB}">`,
                ].join('\n')
            }, opt, (fd) => {
                put(fd, '絕對 資料夾/a b.png')
                put(fd, '絕對 資料夾/c d.png')
            })
            assert.strict.deepEqual(srcs(r.html), [
                path.join(r.fd, '絕對 資料夾', 'a b.png'),
                path.join(r.fd, '絕對 資料夾', 'c d.png'),
            ])
        })

        //規格§2.1: Windows反斜線形式(正斜線與百分比編碼Word不可解析)
        it('輸出之路徑為作業系統原生形式(Windows為反斜線, 不含正斜線與百分比編碼)', async function() {
            let r = await conv('native', '![a](pics/a b.png)\n\n![b](<pics/a b.png>)\n\n<img src="pics/a b.png">', opt, (fd) => {
                put(fd, 'pics/a b.png')
            })
            let ss = srcs(r.html)
            assert.strict.equal(ss.length, 2) //未加<>之md語法因含空白不成圖
            assert.strict.equal(ss[0], path.join(r.fd, 'pics', 'a b.png'))
            if (isWin) {
                assert.strict.equal(/^[A-Za-z]:\\/.test(ss[0]), true)
                assert.strict.equal(ss[0].includes('/'), false)
            }
            assert.strict.equal(ss[0].includes('%'), false)
            assert.strict.equal(ss[0].startsWith('file:'), false)
        })

        //規格§2.1: 以md所在資料夾解析, 不以cwd解析(修前原始<img>行先以cwd解析)
        it('相對路徑以md所在資料夾解析, cwd下同名檔不得替代', async function() {
            let rel = 'test/_tmp/unit-imgPath/decoy-cwd/x.png' //相對於cwd(專案根)存在, 相對於md所在資料夾不存在
            put(path.resolve('.'), rel)
            let err = await convErr('cwd-decoy', `<img src="${rel}">`, opt)
            assert.strict.equal(err.msg.includes(path.join(fdBase, 'cwd-decoy', 'test', '_tmp', 'unit-imgPath', 'decoy-cwd', 'x.png')), true)
        })

        //規格§2.1: 路徑含&, #, %, ', 中文與空白時, 使用者端解析出之src屬性值即該路徑(屬性值內之&須逸出, 否則破壞屬性)
        it('特殊字元路徑(& # % \' 中文 空白): src屬性值即絕對路徑', async function() {
            let rel = `特 殊#%&'/x#y%z&w'.png`
            let r = await conv('special', [
                `![a](<${rel}>)`,
                '',
                `<img src="${rel}">`,
            ].join('\n'), opt, (fd) => {
                put(fd, rel)
            })
            let fp = path.join(r.fd, ...rel.split('/'))
            assert.strict.deepEqual(srcs(r.html), [fp, fp])
            assert.strict.equal(r.html.includes('&amp;'), true) //原始碼中之&已逸出
        })

        //規格§2.1: 檔名本身含實體樣式(&amp;)時, 屬性值須逸出為&amp;amp;, 使用者端解析後才是原檔名(不逸出則被解成&)
        it('檔名含實體樣式(&amp; &lt;)之路徑: 逸出後src屬性值仍為原檔名', async function() {
            let rel = 'a&amp;b&lt;c.png'
            let r = await conv('entity', `<img src="${rel}">`, opt, (fd) => {
                put(fd, rel)
            })
            assert.strict.deepEqual(srcs(r.html), [path.join(r.fd, rel)])
        })

        //規格§2.1: 屬性值內之"逸出(Windows檔名不可含", 僅於其他平台建檔)
        it('路徑含雙引號時屬性值逸出(僅非Windows)', async function() {
            if (isWin) {
                this.skip()
            }
            let rel = 'q"uote/x.png'
            let r = await conv('quote', `![a](<${rel}>)`, opt, (fd) => {
                put(fd, rel)
            })
            assert.strict.deepEqual(srcs(r.html), [path.join(r.fd, 'q"uote', 'x.png')])
        })

        //規格§2.1: 同一圖多處引用皆改寫
        it('同一圖於md語法與原始<img>多處引用皆改寫為同一絕對路徑', async function() {
            let r = await conv('dup', '![a](pics/a.png)\n\n<img src="pics/a.png">\n\n![b](pics/a.png)', opt, (fd) => {
                put(fd, 'pics/a.png')
            })
            let fp = path.join(r.fd, 'pics', 'a.png')
            assert.strict.deepEqual(srcs(r.html), [fp, fp, fp])
        })

        //規格§2.1: 不轉碼, 非本機圖不處理
        it('具通訊協定之網址(https:、data:)與協定相對網址不處理且不reject(md語法與原始<img>)', async function() {
            let data = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
            let md = [
                '![a](https://example.com/a.png)',
                '',
                `![b](${data})`,
                '',
                '![c](//example.com/c.png)',
                '',
                '<img src="https://example.com/d.png">',
                '',
                `<img src="${data}">`,
                '',
                '![e](#frag)',
                '',
                '![f]()',
            ].join('\n')
            let ex = ['https://example.com/a.png', data, '//example.com/c.png', 'https://example.com/d.png', data, '#frag', '']
            for (let b of [false, true]) {
                let r = await conv(`url-${b}`, md, { imgConvertToBase64: b })
                assert.strict.deepEqual(srcs(r.html), ex)
            }
        })

        //規格§2.2/§2.1: 只檢查輸出中實際引用之圖片(HTML註解內之<img>不進輸出)
        it('不進輸出之圖片引用(HTML註解內之<img>)不要求檔案存在', async function() {
            let r = await conv('comment', '<!-- <img src="gone.png"> -->\n\n<img src="ok.png">', opt, (fd) => {
                put(fd, 'ok.png')
            })
            assert.strict.deepEqual(srcs(r.html), [path.join(r.fd, 'ok.png')])
        })

        //規格§2.1: 內部佔位符不得與模板內文字衝突(模板內與佔位符同形之字串須原樣保留)
        it('自訂模板內與內部佔位符同形之src不被改寫', async function() {
            let tpl = '<html><body>{html}<img src="wmd2htmlimg0"></body></html>'
            let r = await conv('tpl-collide', '<img src="ok.png">', { ...opt, htmlTemp: tpl }, (fd) => {
                put(fd, 'ok.png')
            })
            assert.strict.deepEqual(srcs(r.html), [path.join(r.fd, 'ok.png'), 'wmd2htmlimg0'])
        })

        //規格§2.1: 不轉碼, 路徑模式不讀取圖片內容
        it('不讀取圖片內容(內容非圖片之檔亦照寫路徑)', async function() {
            let r = await conv('notimg', '![a](x.png)\n\n<img src="y.png">', opt, (fd) => {
                put(fd, 'x.png', Buffer.from('not an image'))
                put(fd, 'y.png', Buffer.from('not an image'))
            })
            assert.strict.deepEqual(srcs(r.html), [path.join(r.fd, 'x.png'), path.join(r.fd, 'y.png')])
        })

    })

    describe('圖片檔不存在一律reject並列出全部缺圖路徑', function() {

        //規格§2.2: 兩處(md語法圖、原始<img>行)與兩種模式皆reject, 訊息列出全部缺圖(絕對路徑), 不列存在者, 不寫出輸出檔
        for (let b of [false, true]) {
            it(`imgConvertToBase64=${b}: md語法圖與原始<img>缺圖皆列出, 存在者不列, 不寫出輸出檔`, async function() {
                let err = await convErr(`missing-${b}`, [
                    '![a](pics/miss1.png)',
                    '',
                    '![ok](pics/ok.png)',
                    '',
                    '<img src="pics/miss2.png">',
                    '',
                    '![c](<缺 圖/miss3.png>)',
                    '',
                    '<img src="pics/miss1.png">', //同一缺圖多處只列一次
                ].join('\n'), { imgConvertToBase64: b }, (fd) => {
                    put(fd, 'pics/ok.png')
                })
                let fd = path.join(fdBase, `missing-${b}`)
                for (let rel of ['pics/miss1.png', 'pics/miss2.png', '缺 圖/miss3.png']) {
                    assert.strict.equal(err.msg.includes(path.join(fd, ...rel.split('/'))), true, rel)
                }
                assert.strict.equal(err.msg.includes(path.join(fd, 'pics', 'ok.png')), false)
                assert.strict.equal(err.msg.split(path.join(fd, 'pics', 'miss1.png')).length - 1, 1) //只列一次
                assert.strict.equal(err.msg.startsWith('3 image file(s) do not exist'), true)
                assert.strict.equal(err.outExists, false)
            })
        }

    })

    describe('imgConvertToBase64=true 之base64內嵌與總量上限', function() {

        //規格(原行為): 預設true, md語法圖與原始<img>各圖重新編碼為PNG之data URL內嵌, 不留原路徑
        it('預設(true): md語法圖與原始<img>皆內嵌為PNG data URL(與wi.base64同), 同圖共用', async function() {
            let r = await conv('b64', '![a](pics/a.png)\n\n<img src="pics/a.png">\n\n![b](pics/c.svg)', {}, (fd) => {
                put(fd, 'pics/a.png')
                fs.copyFileSync('./test/cocktail.svg', path.join(fd, 'pics', 'c.svg'))
            })
            let ss = srcs(r.html)
            assert.strict.equal(ss.length, 3)
            let b64a = await wi.base64(path.join(r.fd, 'pics', 'a.png'), 'png')
            let b64c = await wi.base64(path.join(r.fd, 'pics', 'c.svg'), 'png')
            assert.strict.deepEqual(ss, [b64a, b64a, b64c])
            assert.strict.equal(r.html.includes('pics'), false)
        })

        //規格§2.3: 超過上限以明確訊息reject; 以稀疏檔(不實寫內容)產生足量之圖, 超過上限者於轉碼前即reject
        let convBig = async (md, n) => { //單一巨檔(位元組n, 檔名big.png)之案
            return convErr('b64-big', md, {}, (fd) => {
                let fh = fs.openSync(path.join(fd, 'big.png'), 'w')
                fs.ftruncateSync(fh, n)
                fs.closeSync(fh)
            })
        }
        let mb200 = 200 * 1024 * 1024

        it('圖片總量超過上限: reject, 訊息含張數, 總量, 上限與建議(imgConvertToBase64=false), 不寫出輸出檔', async function() {
            let err = await convBig('![a](big.png)', mb200)
            assert.strict.equal(/^images are too large to embed as base64 \(imgConvertToBase64=true\): 1 image file\(s\), 200\.0 MB, estimated \d+ chars of base64 data in one html string, over the limit of \d+ chars \([\d.]+ MB of base64 text, about [\d.]+ MB of image data\); set imgConvertToBase64=false to reference the image files by absolute path instead, or reduce the images$/.test(err.msg), true, err.msg)
            assert.strict.equal(err.outExists, false)
        })

        //規格§2.3: 門檻邊界(由訊息取得上限, 不複製常數); 恰於上限不因總量reject, 多1位元組(多1個base64字元組)reject
        it('上限邊界: 估算字元數等於上限者通過檢查(改因檔案非圖片而於轉碼失敗), 多一個字元組者reject', async function() {
            let err0 = await convBig('![a](big.png)', mb200)
            let limit = Number(/over the limit of (\d+) chars/.exec(err0.msg)[1])
            assert.strict.equal(limit % 4, 0)
            let n = (limit / 4) * 3 //估算 ceil(n/3)*4 = limit
            let errOk = await convBig('![a](big.png)', n)
            assert.strict.equal(errOk.msg.includes('too large'), false, errOk.msg) //通過總量檢查, 轉碼稀疏檔(非圖片)失敗
            let errNg = await convBig('![a](big.png)', n + 1)
            assert.strict.equal(errNg.msg.includes('too large'), true, errNg.msg)
            assert.strict.equal(errNg.msg.includes(`estimated ${limit + 4} chars`), true, errNg.msg)
        })

        //規格§2.3: 總量以輸出中之引用次數計(data URL逐處嵌入), 非以檔案數計
        it('同一圖多處引用逐處計入總量(單檔未超, 多處引用後超過)', async function() {
            let n = 3 * 1024 * 1024
            let md = Array.from({ length: 40 }, () => '<img src="big.png">').join('\n\n') //估算約4MiB*40=160MiB字元, 大於上限
            let err = await convBig(md, n)
            assert.strict.equal(err.msg.includes('too large'), true, err.msg)
            assert.strict.equal(err.msg.includes('1 image file(s), 3.0 MB'), true, err.msg)
            let err1 = await convBig('<img src="big.png">', n) //僅一處引用: 通過總量檢查
            assert.strict.equal(err1.msg.includes('too large'), false, err1.msg)
        })

        //規格§2.3: 重新編碼為PNG後可能遠大於原檔(JPG), 以實際長度再檢查
        it('原檔未超但重新編碼為PNG後之實際長度超過上限: 轉碼後reject(非估算)', async function() {
            let fdName = 'b64-jpg'
            let raw = crypto.randomBytes(1600 * 900 * 3)
            let jpg = await sharp(raw, { raw: { width: 1600, height: 900, channels: 3 } }).jpeg({ quality: 50 }).toBuffer()
            let md = Array.from({ length: 80 }, () => '<img src="n.jpg">').join('\n\n')
            let err = await convErr(fdName, md, {}, (fd) => {
                put(fd, 'n.jpg', jpg)
            })
            assert.strict.equal(/^images are too large to embed as base64 .*1 image file\(s\), [\d.]+ MB, \d+ chars of base64 data/.test(err.msg), true, err.msg)
            assert.strict.equal(err.msg.includes('estimated'), false, err.msg)
            assert.strict.equal(err.outExists, false)
        })

        //規格§2.3: 路徑模式不受總量上限限制
        it('imgConvertToBase64=false 不受總量上限限制(巨檔照寫路徑)', async function() {
            let r = await conv('path-big', '![a](big.png)', { imgConvertToBase64: false }, (fd) => {
                let fp = path.join(fd, 'big.png')
                let fh = fs.openSync(fp, 'w')
                fs.ftruncateSync(fh, mb200)
                fs.closeSync(fh)
            })
            assert.strict.deepEqual(srcs(r.html), [path.join(r.fd, 'big.png')])
        })

        //規格§2.3: 無本機圖者不受影響
        it('無本機圖(或僅網址圖)之md不受影響', async function() {
            let r = await conv('no-img', '# t\n\n文字\n\n![a](https://example.com/a.png)', {})
            assert.strict.deepEqual(srcs(r.html), ['https://example.com/a.png'])
        })

    })

    //原始<img>之src屬性解析(排程第173項): 雙引號, 單引號, 無引號與同行多個皆與md語法圖同一流程登記與填入
    //  修前: 只處理逐行恰一個src=", 同行兩個丟size(s)!==2, 單引號與無引號保持原值(路徑模式留相對路徑, base64模式不內嵌), data-src與他標籤之src被誤登記, 程式碼內之文字被登記或殘留佔位符
    describe('原始<img>之src屬性解析(引號形態, 同行多個, 屬性名稱, 語境)', function() {

        //各檔內容不同之1x1 PNG, 使base64模式下各圖之data URL可區分
        let pics = {}

        before(async function() {
            for (let [k, rgb] of Object.entries({ a: { r: 255, g: 0, b: 0 }, b: { r: 0, g: 255, b: 0 }, c: { r: 0, g: 0, b: 255 } })) {
                pics[k] = await sharp({ create: { width: 1, height: 1, channels: 3, background: rgb } }).png().toBuffer()
            }
        })

        let putPics = (fd) => {
            for (let k of ['a', 'b', 'c']) {
                put(fd, `pics/${k}.png`, pics[k])
            }
        }

        //各圖預期之src: 路徑模式為以案資料夾解析之絕對路徑, base64模式為wi.base64之data URL
        let expOf = async (fd, rels, b) => {
            let r = []
            for (let rel of rels) {
                let fp = path.join(fd, ...rel.split('/'))
                r.push(b ? await wi.base64(fp, 'png') : fp)
            }
            return r
        }

        //每一案於兩種模式各跑一次(同一流程填入: 路徑模式寫絕對路徑, base64模式內嵌)
        let eachMode = (title, fn) => {
            for (let b of [false, true]) {
                it(`imgConvertToBase64=${b}: ${title}`, async function() {
                    await fn(b)
                })
            }
        }

        //規格: src值為雙引號, 單引號或無引號皆登記(含等號兩側空白, 標籤與屬性名大小寫, 前後有其他屬性), 其他屬性保留
        eachMode('src為雙引號, 單引號, 無引號(含等號兩側空白, 大小寫, 前後有他屬性)皆登記並填入', async (b) => {
            let forms = [
                '<img src="pics/a.png">',
                '<img src=\'pics/a.png\'>',
                '<img src=pics/a.png>',
                '<img src=pics/a.png />',
                '<img src = \'pics/a.png\' >',
                '<IMG SRC=\'pics/a.png\'>',
                '<img alt="x" src=\'pics/a.png\' style="width:10px;">',
            ]
            let r = await conv(`form-${b}`, forms.join('\n\n'), { imgConvertToBase64: b }, putPics)
            assert.strict.deepEqual(srcs(r.html), await expOf(r.fd, forms.map(() => 'pics/a.png'), b))
            assert.strict.equal(r.html.includes('wmd2htmlimg'), false) //佔位符不殘留
            assert.strict.equal(attrsOf(r.html, 'alt')[6], 'x')
            assert.strict.equal(attrsOf(r.html, 'style')[6].includes('width:10px'), true)
        })

        //規格(缺陷): 同一行多個<img>不丟size(s)!==2, 各自登記(引號形態可混用, 同圖可重複)
        eachMode('同一行多個<img>(雙引號, 單引號, 無引號混用, 同圖重複)全部登記', async (b) => {
            let r = await conv(`multi-${b}`, [
                '<img src="pics/a.png"><img src=\'pics/b.png\'><img src=pics/c.png>',
                '',
                '<img src=\'pics/a.png\'> 文字 <img src=\'pics/a.png\'>',
            ].join('\n'), { imgConvertToBase64: b }, putPics)
            assert.strict.deepEqual(srcs(r.html), await expOf(r.fd, ['pics/a.png', 'pics/b.png', 'pics/c.png', 'pics/a.png', 'pics/a.png'], b))
        })

        //規格: md語法圖與原始<img>同一行混合, 依文字順序登記與填入
        eachMode('同一行md語法圖與原始<img>混合', async (b) => {
            let r = await conv(`mix-${b}`, '![x](pics/a.png) <img src=\'pics/b.png\'> ![y](pics/c.png) <img src="pics/a.png"> <img src=pics/b.png>', { imgConvertToBase64: b }, putPics)
            assert.strict.deepEqual(srcs(r.html), await expOf(r.fd, ['pics/a.png', 'pics/b.png', 'pics/c.png', 'pics/a.png', 'pics/b.png'], b))
        })

        //規格: 缺圖一律reject並列全部(含同行多個, 單引號, 無引號, md語法圖), 存在者不列
        eachMode('同行多個與各引號形態之缺圖一次列出全部, 存在者不列', async (b) => {
            let err = await convErr(`miss-${b}`, '<img src=\'pics/m1.png\'><img src=pics/m2.png><img src="pics/a.png"> ![z](pics/m3.png)', { imgConvertToBase64: b }, putPics)
            let fd = path.join(fdBase, `miss-${b}`)
            assert.strict.equal(err.msg.startsWith('3 image file(s) do not exist'), true, err.msg)
            for (let rel of ['pics/m1.png', 'pics/m2.png', 'pics/m3.png']) {
                assert.strict.equal(err.msg.includes(path.join(fd, ...rel.split('/'))), true, rel)
            }
            assert.strict.equal(err.msg.includes(path.join(fd, 'pics', 'a.png')), false)
            assert.strict.equal(err.outExists, false)
        })

        //規格: 屬性名稱須完整相等(data-src, alt內含src字樣皆不是src); 修前data-src使同行丟錯, alt內之src="…"被誤登記且佔位符殘留於alt
        eachMode('屬性名稱須完整相等: data-src與alt內之src字樣不干擾真正之src', async (b) => {
            let r = await conv(`attr-${b}`, [
                '<img data-src="lazy.png" src="pics/a.png">',
                '',
                '<img alt=\'my src="x.png"\' src=pics/b.png>',
                '',
                '<img alt="src=y.png" src=\'pics/c.png\'>',
            ].join('\n'), { imgConvertToBase64: b }, putPics)
            assert.strict.deepEqual(srcs(r.html), await expOf(r.fd, ['pics/a.png', 'pics/b.png', 'pics/c.png'], b))
            assert.strict.deepEqual(attrsOf(r.html, 'data-src'), ['lazy.png', null, null])
            assert.strict.deepEqual(attrsOf(r.html, 'alt'), [null, 'my src="x.png"', 'src=y.png'])
            assert.strict.equal(r.html.includes('wmd2htmlimg'), false)
        })

        //規格: 同一標籤有多個src時只取第一個(與html解析器一致)
        it('同一標籤有多個src: 只取第一個', async function() {
            let r = await conv('dup-src', '<img src=\'pics/a.png\' src="pics/b.png">', { imgConvertToBase64: false }, putPics)
            assert.strict.deepEqual(srcs(r.html), [path.join(r.fd, 'pics', 'a.png')])
        })

        //規格: 單引號值內可含雙引號, 雙引號值內可含單引號, 中文與空白; 缺檔訊息列出含雙引號之完整路徑(Windows無法建含"之檔名, 故以缺圖訊息驗證)
        it('src值內含另一種引號, 中文與空白: 單引號值含"之路徑完整列於缺圖訊息, 其餘照填', async function() {
            let err = await convErr('quote-miss', '<img src=\'q"x.png\'>', { imgConvertToBase64: false })
            assert.strict.equal(err.msg.includes(path.join(fdBase, 'quote-miss', 'q"x.png')), true, err.msg)
            let r = await conv('quote-ok', '<img src=\'圖 資料夾/圖 c.png\'>\n\n<img src="pics/it\'s.png">', { imgConvertToBase64: false }, (fd) => {
                put(fd, '圖 資料夾/圖 c.png')
                put(fd, 'pics/it\'s.png')
            })
            assert.strict.deepEqual(srcs(r.html), [path.join(r.fd, '圖 資料夾', '圖 c.png'), path.join(r.fd, 'pics', 'it\'s.png')])
        })

        //規格: 標籤屬性可跨行(屬性在不同行, 無引號與雙引號)
        eachMode('標籤屬性跨行', async (b) => {
            let r = await conv(`line-${b}`, '<img\n  alt=\'x\'\n  src=pics/a.png>\n\n<img\n src="pics/b.png"\n alt="y">', { imgConvertToBase64: b }, putPics)
            assert.strict.deepEqual(srcs(r.html), await expOf(r.fd, ['pics/a.png', 'pics/b.png'], b))
        })

        //規格: 非本機圖(網址, //, #, 空值, 無值, data:)於單引號與無引號寫法亦不處理不reject
        eachMode('非本機圖(單引號與無引號之網址, //, #, 空值, 無值, data:)不處理且不reject', async (b) => {
            let data = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
            let r = await conv(`url-${b}`, [
                '<img src=\'https://example.com/d.png\'>',
                '',
                '<img src=//example.com/c.png>',
                '',
                '<img src=#frag>',
                '',
                '<img src=\'\'>',
                '',
                '<img src>',
                '',
                `<img src='${data}'>`,
            ].join('\n'), { imgConvertToBase64: b })
            assert.strict.deepEqual(srcs(r.html), ['https://example.com/d.png', '//example.com/c.png', '#frag', '', '', data])
        })

        //規格: HTML註解內之<img>(單引號, 無引號, 多個)不登記, 不要求檔案存在
        it('HTML註解內之<img>(單引號, 無引號, 同行多個)不登記不reject', async function() {
            let r = await conv('cmt', '<!-- <img src=\'gone1.png\'><img src=gone2.png> -->\n\n<img src=pics/a.png>', { imgConvertToBase64: false }, putPics)
            assert.strict.deepEqual(srcs(r.html), [path.join(r.fd, 'pics', 'a.png')])
        })

        //規格: 只處理<img>標籤; 修前其他標籤之src(如video)被當圖片登記而缺檔reject(base64模式則轉PNG失敗)
        eachMode('非<img>標籤之src(video)不處理, 缺檔不reject', async (b) => {
            let r = await conv(`vid-${b}`, '<video src="clip.mp4"></video>\n\n<img src=\'pics/a.png\'>', { imgConvertToBase64: b }, putPics)
            assert.strict.deepEqual(attrsOf(r.html, 'src', 'video'), ['clip.mp4'])
            assert.strict.deepEqual(srcs(r.html), await expOf(r.fd, ['pics/a.png'], b))
        })

        //規格: 程式碼區塊與行內程式碼內之文字不是圖片引用: 不登記(缺檔不reject), 輸出文字原樣, 無佔位符殘留; 修前雙引號者缺檔reject或殘留佔位符
        eachMode('程式碼區塊與行內程式碼內之<img>文字不登記不改寫', async (b) => {
            let r = await conv(`code-${b}`, '正文 `<img src=z.png>` 結尾\n\n```html\n<img src="x.png">\n<img src=\'y.png\'>\n```', { imgConvertToBase64: b })
            assert.strict.deepEqual(srcs(r.html), [])
            assert.strict.equal(r.html.includes('wmd2htmlimg'), false)
            let { window } = new JSDOM(r.html)
            let txt = Array.from(window.document.querySelectorAll('code')).map((el) => el.textContent).join('\n')
            window.close()
            for (let s of ['<img src=z.png>', '<img src="x.png">', '<img src=\'y.png\'>']) {
                assert.strict.equal(txt.includes(s), true, s)
            }
        })

        //規格: 表格(表頭與儲存格), 清單, 引用區塊, 連結, 註腳內之行內<img>(單引號, 無引號, 雙引號)皆登記並填入(註腳於輸出末尾)
        eachMode('表格表頭與儲存格, 清單, 引用區塊, 連結, 註腳內之原始<img>', async (b) => {
            let r = await conv(`ctx-${b}`, [
                '| <img src="pics/c.png"> |',
                '|---|',
                '| <img src=\'pics/a.png\'> |',
                '',
                '- <img src=pics/b.png>',
                '',
                '> <img src="pics/c.png"> 引用',
                '',
                '[<img src=\'pics/a.png\'>](https://example.com)',
                '',
                '註腳[^1]',
                '',
                '[^1]: 註 <img src=pics/a.png>',
            ].join('\n'), { imgConvertToBase64: b }, putPics)
            assert.strict.deepEqual(srcs(r.html), await expOf(r.fd, ['pics/c.png', 'pics/a.png', 'pics/b.png', 'pics/c.png', 'pics/a.png', 'pics/a.png'], b))
        })

        //規格: 圖題與同行多個<img>並存時, 交叉引用取代為圖號且各圖皆填入(圖表編號與圖片引用協同)
        it('圖題與同行多個單引號/無引號<img>並存: {圖名}取代為圖號, 兩圖皆填入', async function() {
            let r = await conv('figref', '如{兩圖}所示。\n\n<div style="text-align:center;"><img src=\'pics/a.png\' /><img src=pics/b.png /><div>圖n 兩圖</div></div>', { imgConvertToBase64: false }, putPics)
            assert.strict.deepEqual(srcs(r.html), [path.join(r.fd, 'pics', 'a.png'), path.join(r.fd, 'pics', 'b.png')])
            assert.strict.equal(r.html.includes('如圖1所示'), true)
            assert.strict.equal(r.html.includes('{兩圖}'), false)
        })

    })

})
