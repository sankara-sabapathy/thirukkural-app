import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';

export interface SeoConfig {
  title: string;
  description: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: string;
  author?: string;
  robots?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SeoService {
  private defaultImage = 'https://thirukkural.site/assets/icons/icon-512x512.png';
  private defaultType = 'website';
  private siteName = 'Thirukkural Daily';
  private isBrowser: boolean;

  constructor(
    private titleService: Title,
    private metaService: Meta,
    @Inject(DOCUMENT) private document: Document,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  generateTags(config: SeoConfig) {
    // 1. Basic Title and Description
    const fullTitle = `${config.title} | ${this.siteName}`;
    this.titleService.setTitle(fullTitle);
    this.metaService.updateTag({ name: 'title', content: fullTitle });
    
    this.metaService.updateTag({ name: 'description', content: config.description });
    this.updateOptionalMetaTag('keywords', config.keywords);
    this.metaService.updateTag({ name: 'author', content: config.author || this.siteName });
    this.metaService.updateTag({ name: 'robots', content: config.robots || 'index, follow' });

    // 2. OpenGraph Meta Tags (Facebook, LinkedIn, iMessage, WhatsApp)
    this.metaService.updateTag({ property: 'og:type', content: config.type || this.defaultType });
    this.metaService.updateTag({ property: 'og:site_name', content: this.siteName });
    this.metaService.updateTag({ property: 'og:title', content: config.title });
    this.metaService.updateTag({ property: 'og:description', content: config.description });
    this.metaService.updateTag({ property: 'og:image', content: config.image || this.defaultImage });
    if (config.url) {
      this.metaService.updateTag({ property: 'og:url', content: config.url });
    }

    // 3. Twitter Card Meta Tags
    this.metaService.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.metaService.updateTag({ name: 'twitter:title', content: config.title });
    this.metaService.updateTag({ name: 'twitter:description', content: config.description });
    this.metaService.updateTag({ name: 'twitter:image', content: config.image || this.defaultImage });
    if (config.url) {
      this.metaService.updateTag({ name: 'twitter:url', content: config.url });
    }

    // 4. Update Canonical Link
    this.updateCanonicalUrl(config.url || this.document.URL);
  }

  updateCanonicalUrl(url: string) {
    let link: HTMLLinkElement | null = this.document.querySelector("link[rel='canonical']");
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    // Clean up URL if needed (remove trailing slashes, query params etc., based on requirements)
    const cleanUrl = url.split('?')[0]; 
    link.setAttribute('href', cleanUrl);
  }

  setStructuredData(jsonData: any, scriptId: string = 'structured-data-kural') {
    if (!this.isBrowser) {
        // Skip appending script block if running in native SSR mode to avoid duplicate injections
        // Though we are moving to Custom SSG, this check is good practice
    }
    
    let script = this.document.getElementById(scriptId) as HTMLScriptElement;
    if (script) {
        script.remove();
    }
    
    script = this.document.createElement('script');
    script.type = 'application/ld+json';
    script.id = scriptId;
    script.text = JSON.stringify(jsonData);
    this.document.head.appendChild(script);
  }

  removeStructuredData(scriptId: string) {
    const script = this.document.getElementById(scriptId);
    if (script) {
      script.remove();
    }
  }

  private updateOptionalMetaTag(name: string, content?: string): void {
    if (content) {
      this.metaService.updateTag({ name, content });
      return;
    }

    this.metaService.removeTag(`name='${name}'`);
  }
}
