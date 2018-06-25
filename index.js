"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const puppeteer = require("puppeteer");
const fs = require("fs");
if (!process.env.SEARCH_STRING) {
    console.error('Please supply a SEARCH_STRING.');
    process.exit(1);
}
const SEARCH_STRING = process.env.SEARCH_STRING;
console.log('Searching for', SEARCH_STRING);
const DEFAULT_START_URL = `https://www.google.com/search?q=${SEARCH_STRING}`;
//read from file in disk, so we don't go through same pages if we restart the process
let pagesVisited = [];
let pagesWithRefToTarget = [];
let pagesToVisit = [];
/**
 * Add urls to the queue of urls to visit.
 * Make sure none of those backlinks to the source url.
 * Make sure none of those links are already in the visited links collection.
 * Make sure none of those links are already in the queue to be visited.
 * @param sourceUrl
 * @param urls
 */
function shouldVisit(sourceUrl, urls) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            let toVisit = urls.filter(x => sourceUrl !== x || !pagesToVisit.includes(x));
            toVisit = toVisit.filter(x => !pagesVisited.includes(x));
            pagesToVisit = pagesToVisit.concat(toVisit);
            //replace every time
            fs.writeFile("queued-urls.txt", `${pagesToVisit.join('\n')}\n`, (err) => {
                resolve();
            });
        });
    });
}
function foundUrlWithRefToTarget(url) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            pagesWithRefToTarget.push(url);
            fs.appendFile("target-urls.txt", `${url}\n`, (err) => {
                resolve();
            });
        });
    });
}
function pageVisited(url) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            if (pagesVisited.includes(url)) {
                console.warn(url, 'visited more than once!');
            }
            pagesVisited.push(url);
            fs.appendFile("visited-urls.txt", `${url}\n`, (err) => {
                resolve();
            });
        });
    });
}
function loadVisitedPagesInMemory() {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            fs.readFile('visited-urls.txt', 'utf8', (err, data) => {
                if (err) {
                    pagesVisited = [];
                }
                else {
                    const visited = data
                        .split('\n')
                        .filter(x => x.length != 0)
                        .map(x => x.trim());
                    if (visited.length) {
                        pagesVisited = visited;
                    }
                }
                resolve();
            });
        });
    });
}
function loadPagesToVisitInMemory() {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            fs.readFile('queued-urls.txt', 'utf8', (err, data) => {
                if (err) {
                    pagesToVisit = [DEFAULT_START_URL];
                }
                else {
                    const toVisit = data
                        .split('\n')
                        .filter(x => x.length != 0)
                        .map(x => x.trim());
                    if (toVisit.length) {
                        pagesToVisit = toVisit;
                    }
                    else {
                        pagesToVisit = [DEFAULT_START_URL];
                    }
                }
                resolve();
            });
        });
    });
}
function visit(browser, url) {
    return __awaiter(this, void 0, void 0, function* () {
        yield pageVisited(url.toLowerCase());
        const page = yield browser.newPage();
        yield page.goto(url, { waitUntil: 'networkidle2' });
        try {
            const result = yield page.evaluate((searchString) => {
                const result = {
                    hasLinkToTarget: false,
                    links: []
                };
                const elements = document.querySelectorAll('a');
                for (const el of elements) {
                    const link = el.href ? el.href.toLowerCase() : "";
                    if (link.indexOf(searchString) > -1) {
                        result.hasLinkToTarget = true;
                    }
                    else if (link.length && !link.includes('javascript')) {
                        result.links.push(link);
                    }
                }
                return result;
            }, SEARCH_STRING);
            if (result.hasLinkToTarget) {
                console.log(url);
                yield foundUrlWithRefToTarget(url);
            }
            yield shouldVisit(url, result.links);
        }
        catch (e) {
            console.error(e);
        }
        yield page.close();
    });
}
function dequeue(browser) {
    return __awaiter(this, void 0, void 0, function* () {
        const nextPage = pagesToVisit.pop();
        if (nextPage) {
            yield visit(browser, nextPage);
            dequeue(browser);
        }
        else {
            console.log('Crawling is DONE!');
            yield browser.close();
        }
    });
}
(() => __awaiter(this, void 0, void 0, function* () {
    yield loadPagesToVisitInMemory();
    yield loadVisitedPagesInMemory();
    const browser = yield puppeteer.launch({ headless: true });
    dequeue(browser);
}))();
//# sourceMappingURL=index.js.map