/* eslint-disable require-atomic-updates */
/* eslint-disable no-console */
/* eslint-disable promise/catch-or-return */
/* eslint-disable no-process-env */
/* eslint-disable import/order */
require('isomorphic-fetch');
const dotenv = require('dotenv');
const Koa = require('koa');
const KoaRouter = require('koa-router');
const next = require('next');
const { default: createShopifyAuth } = require('@shopify/koa-shopify-auth');
const { verifyRequest } = require('@shopify/koa-shopify-auth');
const session = require('koa-session');
const koaBody = require('koa-body');

dotenv.config();
const { default: graphQLProxy } = require('@shopify/koa-shopify-graphql-proxy');
const { ApiVersion } = require('@shopify/koa-shopify-graphql-proxy');

const port = parseInt(process.env.PORT, 10) || 3000;
const dev = (process.env.NODE_ENV !== 'production');
const app = next({ dev });
const handle = app.getRequestHandler();

const { SHOPIFY_API_SECRET_KEY, SHOPIFY_API_KEY } = process.env;

const server = new Koa();
const router = new KoaRouter();
const productsUrl = '/api/products';

let products = [];

router.get(productsUrl,  (ctx) => {
  try {
    ctx.body = {
      status: 'success',
      data: products,
    };
  } catch (error) {
    console.log(error);
  }
});

router.post(productsUrl, koaBody(), async (ctx) => {
  try {
    const body = ctx.request.body;
    await products.push(body);
    ctx.body = 'Item Added';
  } catch (error) {
    console.log(error);
  }
});

router.delete(productsUrl, koaBody(), (ctx) => {
  try {
    products = [];
    ctx.body = 'All items deleted!';
  } catch (error) {
    console.log(error);
  }
});

// Router Middleware
server.use(router.allowedMethods());
server.use(router.routes());

app.prepare().then(() => {
  server.use(session({ secure: true, sameSite: 'none' }, server));
  server.keys = [SHOPIFY_API_SECRET_KEY];

  server.use(
    createShopifyAuth({
      apiKey: SHOPIFY_API_KEY,
      secret: SHOPIFY_API_SECRET_KEY,
      scopes: ['read_products', 'write_products', 'read_script_tags', 'write_script_tags'],
      afterAuth(ctx) {
        const { shop } = ctx.session;
        ctx.cookies.set('shopOrigin', shop, {
          httpOnly: false,
          secure: true,
          sameSite: 'none',
        });
        ctx.redirect('/');
      },
    }),
  );

  server.use(graphQLProxy({ version: ApiVersion.October19 }));
  server.use(verifyRequest());

  server.use(async (ctx) => {
    await handle(ctx.req, ctx.res);
    ctx.respond = false;
    ctx.res.statusCode = 200;
  });

  server.listen(port, () => {
    console.log(`> Ready on port:${port}`);
  });
});
