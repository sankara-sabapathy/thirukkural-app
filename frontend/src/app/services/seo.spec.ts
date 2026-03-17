import { DOCUMENT } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { SeoService } from './seo.service';

describe('SeoService', () => {
    let service: SeoService;
    let titleService: Title;
    let metaService: Meta;
    let document: Document;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                SeoService,
                { provide: PLATFORM_ID, useValue: 'browser' }
            ]
        });

        service = TestBed.inject(SeoService);
        titleService = TestBed.inject(Title);
        metaService = TestBed.inject(Meta);
        document = TestBed.inject(DOCUMENT);
    });

    afterEach(() => {
        document.querySelector("link[rel='canonical']")?.remove();
        document.getElementById('structured-data-test')?.remove();
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should update title, metadata, and canonical url', () => {
        service.generateTags({
            title: 'Adhigaram 1',
            description: 'Chapter description',
            keywords: 'thirukkural, chapter',
            url: 'https://thirukkural.site/adhigaram/1'
        });

        expect(titleService.getTitle()).toBe('Adhigaram 1 | Thirukkural Daily');
        expect(metaService.getTag("name='description'")?.content).toBe('Chapter description');
        expect(metaService.getTag("name='keywords'")?.content).toBe('thirukkural, chapter');
        expect(document.querySelector("link[rel='canonical']")?.getAttribute('href'))
            .toBe('https://thirukkural.site/adhigaram/1');
    });

    it('should remove stale optional metadata and apply robots defaults', () => {
        service.generateTags({
            title: 'Kural 1',
            description: 'Kural page',
            keywords: 'thirukkural, kural 1',
            robots: 'noindex, nofollow',
            url: 'https://thirukkural.site/kural/1'
        });

        service.generateTags({
            title: 'About',
            description: 'About page',
            url: 'https://thirukkural.site/about'
        });

        expect(metaService.getTag("name='keywords'")).toBeNull();
        expect(metaService.getTag("name='robots'")?.content).toBe('index, follow');
        expect(metaService.getTag("name='author'")?.content).toBe('Thirukkural Daily');
    });

    it('should replace structured data for the same script id', () => {
        service.setStructuredData({ name: 'first' }, 'structured-data-test');
        service.setStructuredData({ name: 'second' }, 'structured-data-test');

        const script = document.getElementById('structured-data-test');
        expect(script).toBeTruthy();
        expect(script?.textContent).toContain('second');
        expect(document.querySelectorAll('#structured-data-test')).toHaveLength(1);
    });

    it('should remove structured data by script id', () => {
        service.setStructuredData({ name: 'temporary' }, 'structured-data-test');
        service.removeStructuredData('structured-data-test');

        expect(document.getElementById('structured-data-test')).toBeNull();
    });
});
