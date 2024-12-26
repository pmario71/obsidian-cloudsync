# GitHub Pages Setup

To host this documentation on GitHub Pages:

1. **Enable GitHub Pages**
   - Go to your repository settings
   - Scroll down to "GitHub Pages" section
   - Under "Source", select `main` branch
   - Under "Folder", select `/ (root)`
   - Click Save

2. **Update Base URL**
   - Open `index.html`
   - Update the `basePath` in the docsify configuration:
   ```js
   window.$docsify = {
     // ... other config
     basePath: '/obsidian-cloudsync/', // your repo name
     // ... other config
   }
   ```

3. **Create .nojekyll File**
   - Create a `.nojekyll` file in the root directory to tell GitHub Pages not to process the site with Jekyll
   - This is required for docsify to work properly

4. **Verify Setup**
   - Your documentation will be available at:
   `https://[username].github.io/obsidian-cloudsync/`
   - For example: `https://mihakralj.github.io/obsidian-cloudsync/`

5. **Custom Domain (Optional)**
   - If you want to use a custom domain:
     1. Go to repository settings
     2. Under "GitHub Pages", enter your custom domain
     3. Update DNS settings with your domain provider
     4. Add CNAME file to your repository

The dark theme and all styling will work automatically on GitHub Pages as all required files are already included in the repository.
