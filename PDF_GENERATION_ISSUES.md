# PDF Generation Issues Guide

## 1. Preview Issues
### Preview 1 (/preview1)
- **Current Status**: Not showing data
- **Possible Causes**:
  1. Template variable mismatch:
     - Template uses `nome` but data uses `nome_funcionario`
     - Template uses `numeroDocumento` but data uses `numero_documento`
  2. Data mapping inconsistencies between mock data and template

### Preview 2 (/preview2)
- **Current Status**: Working with images but data might be inconsistent
- **Note**: Keep working state for reference when fixing Preview 1

## 2. Image Rendering Issues
### Logo and Evidence Images Not Showing
- **Current Status**: Neither logo nor example images are displaying
- **Possible Areas to Check**:
  1. Asset Path Configuration:
     ```javascript
     // Current path
     logoUrl: path.join('/assets/images', 'logo.png')
     ```
  2. Static File Serving:
     ```javascript
     app.use('/assets', express.static(path.join(workspaceRoot, 'assets')));
     ```
  3. File System Structure:
     - Verify `/assets/images/logo.png` exists
     - Verify `/assets/images/evidenceexample.png` exists

## 3. Data Mapping Issues
### Field Name Inconsistencies
```javascript
// Template expects:
nome, numeroDocumento, dataOcorrencia, horaOcorrencia

// Data provides:
nome_funcionario, numero_documento, data_infracao, hora_infracao
```

## 4. Required Checks
1. File System:
   - Confirm all image files exist in correct locations
   - Verify file permissions

2. Template Variables:
   - Audit all variable names in both templates
   - Create a mapping table of template variables to data fields

3. Static File Serving:
   - Verify static middleware is working
   - Check network tab for 404 errors on image requests

4. Image Paths:
   - Verify absolute vs relative paths
   - Check URL construction in development vs production

## 5. Logging Points to Add
```javascript
// Asset loading
logger.info('Static asset request', {
    path: req.path,
    baseUrl: req.baseUrl,
    originalUrl: req.originalUrl
});

// Template variable mapping
logger.info('Template data mapping', {
    templateVars: Object.keys(templateData),
    providedData: Object.keys(mockData)
});

// Image path resolution
logger.info('Image path resolution', {
    logoPath: path.resolve(logoUrl),
    evidencePath: path.resolve(evidencePath)
});
```

## Next Steps Recommendation
1. Verify file system structure and image locations
2. Audit template variable names against provided data
3. Test static file serving independently
4. Add suggested logging points
5. Check network requests for image loading
6. Verify template compilation with sample data 