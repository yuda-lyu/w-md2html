import fs from 'fs'
import toLower from 'lodash-es/toLower.js'
import getFileNameExt from 'wsemi/src/getFileNameExt.mjs'
import svg2png from './svg2png.mjs'


let getFileB64 = (fp) => {
    let bitmap = fs.readFileSync(fp)
    return Buffer.from(bitmap).toString('base64')
}

let cvExtToMime = (ext) => {
    ext = toLower(ext)
    if (ext === 'png') return 'image/png'
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
    if (ext === 'gif') return 'image/gif'
    if (ext === 'svg') return 'image/svg+xml'
    if (ext === 'webp') return 'image/webp'
    return 'application/octet-stream'
}

let bitmap2b64 = async(fp) => {

    //ext
    let ext = getFileNameExt(fp)

    //b64
    let b64 = getFileB64(fp)

    //mime
    let mime = cvExtToMime(ext)

    //pb64
    let pb64 = `data:${mime};base64,${b64}`
    // console.log(fp, 'b64', b64)

    return pb64
}

let svg2b64 = async (fp) => {

    //pb64
    let pb64 = await svg2png(fp, { returnBase64: true })

    return pb64
}

let readPicB64 = async (fp) => {

    //ext
    let ext = getFileNameExt(fp)

    //pb64
    let pb64 = ''
    if (ext === 'svg') {
        pb64 = await svg2b64(fp)
    }
    else {
        pb64 = await bitmap2b64(fp)
    }

    return pb64
}


export default readPicB64
