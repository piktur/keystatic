import { collection, config, fields } from '@keystatic/core';
import type { APIRouteConfig } from '@keystatic/core/api/generic';
import { makeGenericAPIRouteHandler } from '@keystatic/core/api/generic';
import type { APIContext } from 'astro';

export const prerender = false;
/**
 * @see Thinkmill/keystatic/packages/astro/src/api.tsx
 */
export function makeHandler(_config: APIRouteConfig, _?: string) {
  return async function keystaticAPIRoute(context: APIContext) {
    const envVarsForCf = (context.locals as any)?.runtime?.env;
    const handler = makeGenericAPIRouteHandler(
      {
        ..._config,
        clientId:
          _config.clientId ??
          envVarsForCf?.KEYSTATIC_GITHUB_CLIENT_ID ??
          tryOrUndefined(() => {
            return import.meta.env.KEYSTATIC_GITHUB_CLIENT_ID;
          }),
        clientSecret:
          _config.clientSecret ??
          envVarsForCf?.KEYSTATIC_GITHUB_CLIENT_SECRET ??
          tryOrUndefined(() => {
            return import.meta.env.KEYSTATIC_GITHUB_CLIENT_SECRET;
          }),
        secret:
          _config.secret ??
          envVarsForCf?.KEYSTATIC_SECRET ??
          tryOrUndefined(() => {
            return import.meta.env.KEYSTATIC_SECRET;
          }),
      },
      {
        slugEnvName: 'PUBLIC_KEYSTATIC_GITHUB_APP_SLUG',
      },
    );
    const { body, headers, status } = await handler(context.request);
    // all this stuff should be able to go away when astro is using a version of undici with getSetCookie
    const headersInADifferentStructure = new Map<string, string[]>();
    if (headers) {
      if (Array.isArray(headers)) {
        for (const [key, value] of headers) {
          if (!headersInADifferentStructure.has(key.toLowerCase())) {
            headersInADifferentStructure.set(key.toLowerCase(), []);
          }
          headersInADifferentStructure.get(key.toLowerCase())!.push(value);
        }
      } else if (typeof headers.entries === 'function') {
        for (const [key, value] of headers.entries()) {
          headersInADifferentStructure.set(key.toLowerCase(), [value]);
        }
        if ('getSetCookie' in headers && typeof headers.getSetCookie === 'function') {
          const setCookieHeaders = (headers as any).getSetCookie();
          if (setCookieHeaders?.length) {
            headersInADifferentStructure.set('set-cookie', setCookieHeaders);
          }
        }
      } else {
        for (const [key, value] of Object.entries(headers)) {
          headersInADifferentStructure.set(key.toLowerCase(), [value]);
        }
      }
    }

    // const setCookieHeaders = headersInADifferentStructure.get('set-cookie');
    // headersInADifferentStructure.delete('set-cookie');
    // if (setCookieHeaders) {
    //   for (const setCookieValue of setCookieHeaders) {
    //     // const { name, value, ...options } = parseString(setCookieValue);
    //     // const sameSite = options.sameSite?.toLowerCase();
    //     // context.cookies.set(name, value, {
    //     //   domain: options.domain,
    //     //   expires: options.expires,
    //     //   httpOnly: options.httpOnly,
    //     //   maxAge: options.maxAge,
    //     //   path: options.path,
    //     //   sameSite:
    //     //     sameSite === 'lax' || sameSite === 'strict' || sameSite === 'none'
    //     //       ? sameSite
    //     //       : undefined,
    //     // });
    //   }
    // }

    const bodyForResponse: any =
      body instanceof Uint8Array
        ? body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength)
        : body;
    return new Response(bodyForResponse, {
      status,
      headers: [...headersInADifferentStructure.entries()].flatMap(([key, val]) =>
        val.map((x): [string, string] => [key, x]),
      ),
    });
  };
}

function tryOrUndefined<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}

export const ALL = async (context: APIContext) => {
  if (import.meta.env.ENVIRONMENT === 'production') {
    return Response.json({ error: 'Not Found' }, { status: 404 });
  }

  const templateId = context.params.keystatic;
  const basePath = `/${templateId}`;
  const _config = config({
  storage: {
    kind: 'local',
  },
  collections: {
    posts: collection({
      label: 'Posts',
      slugField: 'title',
      path: 'src/content/posts/*',
      format: { contentField: 'content' },
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        content: fields.markdoc({
          label: 'Content',
          options: {
            image: {
              directory: 'src/assets/images/posts',
              publicPath: '../../assets/images/posts/',
            },
          },
        }),
      },
    }),
  },
});

  return makeHandler(
    {
      config: _config,
    },
    basePath,
  )(context);
};
