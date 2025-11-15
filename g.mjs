import w from 'wsemi'
// import WMd2html from './src/WMd2html.mjs'
//import WMd2html from 'w-md2html/src/WMd2html.mjs'
//import WMd2html from 'w-md2html'
import WMd2html from './dist/w-md-2-html.umd.js'


async function test() {

    let fpIn = `./test/report.md`
    let fpOut = `./test/report.html`
    let opt = {
        imgWidthMax: '500px',
        funProcFpOut: (msg) => {
            console.log('msg', msg)
            return msg.fpOut
        },
    }

    let r = await WMd2html(fpIn, fpOut, opt)
    console.log(r)
    // => ok

    w.fsDeleteFile(fpOut)

}
test()
    .catch((err) => {
        console.log('catch', err)
    })


//node g.mjs
