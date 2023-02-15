import { shield, rule } from 'trpc-shield';
import { Context } from './context';

export const isAuthenticated = rule<Context>()(
  async (ctx) => ctx.user !== null,
);

export const permissions = shield<Context>({
  mutation: {
    createOneBook: isAuthenticated,
  },
});
