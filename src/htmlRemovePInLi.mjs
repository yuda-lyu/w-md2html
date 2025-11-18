
import * as cheerio from 'cheerio'


let htmlRemovePInLi = (html) => {

    let $ = cheerio.load(html, { decodeEntities: false })

    $('li > p').each((i, el) => {
        let $p = $(el)
        let content = $p.html() // 只取內容，不含 <p>

        $p.replaceWith(content) // 用內容取代 p 標籤
    })

    return $.html()
}


export default htmlRemovePInLi
