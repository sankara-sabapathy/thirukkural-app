import { Component, Inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

interface WidgetPreview {
    title: string;
    description: string;
    frameClass: string;
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
export class WidgetDocsComponent {
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
    layout: 'compact',
    language: 'english',
    meaning: 'explanation',
    accent: '#0f766e',
    showTags: false
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
            values: '`spotlight`, `banner`, `square`, `compact`, `minimal`',
            description: 'Changes the widget shape so it can fit top-of-page banners, square cards, blog rails, or compact embeds.'
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
        'Pick the layout that matches the available real estate: `banner` for horizontal hero areas, `square` for card grids, and `compact` or `minimal` for rails.',
        'Reserve space with width and max-width settings so the widget does not create unnecessary layout shift when it loads.',
        'Lazy-load widgets that appear below the fold; switch to eager loading only when the widget is part of the initial viewport.',
        'Keep widget messaging strict. This implementation validates both the iframe origin and source window before accepting resize messages.',
        'Treat widget links as distribution and attribution, not as a link-scheme shortcut. The default outbound links use nofollow semantics.'
    ];

    constructor(
        private sanitizer: DomSanitizer,
        private snackBar: MatSnackBar,
        @Inject(DOCUMENT) private document: Document
    ) {
        this.previews = [
            {
                title: 'Banner',
                description: 'A horizontal treatment for the top of homepages, article hubs, and editorial sections.',
                frameClass: 'preview-frame-banner',
                src: this.trustPreview('/widgets/daily-kural-frame.html?mode=random&layout=banner&language=bilingual&meaning=translation&align=center&showRefresh=false')
            },
            {
                title: 'Spotlight',
                description: 'A rich bilingual card for blogs, landing pages, and feature modules.',
                frameClass: '',
                src: this.trustPreview('/widgets/daily-kural-frame.html?mode=random&layout=spotlight&language=bilingual&meaning=translation&showRefresh=false')
            },
            {
                title: 'Square',
                description: 'A square card for grid layouts, side modules, and visual homepages.',
                frameClass: 'preview-frame-square',
                src: this.trustPreview('/widgets/daily-kural-frame.html?mode=random&layout=square&language=english&meaning=explanation&accent=%230f766e&showTags=false&showRefresh=false')
            },
            {
                title: 'Compact',
                description: 'A tighter layout for article rails, footers, and newsletter landing pages.',
                frameClass: 'preview-frame-compact',
                src: this.trustPreview('/widgets/daily-kural-frame.html?mode=random&layout=compact&language=bilingual&meaning=explanation&accent=%230f766e&showTags=false&showRefresh=false')
            },
            {
                title: 'Minimal',
                description: 'A low-profile quote block for dense interfaces that still needs a clear source link.',
                frameClass: 'preview-frame-minimal',
                src: this.trustPreview('/widgets/daily-kural-frame.html?mode=random&layout=minimal&language=english&meaning=couplet&showMeta=false&showTags=false&showRefresh=false')
            }
        ];
    }

    copySnippet(snippet: string): void {
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(snippet).then(() => {
                this.snackBar.open('Embed code copied.', 'Close', { duration: 2000 });
            }).catch(() => this.fallbackCopy(snippet));
            return;
        }

        this.fallbackCopy(snippet);
    }

    private fallbackCopy(snippet: string): void {
        const textArea = this.document.createElement('textarea');
        textArea.value = snippet;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        this.document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        const copied = this.document.execCommand('copy');
        this.document.body.removeChild(textArea);

        this.snackBar.open(copied ? 'Embed code copied.' : 'Unable to copy embed code.', 'Close', {
            duration: 2000
        });
    }

    private trustPreview(url: string): SafeResourceUrl {
        return this.sanitizer.bypassSecurityTrustResourceUrl(url);
    }
}
