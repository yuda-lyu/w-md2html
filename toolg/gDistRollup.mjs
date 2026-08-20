import rollupFiles from 'w-package-tools/src/rollupFiles.mjs'
import rollupFile from 'w-package-tools/src/rollupFile.mjs'
import getFiles from 'w-package-tools/src/getFiles.mjs'


let fdSrc = './src'
let fdTar = './dist'


async function rp() {

    await rollupFiles({ //rollupFiles預設會clean folder
        fns: 'WMd2html.mjs',
        fdSrc,
        fdTar,
        hookNameDist: () => 'w-md2html',
        // nameDistType: 'kebabCase', //直接由hookNameDist給予
        globals: {
            'path': 'path',
            'fs': 'fs',
            'sharp': 'sharp',
            'highlight.js': 'highlight.js',
            'marked': 'marked',
            'marked-katex-extension': 'marked-katex-extension',
            'marked-footnote': 'marked-footnote',
            'marked-highlight': 'marked-highlight',
            'cheerio': 'cheerio',
            'jsdom': 'jsdom',
        },
        external: [
            'path',
            'fs',
            'sharp',
            'highlight.js',
            'marked',
            'marked-katex-extension',
            'marked-footnote',
            'marked-highlight',
            'cheerio',
            'jsdom',
        ],
    })

    await rollupFile({
        fn: 'md2html.mjs',
        fdSrc,
        fdTar,
        hookNameDist: () => 'md2html',
        // nameDistType: 'kebabCase', //直接由hookNameDist給予
        globals: {
            'path': 'path',
            'fs': 'fs',
            'sharp': 'sharp',
            // 'highlight.js': 'highlight.js', //給瀏覽器直接用
            // 'marked': 'marked', //給瀏覽器直接用
            // 'marked-katex-extension': 'marked-katex-extension', //給瀏覽器直接用
            // 'marked-footnote': 'marked-footnote', //給瀏覽器直接用
            // 'marked-highlight': 'marked-highlight', //給瀏覽器直接用
            'cheerio': 'cheerio',
            'jsdom': 'jsdom',
        },
        external: [
            'path',
            'fs',
            'sharp',
            // 'highlight.js', //給瀏覽器直接用
            // 'marked', //給瀏覽器直接用
            // 'marked-katex-extension', //給瀏覽器直接用
            // 'marked-footnote', //給瀏覽器直接用
            // 'marked-highlight', //給瀏覽器直接用
            'cheerio',
            'jsdom',
        ],
    })

}
rp()
    .catch((err) => {
        console.log(err)
    })

