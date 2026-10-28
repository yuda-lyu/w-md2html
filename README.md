# w-md2html
A tool for Markdown to Html.

![language](https://img.shields.io/badge/language-JavaScript-orange.svg) 
[![npm version](http://img.shields.io/npm/v/w-md2html.svg?style=flat)](https://npmjs.org/package/w-md2html) 
[![license](https://img.shields.io/npm/l/w-md2html.svg?style=flat)](https://npmjs.org/package/w-md2html) 
[![npm download](https://img.shields.io/npm/dt/w-md2html.svg)](https://npmjs.org/package/w-md2html) 
[![npm download](https://img.shields.io/npm/dm/w-md2html.svg)](https://npmjs.org/package/w-md2html) 
[![jsdelivr download](https://img.shields.io/jsdelivr/npm/hm/w-md2html.svg)](https://www.jsdelivr.com/package/npm/w-md2html)

## Documentation
To view documentation or get support, visit [docs](https://yuda-lyu.github.io/w-md2html/global.html).

## Example
To view some examples for more understanding, visit examples:
> **convertCoordinate:** [ex-md2html.html](https://yuda-lyu.github.io/w-md2html/examples/ex-md2html.html) [[source code](https://github.com/yuda-lyu/w-md2html/blob/master/docs/examples/ex-md2html.html)]

## Upgrade Notes

### Breaking changes after 1.1.11：本機圖片之引用（路徑模式、缺圖 reject、base64 總量上限）

**破壞性變更**（`WMd2html`；不保留舊行為，下游須連帶修正）。
- **`imgConvertToBase64: false`：md 語法圖與原始 `<img src="…">` 行之本機圖，一律改寫為以 md 所在資料夾解析之絕對路徑**（Windows 為反斜線形式，如 `C:\docs\圖 資料夾\a b.png`；路徑原樣寫入，不做百分比編碼，僅逸出屬性值內之 `& " < >`），不讀取、不轉碼。Word 只能解析反斜線絕對路徑，正斜線絕對路徑與百分比編碼皆不可解析，故不採用。輸出之 html 含本機路徑而不可攜，僅供同機之後續處理（如轉 Word 之中介 html）；要自足 html 請用預設（`true`）。過去：md 語法圖保留原 `href`，原始 `<img>` 行不受此選項控制，仍被轉為 base64（給 `false` 仍可能因字串過長而失敗）。
- **路徑模式下 SVG 與 JPG 保持原檔**：不再經 `sharp` 重新編碼（過去 SVG 以 96 dpi 點陣化為 PNG、JPG 轉為 PNG），由後續處理讀取原檔（轉 Word 時 SVG 以向量、JPG 以原檔內嵌）。DPI 不為 96 之 JPG，Word 依 96 dpi 計顯示尺寸，與瀏覽器之 CSS px 一致（過去轉 PNG 時保留原 DPI，顯示尺寸不同）。
- **圖片檔不存在一律 reject**（兩種模式；md 語法圖與原始 `<img>` 行皆然）：訊息為 `N image file(s) do not exist:` 之後逐行列出全部缺圖之絕對路徑（同一缺圖只列一次）。過去 md 語法圖缺圖只 `console.log` 後保留原 `href`，原始 `<img>` 行缺圖則丟出只含第一個缺圖之錯誤。只檢查輸出中實際引用之圖（如 HTML 註解內之 `<img>` 不進輸出，不檢查）。
- **本機圖一律以 md 所在資料夾解析**（絕對路徑照用）：過去原始 `<img>` 行先以工作目錄（cwd）解析，cwd 下恰有同名檔時會誤用。`%XX` 不解碼，檔名須與引用之字面一致。
- **非本機圖不處理、不 reject**：具通訊協定之網址（`https:`、`data:`、`file:` 等）、協定相對網址（`//host/x.png`）、錨點（`#x`）與空值維持原樣（過去原始 `<img>` 行遇網址會丟 `fp[…] does not exist`，md 語法圖則 `console.log` 後保留）。
- **`imgConvertToBase64: true`（預設）：圖片總量過大時明確 reject**：轉換前依原檔大小估算內嵌之 base64 字元總量（同一圖多處引用逐處計），超過上限（2^27 字元＝134,217,728，約 96 MiB 之 PNG）即 reject，訊息指出張數、檔案總量、估算字元數、上限與「改用 `imgConvertToBase64: false` 或減少圖片」；轉碼後再依實際長度檢查一次（JPG、SVG 重新編碼為 PNG 後可能遠大於原檔）。過去超過約 80～100 MB（預設堆積）時行程直接中止（離開碼 134，呼叫端收不到 reject）或丟出 `Invalid string length`（訊息指向 marked）。未超過上限者之輸出與過去逐字相同（各圖重新編碼為 PNG 內嵌）。
- **處理方式之改變（輸出不變）**：圖片改為先登記、待 md 轉 html 完成後才寫入 `src`，base64 資料不再經過 marked、DOMPurify 與 jsdom（過去其記憶體約為 html 字元數之 35 倍）。實測 150 張（82 MB）之 md 轉換，峰值 RSS 由約 4294 MB 降為 649 MB。
- **遷移**：依賴 `imgConvertToBase64: false` 保留相對路徑者（例如把輸出 html 放在別處再載入）須改為預設 `true`，或自行處理路徑；缺圖由「記錄後繼續」改為 reject，呼叫端須處理；下游 w-md2docx 以 `imgConvertToBase64: false` 產生中介 html、並由 w-html2docx 內嵌圖片（另案連動）。已知限制（與本版前相同）：同一行寫兩個以上 `<img src="…">` 仍會丟 `size(s)!==2`；原始 `<img>` 只處理雙引號之 `src="…"`（單引號與無引號寫法不處理）。

### Behavior change after 1.1.9：圖題與 `<img>` 同一行時圖表名之取法，以及對不上圖表名之 `{…}` 警告

**行為變更**（`WMd2html`，兩處）。
- **圖題與 `<img>` 同一行時圖表名之取法**：過去單行寫法之圖表名會被併入 `<img>` 轉成之文字（如 `[pics/a.png]`），與內文之 `{圖名}` 對不上，引用靜默不取代、原樣留在輸出；本版起取名前先移除同一行中有 `src`（值非空）之 `<img>`（屬性值可含 `>`；包在 `<a href>` 內者連同變空的連結一併移除），單行與多行寫法得到相同之圖表名與編號，引用皆取代。沒有 `src`（含 `src` 為空）之 `<img>` 維持過去行為（其 `alt` 視為文字）；不含有 `src` 之 `<img>` 的行，取名與過去逐字相同。若「圖n」只出現在被移除之 `<img>` 的屬性內（例如 `<img alt="圖n" src="…">`），該行不視為圖題、不登記圖表名（仍佔用編號，同過去）。
- **轉換後輸出中仍殘留對不上任何圖表名之 `{…}` 時輸出警告**：以 `console.log` 輸出一行 `warning: N reference(s) match no figure/table name: {a}, {b}`（重複者只列一次、依輸出內首次出現順序），轉換照常完成，回傳值仍為 `'ok'`、輸出檔照常寫出，不增加選項。判準是「輸出的可見文字中仍有 `{…}`」：程式碼區塊與行內程式碼（輸出為 `<pre>`、`<code>`）、數學式內之大括號不檢查；模板符號 `{title}`（隨後會被換成檔名）不列；連結 title、圖片 alt 等屬性值不是可見文字不檢查；以反斜線逸出之 `\{x\}` 在輸出中是可見文字，會列出；被 Markdown 修飾字元包住者（`{**x**}`）列其可見文字（`{x}`）；跨行（含跨段落、跨區塊、跨行內碼）之大括號不檢查，巢狀大括號列最內層；以 HTML 元素種類判定區塊邊界，不依 CSS 實際顯示（如 `display:inline` 之 `div`）。
- **影響與遷移**：多行寫法之輸出不變。單行寫法過去殘留於輸出之 `{圖名}` 自此被取代為圖號；若您依賴「輸出中仍有 `{…}`」做檢查，請改依警告。正文中本就含大括號者（例如以 `{n}` 說明語法而未用反引號包住）會多一行警告，不影響輸出，可改用行內程式碼 `` `{n}` `` 避免。已知限制（與本版前相同）：以 Markdown 修飾字元包住整個圖題（`**圖n 名**`）、圖題後同行另有區塊文字、圖題後同行之 Markdown 圖片語法或連結、圖題文字本身包在連結內（圖表名會帶 `[連結位址]`）、`<img>` 標籤之屬性跨多行，其文字仍會併入圖表名（對不上時由警告列出），請改以 HTML 寫圖題並將 `<img>` 寫在同一行內；同一行寫兩個以上 `<img src="…">` 仍會於轉 Base64 時丟錯（`size(s)!==2`），請將圖片分行。

## Figure and Table Numbering

`WMd2html` 於轉換前先為圖題、表題自動編號並解析內文交叉引用：

- 圖題、表題以「圖n」「表n」開頭（可包在 `<div>` 等標籤內），依出現順序編為「圖1」「圖2」…、「表1」「表2」…（圖、表各自獨立計數）。
- 圖表名＝「圖n」「表n」之後之文字（去頭尾空白）；內文以 `{圖表名}` 引用，轉換時取代為對應編號（含前向引用與重複引用）。
- 圖片與圖題可寫在同一行或分多行，兩種寫法得到相同之圖表名與編號。
- 轉換後輸出之可見文字中仍對不上任何圖表名之 `{…}`（程式碼區塊、行內程式碼、數學式除外）會以 `console.log` 輸出警告並列出該字串，轉換不中斷，回傳值不變。

```alias
單行之架構如{單行圖}所示，多行之架構如{多行圖}所示。

<div style="text-align:center;"><img src="pics/a.png" /><div>圖n 單行圖</div></div>

<div style="text-align:center;">
    <img src="pics/a.png" />
    <div>圖n 多行圖</div>
</div>
```

## Installation

### Using npm(ES6 module):
```alias
npm i w-md2html
```

#### Example:
> **Link:** [[dev source code](https://github.com/yuda-lyu/w-md2html/blob/master/g.mjs)]
```alias
import w from 'wsemi'
import WMd2html from './src/WMd2html.mjs'
//import WMd2html from 'w-md2html/src/WMd2html.mjs'
//import WMd2html from 'w-md2html'

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
```
