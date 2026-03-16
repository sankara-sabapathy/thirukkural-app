import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, map, tap, catchError } from 'rxjs';

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

@Injectable({
    providedIn: 'root'
})
export class KuralService {
    private readonly DATA_BASE_URL = '/data/thirukkural';
    private readonly CHUNK_SIZE = 100;

    private chunkCache = new Map<string, Kural[]>();
    private searchIndex: SearchIndexItem[] | null = null;

    constructor(private http: HttpClient) { }

    /**
     * Fetches a specific Kural by its number (1-1330)
     */
    getKural(number: number): Observable<Kural | undefined> {
        if (number < 1 || number > 1330) {
            return of(undefined);
        }

        const chunkId = this.getChunkId(number);

        if (this.chunkCache.has(chunkId)) {
            const chunk = this.chunkCache.get(chunkId)!;
            const kural = chunk.find(k => k.number === number);
            return of(kural);
        }

        const url = `${this.DATA_BASE_URL}/${chunkId}.json`;

        return this.http.get<Kural[]>(url).pipe(
            tap(chunk => {
                this.chunkCache.set(chunkId, chunk);
            }),
            map(chunk => {
                return chunk.find(k => k.number === number);
            }),
            catchError(err => {
                console.error(`Failed to load chunk ${chunkId}`, err);
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

    /**
     * Determines the chunk filename for a given Kural number
     * e.g., 1 -> "1-100", 150 -> "101-200"
     */
    private getChunkId(number: number): string {
        const start = Math.floor((number - 1) / this.CHUNK_SIZE) * this.CHUNK_SIZE + 1;
        const end = Math.min(start + this.CHUNK_SIZE - 1, 1330);
        return `${start}-${end}`;
    }
}
