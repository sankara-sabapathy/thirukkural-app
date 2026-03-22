import { Component, Inject, OnDestroy } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

interface WidgetPreview {
    widgetId: string;
    title: string;
    description: string;
    cardClass?: string;
    frameClass: string;
    minHeight: number;
    height: number;
    src: SafeResourceUrl;
}

interface WidgetSnippet {
    title: string;
    description: string;
    code: string;
}

interface WidgetOption {
    name: string;
    values: string;
    description: string;
}

@Component({
    selector: 'app-widget-docs',
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatSnackBarModule
    ],
    templateUrl: './widget-docs.component.html',
    styleUrls: ['./widget-docs.component.scss']
})
export class WidgetDocsComponent implements OnDestroy {
    copiedKey: string | null = null;
    private copiedResetTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly isBrowser = typeof window !== 'undefined';
    private readonly previewMessageHandler = (event: MessageEvent) => this.updatePreviewHeight(event);

    readonly quickStartSnippet = `<script
  src="https://thirukkural.site/widgets/daily-kural.js"
  data-mode="random"
  data-layout="spotlight"
  data-language="bilingual"
></script>`;

    readonly advancedSnippet = `<script src="https://thirukkural.site/widgets/daily-kural.js"></script>
        <div id="kural-slot"></div>
<script>
  window.ThirukkuralWidget.mount('#kural-slot', {
    mode: 'random',
    layout: 'ticker',
    language: 'english',
    meaning: 'explanation',
    accent: '#0f766e',
    speed: 'slow',
    scrollDirection: 'ltr'
  });
</script>`;

    readonly previews: WidgetPreview[];

    readonly presetSnippets: WidgetSnippet[] = [
        {
            title: 'Random Spotlight',
            description: 'Best default: random Kural on load, bilingual content, full presentation.',
            code: `<script
  src="https://thirukkural.site/widgets/daily-kural.js"
  data-mode="random"
  data-layout="spotlight"
  data-language="bilingual"
></script>`
        },
        {
            title: 'Compact English Rail',
            description: 'A compact English-only widget for article sidebars or newsletters.',
            code: `<script
  src="https://thirukkural.site/widgets/daily-kural.js"
  data-mode="random"
  data-layout="compact"
  data-language="english"
  data-meaning="explanation"
  data-accent="#0f766e"
  data-show-tags="false"
></script>`
        },
        {
            title: 'Top Navigation Banner',
            description: 'A horizontal layout designed for the top of a homepage, article hub, or magazine front page.',
            code: `<script
  src="https://thirukkural.site/widgets/daily-kural.js"
  data-mode="random"
  data-layout="banner"
  data-language="bilingual"
  data-max-width="100%"
  data-align="center"
></script>`
        },
        {
            title: 'Ticker Bar',
            description: 'A moving caption-style embed for the top or bottom of content-heavy websites.',
            code: `<script
  src="https://thirukkural.site/widgets/daily-kural.js"
  data-mode="random"
  data-layout="ticker"
  data-language="bilingual"
  data-speed="normal"
  data-scroll-direction="rtl"
  data-max-width="100%"
></script>`
        },
        {
            title: 'Square Feature Card',
            description: 'A square treatment for grid systems, side modules, or portfolio-style homepages.',
            code: `<script
  src="https://thirukkural.site/widgets/daily-kural.js"
  data-mode="random"
  data-layout="square"
  data-language="english"
  data-meaning="explanation"
  data-max-width="340px"
  data-show-tags="false"
></script>`
        },
        {
            title: 'Fixed Editorial Feature',
            description: 'Pin a specific Kural for a story, essay, or campaign page.',
            code: `<script
  src="https://thirukkural.site/widgets/daily-kural.js"
  data-mode="fixed"
  data-kural="1078"
  data-layout="spotlight"
  data-language="bilingual"
  data-cta-text="Read the full Kural"
></script>`
        }
    ];

    readonly options: WidgetOption[] = [
        {
            name: 'data-mode',
            values: '`random`, `daily`, `fixed`',
            description: 'Controls how the widget chooses a Kural. `random` is the default.'
        },
        {
            name: 'data-layout',
            values: '`spotlight`, `banner`, `ticker`, `square`, `compact`, `minimal`',
            description: 'Changes the widget shape so it can fit top-of-page banners, moving tickers, square cards, blog rails, or compact embeds.'
        },
        {
            name: 'data-language',
            values: '`bilingual`, `tamil`, `english`',
            description: 'Controls whether Tamil, English, or both are rendered.'
        },
        {
            name: 'data-meaning',
            values: '`translation`, `couplet`, `explanation`',
            description: 'Chooses which English meaning field is shown when English content is enabled.'
        },
        {
            name: 'data-accent',
            values: 'hex color such as `#0f766e`',
            description: 'Sets the widget accent color.'
        },
        {
            name: 'data-speed / data-scroll-direction',
            values: '`slow`, `normal`, `fast` and `rtl`, `ltr`',
            description: 'Controls ticker motion speed and whether the marquee runs right-to-left or left-to-right.'
        },
        {
            name: 'data-pause-on-hover',
            values: '`true` or `false`',
            description: 'Pauses the ticker when hovered. Reduced-motion users always get a static ticker regardless of this value.'
        },
        {
            name: 'data-align',
            values: '`left`, `center`',
            description: 'Controls typography alignment inside the widget.'
        },
        {
            name: 'data-show-meta / data-show-tags',
            values: '`true` or `false`',
            description: 'Lets integrators simplify the card for tighter placements.'
        },
        {
            name: 'data-show-refresh',
            values: '`true` or `false`',
            description: 'Shows a "Show another" button in random mode.'
        },
        {
            name: 'data-radius / data-font-scale / data-shadow',
            values: 'numeric or preset values',
            description: 'Adjusts presentation details without requiring host-site CSS overrides.'
        },
        {
            name: 'data-width / data-max-width / data-min-width',
            values: 'CSS dimensions such as `360px` or `100%`',
            description: 'Helps reserve space, control the final shape, and avoid layout shift.'
        }
    ];

    readonly bestPractices: string[] = [
        'Use the hosted iframe model for isolation and compatibility instead of injecting large DOM or CSS payloads directly into the host page.',
        'Pick the layout that matches the available real estate: `banner` for horizontal hero areas, `ticker` for caption-style strips, `square` for card grids, and `compact` or `minimal` for rails.',
        'Reserve space with width and max-width settings so the widget does not create unnecessary layout shift when it loads.',
        'Let the host site control placement for ticker-style embeds. Use the widget as content, not as a forced fixed-position takeover.',
        'Lazy-load widgets that appear below the fold; switch to eager loading only when the widget is part of the initial viewport.',
        'Keep widget messaging strict. This implementation validates both the iframe origin and source window before accepting resize messages.',
        'Respect motion sensitivity. The ticker pauses on hover when configured and falls back to a static bar when the user prefers reduced motion.',
        'Treat widget links as distribution and attribution, not as a link-scheme shortcut. The default outbound links use nofollow semantics.'
    ];

    constructor(
        private sanitizer: DomSanitizer,
        private snackBar: MatSnackBar,
        @Inject(DOCUMENT) private document: Document
    ) {
        this.previews = [
            this.createPreview(
                'preview-banner',
                'Banner',
                'A horizontal treatment for the top of homepages, article hubs, and editorial sections.',
                'mode=random&layout=banner&language=bilingual&meaning=translation&align=center&showRefresh=false',
                'preview-frame-banner',
                240,
                'preview-card-wide'
            ),
            this.createPreview(
                'preview-ticker',
                'Ticker',
                'A moving strip for top bars, footer bars, and announcement-style placements.',
                'mode=random&layout=ticker&language=bilingual&meaning=translation&speed=normal&scrollDirection=rtl',
                'preview-frame-ticker',
                116,
                'preview-card-wide'
            ),
            this.createPreview(
                'preview-spotlight',
                'Spotlight',
                'A rich bilingual card for blogs, landing pages, and feature modules.',
                'mode=random&layout=spotlight&language=bilingual&meaning=translation&showRefresh=false',
                '',
                420
            ),
            this.createPreview(
                'preview-square',
                'Square',
                'A square card for grid layouts, side modules, and visual homepages.',
                'mode=random&layout=square&language=english&meaning=explanation&accent=%230f766e&showTags=false&showRefresh=false',
                'preview-frame-square',
                390
            ),
            this.createPreview(
                'preview-compact',
                'Compact',
                'A tighter layout for article rails, footers, and newsletter landing pages.',
                'mode=random&layout=compact&language=bilingual&meaning=explanation&accent=%230f766e&showTags=false&showRefresh=false',
                'preview-frame-compact',
                300
            ),
            this.createPreview(
                'preview-minimal',
                'Minimal',
                'A low-profile quote block for dense interfaces that still needs a clear source link.',
                'mode=random&layout=minimal&language=english&meaning=couplet&showMeta=false&showTags=false&showRefresh=false',
                'preview-frame-minimal',
                250
            )
        ];

        if (this.isBrowser) {
            window.addEventListener('message', this.previewMessageHandler);
        }
    }

    copySnippet(snippet: string, key: string): void {
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(snippet).then(() => {
                this.showCopiedFeedback(key);
            }).catch(() => this.fallbackCopy(snippet, key));
            return;
        }

        this.fallbackCopy(snippet, key);
    }

    private fallbackCopy(snippet: string, key: string): void {
        const textArea = this.document.createElement('textarea');
        textArea.value = snippet;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        this.document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        const copied = this.document.execCommand('copy');
        this.document.body.removeChild(textArea);

        if (copied) {
            this.showCopiedFeedback(key);
            return;
        }

        this.snackBar.open('Unable to copy embed code.', 'Close', {
            duration: 2400,
            panelClass: ['snackbar-error']
        });
    }

    private trustPreview(url: string): SafeResourceUrl {
        return this.sanitizer.bypassSecurityTrustResourceUrl(url);
    }

    private showCopiedFeedback(key: string): void {
        this.copiedKey = key;
        if (this.copiedResetTimer !== null) {
            clearTimeout(this.copiedResetTimer);
        }

        this.snackBar.open('Embed code copied.', 'Close', {
            duration: 2200,
            panelClass: ['snackbar-info'],
            horizontalPosition: 'center',
            verticalPosition: 'bottom'
        });

        this.copiedResetTimer = setTimeout(() => {
            if (this.copiedKey === key) {
                this.copiedKey = null;
            }
            this.copiedResetTimer = null;
        }, 1600);
    }

    ngOnDestroy(): void {
        if (this.copiedResetTimer !== null) {
            clearTimeout(this.copiedResetTimer);
            this.copiedResetTimer = null;
        }

        if (this.isBrowser) {
            window.removeEventListener('message', this.previewMessageHandler);
        }
    }

    private createPreview(
        widgetId: string,
        title: string,
        description: string,
        query: string,
        frameClass: string,
        minHeight: number,
        cardClass?: string
    ): WidgetPreview {
        return {
            widgetId,
            title,
            description,
            cardClass,
            frameClass,
            minHeight,
            height: minHeight,
            src: this.trustPreview(`/widgets/daily-kural-frame.html?widgetId=${widgetId}&${query}`)
        };
    }

    private updatePreviewHeight(event: MessageEvent): void {
        if (!this.isBrowser || (event.origin !== window.location.origin && event.origin !== 'null')) {
            return;
        }

        const data = event.data as { source?: string; widgetId?: string; height?: number } | null;
        if (!data || data.source !== 'thirukkural-widget' || typeof data.widgetId !== 'string' || typeof data.height !== 'number') {
            return;
        }

        const preview = this.previews.find((item) => item.widgetId === data.widgetId);
        if (!preview) {
            return;
        }

        preview.height = Math.max(preview.minHeight, Math.ceil(data.height));
    }
}
