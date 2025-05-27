# MCGQS Portal

This repository contains a sample HTML page for displaying live charts.

## Providing the API key

`socketChart.html` expects an API key to connect to the VitalStats API. The file uses a placeholder value (`PLACEHOLDER_API_KEY`). Replace this value when serving the page.

One way to do this is to pass the key via an environment variable and substitute it before the page is served:

```bash
API_KEY=your_real_key envsubst < socketChart.html > index.html
```

The generated `index.html` will contain the real key and can be served by any web server. Keep the real key out of version control.
