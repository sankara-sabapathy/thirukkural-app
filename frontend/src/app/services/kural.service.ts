import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, map, tap, catchError, switchMap } from 'rxjs';

export interface Kural {
    number: number;
    // Tamil text
    line1: string;
    line1_tl?: string;
    line2: string;
    line2_tl?: string;
    kural?: string[];
    // Category information
    iyal: string;
    iyal_tr: string;
    iyal_tl?: string;
    pal: string;
    pal_tr: string;
    pal_tl?: string;
    adikaram: string;
    adikaram_tr: string;
    adikaram_tl?: string;
    // Translations and explanations
    translation: string;
    couplet: string;
    couplet_obj?: string[];
    explanation: string;
    explanation_obj?: string[];
    // Tamil commentaries
    mv?: string; // மு.வரதராசனார்
    mk?: string; // மு.கருணாநிதி
    sp?: string; // சாலமன் பாப்பையா
    mu_varatha?: string[]; // மு.வரதராசனார் உரை
    parimela?: string[]; // பரிமேலழகர் உரை
    salaman?: string[]; // சாலமன் பாப்பையா உரை
    manikudavar?: string[]; // மணக்குடவர் உரை
    v_munusami?: string[]; // திருக்குறளார் வீ. முனிசாமி உரை
    mu_karu?: string[]; // கலைஞர் மு.கருணாநிதி உரை
}

export interface SearchIndexItem {
    n: number; // number
    l1: string; // line1
    t: string; // translation
    mk: string; // mk (Tamil explanation/meaning)
    i: string; // iyal
    p: string; // pal
    a: string; // adikaram
}

export interface AdhigaramSummary {
    id: number;
    start: number;
    end: number;
    pal: string;
    pal_tr: string;
    pal_tl?: string;
    iyal: string;
    iyal_tr: string;
    iyal_tl?: string;
    adikaram: string;
    adikaram_tr: string;
    adikaram_tl?: string;
}

export interface AdhigaramPageData extends AdhigaramSummary {
    kurals: Kural[];
}

type PrerenderRouteSnapshot =
    | { type: 'kural'; payload: Kural }
    | { type: 'adhigaram'; payload: AdhigaramPageData };

@Injectable({
    providedIn: 'root'
})
export class KuralService {
    private readonly DATA_BASE_URL = '/data/thirukkural';
    private readonly CHUNK_SIZE = 100;

    private chunkCache = new Map<string, Kural[]>();
    private searchIndex: SearchIndexItem[] | null = null;
    private adhigarams: AdhigaramSummary[] | null = null;
    private prerenderRouteSnapshot: PrerenderRouteSnapshot | null | undefined = undefined;

    constructor(
        private http: HttpClient,
        @Inject(DOCUMENT) private document: Document
    ) { }

    /**
     * Fetches a specific Kural by its number (1-1330)
     */
    getKural(number: number): Observable<Kural | undefined> {
        if (number < 1 || number > 1330) {
            return of(undefined);
        }

        const prerenderedKural = this.consumePrerenderedKural(number);
        if (prerenderedKural) {
            return of(prerenderedKural);
        }

        const chunkId = this.getChunkId(number);
        return this.loadChunk(chunkId).pipe(
            map(chunk => chunk.find(k => k.number === number)),
            catchError(err => {
                console.error(`Failed to load kural ${number}`, err);
                return of(undefined);
            })
        );
    }

    /**
     * Loads the lightweight search index
     */
    getSearchIndex(): Observable<SearchIndexItem[]> {
        if (this.searchIndex) {
            return of(this.searchIndex);
        }

        const url = `${this.DATA_BASE_URL}/search-index.json`;

        return this.http.get<SearchIndexItem[]>(url).pipe(
            tap(index => this.searchIndex = index),
            catchError(err => {
                console.error('Failed to load search index', err);
                return of([]);
            })
        );
    }

    getAdhigarams(): Observable<AdhigaramSummary[]> {
        if (this.adhigarams) {
            return of(this.adhigarams);
        }

        const url = `${this.DATA_BASE_URL}/adhigarams.json`;

        return this.http.get<AdhigaramSummary[]>(url).pipe(
            tap(adhigarams => this.adhigarams = adhigarams),
            catchError(err => {
                console.error('Failed to load adhigarams', err);
                return of([]);
            })
        );
    }

    getAdhigaram(id: number): Observable<AdhigaramPageData | undefined> {
        if (!Number.isInteger(id) || id < 1) {
            return of(undefined);
        }

        const prerenderedAdhigaram = this.consumePrerenderedAdhigaram(id);
        if (prerenderedAdhigaram) {
            return of(prerenderedAdhigaram);
        }

        return this.getAdhigarams().pipe(
            switchMap(adhigarams => {
                const adhigaram = adhigarams.find(item => item.id === id);
                if (!adhigaram) {
                    return of(undefined);
                }

                const chunkId = this.getChunkId(adhigaram.start);
                return this.loadChunk(chunkId).pipe(
                    map(chunk => ({
                        ...adhigaram,
                        kurals: chunk.filter(
                            kural => kural.number >= adhigaram.start && kural.number <= adhigaram.end
                        )
                    })),
                    map(adhigaramPage => (
                        adhigaramPage.kurals.length > 0 ? adhigaramPage : undefined
                    )),
                    catchError(err => {
                        console.error(`Failed to load adhigaram ${id}`, err);
                        return of(undefined);
                    })
                );
            })
        );
    }

    hasPrerenderedKural(number: number): boolean {
        const snapshot = this.getPrerenderRouteSnapshot();
        return snapshot?.type === 'kural' && snapshot.payload.number === number;
    }

    hasPrerenderedAdhigaram(id: number): boolean {
        const snapshot = this.getPrerenderRouteSnapshot();
        return snapshot?.type === 'adhigaram' && snapshot.payload.id === id;
    }

    /**
     * Determines the chunk filename for a given Kural number
     * e.g., 1 -> "1-100", 150 -> "101-200"
     */
    private getChunkId(number: number): string {
        const start = Math.floor((number - 1) / this.CHUNK_SIZE) * this.CHUNK_SIZE + 1;
        const end = Math.min(start + this.CHUNK_SIZE - 1, 1330);
        return `${start}-${end}`;
    }

    private loadChunk(chunkId: string): Observable<Kural[]> {
        if (this.chunkCache.has(chunkId)) {
            return of(this.chunkCache.get(chunkId)!);
        }

        const url = `${this.DATA_BASE_URL}/${chunkId}.json`;

        return this.http.get<Kural[]>(url).pipe(
            tap(chunk => {
                this.chunkCache.set(chunkId, chunk);
            })
        );
    }

    private getPrerenderRouteSnapshot(): PrerenderRouteSnapshot | null {
        if (this.prerenderRouteSnapshot !== undefined) {
            return this.prerenderRouteSnapshot;
        }

        const script = this.document.getElementById('prerender-route-data');
        if (!script?.textContent) {
            this.prerenderRouteSnapshot = null;
            return this.prerenderRouteSnapshot;
        }

        try {
            this.prerenderRouteSnapshot = JSON.parse(script.textContent) as PrerenderRouteSnapshot;
        } catch (error) {
            console.error('Failed to parse prerender route snapshot', error);
            this.prerenderRouteSnapshot = null;
        }

        return this.prerenderRouteSnapshot;
    }

    private clearPrerenderRouteSnapshot(): void {
        const script = this.document.getElementById('prerender-route-data');
        if (script) {
            script.remove();
        }
        this.prerenderRouteSnapshot = null;
    }

    private consumePrerenderedKural(number: number): Kural | null {
        const snapshot = this.getPrerenderRouteSnapshot();
        if (snapshot?.type === 'kural' && snapshot.payload.number === number) {
            this.clearPrerenderRouteSnapshot();
            return snapshot.payload;
        }

        return null;
    }

    private consumePrerenderedAdhigaram(id: number): AdhigaramPageData | null {
        const snapshot = this.getPrerenderRouteSnapshot();
        if (snapshot?.type === 'adhigaram' && snapshot.payload.id === id) {
            this.clearPrerenderRouteSnapshot();
            return snapshot.payload;
        }

        return null;
    }
}
