import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class ApiService {
    private baseUrl = environment.api.baseUrl;

    constructor(private http: HttpClient) { }

    sendSampleEmail(email: string): Observable<any> {
        const url = `${this.baseUrl}${environment.api.endpoints.sampleEmail}`;
        return this.http.post(url, { email });
    }
}
