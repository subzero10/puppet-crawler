import puppeteer = require('puppeteer');
import * as fs from 'fs';

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
async function shouldVisit(sourceUrl: string, urls: string[]) {
    return new Promise((resolve, reject) => {
        let toVisit = urls.filter(x => sourceUrl !== x || !pagesToVisit.includes(x));
        toVisit = toVisit.filter(x => !pagesVisited.includes(x));
        pagesToVisit = pagesToVisit.concat(toVisit);
        //replace every time
        fs.writeFile("queued-urls.txt", `${pagesToVisit.join('\n')}\n`, (err) => {
            resolve();
        });
    });
}

async function foundUrlWithRefToTarget(url: string) {
    return new Promise((resolve, reject) => {
        pagesWithRefToTarget.push(url);
        fs.appendFile("target-urls.txt", `${url}\n`, (err) => {
            resolve();
        });
    });
}

async function pageVisited(url: string) {
    return new Promise((resolve, reject) => {
        if (pagesVisited.includes(url)) {
            console.warn(url, 'visited more than once!');
        }
        pagesVisited.push(url);
        fs.appendFile("visited-urls.txt", `${url}\n`, (err) => {
            resolve();
        });
    });
}

async function loadVisitedPagesInMemory() {
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
}

async function loadPagesToVisitInMemory() {
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
}


async function visit(browser: puppeteer.Browser, url: string) {

    await pageVisited(url.toLowerCase());

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });

    try {
        const result = await page.evaluate((searchString) => {
            const result = {
                hasLinkToTarget: false,
                links: []
            }
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
            await foundUrlWithRefToTarget(url);
        }

        await shouldVisit(url, result.links);
    }
    catch (e) {
        console.error(e);
    }

    await page.close();
}

async function dequeue(browser: puppeteer.Browser) {
    const nextPage = pagesToVisit.pop();
    if (nextPage) {
        await visit(browser, nextPage);
        dequeue(browser);
    }
    else {
        console.log('Crawling is DONE!');
        await browser.close();
    }
}

(async () => {

    await loadPagesToVisitInMemory();
    await loadVisitedPagesInMemory();
    const browser = await puppeteer.launch({ headless: true });
    dequeue(browser);

})();