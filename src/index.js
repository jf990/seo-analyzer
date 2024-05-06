/**
 * Analyze web pages for SEO. This analyzer starts at a root page and analyzes it and any pages that page links to. It
 * only analyzes pages on the same domain that are under the path of the target page. If it encounters a URL for a
 * domain other than the configuration.host domain, it will only 404 check that URL.
 */
import URLParse from "url-parse";
import Path from "path";
import StripJS from "strip-js";
import HTMLStrip from "strip";
import TextMiner from "text-miner";
import chalk from "chalk";
import yargs from "yargs";
import yaml from "js-yaml";
import fs from "fs";
import Crawler from "crawler";
import CSVWriter from "csv-writer";


// Analyzer configuration parameters. Shown here are the defaults. Override any option here
// with the configuration file and command line arguments.
let defaultConfiguration = {
    protocol: "",
    host: "",
    startPage: "",
    subPathOnly: true,
    saveToCSV: "",
    showReport: true,
    debug: false,
    basePath: ""
}

// Use this array to filter out words found in page content we don't want in search results.
const weDontWantTheseWords = [
    "skip",
    "content",
    "arcgis",
    "developers",
    "dashboard",
    "false",
    "true",
    "nil",
    "null",
    "void",
    "copyright",
    "rights",
    "reserved",
];

// There are a bunch of symbols the TextMiner does not filter and are missed with weDontWantTheseWords
const specialWordFilter = [
    ":",
    "=",
    "==",
    "{",
    "}",
    "|",
    ";",
    "(",
    ")",
    "++",
    "//",
    "://",
    "**",
    "***",
    "()"
];

/**
 * Combine the terms and term frequency arrays into a single array sorted by frequency.
 * @param {array} wordList List of terms
 * @param {array} frequencyList List of term frequencies, in the exact order of the terms array.
 */
function sortWordsByFrequency(wordList, frequencyList) {
    var i;
    const numberOfWords = wordList.length;
    var combinedWords = [];

    for (i = 0; i < numberOfWords; i ++) {
        // Consider the word if it's not blacklisted.
        if (specialWordFilter.indexOf(wordList[i]) == -1) {
            combinedWords.push({
                term: wordList[i],
                frequency: frequencyList[i]
            });
        }
    }
    return combinedWords.sort(function(a, b) {
        // sort descending
        return b.frequency - a.frequency;
    })
}

/**
 * Determine how many words two lists have in common.
 * @param {array} listOne List of words.
 * @param {array} listTwo List of words.
 */
function arrayWordsInCommon(listOne, listTwo) {
    let commonWordCount = 0;
    let largerList = listOne.length >= listTwo.length ? listOne : listTwo;
    let shorterList = listOne.length < listTwo.length ? listTwo : listOne;
    largerList.forEach(itemOne => {
        if (shorterList.indexOf(itemOne)) {
            commonWordCount ++;
        }
    });
    return commonWordCount;
}

/**
 * Update the page SEO score according to the SEO rules.
 */
function scorePage(pageDetails) {
    if (pageDetails.analyze) {
        let word;
        let index;
        let crawledWord;
        let crawledWordIndex;
        let boostWords;
        let boostedWordCount;
        let wordFrequencyList = sortWordsByFrequency(pageDetails.terms.vocabulary, pageDetails.terms.data[0]);
        let pageScore = 0;
        let pageAnalysis = "";
        let headerOneWords = null;
        let headerWordsInTitle = 0;
        let headerWordsInDescription = 0;
        let headerWordsInKeywords = 0;

        if (pageDetails.headerOne) {
            headerOneWords = pageDetails.headerOne.split(' ');
        }

        // boost title words by +2 when they appear in the body
        if (pageDetails.title) {
            boostWords = pageDetails.title.split(' ');
            boostedWordCount = 0;
            for (index in boostWords) {
                word = boostWords[index].toLowerCase();
                for (crawledWordIndex in wordFrequencyList) {
                    crawledWord = wordFrequencyList[crawledWordIndex];
                    if (word == crawledWord.term) {
                        if (crawledWord.frequency > 1) {
                            // level up for a title word on the page
                            pageScore += 2;
                            boostedWordCount ++;
                        }
                        crawledWord.frequency += 2;
                    }
                }
                if (headerOneWords != null) {
                    headerWordsInTitle += headerOneWords.indexOf(word) >= 0 ? 1 : 0;
                }
            }
            if (boostedWordCount > 0) {
                pageAnalysis += "good: " + boostedWordCount + " title words appear in body.";
            } else {
                pageAnalysis += "bad: no title words appear in body.";
            }
        } else {
            pageAnalysis += "; very bad: no title.";
        }

        // boost description words by +2 when they appear in the body
        if (pageDetails.description) {
            boostWords = pageDetails.description.split(' ');
            boostedWordCount = 0;
            for (index in boostWords) {
                word = boostWords[index].toLowerCase();
                for (crawledWordIndex in wordFrequencyList) {
                    crawledWord = wordFrequencyList[crawledWordIndex];
                    if (word == crawledWord.term) {
                        if (crawledWord.frequency > 1) {
                            // level up for a description word on the page
                            pageScore += 2;
                            boostedWordCount ++;
                        }
                        crawledWord.frequency += 2;
                    }
                }
                if (headerOneWords != null) {
                    headerWordsInDescription += headerOneWords.indexOf(word) >= 0 ? 1 : 0;
                }
            }
            if (boostedWordCount > 0) {
                pageAnalysis += "; good: " + boostedWordCount + " description words appear in body.";
            } else {
                pageAnalysis += "; bad: no description words appear in body.";
            }
        } else {
            pageAnalysis += "; very bad: no description."; 
        }

        // boost keyword words by +1 when they appear in the body
        if (pageDetails.keywords) {
            boostWords = pageDetails.keywords.replace(',', ' ').split(' ');
            boostedWordCount = 0;
            for (index in boostWords) {
                word = boostWords[index].toLowerCase();
                for (crawledWordIndex in wordFrequencyList) {
                    crawledWord = wordFrequencyList[crawledWordIndex];
                    if (word.trim() == crawledWord.term) {
                        if (crawledWord.frequency > 1) {
                            // level up for a keyword on the page
                            pageScore += 1;
                            boostedWordCount ++;
                        }
                        crawledWord.frequency += 1;
                    }
                }
                if (headerOneWords != null) {
                    headerWordsInKeywords += headerOneWords.indexOf(word) >= 0 ? 1 : 0;
                }
            }
            if (boostedWordCount > 0) {
                pageAnalysis += "; good: " + boostedWordCount + " keywords appear in body.";
            } else {
                pageAnalysis += "; bad: no keywords appear in body.";
            }
        } else {
            pageAnalysis += "; very bad: no keywords."; 
        }

        // Test last-modified date is recent within one year
        if (pageDetails.lastModified) {
            let lastModified = new Date(pageDetails.lastModified);
            let age = new Date().valueOf() - lastModified.valueOf();
            if (age > (365 * 24 * 60 * 60 * 1000)) {
                pageScore -= 1;
                pageAnalysis += "; bad: page over 1 year old.";
            } else {
                pageScore += 1;
                pageAnalysis += "; good: page is recent.";
            }
        } else {
            pageScore -= 2;
            pageAnalysis += "; bad: page missing last-modified.";
        }

        // Test product and version. Having no product may be ok, but
        // having product without version is bad.
        if (pageDetails.product) {
            if ( ! pageDetails.version) {
                // deduct for a product without a version
                pageScore -= 1;
                pageAnalysis += "; bad: page has product but missing version.";
            } else {
                pageScore += 1;
                pageAnalysis += "; good: page has product and version.";
            }
        }

        // Test H1
        if (pageDetails.headerOne) {
            pageScore += (1 + headerWordsInTitle + headerWordsInDescription + headerWordsInKeywords);
            // H1 words should appear in title, description, and keywords
            pageAnalysis += "; good: page has H1, " + headerWordsInTitle + " in title, " + headerWordsInDescription + " in description, " + headerWordsInKeywords + " in keywords";
        } else {
            pageScore -= 1;
            pageAnalysis += "; bad: page missing H1.";
        }

        pageDetails.pageScore = pageScore;
        pageDetails.pageAnalysis = pageAnalysis;
        pageDetails.wordFrequencyList = wordFrequencyList;
        delete pageDetails.terms;
    }
}

/**
 * Display the word list in a condensed format showing the term and the frequency.
 * @param {array} wordFrequencyList The word list with frequency information.
 * @returns {string} The word list formatted as a single string.
 */
function frequencyToString(wordFrequencyList) {
    let orderedString = "";
    for (let index in wordFrequencyList) {
        let word = wordFrequencyList[index];
        orderedString += (orderedString == "" ? "" : ", ") + word.term + ": " + word.frequency;
    }
    return orderedString;
}

/**
 * Remove HTML entities from a string.
 * @param {string} sourceString String to clean of HTML entities.
 * @returns {string} A clean string.
 */
function cleanHTMLEntities(sourceString) {
    const entityRegEx = /&(?:#x[a-f0-9]+|#[0-9]+|[a-z0-9]+);?/ig;
    return sourceString.replace(entityRegEx, "");
}

/**
 * Determine if a URL is a synonym for the root index page.
 * @param {string} URL A URL to test.
 * @returns {boolean} true if we think the URL points to the index page.
 */
function isIndexPage(URL) {
    let URLParts = URLParse(URL);
    return URLParts.pathname.length == 0 || URLParts.pathname == "/" || /^\/?index\.(html|php|jsp)$/.test(URLParts.pathname);
}


/**
 * Start the crawler after the environment is set up.
 * @param {object} configuration
 * @returns {int} exit code
 */
function startCrawler(configuration) {
    var pageCrawler = new Crawler({
        maxConnections : 1,
        rateLimit: 1000,
        callback: analyzePage
    });
    // Keep track of pages we analyzed
    var pagesVisited = {};

    debugLog("Site-crawler configuration:");
    debugLog(JSON.stringify(configuration));
    debugLog("---------------------------");

    /**
     * Determine if a log message show show.
     * @param {string} message Message to show in console log.
     */
    function debugLog(message) {
        if (configuration.debug) {
            console.log(message);
        }
    }

    /**
     * Determine if a log message show show.
     * @param {string} message Message to show in console log.
     */
    function immediateLog(message) {
        console.log(message);
    }

    /**
     * Determine the starting root page based on configuration settings.
     */
    function startURL() {
        return makeURL(configuration.startPage);
    }

    /**
     * Create a fully qualified URL given a local path from the root of the host.
     * @param {string} pathFromRoot A URL path starting at /
     */
    function makeURL(pathFromRoot) {
        return `${configuration.protocol}//${configuration.host}${pathFromRoot}`;
    }

    /**
     * Determine if a host name matches the host we are analyzing.
     * @param {string} hostName A host name to check.
     * @returns {boolean} true if a match.
     */
    function isHostNameMatch(hostName) {
        return hostName && (hostName.toLowerCase() == configuration.host);
    }

    /**
     * Determine if a URL is a sub-path of our intended crawl.
     * @param {URLParse} URLParts A parsed URL to check.
     * @returns {boolean} true if a match.
     */
    function isIntendedSubPath(URLParts) {
        if (URLParts.hostname.length == 0 || (URLParts.hostname.toLowerCase() == configuration.host)) {
            if (configuration.subPathOnly) {
                if (URLParts.pathname.startsWith(configuration.basePath)) {
                    debugLog("+++ " + URLParts.pathname + " is under " + configuration.basePath);
                    return true;
                } else {
                    debugLog("XXX " + URLParts.pathname + " does not start with " + configuration.basePath);
                }
            } else {
                debugLog("+++ " + URLParts.pathname + " is on same host");
                return true;
            }
        } else {
            debugLog("XXX " + URLParts.hostname + " is on different host");
        }
        return false;
    }

    /**
     * Look at a proposed URL and determine if we should analyze that page.
     *   - is it a valid URL?
     *   - treat host.com/, host.com, and host.com/index.html as the same page
     *   - is it a page on the same domain we are checking?
     *   - is it a page we have not analyzed before?
     *   - is sub-folder checking on and this page is under the target folder?
     *   
     * @param {string} proposedURL A URL to consider analyzing.
     * @param {string} currentURL The path currently crawling, in case any proposed URLs are relative to it instead of /.
     * @param {string} referrer The referring URL, so we know which page requested this crawl.
     * @returns {string} A path from / if it's a URL we should crawl, or null to ignore it.
     */
    function cleanURL(proposedURL, currentURL, referrer) {
        var realURL = null;
        if (typeof proposedURL !== "undefined" && proposedURL !== null && proposedURL.length > 0 && proposedURL[0] != "#" && proposedURL[0] != "?") {
            if (proposedURL.substr(0, 2) == "//") {
                // URLs that begin with // will require a protocol or the crawler won't crawl it.
                proposedURL = configuration.protocol + proposedURL;
            }

            let URLParts = URLParse(proposedURL);
            if (isIntendedSubPath(URLParts)) {
                // considering a path on the same host we are crawling
                if (URLParts.pathname[0] != "/") {
                    // not a path from root, need to resolve it against currentURL
                    realURL = makeURL(Path.dirname(currentURL) + "/" + URLParts.pathname);
                } else {
                    realURL = makeURL(URLParts.pathname);
                }
                if (pagesVisited[proposedURL] != undefined) {
                    debugLog("already crawled " + realURL + " -- ignoring");
                    realURL = null;
                } else if (configuration.subPathOnly) {
                    if ( ! URLParts.pathname.startsWith(configuration.basePath) && pagesVisited[realURL] == undefined) {
                        debugLog(realURL + " is not under " + configuration.basePath + " - 404 check only");
                        queueURLToCrawl(pageCrawler, realURL, referrer, false);
                        realURL = null;
                    }
                }
            } else {
                // if it's a URL on another host or not under our target path, then we only 
                // want to 404 check it, but make sure we didn't see it before
                if ( ! URLParts.protocol) {
                    URLParts.protocol = configuration.protocol;
                }
                if ( ! URLParts.hostname) {
                    URLParts.hostname = configuration.host;
                }
                if (isIndexPage(proposedURL)) {
                    // treat arcgis.com, arcgis.com/, and arcgis.com/index.html as the same URL
                    let transformedURL = URLParts.protocol + "//" + URLParts.hostname + "/";
                    debugLog("Converting " + proposedURL + " to " + transformedURL);
                    proposedURL = transformedURL;
                } else {
                    proposedURL = `${URLParts.protocol}//${URLParts.hostname}${URLParts.pathname}`;
                }
                if (pagesVisited[proposedURL] == undefined) {
                    debugLog("Only 404 check on " + proposedURL);
                    queueURLToCrawl(pageCrawler, proposedURL, referrer, false);
                } else {
                    debugLog("Ignoring already crawled " + proposedURL);
                }
            }
        }
        return realURL;
    }

    /**
     * Post-process the crawled pages:
     *   - convert the TextMiner array into something useful.
     *   - improve the word scores for terms found in title, description, and keywords
     * This function updates the properties of elements in the pagesVisited array.
     */
    function adjustTermScores() {
        for (let URL in pagesVisited) {
            if (pagesVisited[URL].statusCode == -1) {
                // Don't score pages we didn't analyze.
                delete pagesVisited[URL];
            } else {
                let pageDetails = pagesVisited[URL];
                if (pageDetails.analyze && pageDetails.pageScore == 0) {
                    scorePage(pageDetails);
                }
            }
        }
    }

    /**
     * Queue a page for crawling.
     * @param {Crawler} crawler the queue to add this to.
     * @param {string} URL A full URL to a page we want to crawl.
     * @param {string} URL A full URL to a the page we found this URL on.
     * @param {boolean} analyze true if we should do a full SEO analysis on this page, false to 404 check it only.
     * @returns {boolean} true if queued.
     */
    function queueURLToCrawl(crawler, URL, referrer, analyze) {
        let isQueued = false;
        if (URL.substr(0, 2) == "//") {
            URL = configuration.protocol + URL;
        }
        if (pagesVisited[URL] == undefined) {
            let pageDetails = {
                statusCode: -1,
                queueTime: Date.now(),
                referrer: referrer,
                analyze: analyze,
                pageScore: 0,
                title: "",
                description: "",
                keywords: "",
                headerOne: "",
                lastModified: "",
                product: "",
                version: ""
            };
            pagesVisited[URL] = pageDetails;
            crawler.queue(URL);
            isQueued = true;
            immediateLog(">> " + URL + " was queued.");
        }
        return isQueued;
    }

    /**
     * Crawler hit function call on each page crawled.
     * @param {Error} error If an error occurs this error object is not null.
     * @param {Response} response The http response object if the page was successfully crawled.
     * @param {function} done The process chain function to call after finished with the current task.
     */
    function analyzePage(error, response, done) {
        if (error) {
            debugLog(error);
        } else {
            let proposedURL = response.request.uri.href;
            let URLParts = URLParse(proposedURL);
            debugLog(`considering ${proposedURL}`);
            if (pagesVisited[proposedURL] == undefined || pagesVisited[proposedURL].statusCode < 0) {
                let pageDetails = pagesVisited[proposedURL] || {};
                pageDetails.statusCode = response.statusCode;
                if (response.statusCode < 300 && pageDetails.analyze) {
                    if (response.$) {
                        debugLog(`Analyzing ${proposedURL}`);
                        let $ = response.$;
                        pageDetails.title = $("title").text();
                        pageDetails.description = $('meta[name=description]').attr("content");
                        pageDetails.keywords = $('meta[name=keywords]').attr("content");
                        pageDetails.lastModified = $('meta[name=last-modified]').attr("content");
                        pageDetails.product = $('meta[name=product]').attr("content");
                        pageDetails.headerOne = $('h1').text().toLowerCase();
                        $('body').find('a').each(function(index, element) {
                            // determine if we should crawl and analyze the linked page
                            let href = cleanURL(element.attribs.href, URLParts.pathname, proposedURL);
                            if (href != null) {
                                queueURLToCrawl(pageCrawler, href, proposedURL, true);
                            }
                        });
                        let pageCorpus = new TextMiner.Corpus([
                            pageDetails.title + " " + pageDetails.description + " " + pageDetails.keywords + " " + cleanHTMLEntities(HTMLStrip(StripJS($('body').html())))
                        ]);
                        pageCorpus
                            .removeNewlines()
                            .clean()
                            .removeDigits()
                            .removeInterpunctuation()
                            .removeInvalidCharacters()
                            .toLower()
                            .stem("Porter")
                            .removeWords(weDontWantTheseWords)
                            .removeWords(TextMiner.STOPWORDS.EN)
                        ;
                        pageDetails.terms = new TextMiner.DocumentTermMatrix(pageCorpus);
                        scorePage(pageDetails);
                    } else {
                        pageDetails.analyze = false;
                        debugLog(`response of ${proposedURL} is not HTML`);
                    }
                } else {
                    pageDetails.analyze = false;
                    debugLog(`Status ${response.statusCode} on page ${proposedURL}`);
                }
                let pageCount = Object.keys(pagesVisited).length;
                debugLog(`analysis complete on ${proposedURL}; completed ${pageCount} pages`);
                pageDetails.completeTime = Date.now();
                pagesVisited[proposedURL] = pageDetails;
            } else {
                debugLog(`Already scanned ${proposedURL} -- discarding response`);
            }
        }
        done();
        let pageCount = pageCrawler.queueSize;
        if (pageCount == 0) {
            adjustTermScores();
            if (configuration.saveToCSV) {
                saveResultsToCSVFile();
            }
            if (configuration.showReport) {
                finalReport();
            }
        } else {
            debugLog(`scanning continues, ${pageCount} pages pending in queue.`);
        }
    }

    /**
     * Save the information we gathered to a CSV file.
     */
    function saveResultsToCSVFile() {
        if (configuration.saveToCSV != null && configuration.saveToCSV.length > 0) {
            const header = [
                {id: "url", title: "URL"},
                {id: "status", title: "Status Code"},
                {id: "score", title: "Page Score"},
                {id: "title", title: "Title"},
                {id: "description", title: "Description"},
                {id: "keywords", title: "Keywords"},
                {id: "product", title: "Product"},
                {id: "lastModified", title: "Last Modified"},
                {id: "analysis", title: "Page Analysis"},
                {id: "terms", title: "Terms"}
            ];
            const csvWriter = CSVWriter.createObjectCsvWriter({
                path: configuration.saveToCSV,
                header: header
            });
            let row;
            let records = [];
            for (var URL in pagesVisited) {
                let pageDetails = pagesVisited[URL];
                row = {
                    url: URL,
                    status: pageDetails.statusCode,
                    score: 0,
                    title: "",
                    description: "",
                    keywords: "",
                    product: "",
                    lastModified: "",
                    analysis: "",
                    terms: ""
                };
                if (pageDetails.analyze) {
                    row.score = pageDetails.pageScore;
                    row.title = pageDetails.title;
                    row.description = pageDetails.description;
                    row.keywords = pageDetails.keywords;
                    row.product = pageDetails.product + " / " + pageDetails.version;
                    row.lastModified = pageDetails.lastModified;
                    row.analysis = pageDetails.pageAnalysis;
                    row.terms = frequencyToString(pageDetails.wordFrequencyList);
                }
                records.push(row);
            }
            csvWriter.writeRecords(records)
                .then(function() {
                    debugLog("CSV file saved to " + configuration.saveToCSV);
                });
        }
    }

    /**
     * Display the results of the analysis to stdout.
     */
    function finalReport() {
      let pageCount = Object.keys(pagesVisited).length;
      console.log(chalk.white("-----------------------------------------------"));
      console.log(chalk.bold.yellow(`scanning complete, ${pageCount} pages analyzed.`));
      for (var URL in pagesVisited) {
          let pageDetails = pagesVisited[URL];
          if (pageDetails.analyze) {
              let terms = frequencyToString(pageDetails.wordFrequencyList);
              console.log(chalk.white("----------------------------------------------"));
              console.log(chalk.green(URL));
              console.log(chalk.blueBright(`   title: ${pageDetails.title}`));
              console.log(chalk.blueBright(`   description: ${pageDetails.description}`));
              console.log(chalk.blueBright(`   keywords: ${pageDetails.keywords}`));
              console.log(chalk.bold.blueBright(`   score: ${pageDetails.pageScore} ${pageDetails.pageAnalysis}`));
              console.log(chalk.blue(`   terms: ${terms}`));
          }
      }
    }

    // save the parent folder so we don't recompute it every iteration
    if (configuration.subPathOnly) {
        let baseName = Path.basename(configuration.startPage);
        configuration.basePath = Path.dirname(configuration.startPage);
    }
    let basePage = startURL();
    queueURLToCrawl(pageCrawler, basePage, basePage, true);
}

/**
 * Update the configuration object as follows:
 * - override any default option with YML configuration file option.
 * - override any default/YML option with a command line override.
 * @param {object} defaultConfiguration configuration default settings that will be overridden by args.
 * @returns {object} final configuration
 */
function updateConfiguration(defaultConfiguration) {
    yargs()
    .option("c", {
        alias: "conf",
        demandOption: false,
        default: "config.yaml",
        describe: "use configuration file (in YAML format)",
        type: "string"
    })
    .option("h", {
        alias: "host",
        demandOption: false,
        default: "",
        describe: "specify host to crawl",
        type: "string"
    })
    .option("p", {
        alias: "startpage",
        demandOption: false,
        default: "",
        describe: "specify start path on host to crawl",
        type: "string"
    })
    .option("o", {
        alias: "savetocsv",
        demandOption: false,
        default: "",
        describe: "save results in CSV file (leave empty to not save)",
        type: "string"
    })
    .option("d", {
        alias: "debug",
        demandOption: false,
        default: false,
        describe: "turn on debugging",
        type: "boolean"
    })
    .option("l", {
        alias: "protocol",
        demandOption: false,
        default: "https:",
        describe: "force protocol when we don't know",
        type: "string"
    })
    .option("a", {
        alias: "subpathonly",
        demandOption: false,
        default: true,
        describe: "only score pages under start path",
        type: "boolean"
    })
    .option("r", {
        alias: "showreport",
        demandOption: false,
        default: true,
        describe: "show final report to stdout",
        type: "boolean"
    })
    .argv;

    let configuration = Object.assign(defaultConfiguration);
    let configurationFilePath;
    const args = yargs().argv;
    if (args.conf) {
        configurationFilePath = args.conf;
    } else {
        configurationFilePath = "config.yaml";
    }
    if (fs.existsSync(configurationFilePath)) {
        let yamlData = fs.readFileSync(configurationFilePath, "utf8");
        if (yamlData) {
            let yamlConfiguration = yaml.load(yamlData);
            if (yamlConfiguration.hasOwnProperty("protocol")) {
                configuration.protocol = yamlConfiguration.protocol;
            }
            if (yamlConfiguration.hasOwnProperty("host")) {
                configuration.host = yamlConfiguration.host;
            }
            if (yamlConfiguration.hasOwnProperty("startPage")) {
                configuration.startPage = yamlConfiguration.startPage;
            }
            if (yamlConfiguration.hasOwnProperty("subPathOnly")) {
                configuration.subPathOnly = yamlConfiguration.subPathOnly;
            }
            if (yamlConfiguration.hasOwnProperty("saveToCSV")) {
                configuration.saveToCSV = yamlConfiguration.saveToCSV;
            }
            if (yamlConfiguration.hasOwnProperty("showReport")) {
                configuration.showReport = yamlConfiguration.showReport;
            }
            if (yamlConfiguration.hasOwnProperty("debug")) {
                configuration.debug = yamlConfiguration.debug;
            }
        } else {
            console.log("Cannot load YAML " + configurationFilePath);
        }
    } else {
        console.log("No config file " + configurationFilePath);
    }
    if (args.host) {
        configuration.host = args.host;
    }
    if (args.protocol) {
        configuration.protocol = args.protocol;
    }
    if (args.startpage) {
        configuration.startPage = args.startpage;
    }
    if (args.savetocsv) {
        configuration.saveToCSV = args.savetocsv;
    }
    if (args.debug) {
        configuration.debug = args.debug;
    }
    if (args.showreport) {
        configuration.showReport = args.showreport;
    }
    if (args.subpathonly) {
        configuration.subPathOnly = args.subpathonly;
    }
    return configuration;
}

let configuration = updateConfiguration(defaultConfiguration);
startCrawler(configuration);
