
import * as cheerio from 'cheerio'


let cleanHtml = (html) => {
    const $ = cheerio.load(html)
    $('[style*="display:none"]').remove()
    return $.html()
}


export default cleanHtml
