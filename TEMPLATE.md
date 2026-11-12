# mpowerio.ai Client Template Guide

This document provides instructions for using this website as a template for future construction/contractor clients.

## Overview

This template is designed for construction, contracting, and service-based businesses. It includes all the essential sections that convert visitors into leads.

## Quick Setup Checklist

- [ ] Update company name and branding
- [ ] Replace logo and favicon
- [ ] Update color scheme
- [ ] Modify contact information
- [ ] Update services list
- [ ] Replace testimonials
- [ ] Add project photos
- [ ] Update FAQ content
- [ ] Configure contact form
- [ ] Add analytics tracking

---

## 1. Brand Colors

### CSS Variables Location
File: `assets/css/styles.css` (lines 10-25)

```css
:root {
    /* Primary brand color - main buttons, accents */
    --color-primary: #1a2744;        /* Change to client's primary */
    --color-primary-dark: #0f1a2e;   /* Darker shade */
    --color-primary-light: #2d3e5f;  /* Lighter shade */

    /* Accent color - CTAs, highlights */
    --color-accent: #d4a937;         /* Change to client's accent */
    --color-accent-dark: #b8922f;    /* Darker shade */
    --color-accent-light: #e8c55a;   /* Lighter shade */
}
```

### Color Suggestions by Industry
| Industry | Primary | Accent |
|----------|---------|--------|
| Construction | Navy #1a2744 | Gold #d4a937 |
| Landscaping | Forest #2d5a27 | Lime #7cb342 |
| Plumbing | Blue #1565c0 | Orange #ff8f00 |
| Electrical | Dark Gray #37474f | Yellow #ffc107 |
| Roofing | Charcoal #263238 | Red #c62828 |
| HVAC | Teal #00695c | Silver #90a4ae |

---

## 2. Company Information

### Locations to Update

**index.html - Search and replace these values:**

| Current Value | Location | Description |
|---------------|----------|-------------|
| `FPC Construction LLC` | Title, header, footer | Company name |
| `North Augusta, SC 29860` | Contact section, footer | Address |
| `(803) 884-9305` | Nav CTA, contact, footer | Public phone (JJ line) |
| `info@fpcconstructions.com` | Contact section, footer | Email |
| `Mon-Fri: 7AM - 6PM` | Contact section, footer | Business hours |
| `fpcconstructions.com` | Meta tags | Domain |

**Quick find/replace:**
```
Find: FPC Construction
Replace: [Client Name]

Find: (803) 884-9305
Replace: [Client Phone]

Find: info@fpcconstructions.com
Replace: [Client Email]

Find: North Augusta, SC 29860
Replace: [Client Address]
```

---

## 3. Services

### Current Services (6 cards)
Location: `index.html` - Look for `<section class="services">`

Each service card structure:
```html
<div class="service-card">
    <div class="service-card__icon">
        <!-- SVG icon here -->
    </div>
    <h3 class="service-card__title">Service Name</h3>
    <p class="service-card__description">Service description...</p>
    <a href="#contact" class="service-card__link">Learn More &rarr;</a>
</div>
```

### To Add/Remove Services
- Copy an existing `.service-card` div
- Update the title, description, and icon
- Adjust the CSS grid if needed (currently 3 columns on desktop)

### Icon Resources
- Feather Icons: https://feathericons.com
- Heroicons: https://heroicons.com
- Bootstrap Icons: https://icons.getbootstrap.com

---

## 4. Testimonials

### Current Testimonials (4 reviews)
Location: `index.html` - Look for `<section class="testimonials">`

Each testimonial structure:
```html
<div class="testimonial-card">
    <div class="testimonial-card__stars">
        <!-- 5 star SVGs -->
    </div>
    <p class="testimonial-card__quote">"Customer review text..."</p>
    <div class="testimonial-card__author">
        <div class="testimonial-card__avatar">JM</div>
        <div class="testimonial-card__info">
            <span class="testimonial-card__name">Customer Name</span>
            <span class="testimonial-card__role">Homeowner</span>
        </div>
    </div>
</div>
```

### To Add New Testimonials
1. Copy an existing `.testimonial-card` div
2. Update the quote, name, role
3. Update the avatar initials
4. The carousel JS will automatically adjust

---

## 5. Portfolio/Projects

### Current Projects (6 items)
Location: `index.html` - Look for `<section class="projects">`

Each project card structure:
```html
<div class="project-card" data-category="category-slug">
    <div class="project-card__image">
        <img src="assets/images/placeholder/project-X.jpg" alt="..." loading="lazy">
        <div class="project-card__overlay">
            <span class="project-card__category">Category Name</span>
        </div>
    </div>
    <div class="project-card__content">
        <h3 class="project-card__title">Project Title</h3>
        <p class="project-card__location">City, State</p>
    </div>
</div>
```

### Filter Buttons
Update the filter buttons to match categories:
```html
<div class="projects__filters">
    <button class="projects__filter projects__filter--active" data-filter="all">All Projects</button>
    <button class="projects__filter" data-filter="category-slug">Category Name</button>
    <!-- Add more filters -->
</div>
```

**Important:** The `data-filter` attribute must match the `data-category` attribute on project cards.

---

## 6. Contact Form Backend

### Option 1: Formspree (Easiest)
1. Create account at https://formspree.io
2. Create new form
3. Update form action:
```html
<form action="https://formspree.io/f/YOUR_FORM_ID" method="POST">
```
4. Remove the JavaScript form handler simulation in `main.js`

### Option 2: Netlify Forms
Add attributes to form:
```html
<form name="contact" data-netlify="true" netlify-honeypot="bot-field" method="POST">
    <input type="hidden" name="form-name" value="contact">
    <p hidden><input name="bot-field"></p>
    <!-- rest of form -->
</form>
```

### Option 3: Custom Endpoint
Modify the form submission handler in `main.js`:
```javascript
form.addEventListener('submit', async function(e) {
    e.preventDefault();
    const formData = new FormData(form);

    const response = await fetch('YOUR_API_ENDPOINT', {
        method: 'POST',
        body: formData
    });

    if (response.ok) {
        // Show success message
    }
});
```

---

## 7. Analytics & Tracking

### Google Analytics 4
Add before closing `</head>` tag:
```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

### Google Tag Manager
Add after opening `<body>` tag:
```html
<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-XXXXXXX"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
```

### Facebook Pixel
Add before closing `</head>` tag:
```html
<!-- Facebook Pixel Code -->
<script>
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', 'YOUR_PIXEL_ID');
  fbq('track', 'PageView');
</script>
```

---

## 8. SEO Optimization

### Meta Tags to Update
Location: `index.html` - `<head>` section

```html
<title>Company Name | Tagline | City, State</title>
<meta name="description" content="Description with keywords...">
<meta property="og:title" content="Company Name - Tagline">
<meta property="og:description" content="Description...">
<meta property="og:url" content="https://yoursite.com">
<meta property="og:image" content="assets/images/og-image.jpg">
```

### Create OG Image
- Size: 1200x630 pixels
- Include: Logo, tagline, phone number
- Tools: Canva, Figma, or similar

---

## 9. mpowerio.ai Branding

### Footer Credit
Currently includes:
```html
<p class="footer__powered">
    <a href="https://mpowerio.ai" target="_blank" rel="noopener">Powered by mpowerio.ai</a>
</p>
```

### Options:
1. **Keep as-is** - Provides backlink
2. **Remove entirely** - For clients who prefer no third-party branding
3. **Modify style** - Make more/less prominent

To remove:
- Delete the `<p class="footer__powered">` element in `index.html`
- Optionally remove the `.footer__powered` styles in `styles.css`

---

## 10. Pre-Launch Checklist

### Content
- [ ] Company name updated everywhere
- [ ] Contact info correct (phone, email, address)
- [ ] Services match client offerings
- [ ] Testimonials are real (with permission)
- [ ] FAQ answers are accurate
- [ ] All placeholder text removed

### Images
- [ ] Logo uploaded (transparent PNG recommended)
- [ ] Favicon created (32x32 PNG)
- [ ] Hero background image
- [ ] About section image
- [ ] Project/portfolio images
- [ ] OG image for social sharing

### Technical
- [ ] Form backend configured and tested
- [ ] All links work
- [ ] Mobile responsive verified
- [ ] Analytics installed
- [ ] SSL certificate active

### SEO
- [ ] Meta title and description
- [ ] Open Graph tags
- [ ] Canonical URL (if needed)
- [ ] Schema markup (optional but recommended)

---

## Support

For template questions or custom development:
- **Website:** https://mpowerio.ai
- **Email:** support@mpowerio.ai

---

*Template Version: 1.0.0*
*Last Updated: January 2025*
