import { buildApp } from './app';

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? '0.0.0.0';

const app = await buildApp();
await app.listen({ host, port });
