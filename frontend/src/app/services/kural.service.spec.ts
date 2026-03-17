import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { DOCUMENT } from '@angular/common';
import { AdhigaramSummary, Kural, KuralService } from './kural.service';

const createKural = (number: number): Kural => ({
    number,
    line1: `Line 1 ${number}`,
    line2: `Line 2 ${number}`,
    iyal: 'இயல்',
    iyal_tr: 'Division',
    iyal_tl: 'Iyal',
    pal: 'பால்',
    pal_tr: 'Section',
    pal_tl: 'Paal',
    adikaram: 'அதிகாரம்',
    adikaram_tr: 'Chapter',
    adikaram_tl: 'Adhigaram',
    translation: `Translation ${number}`,
    couplet: `Couplet ${number}`,
    explanation: `Explanation ${number}`
});

describe('KuralService', () => {
    let service: KuralService;
    let httpMock: HttpTestingController;
    let document: Document;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                KuralService,
                provideHttpClient(),
                provideHttpClientTesting()
            ]
        });
        service = TestBed.inject(KuralService);
        httpMock = TestBed.inject(HttpTestingController);
        document = TestBed.inject(DOCUMENT);
    });

    afterEach(() => {
        document.getElementById('prerender-route-data')?.remove();
        httpMock.verify();
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should fetch a kural by number', () => {
        const dummyKural = createKural(1);
        const chunkId = '1-100';

        service.getKural(1).subscribe(kural => {
            expect(kural).toBeTruthy();
            expect(kural?.number).toBe(1);
            expect(kural?.line1).toBe('Line 1 1');
        });

        const req = httpMock.expectOne(`/data/thirukkural/${chunkId}.json`);
        expect(req.request.method).toBe('GET');
        req.flush([dummyKural]);
    });

    it('should use prerendered kural snapshot without issuing an http request', () => {
        const prerenderedKural = createKural(42);
        const script = document.createElement('script');
        script.id = 'prerender-route-data';
        script.type = 'application/json';
        script.textContent = JSON.stringify({
            type: 'kural',
            payload: prerenderedKural
        });
        document.body.appendChild(script);

        service.getKural(42).subscribe(kural => {
            expect(kural?.number).toBe(42);
            expect(kural?.translation).toBe('Translation 42');
        });

        httpMock.expectNone('/data/thirukkural/1-100.json');
        expect(document.getElementById('prerender-route-data')).toBeNull();
    });

    it('should return undefined for invalid kural number', () => {
        service.getKural(0).subscribe(kural => {
            expect(kural).toBeUndefined();
        });

        service.getKural(1331).subscribe(kural => {
            expect(kural).toBeUndefined();
        });

        httpMock.expectNone('/data/thirukkural/1-100.json');
    });

    it('should fetch an adhigaram with its ten kurals', () => {
        const adhigaram: AdhigaramSummary = {
            id: 1,
            start: 1,
            end: 10,
            pal: 'பால்',
            pal_tr: 'Section',
            pal_tl: 'Paal',
            iyal: 'இயல்',
            iyal_tr: 'Division',
            iyal_tl: 'Iyal',
            adikaram: 'அதிகாரம்',
            adikaram_tr: 'Chapter',
            adikaram_tl: 'Adhigaram'
        };
        const chunk = Array.from({ length: 100 }, (_, index) => createKural(index + 1));

        service.getAdhigaram(1).subscribe(page => {
            expect(page).toBeTruthy();
            expect(page?.id).toBe(1);
            expect(page?.kurals).toHaveLength(10);
            expect(page?.kurals[0].number).toBe(1);
            expect(page?.kurals[9].number).toBe(10);
        });

        const adhigaramReq = httpMock.expectOne('/data/thirukkural/adhigarams.json');
        adhigaramReq.flush([adhigaram]);

        const chunkReq = httpMock.expectOne('/data/thirukkural/1-100.json');
        chunkReq.flush(chunk);
    });

    it('should use prerendered adhigaram snapshot without issuing http requests', () => {
        const prerenderedAdhigaram = {
            id: 12,
            start: 111,
            end: 120,
            pal: 'à®ªà®¾à®²à¯',
            pal_tr: 'Section',
            pal_tl: 'Paal',
            iyal: 'à®‡à®¯à®²à¯',
            iyal_tr: 'Division',
            iyal_tl: 'Iyal',
            adikaram: 'à®…à®¤à®¿à®•à®¾à®°à®®à¯',
            adikaram_tr: 'Chapter',
            adikaram_tl: 'Adhigaram',
            kurals: Array.from({ length: 10 }, (_, index) => createKural(111 + index))
        };

        const script = document.createElement('script');
        script.id = 'prerender-route-data';
        script.type = 'application/json';
        script.textContent = JSON.stringify({
            type: 'adhigaram',
            payload: prerenderedAdhigaram
        });
        document.body.appendChild(script);

        service.getAdhigaram(12).subscribe(page => {
            expect(page?.id).toBe(12);
            expect(page?.kurals).toHaveLength(10);
            expect(page?.kurals[0].number).toBe(111);
        });

        httpMock.expectNone('/data/thirukkural/adhigarams.json');
        httpMock.expectNone('/data/thirukkural/101-200.json');
        expect(document.getElementById('prerender-route-data')).toBeNull();
    });

    it('should return undefined for invalid adhigaram number', () => {
        service.getAdhigaram(0).subscribe(page => {
            expect(page).toBeUndefined();
        });

        httpMock.expectNone('/data/thirukkural/adhigarams.json');
    });
});
