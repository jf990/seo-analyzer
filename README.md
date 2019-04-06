# SEO Analyzer

Analyze and score a directory of web pages for SEO.

This project is designed to crawl a sub-folder of a web site and score the pages for SEO. There are some general rules, such as looking at title, description, keywords, and making a general determination if they are strong SEO-wise. As this utility scans a site, pages on the site are scored while any links that go off the site are only checked if they are valid (404.)

Run this utility by updating the configuration file or providing command line options, or some combination of both. Anything specified on the command line will override anything in the configuration file.

It is best to run this on a sub-section of a website. While you could run it from /, doing that could be very slow and potentially crash the app due to memory exhaustion if the site has a lot of pages and links. A better method is to chunk the site by sub-folder and analyze a section at a time.

## Configuration file options

See `config.yaml`

`protocol`: force protocol when we don't know (e.g. use https when encountering a // URL)
`host`: specify host to crawl (required)
`startPage`: specify start path on host to crawl (required)
`subPathOnly`: only score pages under start path. If not specified will attempt to crawl all pages found, and this is very dangerous. Default is true.
`saveToCSV`: path to file name to save results in CSV file (leave empty to not save)
`showReport`: show final report to stdout. Default is false.
`debug`: turn on debugging. Default is false.

## Command line options

--help             Show help
--version          Show version number
-c, --conf         path to configuration file (must be a YAML formated file)
-h, --host         specify host to crawl (required)
-p, --startpage    specify start path on host to crawl (required)
-o, --savetocsv    path to file name to save results in CSV file (leave empty to not save)
-d, --debug        turn on debugging. Default is false.
-l, --protocol     force protocol when we don't know (e.g. use https when encountering a // URL)
-a, --subpathonly  only score pages under start path. If not specified will attempt to crawl all pages found, and this is very dangerous. Default is true.
-r, --showreport   show final report to stdout. Default is false.
