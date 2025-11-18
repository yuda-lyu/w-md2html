
import * as cheerio from 'cheerio'


let htmlClean = (html) => {
    let $ = cheerio.load(html)
    $('[style*="display:none"]').remove()
    return $.html()
}


export default htmlClean
