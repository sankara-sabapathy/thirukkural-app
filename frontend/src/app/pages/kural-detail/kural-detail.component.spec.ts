import { DOCUMENT } from '@angular/common';
import { ChangeDetectorRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { KuralDetailComponent } from './kural-detail.component';
import { Kural, KuralService } from '../../services/kural.service';
import { SeoService } from '../../services/seo.service';

describe('KuralDetailComponent', () => {
    let component: KuralDetailComponent;
    let fixture: ComponentFixture<KuralDetailComponent>;
    let seoService: SeoService;
    let document: Document;

    const kuralFixture: Kural = {
        number: 1078,
        line1: 'சொல்லப் பயன்படுவர் சான்றோர்',
        line1_tl: 'Sollap payanpaduvar saanror',
        line2: 'கயவர் அவரால் அல்லர்',
        line2_tl: 'Kayavar avaraal allar',
        iyal: 'குடியியல்',
        iyal_tr: 'Miscellaneous',
        iyal_tl: 'Kudiyiyal',
        pal: 'பொருட்பால்',
        pal_tr: 'Wealth',
        pal_tl: 'Porutpaal',
        adikaram: 'கயமை',
        adikaram_tr: 'Baseness',
        adikaram_tl: 'Kayamai',
        translation: 'The base do not profit from words that help the wise.',
        couplet: 'The base gain not from words that guide the wise.',
        explanation: 'A mean person does not benefit from good counsel.',
        mu_varatha: ['Mu. Varadarajan', 'Detailed commentary']
    };

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [KuralDetailComponent],
            providers: [
                provideRouter([]),
                SeoService,
                { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map() }, paramMap: of(new Map()) } },
                { provide: KuralService, useValue: { getKural: vi.fn().mockReturnValue(of(kuralFixture)) } },
                { provide: MatSnackBar, useValue: { open: vi.fn() } },
                { provide: ChangeDetectorRef, useValue: { markForCheck: vi.fn() } }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(KuralDetailComponent);
        component = fixture.componentInstance;
        seoService = TestBed.inject(SeoService);
        document = TestBed.inject(DOCUMENT);
    });

    afterEach(() => {
        seoService.removeStructuredData('structured-data-kural');
    });

    it('should emit a breadcrumb graph for kural structured data', () => {
        component.injectStructuredData(kuralFixture);

        const script = document.getElementById('structured-data-kural') as HTMLScriptElement | null;
        expect(script).toBeTruthy();

        const payload = JSON.parse(script!.textContent || '{}');
        expect(payload['@context']).toBe('https://schema.org');
        expect(Array.isArray(payload['@graph'])).toBe(true);

        const breadcrumb = payload['@graph'].find((entry: any) => entry['@type'] === 'BreadcrumbList');
        expect(breadcrumb).toBeTruthy();
        expect(breadcrumb.itemListElement).toEqual([
            {
                '@type': 'ListItem',
                position: 1,
                name: 'Home',
                item: 'https://thirukkural.site/'
            },
            {
                '@type': 'ListItem',
                position: 2,
                name: 'Kurals',
                item: 'https://thirukkural.site/kurals'
            },
            {
                '@type': 'ListItem',
                position: 3,
                name: 'Adhigaram 108: Baseness',
                item: 'https://thirukkural.site/adhigaram/108'
            },
            {
                '@type': 'ListItem',
                position: 4,
                name: 'Thirukkural 1078',
                item: 'https://thirukkural.site/kural/1078'
            }
        ]);

        const webPage = payload['@graph'].find((entry: any) => entry['@type'] === 'WebPage');
        expect(webPage.mainEntity).toEqual({ '@id': 'https://thirukkural.site/kural/1078#creativework' });
    });
});
