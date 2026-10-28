# 狀態(現況)

本檔記當前已開發功能之最新狀態:各功能做到哪裡、對應之規則帳本條目與測試檔、已知缺口與待辦、最近一次驗證或發布之版本.只記現況,不寫過程(過程寫入 `sgud/exp/experience.md`).接續工作先讀本檔.

## 版本與驗證

- 套件版本:`package.json` 為 1.1.11(本輪不改).發布由使用者/主控處理.
- 最近一次驗證:2026-10-29 `npm test` 76 passing、1 pending(含新增 `test/unit-imgPath.test.mjs` 21 條,pending 1 條為路徑含 `"` 之案,Windows 無法建此檔名);`npx eslint src/WMd2html.mjs test/unit-imgPath.test.mjs` 無輸出;變異驗證 31 種殺 30(存活者即上述 `"` 逸出),見規則帳本 R-IMGREF-01.
- 未發布之變更(自 1.1.11 起):本機圖片引用之處理(見下表「本機圖片引用」,破壞性,README〈Breaking changes after 1.1.11〉已寫);`dist/` 未重建(發布時自動產製).下游 w-html2docx(斷開連結內嵌,須先發)、w-md2docx(最後,以 `imgConvertToBase64:false` 取中介 html)為另案連動,本套件不改.

## 功能現況

| 功能 | 做到哪裡 | 規則帳本 | 測試 |
|---|---|---|---|
| Markdown 轉 HTML(`src/md2html.mjs`,瀏覽器與 Node 共用) | 完成:marked + KaTeX + highlight.js + footnote,DOMPurify 清洗(移除 `<style>`),DOM 後處理(display:none、data-for=br/tab、linkBlank、表格置中) | R-CSS-01、R-DEP-01、R-BUILD-01、R-SYNTAX-01、R-SANITIZE-01 | `test/md2html.test.mjs`、`test/unit-md2html-deps.test.mjs` |
| Markdown 檔轉 HTML 檔(`src/WMd2html.mjs`,Node) | 完成:讀檔、圖表編號、本機圖片引用(見下列)、套模板、Footnotes 標題隱藏、li 間距、輸出檔名函數 | R-TEST-01 | `test/WMd2html.test.mjs`(逐字比對 `test/reportTrue.html`)、`test/unit-md2html-deps.test.mjs` |
| 本機圖片引用(`WMd2html` 之 `regImg`、`cvPicRef`、`fillImgs`)(2026-10-29) | 完成:md 語法圖與原始 `<img src="">` 行之本機圖先登記為佔位符,md2html 完成後才寫入 `src`(DOMPurify 會移除 `C:\` 絕對路徑之 src,base64 亦不再進 DOM);`imgConvertToBase64:false` 寫入以 md 所在資料夾解析之絕對路徑(Windows 反斜線,不轉碼不編碼);缺圖兩處兩模式皆 reject 並列全部路徑;`true` 時 base64 字元總量上限 `IMG_BASE64_MAX_CHARS`=2^27(預檢估算+轉碼後實際長度);網址/`data:`/`//`/`#`/空值不處理 | R-IMGREF-01 | `test/unit-imgPath.test.mjs`(21+1 pending) |
| 圖表編號與交叉引用(`WMd2html` 之 `cvItemNum`) | 完成:「圖n」「表n」依出現順序編號(圖、表各自計數),內文 `{圖表名}` 取代為編號;圖題與有 src 之 `<img>` 同行時圖表名只取圖題文字(單行與多行寫法一致,`getItemName` 只移除有 src 之 img,其餘與修前相同);寫檔前最終輸出之可見文字中仍對不上之 `{…}` 以 console.log 警告(`getUnresolvedRefs`,以最終 HTML 經 jsdom 判定,排除 code/pre/數學式/style/script)(2026-10-25) | R-FIGREF-01 | `test/genNumForPicAndTab.test.mjs`(4)、`test/unit-genNumRefs.test.mjs`(17) |
| 範例頁(`examples/ex-md2html.html`) | 完成,內容與 `test/report.md` 逐字一致 | R-EXAMPLE-01 | 無自動化,Playwright 開頁驗收 |

## 已知缺口與待辦

- 圖表名限制(與修前相同,見 R-FIGREF-01):圖題以 Markdown 修飾字元包住(`**圖n 名**`)或位於標題/清單/表格列/連結內、圖題後同行另有區塊文字、圖題後同行之 Markdown 圖片語法或連結文字,圖表名會含多餘字元而對不上(由警告列出);取代作用於整份 md 字串(含程式碼區塊內之 `{圖名}`);純 `圖n`(無名)使內文 `{}` 被取代成編號;同一行兩個 `<img src>` 使 `cvPicRef` 丟 `size(s)!==2`(皆既有,範圍外未修);`<img>` 標籤屬性跨多行時,圖題行只見標籤尾端,其前綴併入圖表名(`cvItemNum` 逐行處理,已知限制).
- 圖表名另有畸形或罕見寫法之已知限制(見 R-FIGREF-01):`href` 內含「圖n」、連結同時包住圖片與圖題文字(名帶 `[href]`)、`<img 'src=x'>` 類畸形屬性.
- 警告以最終輸出之可見文字為準:逸出之 `\{x\}` 列出、屬性值(alt/title/href)不檢查、軟換行折疊為空白;區塊邊界依元素種類不依 CSS 實際顯示,`<slot>`/svg `<tspan>`、`textarea`、`hidden`、svg `<defs>`、`<input value>`、註腳標號 CSS 方括號等為已知限制(見 R-FIGREF-01).
- 本機圖片引用之已知限制(見 R-IMGREF-01):原始 `<img>` 只處理雙引號 `src="…"`(單引號/無引號不處理、保持相對路徑),且逐行不分語境(程式碼區塊內之 `src="x.png"` 文字亦被登記,缺檔即 reject);`%XX` 不解碼;路徑含 `"` 之逸出測試於 Windows 為 pending(Ubuntu CI 才跑);上限 2^27 字元為保守值(實測 4288MB 預設堆積下 4.36 億字元仍通過,見規則帳本),未經裁示不提高;路徑含 `# % %20 & '` 時 Word(16)已實測可解析(規則帳本「Word 探測」)。
- `test/report.md` 第 140 行標題含正文 `{n}`,轉換時印出一行警告(屬實,不影響比對).
- 瀏覽器端 bundle 與下游 bundler 以 src 匯入之路徑無自動化測試(見規則帳本〈已知限制〉).
- md2html 與 WMd2html 不對稱、`toolg/gDistRollup.mjs` 未使用 import、`genNumForPicAndTab` 測試以 `./tmp` 為暫存:見規則帳本〈已知限制〉(既有,範圍外).

## 下游與依賴

- 下游:主系統(rddmanager)之 `genDocx_R00.01.mjs`、`_docs/M01.成果報告/*/src/genMd.mjs`(已先改多行寫法因應,修正後單行寫法亦可);w-md2docx;w-web-api。
- 自有依賴 wsemi(`html2str`、`replace` 等)與 w-image-proc(`base64`)由開發者統籌升版,本套件不補裝.
