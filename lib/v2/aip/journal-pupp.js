const cheerio = require('cheerio');
const { puppeteerGet, renderDesc } = require('./utils');
const config = require('@/config').value;
const { isValidHost } = require('@/utils/valid-host');

module.exports = async (ctx) => {
    const pub = ctx.params.pub;
    const jrn = ctx.params.jrn;
    const host = `https://pubs.aip.org`;
    const jrnlUrl = `${host}/${pub}/${jrn}/issue`;
    if (!isValidHost(pub)) {
        throw new Error('Invalid pub');
    }

    // use Puppeteer due to the obstacle by cloudflare challenge
    const browser = await require('@/utils/puppeteer')();

    const { jrnlName, list } = await ctx.cache.tryGet(
        jrnlUrl,
        async () => {
            const response = await puppeteerGet(jrnlUrl, browser);
            const $ = cheerio.load(response);
            const jrnlName = $('.header-journal-title').text();
            const list = $('.card')
                .toArray()
                .map((item) => {
                    $(item).find('.access-text').remove();
                    const title = $(item).find('.hlFld-Title').text();
                    const authors = $(item).find('.entryAuthor.all').text();
                    const img = $(item).find('img').attr('src');
                    const link = $(item).find('.ref.nowrap').attr('href');
                    const doi = link.replace('/doi/full/', '');
                    const description = renderDesc(title, authors, doi, img);
                    return {
                        title,
                        link,
                        doi,
                        description,
                    };
                });
            return {
                jrnlName,
                list,
            };
        },
        config.cache.routeExpire,
        false
    );

    browser.close();

    ctx.state.data = {
        title: jrnlName,
        link: jrnlUrl,
        item: list,
        allowEmpty: true,
    };
};
