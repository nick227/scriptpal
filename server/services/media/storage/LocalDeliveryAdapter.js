export class LocalDeliveryAdapter {
  constructor({ baseUrl }) {
    this.baseUrl = baseUrl;
    this.provider = 'local';
  }

  getPublicUrl({ key }) {
    const normalized = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;
    const normalizedKey = key.startsWith('/') ? key.slice(1) : key;
    return `${normalized}/${normalizedKey}`;
  }

  getSignedUrl({ key }) {
    return this.getPublicUrl({ key });
  }
}
