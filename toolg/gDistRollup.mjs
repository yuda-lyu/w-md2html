import rollupFiles from 'w-package-tools/src/rollupFiles.mjs'
import getFiles from 'w-package-tools/src/getFiles.mjs'


let fdSrc = './src'
let fdTar = './dist'


rollupFiles({
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
    ],
})

