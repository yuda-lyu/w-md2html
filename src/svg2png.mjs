import fs from 'fs'
import get from 'lodash-es/get.js'
import isnum from 'wsemi/src/isnum.mjs'
import isbol from 'wsemi/src/isbol.mjs'
import cdbl from 'wsemi/src/cdbl.mjs'
import sharp from 'sharp'


let svg2png = async(fp, opt = {}) => {

    //density
    let density = get(opt, 'density')
    if (!isnum(density)) {
        density = 96 //96dpi與瀏覽器比例一致
    }
    density = cdbl(density)

    //returnBase64
    let returnBase64 = get(opt, 'returnBase64')
    if (!isbol(returnBase64)) {
        returnBase64 = false
    }

    let b = fs.readFileSync(fp)

    let buf = await sharp(b, { density })
        .png()
        .toBuffer()

    let r = buf
    if (returnBase64) {
        let b64 = 'data:image/png;base64,' + buf.toString('base64')
        r = b64
    }

    return r
}


export default svg2png
