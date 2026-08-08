const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const { URL } = require('node:url');

const API_HOST = process.env.KUBERNETES_SERVICE_HOST;
const API_PORT = process.env.KUBERNETES_SERVICE_PORT || '443';
const NAMESPACE_FILE = '/var/run/secrets/kubernetes.io/serviceaccount/namespace';
const TOKEN_FILE = '/var/run/secrets/kubernetes.io/serviceaccount/token';
const CA_FILE = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';
const GROUP = 'stable.dwk';
const VERSION = 'v1';
const RESOURCE = 'dummysites';

if (!API_HOST) throw new Error('KUBERNETES_SERVICE_HOST is not set');

const namespace = fs.readFileSync(NAMESPACE_FILE, 'utf8').trim();
const token = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
const ca = fs.readFileSync(CA_FILE);
const managedBy = 'dummy-site-controller';
const active = new Set();

function apiRequest(path, { method = 'GET', body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const request = https.request({
      hostname: API_HOST,
      port: API_PORT,
      path,
      method,
      ca,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
    }, (response) => {
      let data = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        let parsed;
        try { parsed = data ? JSON.parse(data) : {}; } catch { parsed = data; }
        if (response.statusCode >= 200 && response.statusCode < 300) resolve(parsed);
        else if (response.statusCode === 404) resolve(null);
        else reject(new Error(`${method} ${path}: ${response.statusCode} ${data}`));
      });
    });
    request.on('error', reject);
    if (body) request.write(JSON.stringify(body));
    request.end();
  });
}

function fetchHtml(target, redirects = 0) {
  if (redirects > 5) return Promise.reject(new Error('Too many redirects'));
  const url = new URL(target);
  if (!['http:', 'https:'].includes(url.protocol)) {
    return Promise.reject(new Error('website_url must use http or https'));
  }
  const transport = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const request = transport.get(url, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
        response.resume();
        resolve(fetchHtml(new URL(response.headers.location, url).toString(), redirects + 1));
        return;
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        reject(new Error(`Fetching ${target} failed with HTTP ${response.statusCode}`));
        return;
      }
      let html = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { html += chunk; });
      response.on('end', () => resolve(html));
    });
    request.setTimeout(15000, () => request.destroy(new Error('Fetch timed out')));
    request.on('error', reject);
  });
}

function ownerReference(site) {
  return [{
    apiVersion: `${GROUP}/${VERSION}`,
    kind: 'DummySite',
    name: site.metadata.name,
    uid: site.metadata.uid,
    controller: true,
    blockOwnerDeletion: true,
  }];
}

async function applyNamespacedResource(path, resource) {
  const resourcePath = `${path}/${resource.metadata.name}`;
  const existing = await apiRequest(resourcePath);
  if (!existing) {
    await apiRequest(path, { method: 'POST', body: resource });
    return;
  }
  resource.metadata.resourceVersion = existing.metadata.resourceVersion;
  if (resource.kind === 'Service') {
    resource.spec.clusterIP = existing.spec.clusterIP;
    if (existing.spec.clusterIPs) resource.spec.clusterIPs = existing.spec.clusterIPs;
    if (existing.spec.ipFamilies) resource.spec.ipFamilies = existing.spec.ipFamilies;
    if (existing.spec.ipFamilyPolicy) resource.spec.ipFamilyPolicy = existing.spec.ipFamilyPolicy;
  }
  await apiRequest(resourcePath, { method: 'PUT', body: resource });
}

async function reconcile(site) {
  const name = site.metadata.name;
  const safeName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 50).replace(/-+$/, '');
  const websiteUrl = site.spec?.website_url;
  if (!websiteUrl) throw new Error(`${name} has no spec.website_url`);
  const html = await fetchHtml(websiteUrl);
  const labels = { app: `dummy-site-${safeName}`, 'managed-by': managedBy };
  const owners = ownerReference(site);
  const configMapName = `${safeName}-html`;
  const deploymentName = `${safeName}-server`;
  const serviceName = `${safeName}-service`;
  const base = `/api/v1/namespaces/${encodeURIComponent(site.metadata.namespace || namespace)}`;
  const appsBase = `/apis/apps/v1/namespaces/${encodeURIComponent(site.metadata.namespace || namespace)}`;

  await applyNamespacedResource(`${base}/configmaps`, {
    apiVersion: 'v1', kind: 'ConfigMap', metadata: { name: configMapName, labels, ownerReferences: owners },
    data: { 'index.html': html },
  });
  await applyNamespacedResource(`${base}/services`, {
    apiVersion: 'v1', kind: 'Service', metadata: { name: serviceName, labels, ownerReferences: owners },
    spec: { selector: labels, ports: [{ name: 'http', port: 80, targetPort: 80 }] },
  });
  await applyNamespacedResource(`${appsBase}/deployments`, {
    apiVersion: 'apps/v1', kind: 'Deployment', metadata: { name: deploymentName, labels, ownerReferences: owners },
    spec: {
      replicas: 1,
      selector: { matchLabels: labels },
      template: { metadata: { labels }, spec: { containers: [{
        name: 'nginx', image: 'nginx:1.27-alpine', ports: [{ containerPort: 80 }],
        volumeMounts: [{ name: 'site', mountPath: '/usr/share/nginx/html' }],
      }], volumes: [{ name: 'site', configMap: { name: configMapName } }] } },
    },
  });
  console.log(`Reconciled DummySite ${name} from ${websiteUrl}`);
}

async function watch(path, onEvent) {
  const response = await new Promise((resolve, reject) => {
    const request = https.get({ hostname: API_HOST, port: API_PORT, path, ca,
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } }, resolve);
    request.on('error', reject);
  });
  if (response.statusCode !== 200) throw new Error(`Watch failed with HTTP ${response.statusCode}`);
  let buffer = '';
  for await (const chunk of response) {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) if (line.trim()) await onEvent(JSON.parse(line));
  }
}

async function handleEvent(event) {
  const site = event.object;
  if (!site?.metadata?.name || !['ADDED', 'MODIFIED'].includes(event.type)) return;
  const key = `${site.metadata.namespace}/${site.metadata.name}`;
  if (active.has(key)) return;
  active.add(key);
  try { await reconcile(site); } catch (error) { console.error(`Failed to reconcile ${key}:`, error.message); }
  finally { active.delete(key); }
}

async function run() {
  const listPath = `/apis/${GROUP}/${VERSION}/${RESOURCE}`;
  while (true) {
    try {
      const list = await apiRequest(listPath);
      const resourceVersion = list.metadata.resourceVersion;
      await Promise.all((list.items || []).map(handleEvent));
      const watchPath = `${listPath}?watch=true&resourceVersion=${encodeURIComponent(resourceVersion)}`;
      await watch(watchPath, handleEvent);
    } catch (error) {
      console.error('Controller loop failed:', error.message);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
