import fs from 'fs'
import w from 'wsemi'
import assert from 'assert'
import WMd2html from '../src/WMd2html.mjs'


describe('WMd2html', function() {

    let fpOutTrue = `./test/reportTrue.html`

    let fpIn = `./test/report.md`
    let fpOut = `./test/report.html`
    let opt = {
        // funProcFpOut: (msg) => {
        //     console.log('msg', msg)
        //     return msg.fpOut
        // },
    }

    it('convert', async function() {
        await WMd2html(fpIn, fpOut, opt)
        let r = fs.readFileSync(fpOut, 'utf8')
        let rr = fs.readFileSync(fpOutTrue, 'utf8')
        w.fsDeleteFile(fpOut)
        assert.strict.deepEqual(r, rr)
    })

})
