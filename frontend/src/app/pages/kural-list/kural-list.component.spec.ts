import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, ParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { KuralListComponent } from './kural-list.component';
import { KuralService } from '../../services/kural.service';

describe('KuralListComponent', () => {
    let component: KuralListComponent;
    let fixture: ComponentFixture<KuralListComponent>;
    let router: Router;

    const queryParamMap$ = new BehaviorSubject<ParamMap>(convertToParamMap({}));
    const activatedRouteStub = {
        queryParamMap: queryParamMap$.asObservable(),
        snapshot: {
            queryParamMap: queryParamMap$.value
        }
    };

    const kuralServiceMock = {
        getSearchIndex: vi.fn().mockReturnValue(of([
            {
                n: 1,
                l1: 'அகர முதல எழுத்தெல்லாம்',
                t: 'A begins the alphabet',
                mk: 'Meaning 1',
                i: 'Prologue',
                p: 'Virtue',
                a: 'The Praise of God'
            },
            {
                n: 1078,
                l1: 'சொல்லப் பயன்படுவர் சான்றோர்',
                t: 'The good by soft words profits yield',
                mk: 'Meaning 1078',
                i: 'Miscellaneous',
                p: 'Wealth',
                a: 'Baseness'
            }
        ])),
        getAdhigarams: vi.fn().mockReturnValue(of([
            {
                id: 1,
                start: 1,
                end: 10,
                pal: 'அறத்துப்பால்',
                pal_tr: 'Virtue',
                pal_tl: 'Araththuppaal',
                iyal: 'பாயிரவியல்',
                iyal_tr: 'Prologue',
                iyal_tl: 'Paayiraviyal',
                adikaram: 'கடவுள் வாழ்த்து',
                adikaram_tr: 'The Praise of God',
                adikaram_tl: 'Kadavul Vazhthu'
            },
            {
                id: 108,
                start: 1071,
                end: 1080,
                pal: 'பொருட்பால்',
                pal_tr: 'Wealth',
                pal_tl: 'Porutpaal',
                iyal: 'குடியியல்',
                iyal_tr: 'Miscellaneous',
                iyal_tl: 'Kudiyiyal',
                adikaram: 'கயமை',
                adikaram_tr: 'Baseness',
                adikaram_tl: 'Kayamai'
            }
        ]))
    };

    function setQueryParams(params: Record<string, string>) {
        const paramMap = convertToParamMap(params);
        queryParamMap$.next(paramMap);
        activatedRouteStub.snapshot.queryParamMap = paramMap;
    }

    beforeEach(async () => {
        setQueryParams({});

        await TestBed.configureTestingModule({
            imports: [KuralListComponent, NoopAnimationsModule],
            providers: [
                provideRouter([]),
                { provide: KuralService, useValue: kuralServiceMock },
                { provide: ActivatedRoute, useValue: activatedRouteStub }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(KuralListComponent);
        component = fixture.componentInstance;
        router = TestBed.inject(Router);
        vi.spyOn(router, 'navigate').mockResolvedValue(true);
        fixture.detectChanges();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should default to kural scope and render kural results', () => {
        expect(component.libraryScope).toBe('kural');
        expect(component.displayedKurals).toHaveLength(2);
        expect(component.displayedAdhigarams).toHaveLength(0);
        expect(fixture.nativeElement.querySelectorAll('.kural-item').length).toBe(2);
    });

    it('should restore adhigaram scope and search from query params', async () => {
        setQueryParams({ view: 'adhigaram', q: '108' });
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.libraryScope).toBe('adhigaram');
        expect(component.searchQuery).toBe('108');
        expect(component.displayedAdhigarams).toHaveLength(1);
        expect(component.displayedAdhigarams[0].id).toBe(108);
        expect(fixture.nativeElement.querySelectorAll('.adhigaram-item').length).toBe(1);
    });

    it('should fall back to kural scope for invalid view query params', async () => {
        setQueryParams({ view: 'invalid' });
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.libraryScope).toBe('kural');
        expect(router.navigate).toHaveBeenCalledWith([], expect.objectContaining({
            queryParams: {}
        }));
    });

    it('should show an adhigaram CTA when filtering kurals by chapter', async () => {
        component.selectedPal = 'Wealth';
        component.onPalChange();
        component.selectedIyal = 'Miscellaneous';
        component.onIyalChange();
        component.selectedAdikaramId = 108;
        component.onAdikaramChange();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.displayedKurals).toHaveLength(1);
        expect(component.displayedKurals[0].n).toBe(1078);
        expect(fixture.nativeElement.querySelector('.open-adhigaram-cta')).toBeTruthy();
    });

    it('should sync query params when switching to adhigaram scope', () => {
        vi.mocked(router.navigate).mockClear();

        component.searchQuery = '108';
        component.libraryScope = 'adhigaram';
        component.onScopeChange();

        expect(router.navigate).toHaveBeenCalledWith([], expect.objectContaining({
            queryParams: expect.objectContaining({
                view: 'adhigaram',
                q: '108'
            }),
            replaceUrl: true
        }));
    });

    it('should preserve unrelated query params when syncing library filters', () => {
        setQueryParams({ ref: 'newsletter' });
        fixture.detectChanges();
        vi.mocked(router.navigate).mockClear();

        component.searchQuery = '108';
        component.libraryScope = 'adhigaram';
        component.onScopeChange();

        expect(router.navigate).toHaveBeenCalledWith([], expect.objectContaining({
            queryParams: expect.objectContaining({
                ref: 'newsletter',
                view: 'adhigaram',
                q: '108'
            }),
            replaceUrl: true
        }));
    });
});
