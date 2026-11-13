# FPC Construction - Photo Upload Guide

This guide explains how to manage photos on your website. You can use **local files** (works on GitHub & GoDaddy) or **Google Drive**.

---

## Quick Start

### Option 1: Local Images (Recommended for GoDaddy)

1. Upload your images to: `assets/images/projects/`
2. Open `assets/data/gallery-config.json`
3. Make sure `"mode": "local"` is set
4. Add filename to `"localImage"` field

**Example:**
```json
{
  "id": "project-1",
  "title": "Residential Driveway",
  "localImage": "my-driveway-photo.jpg",
  "gdriveId": ""
}
```

### Option 2: Google Drive

1. Upload to: https://drive.google.com/drive/folders/1mtkzCuw_zNsbeDa5N_P5yDJTL6lhLrF-
2. Share image with "Anyone with the link"
3. Open `assets/data/gallery-config.json`
4. Set `"mode": "gdrive"`
5. Add file ID to `"gdriveId"` field

---

## Switching Between Modes

In `gallery-config.json`, change the `"mode"` setting:

```json
{
  "mode": "local",    // Use local files in assets/images/projects/
  ...
}
```

OR

```json
{
  "mode": "gdrive",   // Use Google Drive images
  ...
}
```

---

## Detailed Instructions

### Adding Local Images

1. **Prepare your image**
   - Recommended size: 800x600 pixels or larger
   - Formats: JPG, PNG, or WebP
   - Keep file size under 500KB for fast loading

2. **Upload the image**
   - **GitHub:** Upload to `assets/images/projects/` folder
   - **GoDaddy:** Use File Manager or FTP to upload to same folder

3. **Update the config**
   - Open `assets/data/gallery-config.json`
   - Find the project you want to update
   - Add filename to `"localImage"`:
   ```json
   "localImage": "your-image-name.jpg"
   ```

### Adding Google Drive Images

1. **Upload to Google Drive folder**
   - Go to: https://drive.google.com/drive/folders/1mtkzCuw_zNsbeDa5N_P5yDJTL6lhLrF-
   - Upload your image

2. **Share the image**
   - Right-click the image
   - Click "Share"
   - Change to "Anyone with the link"
   - Click "Done"

3. **Get the File ID**
   - Right-click → "Get link"
   - The link looks like: `https://drive.google.com/file/d/ABC123xyz/view`
   - The File ID is: `ABC123xyz` (between `/d/` and `/view`)

4. **Update the config**
   - Open `assets/data/gallery-config.json`
   - Set `"mode": "gdrive"`
   - Add File ID to `"gdriveId"`:
   ```json
   "gdriveId": "ABC123xyz"
   ```

---

## Managing on GoDaddy

### File Manager Method
1. Log into GoDaddy → My Products → Hosting → Manage
2. Open File Manager
3. Navigate to `public_html/assets/images/projects/`
4. Upload your images
5. Edit `assets/data/gallery-config.json` with filenames

### FTP Method
1. Connect via FTP (FileZilla, etc.)
2. Navigate to `/assets/images/projects/`
3. Upload images
4. Update `gallery-config.json`

---

## Managing on GitHub

### Via GitHub.com
1. Go to your repository
2. Navigate to `assets/images/projects/`
3. Click "Add file" → "Upload files"
4. Upload your images
5. Edit `assets/data/gallery-config.json`
6. Commit changes

### Via Git Command Line
```bash
# Add images to the projects folder
cp your-image.jpg assets/images/projects/

# Stage and commit
git add assets/images/projects/your-image.jpg
git add assets/data/gallery-config.json
git commit -m "Add new project photo"
git push
```

---

## File Structure

```
assets/
├── data/
│   └── gallery-config.json    # Edit this to update photos
├── images/
│   ├── projects/              # Put your local images here
│   │   ├── project-1.jpg
│   │   ├── project-2.jpg
│   │   └── ...
│   └── placeholder/           # Fallback images (don't edit)
```

---

## Troubleshooting

**Image not showing?**
- Check the filename matches exactly (case-sensitive)
- Verify the image is in `assets/images/projects/`
- Make sure `"mode"` matches your image source

**Google Drive image not loading?**
- Ensure sharing is set to "Anyone with the link"
- Double-check the File ID is correct
- Google Drive images may load slower

**Changes not appearing?**
- Clear browser cache (Ctrl+Shift+R)
- Wait a few minutes for GitHub Pages to update
- Check for typos in `gallery-config.json`

---

## Need Help?

Contact your web developer or open an issue on GitHub.

