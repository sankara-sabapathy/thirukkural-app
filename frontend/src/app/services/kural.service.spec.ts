import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { KuralService } from './kural.service';

describe('KuralService', () => {
    let service: KuralService;
    let httpMock: HttpTestingController;

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
    });

    afterEach(() => {
        httpMock.verify();
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should fetch a kural by number', () => {
        const dummyKural = { number: 1, line1: 'Test Line 1', line2: 'Test Line 2', translation: 'Test Translation' };
        const chunkId = '1-100';

        service.getKural(1).subscribe(kural => {
            expect(kural).toBeTruthy();
            expect(kural?.number).toBe(1);
            expect(kural?.line1).toBe('Test Line 1');
        });

        const req = httpMock.expectOne(`https://raw.githubusercontent.com/sankara-sabapathy/thirukkural-dataset/main/thirukkural-data/${chunkId}.json`);
        expect(req.request.method).toBe('GET');
        req.flush([dummyKural]);
    });

    it('should return undefined for invalid kural number', () => {
        service.getKural(0).subscribe(kural => {
            expect(kural).toBeUndefined();
        });

        service.getKural(1331).subscribe(kural => {
            expect(kural).toBeUndefined();
        });

        httpMock.expectNone('https://raw.githubusercontent.com/sankara-sabapathy/thirukkural-dataset/main/thirukkural-data/1-100.json');
    });
});
