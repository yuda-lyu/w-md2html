import assert from 'assert'
import htmlConvert from '../src/htmlConvert.mjs'


describe('htmlConvert', function() {

    let zwsp = String.fromCharCode(0x200B) //零寬空格 U+200B

    it('空 div[for=br] 於 div 內插入單一 U+200B 佔位', function() {
        let out = htmlConvert('<div for="br"></div>')
        let m = out.match(/<div for="br">([\s\S]*?)<\/div>/)
        assert.strict.equal(m[1], zwsp)
    })

    it('帶 style 的空 div[for=br] 同樣插入(屬性順序無關)', function() {
        let out = htmlConvert('<div style="text-align:center;" for="br"></div>')
        assert.strict.equal(out.includes(zwsp), true)
    })

    it('有內容的 div[for=br] 不被覆蓋', function() {
        let out = htmlConvert('<div for="br">x</div>')
        assert.strict.equal(out.includes(zwsp), false)
    })

    it('無 for=br 的空 div 不受影響', function() {
        let out = htmlConvert('<div></div>')
        assert.strict.equal(out.includes(zwsp), false)
    })

})
