import { HttpInterceptorFn } from '@angular/common/http';
import { fetchAuthSession } from 'aws-amplify/auth';
import { from, switchMap, catchError } from 'rxjs';
import { environment } from '../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    // Only add token for API requests to our backend
    if (req.url.startsWith(environment.api.baseUrl)) {
        return from(fetchAuthSession()).pipe(
            switchMap(session => {
                const token = session.tokens?.idToken?.toString();
                if (token) {
                    const cloned = req.clone({
                        setHeaders: {
                            Authorization: `Bearer ${token}`
                        }
                    });
                    return next(cloned);
                }
                return next(req);
            }),
            catchError(() => next(req)) // Fallback on auth error
        );
    }
    return next(req);
};
