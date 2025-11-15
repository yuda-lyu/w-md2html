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
