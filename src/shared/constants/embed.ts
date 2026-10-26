/**
 * Embedded objects (secure embedding) contract shared between server and client.
 *
 * The embedding token is passed in the URL hash fragment, so it is never sent
 * to the server as part of the request line and never reaches server logs
 * or server side rendering.
 */

/** Key of the embedding token inside the location hash fragment. */
export const EMBED_TOKEN_HASH_KEY = 'dl_embed_token';

/** SPA page that renders an embedded dashboard. */
export const EMBEDDED_DASH_PATH = '/embeds/dash';

/** SPA page that renders an embedded chart. */
export const EMBEDDED_CHART_PATH = '/embeds/chart';

/**
 * `window.DL.apiPrefix` used by embedded pages.
 * Keeps embed data routes separated from the regular (session authorized) ones.
 */
export const EMBEDDED_API_PREFIX = '/api/embeds';

/**
 * BFF route that resolves an embedded dash entry by the embedding token.
 *
 * Must stay under EMBEDDED_API_PREFIX: the two-segment SPA route `GET /:entryId/:widgetId` is
 * registered before the charts routes, so a two-segment `/api/<something>` path is swallowed by it
 * and returns the SPA html instead of reaching this handler.
 */
export const EMBEDDED_ENTRY_API_PATH = `${EMBEDDED_API_PREFIX}/entry`;
