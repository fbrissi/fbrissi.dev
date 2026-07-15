# AI Agents Context for fbrissi.dev

This file provides context and guidelines for AI coding assistants working on this Next.js portfolio project.

## Project Overview

Static portfolio website for Filipe Bojikian Rissi built with Next.js 15, TypeScript, and deployed to Cloudflare Pages.

**Live URL**: https://fbrissi.dev

## Tech Stack

- **Framework**: Next.js 15.5.2 (App Router)
- **Language**: TypeScript 5.9+
- **UI**: React 19, Tailwind CSS 3.4
- **Content**: Markdown (articles, projects, works), JSON (profile data)
- **Deployment**: Cloudflare Pages (static export)
- **Contact Form**: Cloudflare Workers + Email Routing + Turnstile (all free)
- **CI/CD**: GitHub Actions
- **IaC**: Terraform
- **Local Dev**: Kool.dev + Docker

## Architecture

### Static Site Generation (SSG)
- All pages are pre-rendered at build time (`next build` → `out/`)
- No server-side rendering or API routes
- Content is sourced from local files (Markdown, JSON)

### Internationalization (i18n)
- **English**: Root path (`/`, `/articles`, `/projects`, etc)
- **Portuguese**: `/pt-br` prefix (`/pt-br`, `/pt-br/articles`, etc)
- Language switcher in header (dropdown with flags)
- Content files separated by locale in `content/` and `messages/`

### Routing Structure
```
/                    → Homepage (English)
/projects            → Projects listing
/projects/[slug]     → Project detail
/works               → Works listing
/works/[slug]        → Work detail
/articles            → Articles index
/articles/[slug]     → Article post
/contact             → Contact page
/about               → About page

/pt-br               → Homepage (Portuguese)
/pt-br/projects      → Projects listing (PT)
/pt-br/projects/[slug] → Project detail (PT)
/pt-br/works         → Works listing (PT)
/pt-br/works/[slug]  → Work detail (PT)
/pt-br/articles      → Articles index (PT)
/pt-br/articles/[slug] → Article post (PT)
/pt-br/contact       → Contact page (PT)
/pt-br/about         → About page (PT)
```

## Design System

### Color Scheme (Dark Theme)
```css
--bg: #0a0a0a              /* Main background */
--bg-soft: #171717         /* Card background */
--bg-card: #1f1f1f         /* Nested card background */
--text: #fafafa            /* Primary text */
--text-secondary: #a3a3a3  /* Secondary text */
--muted: #737373           /* Muted text */
--line: #2a2a2a            /* Borders */
--line-bright: #404040     /* Bright borders (hover) */
--accent: #f97316          /* Orange accent */
--accent-hover: #ea580c    /* Orange hover */
--accent-glow: rgba(249, 115, 22, 0.15)  /* Orange glow effect */
```

### Design Principles
- **Dark theme** with vibrant orange accents
- **Card-based layouts** with subtle borders and shadows
- **Hover effects**: Transform, glow, animated underlines
- **Typography**: System fonts, font-weight 300-600, letter-spacing adjustments
- **Animations**: Smooth 200-250ms transitions
- **Responsive**: Mobile-first approach

### Component Patterns
- Use Tailwind CSS for styling (utility-first approach)
- Server Components by default, Client Components when state/effects needed
- Consistent hover states with orange accent
- Border effects, glows, and transforms on interactive elements

## Folder Structure

```
├── app/                    # Next.js App Router pages
│   ├── [locale]/          # Localized routes (pt-br)
│   └── globals.css        # Global styles with Tailwind directives
├── components/            # React components
│   ├── site-shell.tsx     # Layout wrapper
│   ├── site-header.tsx    # Header with nav
│   ├── site-pages.tsx     # Page components
│   ├── language-switcher.tsx  # Language dropdown
│   └── markdown.tsx       # Markdown renderer
├── content/               # Content files
│   ├── articles/         # Articles (Markdown)
│   │   ├── en/           # English posts
│   │   └── pt-BR/        # Portuguese posts
│   ├── projects/         # Projects (Markdown)
│   │   ├── en/           # English posts
│   │   └── pt-BR/        # Portuguese posts
│   ├── works/            # Works (Markdown)
│   │   ├── en/           # English posts
│   │   └── pt-BR/        # Portuguese posts
│   └── profile/          # Profile data (JSON)
│       ├── en.json
│       └── pt-BR.json
├── lib/                   # Utility functions
│   ├── articles.ts       # Article utilities
│   ├── projects.ts       # Project utilities
│   ├── works.ts          # Work utilities
│   ├── i18n.ts           # Internationalization
│   └── site.ts           # Profile & messages
├── messages/             # i18n messages
│   ├── en.json
│   └── pt-BR.json
├── public/               # Static assets
├── scripts/              # Build scripts
│   └── build-seo.mjs     # Generate sitemap/robots
└── terraform/            # Infrastructure as Code
    └── *.tf              # Cloudflare Pages setup
```

## Key Files

### Content Management
- `content/profile/en.json` - Profile data (name, bio, projects, experience)
- `content/profile/pt-BR.json` - Portuguese profile
- `content/articles/{locale}/` - Articles in Markdown with frontmatter
- `content/projects/{locale}/` - Projects in Markdown with frontmatter
- `content/works/{locale}/` - Works in Markdown with frontmatter
- `messages/{locale}.json` - UI strings and labels

### Core Components
- `components/site-shell.tsx` - Layout with header/footer
- `components/site-header.tsx` - Navigation and language switcher
- `components/site-pages.tsx` - All page components (HomePage, ArticlesPage, ProjectsPage, WorksPage, etc)
- `components/language-switcher.tsx` - Dropdown language selector
- `components/markdown.tsx` - Markdown renderer with syntax highlighting

### Styling
- `app/globals.css` - Tailwind directives and custom @layer rules
- `tailwind.config.ts` - Tailwind theme configuration (colors, shadows, animations)
- `postcss.config.mjs` - PostCSS with Tailwind and Autoprefixer

### Utilities
- `lib/i18n.ts` - Locale handling, path generation
- `lib/articles.ts` - Parse article Markdown, generate reading time
- `lib/projects.ts` - Parse project Markdown content
- `lib/works.ts` - Parse work Markdown content
- `lib/markdown-collection.ts` - Shared Markdown collection helpers
- `lib/site.ts` - Load profile & messages

## Development Workflow

### Local Development with Kool

This project uses [Kool.dev](https://kool.dev) for local development with Docker.

Important: do not run `yarn` directly on the host. Use `kool run yarn ...` for all Yarn commands in this repo.
Important: do not start a separate host-side `next dev` when Kool is already running the app. That can steal `localhost:3000` from the container and make the site look broken.

**Setup (first time)**:
```bash
# Install dependencies and start containers
kool run setup
```

**Daily workflow**:
```bash
# Start dev server (http://localhost:3000)
kool start

# Run yarn commands
kool run yarn dev
kool run yarn lint
kool run yarn typecheck
kool run yarn build

# Execute commands in the container
kool exec app yarn add <package>
kool exec app sh  # Open shell in container

# Stop containers
kool stop

# View logs
kool logs app
kool logs -f app  # Follow logs
```

**Kool configuration**:
- `kool.yml` - Scripts and shortcuts
- `docker-compose.yml` - Service definitions
- Uses official `kooldev/node:20` image
- Auto-installs dependencies on setup

### Adding Content

**New Article (English)**:
1. Create `content/articles/en/my-post-slug.md`
2. Add frontmatter:
   ```yaml
   ---
   title: "My Post Title"
   description: "Brief description"
   date: "2026-01-15"
   ---
   ```
3. Write content in Markdown
4. Build & verify at `/articles/my-post-slug`

**New Article (Portuguese)**:
1. Create `content/articles/pt-BR/meu-post-slug.md`
2. Same frontmatter structure
3. Build & verify at `/pt-br/articles/meu-post-slug`

**New Project (English)**:
1. Create `content/projects/en/my-project-slug.md`
2. Add frontmatter:
   ```yaml
   ---
   title: "My Project Title"
   description: "Brief description"
   date: "2026-01-15"
   ---
   ```
3. Write content in Markdown
4. Build & verify at `/projects/my-project-slug`

**New Project (Portuguese)**:
1. Create `content/projects/pt-BR/meu-projeto-slug.md`
2. Same frontmatter structure
3. Build & verify at `/pt-br/projects/meu-projeto-slug`

**New Work (English)**:
1. Create `content/works/en/my-work-slug.md`
2. Add frontmatter:
   ```yaml
   ---
   title: "My Work Title"
   description: "Brief description"
   date: "2026-01-15"
   ---
   ```
3. Write content in Markdown
4. Build & verify at `/works/my-work-slug`

**New Work (Portuguese)**:
1. Create `content/works/pt-BR/meu-trabalho-slug.md`
2. Same frontmatter structure
3. Build & verify at `/pt-br/works/meu-trabalho-slug`

**Update Profile**:
1. Edit `content/profile/en.json` or `content/profile/pt-BR.json`
2. Fields: `name`, `headline`, `summary`, `about`, `location`, `contact`, `publicLinks`, `skills`, `careerHighlights`, `languages`

### Styling Guidelines

**Adding/Modifying Styles**:
- Use Tailwind utility classes
- Leverage custom colors from `tailwind.config.ts`
- Add hover states with orange accent (`hover:text-accent`, `hover:border-accent`)
- Use consistent transitions (`transition-all duration-250`)
- Keep responsive design mobile-first (`sm:`, `md:`, `lg:` breakpoints)

**Card Components Pattern**:
```tsx
<div className="rounded-xl border border-line bg-bg-soft p-6 shadow-lg transition-all duration-250 hover:-translate-y-1 hover:border-line-bright hover:shadow-xl">
  {/* Card content */}
</div>
```

### Creating New Pages

1. Add route in `app/[locale]/` or root `app/`
2. Create page component in `components/site-pages.tsx`
3. Update navigation in `components/site-header.tsx`
4. Add i18n labels to `messages/{locale}.json`
5. Update `navItems` array if needed

## Common Tasks

### Change Color Scheme
Edit theme colors in `tailwind.config.ts`:
```ts
theme: {
  extend: {
    colors: {
      accent: {
        DEFAULT: '#f97316',  // Change accent color
        hover: '#ea580c',
      },
      bg: {
        DEFAULT: '#0a0a0a',  // Change background
        soft: '#171717',
      },
    },
  },
},
```

### Add Navigation Link
1. Update `navItems` in `components/site-header.tsx`
2. Add label to `messages/en.json` and `messages/pt-BR.json`
3. Create corresponding page component

### Modify Header/Footer
Edit `components/site-shell.tsx` (now uses Tailwind classes)

### Add Language
1. Update `lib/i18n.ts` - add locale to array
2. Create `messages/{locale}.json`
3. Create `content/profile/{locale}.json`
4. Create `content/articles/{locale}/`, `content/projects/{locale}/`, and `content/works/{locale}/` directories
5. Update `language-switcher.tsx` with new flag

## Build & Deploy

### Releases

This project follows [Semantic Versioning](https://semver.org/). Every release
must add exactly one `CHANGELOG.md` entry headed `## vMAJOR.MINOR.PATCH` with
release notes. Merging that pull request into `main` creates the matching GitHub
release and tag automatically.

### Production Build
```bash
kool run yarn build
```
Outputs static files to `out/` directory.

### Deploy
GitHub Actions deploys the static site and contact Workers when a `v*` tag is
pushed. Use the manual Deploy workflow to deploy a specific existing tag.

### Manual Deploy
```bash
# Run the Deploy workflow for an existing release tag
gh workflow run deploy.yml --ref main -f tag=v1.0.0
```

## Validation Checklist

Before committing changes:

```bash
# Code quality
kool run yarn lint
kool run yarn typecheck

# Build verification
kool run yarn build

# Test both locales
open out/index.html
open out/pt-br/index.html
```

## Best Practices

### Content
- Keep Markdown files clean (no HTML unless necessary)
- Use frontmatter for metadata
- Add descriptive alt text for images
- Write clear, concise descriptions

### Code
- Prefer Server Components (default)
- Use Client Components only when needed (`"use client"`)
- Type everything (no `any`)
- Keep components small and focused
- Extract reusable logic to `lib/`

### Styling
- Mobile-first responsive design
- Use CSS variables for theming
- Avoid inline styles
- Keep specificity low
- Use consistent spacing units

### Performance
- Optimize images (use Next.js `Image` when dynamic)
- Minimize client-side JavaScript
- Keep bundle size small
- Static export = fast CDN delivery

### SEO
- Add metadata to all pages
- Generate sitemap (automatic via `scripts/build-seo.mjs`)
- Use semantic HTML
- Include structured data (JSON-LD)

## Troubleshooting

### Hot Reload Issues
Next.js Fast Refresh may fail with Client Components. Solution: Hard refresh (Cmd+R or Cmd+Shift+R).

### Build Errors
- Check TypeScript errors: `kool run yarn typecheck`
- Check ESLint: `kool run yarn lint`
- Verify all imports are correct
- Ensure all content files have valid frontmatter

### Styling Not Applying
- Verify CSS Module import syntax
- Check for typos in CSS variables
- Clear `.next` cache: `rm -rf .next`

### i18n Issues
- Verify locale format: `en` and `pt-BR` (not `en-US`)
- Check `localizedPath()` usage
- Ensure all content exists for both locales

## Future Enhancements

Planned improvements:
- [x] ~~Add contact form with Cloudflare Turnstile~~ **DONE** (see `docs/CONTACT_FORM_SETUP.md`)
- [x] ~~Dynamic project content via Markdown files~~ **DONE**
- [x] ~~Dynamic work content via Markdown files~~ **DONE**
- [ ] Image optimization and placeholders
- [ ] Dark/light theme toggle
- [ ] Search functionality for articles
- [ ] RSS feed for articles
- [ ] Analytics integration
- [ ] Newsletter signup
- [ ] Social share buttons

## Contact

For questions about this project, reach out to Filipe Bojikian Rissi.

---

**Last Updated**: 2026-07-11
**Next.js Version**: 15.5.2
**Node Version**: 20+
