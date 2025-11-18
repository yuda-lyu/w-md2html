
import * as cheerio from 'cheerio'


let htmlRemovePInLi = (html) => {
    //因寬鬆清單會於li內產生p元素, 此再轉至docx時會變成使用內文樣式, 無法沿用清單樣式, 故統一刪除各層li下之p元素

    let $ = cheerio.load(html, { decodeEntities: false })

    $('li > p').each((i, el) => {
        let $p = $(el)
        let content = $p.html() // 只取內容，不含 <p>

        $p.replaceWith(content) // 用內容取代 p 標籤
    })

    return $.html()
}


export default htmlRemovePInLi
