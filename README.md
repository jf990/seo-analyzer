# SEO Analyzer

Analyze and score a directory of web pages for SEO.

This project is designed to crawl a sub-folder of a web site and score the pages for SEO. There are some general rules, such as looking at title, description, keywords, and making a general determination if they are strong SEO-wise. As this utility scans a site, pages on the site are scored while any links that go off the site are only checked if they are valid (404.)

Run this utility by updating the configuration file or providing command line options, or some combination of both. Anything specified on the command line will override anything in the configuration file.

It is best to run this on a sub-section of a website. While you could run it from /, doing that could be very slow and potentially crash the app due to memory exhaustion if the site has a lot of pages and links. A better method is to chunk the site by sub-folder and analyze a section at a time.

## Development

Install project dependencies:

```bash
npm install
```

Source is found in the `src` folder, mainly `index.js`.

Edit the `config.yaml` file to set the crawl pattern (see below.)

Run the project with:

```bash
npm start
```

## Configuration file options

Edit `config.yaml` to configure the crawler for the website you want to analyze.

`protocol`:
force protocol when we don't know (e.g. use https when encountering a // URL)

`host`:
specify host to crawl (required.) This is a domain, e.g. `example.com`.

`startPage`:
specify start path on host to crawl (required)

`subPathOnly`:
only score pages under start path. If not specified will attempt to crawl all pages found, and this is very dangerous. Default is true.

`saveToCSV`:
path to file name to save results in CSV file (leave empty to not save)

`showReport`:
show final report to stdout. Default is false.

`debug`:
turn on debugging. Default is false.

## Command line options

`--help`:
Show help

`--version`:
Show version number

`-c`, `--conf`:
path to configuration file (must be a YAML formated file)

`-h`, `--host`:
specify host to crawl (required)

`-p`, `--startpage`:
specify start path on host to crawl (required)

`-o`, `--savetocsv`:
path to file name to save results in CSV file (leave empty to not save)

`-d`, `--debug`:
turn on debugging. Default is false.

`-l`, `--protocol`:
force protocol when we don't know (e.g. use https when encountering a // URL)

`-a`, `--subpathonly`:
only score pages under start path. If not specified will attempt to crawl all pages found, and this is very dangerous. Default is true.

`-r`, `--showreport`:
show final report to stdout. Default is false.

## Issues and bug reports

Feel free to submit issues, bug reports, and enhancement requests using the [issues tab](https://github.com/jf990/seo-analyzer/issues).

## Contributing

All contributions are welcome and encouraged. Please follow the [Esri Community Code of Conduct](https://github.com/Esri/contributing/blob/master/CODE_OF_CONDUCT.md).

NOTE: Be sure to merge the latest from "upstream" before making a pull request!

## License

Copyright 2024 by Esri

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
