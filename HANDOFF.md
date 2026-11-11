# Digitwitch Deployment Handoff

This document provides deployment instructions for the FPC Construction website. This is a static HTML/CSS/JS site with no server-side dependencies.

---

## Project Overview

| Item | Details |
|------|---------|
| **Client** | FPC Construction LLC |
| **Domain** | fpcconstructions.com |
| **Type** | Static HTML/CSS/JS |
| **Hosting** | GoDaddy (client's existing) |
| **Launch Date** | Monday, January 20, 2025 |

---

## 1. File Structure

```
fpc-construction/
├── index.html                # Main website (single-page)
├── assets/
│   ├── css/
│   │   └── styles.css        # All styles (no external dependencies)
│   ├── js/
│   │   └── main.js           # All JavaScript (vanilla, no jQuery)
│   └── images/
│       ├── logo.png          # Company logo
│       ├── favicon.png       # Browser favicon
│       └── placeholder/      # Placeholder images (need replacement)
├── README.md                 # General documentation
├── TEMPLATE.md               # Template customization guide
└── HANDOFF.md                # This file
```

---

## 2. Deployment Options

### Option A: GoDaddy cPanel (Recommended for this client)

1. **Login to GoDaddy**
   - Go to https://www.godaddy.com
   - Login with client credentials
   - Navigate to "My Products" > "Web Hosting" > "Manage"

2. **Access cPanel**
   - Click "cPanel Admin" or "Manage"
   - Navigate to "File Manager"

3. **Upload Files**
   - Open `public_html` directory
   - Delete existing WordPress files (if migrating, back up first!)
   - Upload all files from this package:
     - `index.html`
     - `assets/` folder (with all subfolders)
   - Do NOT upload: `README.md`, `TEMPLATE.md`, `HANDOFF.md`

4. **Set Permissions**
   - Files: 644
   - Directories: 755

### Option B: GoDaddy File Manager (Alternative)

1. Login to GoDaddy Hosting
2. Go to File Manager
3. Navigate to `public_html`
4. Use "Upload" button
5. Upload zip file and extract, or upload individual files

### Option C: FTP Upload

1. **FTP Credentials**
   - Host: ftp.fpcconstructions.com (or IP from GoDaddy)
   - Username: (from GoDaddy cPanel)
   - Password: (from GoDaddy cPanel)
   - Port: 21

2. **Using FileZilla or similar:**
   ```
   Local Site: /path/to/fpc-construction/
   Remote Site: /public_html/
   ```

3. **Upload:**
   - index.html → /public_html/index.html
   - assets/ → /public_html/assets/

### Option D: Deploy to Static Host (Future option)

**Netlify:**
```bash
npm install -g netlify-cli
netlify deploy --prod --dir=.
```

**Vercel:**
```bash
npm install -g vercel
vercel --prod
```

**GitHub Pages:**
1. Push to GitHub repository
2. Go to Settings > Pages
3. Select branch and folder
4. Enable HTTPS

---

## 3. DNS Configuration

### For fpcconstructions.com

**If domain is at GoDaddy:**
1. Go to GoDaddy > Domain Settings > DNS Management
2. Ensure A Record points to hosting IP
3. Add/verify these records:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | [Hosting IP] | 1 hour |
| A | www | [Hosting IP] | 1 hour |
| CNAME | www | fpcconstructions.com | 1 hour |

**If domain is elsewhere:**
1. Get nameservers from GoDaddy hosting
2. Update at domain registrar:
   - ns1.godaddy.com
   - ns2.godaddy.com

**DNS Propagation:**
- Can take 24-48 hours globally
- Use https://dnschecker.org to verify

---

## 4. SSL/HTTPS Setup

### GoDaddy SSL

1. **Check if SSL is included:**
   - Many GoDaddy plans include free SSL
   - Go to cPanel > SSL/TLS Status

2. **Enable AutoSSL:**
   - cPanel > SSL/TLS Status
   - Click "Run AutoSSL"
   - Wait for certificate installation

3. **Force HTTPS:**
   Create/edit `.htaccess` in `public_html`:
   ```apache
   RewriteEngine On
   RewriteCond %{HTTPS} off
   RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
   ```

4. **Verify:**
   - Visit https://fpcconstructions.com
   - Check for padlock icon
   - Test redirect from http to https

### Let's Encrypt (Alternative)

If GoDaddy SSL isn't working:
1. cPanel > Let's Encrypt SSL
2. Issue certificate for fpcconstructions.com
3. Enable auto-renewal

---

## 5. Contact Form Setup

The form currently shows a success message but doesn't send emails. To enable:

### Formspree (Recommended - 5 min setup)

1. Go to https://formspree.io
2. Sign up for free account
3. Create new form
4. Get form ID (e.g., `f/xyzabc123`)
5. Edit `index.html`:

```html
<!-- Find this line (around line 450) -->
<form class="contact__form" id="contact-form" action="#" method="POST">

<!-- Change to -->
<form class="contact__form" id="contact-form" action="https://formspree.io/f/YOUR_FORM_ID" method="POST">
```

6. In `main.js`, remove or comment out the form simulation (around line 230):
```javascript
// Comment out the setTimeout simulation
// setTimeout(function() { ... }, 1500);
```

### Alternative: PHP Mail

Create `send-email.php` in `public_html`:
```php
<?php
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $name = htmlspecialchars($_POST['name']);
    $email = htmlspecialchars($_POST['email']);
    $phone = htmlspecialchars($_POST['phone']);
    $service = htmlspecialchars($_POST['service']);
    $message = htmlspecialchars($_POST['message']);

    $to = "info@fpcconstructions.com";
    $subject = "New Quote Request from $name";
    $body = "Name: $name\nEmail: $email\nPhone: $phone\nService: $service\n\nMessage:\n$message";
    $headers = "From: noreply@fpcconstructions.com\r\nReply-To: $email";

    if (mail($to, $subject, $body, $headers)) {
        header("Location: index.html?success=1");
    } else {
        header("Location: index.html?error=1");
    }
}
?>
```

Update form action to `action="send-email.php"`.

---

## 6. Image Replacement

### Current Placeholders

The following images need real content:

| File | Purpose | Recommended Size |
|------|---------|------------------|
| `assets/images/placeholder/hero-bg.jpg` | Hero background | 1920x1080 |
| `assets/images/placeholder/about-team.jpg` | About section | 800x600 |
| `assets/images/placeholder/cta-bg.jpg` | CTA background | 1920x600 |
| `assets/images/placeholder/project-1.jpg` | Portfolio | 800x600 |
| `assets/images/placeholder/project-2.jpg` | Portfolio | 800x600 |
| `assets/images/placeholder/project-3.jpg` | Portfolio | 800x600 |
| `assets/images/placeholder/project-4.jpg` | Portfolio | 800x600 |
| `assets/images/placeholder/project-5.jpg` | Portfolio | 800x600 |
| `assets/images/placeholder/project-6.jpg` | Portfolio | 800x600 |

### Image Optimization

Before uploading:
1. Resize to appropriate dimensions
2. Compress using TinyPNG or Squoosh
3. Target file size: <200KB per image
4. Consider WebP format with JPEG fallback

---

## 7. Post-Launch Checklist

### Immediate (Day 1)
- [ ] Verify site loads at fpcconstructions.com
- [ ] Verify site loads at www.fpcconstructions.com
- [ ] Check HTTPS redirect working
- [ ] Test all navigation links
- [ ] Test contact form submission
- [ ] Test on mobile device
- [ ] Verify phone number links work

### Within First Week
- [ ] Submit to Google Search Console
- [ ] Submit sitemap (create sitemap.xml if needed)
- [ ] Set up Google Analytics
- [ ] Test form submission email delivery
- [ ] Check page speed (Google PageSpeed Insights)
- [ ] Replace placeholder images with real photos

### Ongoing Maintenance
- [ ] Monitor uptime
- [ ] Check form submissions
- [ ] Update testimonials periodically
- [ ] Add new project photos
- [ ] Renew SSL certificate (if not auto-renewing)

---

## 8. Troubleshooting

### Site not loading
1. Check DNS propagation: https://dnschecker.org
2. Verify files are in `public_html`
3. Check file permissions (644 for files, 755 for directories)
4. Clear browser cache

### CSS/JS not loading
1. Check file paths are correct (case-sensitive on Linux servers)
2. Verify `assets/` folder structure is intact
3. Check browser console for 404 errors

### Form not working
1. Verify Formspree endpoint is correct
2. Check email spam folder
3. Test with different email address
4. Check Formspree dashboard for submissions

### Images not showing
1. Verify images are in correct folders
2. Check file extensions match (case-sensitive)
3. Verify image files aren't corrupted

### HTTPS issues
1. Clear browser cache and cookies
2. Run AutoSSL again in cPanel
3. Check for mixed content warnings
4. Verify .htaccess redirect is in place

---

## 9. Contact Information

### FPC Construction (Client)
- **Phone (public):** (803) 884-9305, the JJ line. Filemon's cell is private and never goes on the site or a listing.
- **Email:** info@fpcconstructions.com
- **Location:** North Augusta, SC 29860

### mpowerio.ai (Developer)
- **Website:** https://mpowerio.ai
- **For template/code questions**

### Digitwitch (Hosting Management)
- **Website:** https://digitwitch.com
- **For hosting/deployment questions**

---

## 10. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Jan 2025 | Initial release |

---

*Document prepared for Digitwitch by mpowerio.ai*
*Last updated: January 2025*
