import { createRequire } from 'module'; const require = createRequire(import.meta.url);

// node_modules/@netlify/runtime-utils/dist/main.js
var getString = (input) => typeof input === "string" ? input : JSON.stringify(input);
var base64Decode = globalThis.Buffer ? (input) => Buffer.from(input, "base64").toString() : (input) => atob(input);
var base64Encode = globalThis.Buffer ? (input) => Buffer.from(getString(input)).toString("base64") : (input) => btoa(getString(input));
var getEnvironment = () => {
  const { Deno, Netlify, process: process2 } = globalThis;
  return Netlify?.env ?? Deno?.env ?? {
    delete: (key) => delete process2?.env[key],
    get: (key) => process2?.env[key],
    has: (key) => Boolean(process2?.env[key]),
    set: (key, value) => {
      if (process2?.env) {
        process2.env[key] = value;
      }
    },
    toObject: () => process2?.env ?? {}
  };
};

// node_modules/@netlify/otel/dist/main.js
var GET_TRACER = "__netlify__getTracer";
var getTracer = (name, version) => {
  return globalThis[GET_TRACER]?.(name, version);
};
function withActiveSpan(tracer, name, optionsOrFn, contextOrFn, fn) {
  const func = typeof contextOrFn === "function" ? contextOrFn : typeof optionsOrFn === "function" ? optionsOrFn : fn;
  if (!func) {
    throw new Error("function to execute with active span is missing");
  }
  if (!tracer) {
    return func();
  }
  return tracer.withActiveSpan(name, optionsOrFn, contextOrFn, func);
}

// node_modules/@netlify/blobs/dist/chunk-SQCJ2S3G.js
var getEnvironmentContext = () => {
  const context = globalThis.netlifyBlobsContext || getEnvironment().get("NETLIFY_BLOBS_CONTEXT");
  if (typeof context !== "string" || !context) {
    return {};
  }
  const data = base64Decode(context);
  try {
    return JSON.parse(data);
  } catch {
  }
  return {};
};
var MissingBlobsEnvironmentError = class extends Error {
  constructor(requiredProperties) {
    super(
      `The environment has not been configured to use Netlify Blobs. To use it manually, supply the following properties when creating a store: ${requiredProperties.join(
        ", "
      )}`
    );
    this.name = "MissingBlobsEnvironmentError";
  }
};
var BASE64_PREFIX = "b64;";
var METADATA_HEADER_INTERNAL = "x-amz-meta-user";
var METADATA_HEADER_EXTERNAL = "netlify-blobs-metadata";
var METADATA_MAX_SIZE = 2 * 1024;
var encodeMetadata = (metadata) => {
  if (!metadata) {
    return null;
  }
  const encodedObject = base64Encode(JSON.stringify(metadata));
  const payload = `b64;${encodedObject}`;
  if (METADATA_HEADER_EXTERNAL.length + payload.length > METADATA_MAX_SIZE) {
    throw new Error("Metadata object exceeds the maximum size");
  }
  return payload;
};
var decodeMetadata = (header) => {
  if (!header?.startsWith(BASE64_PREFIX)) {
    return {};
  }
  const encodedData = header.slice(BASE64_PREFIX.length);
  const decodedData = base64Decode(encodedData);
  const metadata = JSON.parse(decodedData);
  return metadata;
};
var getMetadataFromResponse = (response) => {
  if (!response.headers) {
    return {};
  }
  const value = response.headers.get(METADATA_HEADER_EXTERNAL) || response.headers.get(METADATA_HEADER_INTERNAL);
  try {
    return decodeMetadata(value);
  } catch {
    throw new Error(
      "An internal error occurred while trying to retrieve the metadata for an entry. Please try updating to the latest version of the Netlify Blobs client."
    );
  }
};
var NF_ERROR = "x-nf-error";
var NF_REQUEST_ID = "x-nf-request-id";
var DEPLOY_STORE_PREFIX = "deploy:";
var SITE_STORE_PREFIX = "site:";
var isDeniedWrite = (res, { method, storeName }) => (res.status === 401 || res.status === 403) && (method === "put" || method === "delete") && storeName !== void 0 && !storeName.startsWith(DEPLOY_STORE_PREFIX);
var blobsErrorMessage = (res, context, responseBody) => {
  let details = res.headers.get(NF_ERROR) || `${res.status} status code`;
  if (res.headers.has(NF_REQUEST_ID)) {
    details += `, ID: ${res.headers.get(NF_REQUEST_ID)}`;
  }
  if (isDeniedWrite(res, context)) {
    const storeName = context.storeName?.startsWith(SITE_STORE_PREFIX) ? context.storeName.slice(SITE_STORE_PREFIX.length) : context.storeName;
    const summary = `Netlify Blobs could not write to store '${storeName}' (${details}).`;
    if (context.edgeAccess) {
      return summary;
    }
    return `${summary} Builds and build plugins can only write to deploy-specific stores: use 'getDeployStore' instead of 'getStore', or pass a 'token' with write access to the store. If this code is not running in a build, check that the token and site ID are valid. See https://docs.netlify.com/build/data-and-storage/netlify-blobs/#deploy-specific-stores`;
  }
  let message = `Netlify Blobs has generated an internal error (${details})`;
  if (!res.headers.get(NF_ERROR) && responseBody) {
    message += `: ${responseBody}`;
  }
  return message;
};
var BlobsInternalError = class extends Error {
  constructor(res, context = {}, responseBody) {
    super(blobsErrorMessage(res, context, responseBody));
    this.name = "BlobsInternalError";
    this.status = res.status;
    this.responseBody = responseBody;
  }
};
var createBlobsInternalError = async (res, context = {}) => {
  const responseBody = await res.clone().text().catch(() => void 0);
  return new BlobsInternalError(res, context, responseBody);
};
var discardBody = async (res) => {
  await res.body?.cancel().catch(() => {
  });
};
var collectIterator = async (iterator) => {
  const result = [];
  for await (const item of iterator) {
    result.push(item);
  }
  return result;
};
function withSpan(span, name, fn) {
  if (span) return fn(span);
  return withActiveSpan(getTracer(), name, (span2) => {
    return fn(span2);
  });
}
var BlobsConsistencyError = class extends Error {
  constructor() {
    super(
      `Netlify Blobs has failed to perform a read using strong consistency because the environment has not been configured with a 'uncachedEdgeURL' property`
    );
    this.name = "BlobsConsistencyError";
  }
};
var REGION_AUTO = "auto";
var regions = {
  "us-east-1": true,
  "us-east-2": true,
  "eu-central-1": true,
  "ap-southeast-1": true,
  "ap-southeast-2": true
};
var isValidRegion = (input) => Object.keys(regions).includes(input);
var InvalidBlobsRegionError = class extends Error {
  constructor(region) {
    super(
      `${region} is not a supported Netlify Blobs region. Supported values are: ${Object.keys(regions).join(", ")}.`
    );
    this.name = "InvalidBlobsRegionError";
  }
};
var DEFAULT_RETRY_DELAY = getEnvironment().get("NODE_ENV") === "test" ? 1 : 5e3;
var MIN_RETRY_DELAY = 1e3;
var MAX_RETRY = 5;
var RATE_LIMIT_HEADER = "X-RateLimit-Reset";
var fetchAndRetry = async (fetch, url, options, attemptsLeft = MAX_RETRY, getRetryUrl) => {
  try {
    const res = await fetch(url, options);
    const isRetryable = res.status === 429 || res.status >= 500 || getRetryUrl !== void 0 && res.status === 403;
    if (attemptsLeft > 0 && isRetryable) {
      await discardBody(res);
      const delay = getDelay(res.headers.get(RATE_LIMIT_HEADER));
      await sleep(delay);
      const retryUrl = getRetryUrl ? await getRetryUrl() : url;
      return fetchAndRetry(fetch, retryUrl, options, attemptsLeft - 1, getRetryUrl);
    }
    return res;
  } catch (error) {
    if (attemptsLeft === 0) {
      throw error;
    }
    const delay = getDelay();
    await sleep(delay);
    const retryUrl = getRetryUrl ? await getRetryUrl() : url;
    return fetchAndRetry(fetch, retryUrl, options, attemptsLeft - 1, getRetryUrl);
  }
};
var getDelay = (rateLimitReset) => {
  if (!rateLimitReset) {
    return DEFAULT_RETRY_DELAY;
  }
  return Math.max(Number(rateLimitReset) * 1e3 - Date.now(), MIN_RETRY_DELAY);
};
var sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});
var SIGNED_URL_ACCEPT_HEADER = "application/json;type=signed-url";
var Client = class {
  /**
   * Whether requests reach Blobs through the edge rather than the API. Only
   * runtime environments are given an edge URL.
   */
  get edgeAccess() {
    return this.edgeURL !== void 0;
  }
  constructor({ apiURL, consistency, edgeURL, fetch, region, siteID, token, uncachedEdgeURL }) {
    this.apiURL = apiURL;
    this.consistency = consistency ?? "eventual";
    this.edgeURL = edgeURL;
    this.fetch = fetch ?? globalThis.fetch;
    this.region = region;
    this.siteID = siteID;
    this.token = token;
    this.uncachedEdgeURL = uncachedEdgeURL;
    if (!this.fetch) {
      throw new Error(
        "Netlify Blobs could not find a `fetch` client in the global scope. You can either update your runtime to a version that includes `fetch` (like Node.js 18.0.0 or above), or you can supply your own implementation using the `fetch` property."
      );
    }
  }
  async getFinalRequest({
    consistency: opConsistency,
    key,
    metadata,
    method,
    parameters = {},
    storeName
  }) {
    const encodedMetadata = encodeMetadata(metadata);
    const consistency = opConsistency ?? this.consistency;
    let urlPath = `/${this.siteID}`;
    if (storeName) {
      urlPath += `/${storeName}`;
    }
    if (key) {
      urlPath += `/${key}`;
    }
    if (this.edgeURL) {
      if (consistency === "strong" && !this.uncachedEdgeURL) {
        throw new BlobsConsistencyError();
      }
      const headers = {
        authorization: `Bearer ${this.token}`
      };
      if (encodedMetadata) {
        headers[METADATA_HEADER_INTERNAL] = encodedMetadata;
      }
      if (this.region) {
        urlPath = `/region:${this.region}${urlPath}`;
      }
      const url2 = new URL(urlPath, consistency === "strong" ? this.uncachedEdgeURL : this.edgeURL);
      for (const key2 in parameters) {
        url2.searchParams.set(key2, parameters[key2]);
      }
      return {
        headers,
        url: url2.toString()
      };
    }
    const apiHeaders = { authorization: `Bearer ${this.token}` };
    const url = new URL(`/api/v1/blobs${urlPath}`, this.apiURL ?? "https://api.netlify.com");
    for (const key2 in parameters) {
      url.searchParams.set(key2, parameters[key2]);
    }
    if (this.region) {
      url.searchParams.set("region", this.region);
    }
    if (storeName === void 0 || key === void 0) {
      return {
        headers: apiHeaders,
        url: url.toString()
      };
    }
    if (encodedMetadata) {
      apiHeaders[METADATA_HEADER_EXTERNAL] = encodedMetadata;
    }
    if (method === "head" || method === "delete") {
      return {
        headers: apiHeaders,
        url: url.toString()
      };
    }
    const res = await this.fetch(url.toString(), {
      headers: { ...apiHeaders, accept: SIGNED_URL_ACCEPT_HEADER },
      method
    });
    if (res.status !== 200) {
      throw await createBlobsInternalError(res, { edgeAccess: this.edgeAccess, method, storeName });
    }
    const { url: signedURL } = await res.json();
    const userHeaders = encodedMetadata ? { [METADATA_HEADER_INTERNAL]: encodedMetadata } : void 0;
    return {
      headers: userHeaders,
      url: signedURL
    };
  }
  async makeRequest({
    body,
    conditions = {},
    consistency,
    headers: extraHeaders,
    key,
    metadata,
    method,
    parameters,
    storeName
  }) {
    const { headers: baseHeaders = {}, url } = await this.getFinalRequest({
      consistency,
      key,
      metadata,
      method,
      parameters,
      storeName
    });
    const headers = {
      ...baseHeaders,
      ...extraHeaders
    };
    if (method === "put") {
      headers["cache-control"] = "max-age=0, stale-while-revalidate=60";
    }
    if ("onlyIfMatch" in conditions && conditions.onlyIfMatch) {
      headers["if-match"] = conditions.onlyIfMatch;
    } else if ("onlyIfNew" in conditions && conditions.onlyIfNew) {
      headers["if-none-match"] = "*";
    }
    const options = {
      body,
      headers,
      method
    };
    if (body instanceof ReadableStream) {
      options.duplex = "half";
    }
    const usesSignedUrl = !this.edgeURL && key !== void 0 && storeName !== void 0 && method !== "head" && method !== "delete";
    let getRetryUrl;
    if (usesSignedUrl) {
      getRetryUrl = async () => {
        const finalRequest = await this.getFinalRequest({ consistency, key, metadata, method, parameters, storeName });
        return finalRequest.url;
      };
    }
    return fetchAndRetry(this.fetch, url, options, void 0, getRetryUrl);
  }
};
var getClientOptions = (options, contextOverride) => {
  const context = contextOverride ?? getEnvironmentContext();
  const siteID = context.siteID ?? options.siteID;
  const token = context.token ?? options.token;
  if (!siteID || !token) {
    throw new MissingBlobsEnvironmentError(["siteID", "token"]);
  }
  if (options.region !== void 0 && !isValidRegion(options.region)) {
    throw new InvalidBlobsRegionError(options.region);
  }
  const clientOptions = {
    apiURL: context.apiURL ?? options.apiURL,
    consistency: options.consistency,
    edgeURL: context.edgeURL ?? options.edgeURL,
    fetch: options.fetch,
    region: options.region,
    siteID,
    token,
    uncachedEdgeURL: context.uncachedEdgeURL ?? options.uncachedEdgeURL
  };
  return clientOptions;
};

// node_modules/@netlify/blobs/dist/main.js
var LEGACY_STORE_INTERNAL_PREFIX = "netlify-internal/legacy-namespace/";
var STATUS_OK = 200;
var STATUS_PRE_CONDITION_FAILED = 412;
var STATUS_CONFLICT = 409;
var Store = class _Store {
  constructor(options) {
    this.client = options.client;
    if ("deployID" in options) {
      _Store.validateDeployID(options.deployID);
      let name = DEPLOY_STORE_PREFIX + options.deployID;
      if (options.name) {
        name += `:${options.name}`;
      }
      this.name = name;
    } else if (options.name.startsWith(LEGACY_STORE_INTERNAL_PREFIX)) {
      const storeName = options.name.slice(LEGACY_STORE_INTERNAL_PREFIX.length);
      _Store.validateStoreName(storeName);
      this.name = storeName;
    } else {
      _Store.validateStoreName(options.name);
      this.name = SITE_STORE_PREFIX + options.name;
    }
  }
  async delete(key) {
    const res = await this.client.makeRequest({ key, method: "delete", storeName: this.name });
    await discardBody(res);
    if (![200, 204, 404].includes(res.status)) {
      throw new BlobsInternalError(res, {
        edgeAccess: this.client.edgeAccess,
        method: "delete",
        storeName: this.name
      });
    }
  }
  async deleteAll() {
    let totalDeletedBlobs = 0;
    let hasMore = true;
    while (hasMore) {
      const res = await this.client.makeRequest({ method: "delete", storeName: this.name });
      if (res.status !== 200) {
        await discardBody(res);
        throw new BlobsInternalError(res, {
          edgeAccess: this.client.edgeAccess,
          method: "delete",
          storeName: this.name
        });
      }
      const data = await res.json();
      if (typeof data.blobs_deleted !== "number") {
        throw new BlobsInternalError(res);
      }
      totalDeletedBlobs += data.blobs_deleted;
      hasMore = typeof data.has_more === "boolean" && data.has_more;
    }
    return {
      deletedBlobs: totalDeletedBlobs
    };
  }
  async get(key, options) {
    return withSpan(options?.span, "blobs.get", async (span) => {
      const { consistency, type } = options ?? {};
      span?.setAttributes({
        "blobs.store": this.name,
        "blobs.key": key,
        "blobs.type": type,
        "blobs.method": "GET",
        "blobs.consistency": consistency
      });
      const res = await this.client.makeRequest({
        consistency,
        key,
        method: "get",
        storeName: this.name
      });
      span?.setAttributes({
        "blobs.response.body.size": res.headers.get("content-length") ?? void 0,
        "blobs.response.status": res.status
      });
      if (res.status === 404) {
        await discardBody(res);
        return null;
      }
      if (res.status !== 200) {
        await discardBody(res);
        throw new BlobsInternalError(res);
      }
      if (type === void 0 || type === "text") {
        return res.text();
      }
      if (type === "arrayBuffer") {
        return res.arrayBuffer();
      }
      if (type === "blob") {
        return res.blob();
      }
      if (type === "json") {
        return res.json();
      }
      if (type === "stream") {
        return res.body;
      }
      await discardBody(res);
      throw new BlobsInternalError(res);
    });
  }
  async getMetadata(key, options = {}) {
    return withSpan(options?.span, "blobs.getMetadata", async (span) => {
      span?.setAttributes({
        "blobs.store": this.name,
        "blobs.key": key,
        "blobs.method": "HEAD",
        "blobs.consistency": options.consistency
      });
      const res = await this.client.makeRequest({
        consistency: options.consistency,
        key,
        method: "head",
        storeName: this.name
      });
      span?.setAttributes({
        "blobs.response.status": res.status
      });
      if (res.status === 404) {
        return null;
      }
      if (res.status !== 200 && res.status !== 304) {
        throw new BlobsInternalError(res);
      }
      const etag = res?.headers.get("etag") ?? void 0;
      const metadata = getMetadataFromResponse(res);
      const result = {
        etag,
        metadata
      };
      return result;
    });
  }
  async getWithMetadata(key, options) {
    return withSpan(options?.span, "blobs.getWithMetadata", async (span) => {
      const { consistency, etag: requestETag, type } = options ?? {};
      const headers = requestETag ? { "if-none-match": requestETag } : void 0;
      span?.setAttributes({
        "blobs.store": this.name,
        "blobs.key": key,
        "blobs.method": "GET",
        "blobs.consistency": options?.consistency,
        "blobs.type": type,
        "blobs.request.etag": requestETag
      });
      const res = await this.client.makeRequest({
        consistency,
        headers,
        key,
        method: "get",
        storeName: this.name
      });
      const responseETag = res?.headers.get("etag") ?? void 0;
      span?.setAttributes({
        "blobs.response.body.size": res.headers.get("content-length") ?? void 0,
        "blobs.response.etag": responseETag,
        "blobs.response.status": res.status
      });
      if (res.status === 404) {
        await discardBody(res);
        return null;
      }
      if (res.status !== 200 && res.status !== 304) {
        await discardBody(res);
        throw new BlobsInternalError(res);
      }
      const metadata = getMetadataFromResponse(res);
      const result = {
        etag: responseETag,
        metadata
      };
      if (res.status === 304 && requestETag) {
        return { data: null, ...result };
      }
      if (type === void 0 || type === "text") {
        return { data: await res.text(), ...result };
      }
      if (type === "arrayBuffer") {
        return { data: await res.arrayBuffer(), ...result };
      }
      if (type === "blob") {
        return { data: await res.blob(), ...result };
      }
      if (type === "json") {
        return { data: await res.json(), ...result };
      }
      if (type === "stream") {
        return { data: res.body, ...result };
      }
      await discardBody(res);
      throw new Error(`Invalid 'type' property: ${type}. Expected: arrayBuffer, blob, json, stream, or text.`);
    });
  }
  list(options = {}) {
    return withSpan(options.span, "blobs.list", (span) => {
      span?.setAttributes({
        "blobs.store": this.name,
        "blobs.method": "GET",
        "blobs.list.paginate": options.paginate ?? false
      });
      const iterator = this.getListIterator(options);
      if (options.paginate) {
        return iterator;
      }
      return collectIterator(iterator).then(
        (items) => items.reduce(
          (acc, item) => ({
            blobs: [...acc.blobs, ...item.blobs],
            directories: [...acc.directories, ...item.directories]
          }),
          { blobs: [], directories: [] }
        )
      );
    });
  }
  async set(key, data, options = {}) {
    return withSpan(options.span, "blobs.set", async (span) => {
      span?.setAttributes({
        "blobs.store": this.name,
        "blobs.key": key,
        "blobs.method": "PUT",
        "blobs.data.size": typeof data == "string" ? data.length : data instanceof Blob ? data.size : data.byteLength,
        "blobs.data.type": typeof data == "string" ? "string" : data instanceof Blob ? "blob" : "arrayBuffer",
        "blobs.atomic": Boolean(options.onlyIfMatch ?? options.onlyIfNew)
      });
      _Store.validateKey(key);
      const conditions = _Store.getConditions(options);
      const res = await this.client.makeRequest({
        conditions,
        body: data,
        key,
        metadata: options.metadata,
        method: "put",
        storeName: this.name
      });
      const etag = res.headers.get("etag") ?? "";
      span?.setAttributes({
        "blobs.response.etag": etag,
        "blobs.response.status": res.status
      });
      if (conditions) {
        if (res.status === STATUS_PRE_CONDITION_FAILED || res.status === STATUS_CONFLICT) {
          await discardBody(res);
          return { modified: false };
        }
        if (res.ok) {
          await discardBody(res);
          return { etag, modified: true };
        }
        throw await createBlobsInternalError(res, {
          edgeAccess: this.client.edgeAccess,
          method: "put",
          storeName: this.name
        });
      }
      if (res.status === STATUS_OK) {
        await discardBody(res);
        return {
          etag,
          modified: true
        };
      }
      throw await createBlobsInternalError(res, {
        edgeAccess: this.client.edgeAccess,
        method: "put",
        storeName: this.name
      });
    });
  }
  async setJSON(key, data, options = {}) {
    return withSpan(options.span, "blobs.setJSON", async (span) => {
      span?.setAttributes({
        "blobs.store": this.name,
        "blobs.key": key,
        "blobs.method": "PUT",
        "blobs.data.type": "json",
        "blobs.atomic": Boolean(options.onlyIfMatch ?? options.onlyIfNew)
      });
      _Store.validateKey(key);
      const conditions = _Store.getConditions(options);
      const payload = JSON.stringify(data);
      const headers = {
        "content-type": "application/json"
      };
      const res = await this.client.makeRequest({
        conditions,
        body: payload,
        headers,
        key,
        metadata: options.metadata,
        method: "put",
        storeName: this.name
      });
      const etag = res.headers.get("etag") ?? "";
      span?.setAttributes({
        "blobs.response.etag": etag,
        "blobs.response.status": res.status
      });
      if (conditions) {
        if (res.status === STATUS_PRE_CONDITION_FAILED || res.status === STATUS_CONFLICT) {
          await discardBody(res);
          return { modified: false };
        }
        if (res.ok) {
          await discardBody(res);
          return { etag, modified: true };
        }
        throw await createBlobsInternalError(res, {
          edgeAccess: this.client.edgeAccess,
          method: "put",
          storeName: this.name
        });
      }
      if (res.status === STATUS_OK) {
        await discardBody(res);
        return {
          etag,
          modified: true
        };
      }
      throw await createBlobsInternalError(res, {
        edgeAccess: this.client.edgeAccess,
        method: "put",
        storeName: this.name
      });
    });
  }
  static formatListResultBlob(result) {
    if (!result.key) {
      return null;
    }
    return {
      etag: result.etag,
      key: result.key
    };
  }
  static getConditions(options) {
    if ("onlyIfMatch" in options && "onlyIfNew" in options) {
      throw new Error(
        `The 'onlyIfMatch' and 'onlyIfNew' options are mutually exclusive. Using 'onlyIfMatch' will make the write succeed only if there is an entry for the key with the given content, while 'onlyIfNew' will make the write succeed only if there is no entry for the key.`
      );
    }
    if ("onlyIfMatch" in options && options.onlyIfMatch) {
      if (typeof options.onlyIfMatch !== "string") {
        throw new Error(`The 'onlyIfMatch' property expects a string representing an ETag.`);
      }
      return {
        onlyIfMatch: options.onlyIfMatch
      };
    }
    if ("onlyIfNew" in options && options.onlyIfNew) {
      if (typeof options.onlyIfNew !== "boolean") {
        throw new Error(
          `The 'onlyIfNew' property expects a boolean indicating whether the write should fail if an entry for the key already exists.`
        );
      }
      return {
        onlyIfNew: true
      };
    }
  }
  static validateKey(key) {
    if (key === "") {
      throw new Error("Blob key must not be empty.");
    }
    if (key.startsWith("/") || key.startsWith("%2F")) {
      throw new Error("Blob key must not start with forward slash (/).");
    }
    if (new TextEncoder().encode(key).length > 600) {
      throw new Error(
        "Blob key must be a sequence of Unicode characters whose UTF-8 encoding is at most 600 bytes long."
      );
    }
  }
  static validateDeployID(deployID) {
    if (!/^\w{1,24}$/.test(deployID)) {
      throw new Error(`'${deployID}' is not a valid Netlify deploy ID.`);
    }
  }
  static validateStoreName(name) {
    if (name.includes("/") || name.includes("%2F")) {
      throw new Error("Store name must not contain forward slashes (/).");
    }
    if (new TextEncoder().encode(name).length > 64) {
      throw new Error(
        "Store name must be a sequence of Unicode characters whose UTF-8 encoding is at most 64 bytes long."
      );
    }
  }
  getListIterator(options) {
    const { client, name: storeName } = this;
    const parameters = {};
    if (options?.prefix) {
      parameters.prefix = options.prefix;
    }
    if (options?.directories) {
      parameters.directories = "true";
    }
    return {
      [Symbol.asyncIterator]() {
        let currentCursor = null;
        let done = false;
        return {
          async next() {
            return withSpan(options?.span, "blobs.list.next", async (span) => {
              span?.setAttributes({
                "blobs.store": storeName,
                "blobs.method": "GET",
                "blobs.list.paginate": options?.paginate ?? false,
                "blobs.list.done": done,
                "blobs.list.cursor": currentCursor ?? void 0
              });
              if (done) {
                return { done: true, value: void 0 };
              }
              const nextParameters = { ...parameters };
              if (currentCursor !== null) {
                nextParameters.cursor = currentCursor;
              }
              const res = await client.makeRequest({
                method: "get",
                parameters: nextParameters,
                storeName
              });
              span?.setAttributes({
                "blobs.response.status": res.status
              });
              let blobs = [];
              let directories = [];
              if (![200, 204, 404].includes(res.status)) {
                await discardBody(res);
                throw new BlobsInternalError(res);
              }
              if (res.status === 404) {
                await discardBody(res);
                done = true;
              } else {
                const page = await res.json();
                if (page.next_cursor) {
                  currentCursor = page.next_cursor;
                } else {
                  done = true;
                }
                blobs = (page.blobs ?? []).map(_Store.formatListResultBlob).filter(Boolean);
                directories = page.directories ?? [];
              }
              return {
                done: false,
                value: {
                  blobs,
                  directories
                }
              };
            });
          }
        };
      }
    };
  }
};
var getDeployStoreRegion = (clientOptions, context) => {
  if (clientOptions.region) {
    return clientOptions.region;
  }
  if (clientOptions.edgeURL || clientOptions.uncachedEdgeURL) {
    if (!context.primaryRegion) {
      throw new Error(
        "When accessing a deploy store, the Netlify Blobs client needs to be configured with a region, and one was not found in the environment. To manually set the region, set the `region` property in the store options. If you are using the Netlify CLI, you may have an outdated version; run `npm install -g netlify-cli@latest` to update and try again."
      );
    }
    return context.primaryRegion;
  }
  return REGION_AUTO;
};
var getStore = (input, options) => {
  if (typeof input === "string") {
    const contextOverride = options?.siteID && options?.token ? { siteID: options?.siteID, token: options?.token } : void 0;
    const clientOptions = getClientOptions(options ?? {}, contextOverride);
    const client = new Client(clientOptions);
    return new Store({ client, name: input });
  }
  if (typeof input?.name === "string") {
    const { name } = input;
    const contextOverride = input?.siteID && input?.token ? { siteID: input?.siteID, token: input?.token } : void 0;
    const clientOptions = getClientOptions(input, contextOverride);
    if (!name) {
      throw new MissingBlobsEnvironmentError(["name"]);
    }
    const client = new Client(clientOptions);
    return new Store({ client, name });
  }
  if (typeof input?.deployID === "string") {
    const context = getEnvironmentContext();
    const clientOptions = getClientOptions(input, context);
    const { deployID } = input;
    if (!deployID) {
      throw new MissingBlobsEnvironmentError(["deployID"]);
    }
    clientOptions.region = getDeployStoreRegion(clientOptions, context);
    const client = new Client(clientOptions);
    return new Store({ client, deployID });
  }
  throw new Error(
    "The `getStore` method requires the name of the store as a string or as the `name` property of an options object"
  );
};

// lib/game.mjs
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
var GAME_KEY = "game";
var AUTH_KEY = "auth";
var LIMITS = { teamName: 40, member: 40, members: 12, reason: 140, announcement: 280, roundName: 40, rounds: 30, teams: 100 };
var id = () => randomBytes(6).toString("hex");
var now = () => (/* @__PURE__ */ new Date()).toISOString();
var HttpError = class extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
};
function freshGame() {
  return {
    title: "Silly Quiz",
    registrationOpen: true,
    rounds: [{ id: id(), name: "Round 1" }],
    teams: [],
    scores: {},
    adjustments: [],
    announcements: [],
    updatedAt: now()
  };
}
function cleanText(value, max, label, { required = true } = {}) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (required && !text) throw new HttpError(400, `${label} can't be empty.`);
  if (text.length > max) throw new HttpError(400, `${label} must be ${max} characters or fewer.`);
  return text;
}
function cleanMembers(members) {
  if (!Array.isArray(members)) throw new HttpError(400, "Add at least one team member.");
  const list = members.map((m) => cleanText(m, LIMITS.member, "Member name", { required: false })).filter(Boolean);
  if (!list.length) throw new HttpError(400, "Add at least one team member.");
  if (list.length > LIMITS.members) throw new HttpError(400, `Teams can have up to ${LIMITS.members} members.`);
  return list;
}
function cleanCaptain(captain, members) {
  const name = cleanText(captain, LIMITS.member, "Team captain", { required: false });
  if (!name) throw new HttpError(400, "Pick a team captain.");
  const match = members.find((m) => m.toLowerCase() === name.toLowerCase());
  if (!match) throw new HttpError(400, "The captain must be one of the team members.");
  return match;
}
function cleanNumber(value, label) {
  if (value === "" || value === null || value === void 0) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || Math.abs(n) > 1e5) throw new HttpError(400, `${label} must be a number.`);
  return Math.round(n * 100) / 100;
}
function hashPin(pin, salt) {
  return createHash("sha256").update(`${salt}:${pin}`).digest("hex");
}
function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}
function publicView(game) {
  return {
    ...game,
    teams: game.teams.map(({ token, ...team }) => team)
  };
}
function createGame(store, env = {}) {
  async function read() {
    const entry = await store.getWithMetadata(GAME_KEY, { type: "json", consistency: "strong" });
    return entry ? { game: entry.data, etag: entry.etag } : { game: freshGame(), etag: null };
  }
  async function mutate(fn) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const { game, etag } = await read();
      const result = fn(game);
      game.updatedAt = now();
      const res = await store.setJSON(GAME_KEY, game, etag ? { onlyIfMatch: etag } : { onlyIfNew: true });
      if (res?.modified !== false) return { game, result };
      await new Promise((r) => setTimeout(r, 40 + Math.random() * 120));
    }
    throw new HttpError(409, "Lots happening at once \u2014 please try again.");
  }
  async function authState() {
    if (env.HOST_PIN) return { configured: true, source: "env" };
    const auth = await store.get(AUTH_KEY, { type: "json", consistency: "strong" });
    return { configured: Boolean(auth), source: "blob", auth };
  }
  async function checkPin(pin) {
    if (!pin) throw new HttpError(401, "Enter the host PIN.");
    if (env.HOST_PIN) {
      if (!safeEqual(pin, env.HOST_PIN)) throw new HttpError(401, "That PIN isn't right.");
      return;
    }
    const auth = await store.get(AUTH_KEY, { type: "json", consistency: "strong" });
    if (!auth) throw new HttpError(428, "No host PIN has been set yet.");
    if (!safeEqual(hashPin(pin, auth.salt), auth.hash)) throw new HttpError(401, "That PIN isn't right.");
  }
  async function setupPin(pin) {
    if (env.HOST_PIN) throw new HttpError(409, "The host PIN is set in Netlify settings.");
    pin = String(pin ?? "").trim();
    if (pin.length < 4 || pin.length > 32) throw new HttpError(400, "Choose a PIN of 4\u201332 characters.");
    const salt = id();
    const res = await store.setJSON(AUTH_KEY, { salt, hash: hashPin(pin, salt), createdAt: now() }, { onlyIfNew: true });
    if (res?.modified === false) throw new HttpError(409, "A host PIN already exists. Log in instead.");
  }
  const hostActions = {
    verify: () => ({}),
    setTitle: (g, { title }) => {
      g.title = cleanText(title, 40, "Quiz name");
    },
    toggleRegistration: (g, { open }) => {
      g.registrationOpen = Boolean(open);
    },
    addRound: (g, { name }) => {
      if (g.rounds.length >= LIMITS.rounds) throw new HttpError(400, `Up to ${LIMITS.rounds} rounds.`);
      const round = { id: id(), name: cleanText(name || `Round ${g.rounds.length + 1}`, LIMITS.roundName, "Round name") };
      g.rounds.push(round);
      return round;
    },
    renameRound: (g, { roundId, name }) => {
      const round = g.rounds.find((r) => r.id === roundId);
      if (!round) throw new HttpError(404, "Round not found.");
      round.name = cleanText(name, LIMITS.roundName, "Round name");
    },
    deleteRound: (g, { roundId }) => {
      g.rounds = g.rounds.filter((r) => r.id !== roundId);
      for (const t of Object.keys(g.scores)) delete g.scores[t][roundId];
    },
    setScore: (g, { teamId, roundId, score }) => {
      if (!g.teams.some((t) => t.id === teamId)) throw new HttpError(404, "Team not found.");
      if (!g.rounds.some((r) => r.id === roundId)) throw new HttpError(404, "Round not found.");
      const value = cleanNumber(score, "Score");
      g.scores[teamId] ??= {};
      if (value === null) delete g.scores[teamId][roundId];
      else g.scores[teamId][roundId] = value;
    },
    adjust: (g, { teamId, points, reason }) => {
      if (!g.teams.some((t) => t.id === teamId)) throw new HttpError(404, "Team not found.");
      const value = cleanNumber(points, "Points");
      if (!value) throw new HttpError(400, "Enter a number of points (not zero).");
      const adj = { id: id(), teamId, points: value, reason: cleanText(reason, LIMITS.reason, "Reason"), at: now() };
      g.adjustments.unshift(adj);
      return adj;
    },
    deleteAdjustment: (g, { adjustmentId }) => {
      g.adjustments = g.adjustments.filter((a) => a.id !== adjustmentId);
    },
    announce: (g, { text }) => {
      const a = { id: id(), text: cleanText(text, LIMITS.announcement, "Announcement"), at: now() };
      g.announcements.unshift(a);
      g.announcements = g.announcements.slice(0, 50);
      return a;
    },
    deleteAnnouncement: (g, { announcementId }) => {
      g.announcements = g.announcements.filter((a) => a.id !== announcementId);
    },
    removeTeam: (g, { teamId }) => {
      g.teams = g.teams.filter((t) => t.id !== teamId);
      delete g.scores[teamId];
      g.adjustments = g.adjustments.filter((a) => a.teamId !== teamId);
    },
    resetScores: (g) => {
      g.scores = {};
      g.adjustments = [];
      g.announcements = [];
    },
    newGame: (g) => {
      Object.assign(g, freshGame(), { title: g.title });
    }
  };
  async function handle(method, route, body = {}, headers = {}) {
    try {
      if (method === "GET" && route === "state") {
        const { game } = await read();
        return ok(publicView(game));
      }
      if (method === "GET" && route === "host/status") {
        const { configured, source } = await authState();
        return ok({ configured, source });
      }
      if (method !== "POST") throw new HttpError(405, "Method not allowed.");
      if (route === "join") {
        const name = cleanText(body.name, LIMITS.teamName, "Team name");
        const members = cleanMembers(body.members);
        const captain = cleanCaptain(body.captain, members);
        const token = randomBytes(16).toString("hex");
        const { result } = await mutate((g) => {
          if (!g.registrationOpen) throw new HttpError(403, "Registration is closed \u2014 ask the host.");
          if (g.teams.length >= LIMITS.teams) throw new HttpError(400, "This quiz is full.");
          if (g.teams.some((t) => t.name.toLowerCase() === name.toLowerCase()))
            throw new HttpError(409, "That team name is taken \u2014 get sillier!");
          const team = { id: id(), name, members, captain, token, joinedAt: now() };
          g.teams.push(team);
          return team;
        });
        return ok({ teamId: result.id, token });
      }
      if (route === "team/update") {
        const members = cleanMembers(body.members);
        await mutate((g) => {
          const team = g.teams.find((t) => t.id === body.teamId);
          if (!team || !body.token || !safeEqual(team.token, body.token)) throw new HttpError(403, "You can only edit your own team.");
          team.members = members;
          if (body.captain !== void 0) team.captain = cleanCaptain(body.captain, members);
          else if (team.captain && !members.includes(team.captain)) team.captain = members[0];
        });
        return ok({ saved: true });
      }
      if (route === "host/setup") {
        await setupPin(body.pin);
        return ok({ configured: true });
      }
      if (route === "host") {
        await checkPin(headers["x-host-pin"]);
        const action = hostActions[body.action];
        if (!action) throw new HttpError(400, "Unknown action.");
        if (body.action === "verify") return ok({ verified: true });
        const { game, result } = await mutate((g) => action(g, body));
        return ok({ result: result ?? null, state: publicView(game) });
      }
      throw new HttpError(404, "Not found.");
    } catch (err) {
      if (err instanceof HttpError) return { status: err.status, body: { error: err.message } };
      console.error(err);
      return { status: 500, body: { error: "Something went wrong. Try again." } };
    }
  }
  return { handle };
}
var ok = (body) => ({ status: 200, body });

// netlify/functions/api.mjs
var api_default = async (req) => {
  const url = new URL(req.url);
  const route = url.pathname.replace(/^\/(\.netlify\/functions\/api|api)\/?/, "").replace(/\/$/, "");
  let body = {};
  if (req.method === "POST") {
    try {
      body = await req.json();
    } catch {
      body = {};
    }
  }
  const headers = { "x-host-pin": req.headers.get("x-host-pin") || "" };
  const game = createGame(getStore("silly-quiz"), { HOST_PIN: process.env.HOST_PIN });
  const { status, body: out } = await game.handle(req.method, route, body, headers);
  return new Response(JSON.stringify(out), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" }
  });
};
var config = { path: "/api/*" };
export {
  config,
  api_default as default
};
