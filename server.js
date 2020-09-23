/* eslint-disable @shopify/binary-assignment-parens */
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
const { receiveWebhook, registerWebhook } = require('@shopify/koa-shopify-webhooks');

const port = parseInt(process.env.PORT, 10) || 3000;
const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const { SHOPIFY_API_SECRET_KEY, SHOPIFY_API_KEY, HOST } = process.env;

const server = new Koa();
const router = new KoaRouter();
const webhook = receiveWebhook({ secret: SHOPIFY_API_SECRET_KEY });
const productsUrl = '/api/products';

let products = [];

router.get(productsUrl, (ctx) => {
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

router.post('/webhooks/products/create', webhook, async (ctx) => {
  const state = ctx.state.webhook;
  await products.push(state);
  console.log('received webhook: ', ctx.state.webhook);
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
      async afterAuth(ctx) {
        const { shop, accessToken } = ctx.session;
        ctx.cookies.set('shopOrigin', shop, {
          httpOnly: false,
          secure: true,
          sameSite: 'none',
        });

        const registration = await registerWebhook({
          address: `${HOST}/webhooks/products/create`,
          topic: 'PRODUCTS_CREATE',
          accessToken,
          shop,
          apiVersion: ApiVersion.October19,
        });

        if (registration.success) {
          console.log('Successfully registered webhook!');
        } else {
          console.log('Failed to register webhook', registration.result);
        }

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
  // router.get('*', verifyRequest(), async (ctx) => {
  //     await handle(ctx.req, ctx.res);
  //     ctx.respond = false;
  //     ctx.res.statusCode = 200;
  // });

  server.listen(port, () => {
    console.log(`> Ready on port:${port}`);
  });
});
