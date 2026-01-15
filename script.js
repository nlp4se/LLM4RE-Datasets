// Global state
let datasets = [];
let publications = [];
let filteredDatasets = [];
let currentView = 'listing';
let currentDataset = null;

// Language code mapping
const languageMapping = {
    'en': 'English',
    'chn': 'Chinese',
    'zh': 'Chinese',
    'zh-cn': 'Chinese (Simplified)',
    'zh-tw': 'Chinese (Traditional)',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'ja': 'Japanese',
    'ko': 'Korean',
    'ar': 'Arabic',
    'hi': 'Hindi',
    'nl': 'Dutch',
    'sv': 'Swedish',
    'da': 'Danish',
    'no': 'Norwegian',
    'fi': 'Finnish',
    'pl': 'Polish',
    'tr': 'Turkish',
    'he': 'Hebrew',
    'th': 'Thai',
    'vi': 'Vietnamese',
    'multiple': 'Multiple Languages',
    'multilingual': 'Multilingual'
};

// DOM elements
const elements = {
    listingView: document.getElementById('listing-view'),
    detailView: document.getElementById('detail-view'),
    datasetGrid: document.getElementById('dataset-grid'),
    detailContent: document.getElementById('detail-content'),
    detailTitle: document.getElementById('detail-title'),
    datasetCount: document.getElementById('dataset-count'),
    resultsCount: document.getElementById('results-count'),
    totalCount: document.getElementById('total-count'),
    searchInput: document.getElementById('search-input'),
    sortSelect: document.getElementById('sort-select'),
    sortDirection: document.getElementById('sort-direction'),
    clearFilters: document.getElementById('clear-filters'),
    backBtn: document.getElementById('back-btn'),
    filters: {
        license: document.getElementById('license-filter'),
        artifact: document.getElementById('artifact-filter'),
        granularity: document.getElementById('granularity-filter'),
        stage: document.getElementById('stage-filter'),
        task: document.getElementById('task-filter'),
        domain: document.getElementById('domain-filter'),
        language: document.getElementById('language-filter'),
        year: document.getElementById('year-filter')
    }
};

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadData();
        setupEventListeners();
        populateFilters();

        // Check for dataset ID in URL path (e.g., /dataset-code)
        // This must be done after datasets are loaded
        handleInitialRoute();

        // If showing listing view, load form state from URL parameters
        if (currentView === 'listing') {
            loadStateFromURL();
            renderDatasets();
        }

        updateCounts();
        generateDynamicInsights(); // Add this line
    } catch (error) {
        console.error('Error initializing application:', error);
        showError('Failed to load data. Please refresh the page.');
    }
});

// Load data from CSV files
async function loadData() {
    try {
        // Load datasets
        const datasetsResponse = await fetch('data/datasets.csv');
        const datasetsText = await datasetsResponse.text();
        datasets = parseCSV(datasetsText);

        // Load publications (optional - handle gracefully if file doesn't exist)
        try {
            const publicationsResponse = await fetch('data/publications - selection.csv');
            if (publicationsResponse.ok) {
                const publicationsText = await publicationsResponse.text();
                publications = parseCSV(publicationsText);
            } else {
                console.warn('Publications file not found, continuing without publications data');
                publications = [];
            }
        } catch (pubError) {
            console.warn('Could not load publications file:', pubError);
            publications = [];
        }

        // Initialize filtered datasets
        filteredDatasets = [...datasets];

        console.log(`Loaded ${datasets.length} datasets and ${publications.length} publications`);
    } catch (error) {
        console.error('Error loading data:', error);
        throw error;
    }
}

// Parse CSV data
function parseCSV(text) {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());

    return lines.slice(1).map(line => {
        const values = parseCSVLine(line);
        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = values[index] || '';
        });
        return obj;
    });
}

// Parse a single CSV line handling quoted values
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    result.push(current.trim());
    return result;
}

// Setup event listeners
function setupEventListeners() {
    // Search input
    elements.searchInput.addEventListener('input', debounce(() => {
        handleSearch();
        updateURLFromForm();
    }, 300));

    // Filter selects
    Object.values(elements.filters).forEach(filter => {
        if (filter) {
            filter.addEventListener('change', () => {
                handleFilterChange();
                updateURLFromForm();
            });
        }
    });

    // Sort controls
    elements.sortSelect.addEventListener('change', () => {
        handleSort();
        updateURLFromForm();
    });
    elements.sortDirection.addEventListener('click', () => {
        toggleSortDirection();
        updateURLFromForm();
    });

    // Clear filters
    elements.clearFilters.addEventListener('click', () => {
        clearAllFilters();
        updateURLFromForm();
    });

    // Back button
    elements.backBtn.addEventListener('click', showListingView);

    // Navigation links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            // Skip external links entirely
            if (link.classList.contains('external-link')) {
                return; // Allow default navigation behavior
            }

            const view = link.dataset.view;

            // Prevent default only for internal navigation
            e.preventDefault();

            if (view === 'listing') {
                showListingView();
            }
        });
    });

    // Dataset grid clicks
    elements.datasetGrid.addEventListener('click', handleDatasetClick);

    // Handle browser back/forward navigation
    window.addEventListener('popstate', handlePopState);
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Handle search input
function handleSearch() {
    const query = elements.searchInput.value.toLowerCase().trim();
    applyFilters();
}

// Handle filter changes
function handleFilterChange() {
    applyFilters();
}

// Apply all filters and search
function applyFilters() {
    const searchQuery = elements.searchInput.value.toLowerCase().trim();

    filteredDatasets = datasets.filter(dataset => {
        // Search filter
        if (searchQuery) {
            const searchableText = [
                dataset.Name,
                dataset.Description,
                dataset.Domain,
                dataset.Task,
                dataset.Labels
            ].join(' ').toLowerCase();

            if (!searchableText.includes(searchQuery)) {
                return false;
            }
        }

        // Property filters
        const filters = {
            License: elements.filters.license.value,
            'Artifact type': elements.filters.artifact.value,
            Granularity: elements.filters.granularity.value,
            'RE stage': elements.filters.stage.value,
            Task: elements.filters.task.value,
            Domain: elements.filters.domain.value,
            Languages: elements.filters.language.value,
            Year: elements.filters.year.value
        };

        for (const [key, value] of Object.entries(filters)) {
            if (value && value.trim() !== '') {
                // Handle comma-separated lists for Domain (and potentially Languages)
                if (key === 'Domain') {
                    const datasetValues = dataset[key].split(',').map(v => v.trim());
                    if (!datasetValues.includes(value)) {
                        return false;
                    }
                } else if (dataset[key] !== value) {
                    return false;
                }
            }
        }

        return true;
    });

    handleSort();
    renderDatasets();
    updateCounts();
}

// Handle sorting
function handleSort() {
    const sortBy = elements.sortSelect.value;
    const direction = elements.sortDirection.dataset.direction;

    // Map sort options to CSV column names
    let csvColumn;
    switch (sortBy) {
        case 'name':
            csvColumn = 'Name';
            break;
        case 'size':
            csvColumn = 'Size';
            break;
        case 'domain':
            csvColumn = 'Domain';
            break;
        case 'year':
            csvColumn = 'Year';
            break;
        default:
            csvColumn = 'Name';
    }

    filteredDatasets.sort((a, b) => {
        let aVal = a[csvColumn] || '';
        let bVal = b[csvColumn] || '';

        // Handle numeric sorting for size and year
        if (sortBy === 'size' || sortBy === 'year') {
            aVal = parseInt(aVal) || 0;
            bVal = parseInt(bVal) || 0;
        }

        // Handle string comparison
        if (typeof aVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
        }

        if (direction === 'asc') {
            return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        } else {
            return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
        }
    });

    renderDatasets();
}


// Toggle sort direction
function toggleSortDirection() {
    const currentDirection = elements.sortDirection.dataset.direction;
    const newDirection = currentDirection === 'asc' ? 'desc' : 'asc';

    elements.sortDirection.dataset.direction = newDirection;
    elements.sortDirection.innerHTML = newDirection === 'asc'
        ? '<i class="fas fa-sort-amount-up"></i>'
        : '<i class="fas fa-sort-amount-down"></i>';

    handleSort();
}

// Clear all filters
function clearAllFilters() {
    elements.searchInput.value = '';
    Object.values(elements.filters).forEach(filter => {
        if (filter) {
            filter.value = '';
        }
    });
    elements.sortSelect.value = 'name';
    elements.sortDirection.dataset.direction = 'asc';
    elements.sortDirection.innerHTML = '<i class="fas fa-sort-amount-up"></i>';

    applyFilters();
}

// Populate filter options
function populateFilters() {
    const filterOptions = {
        License: new Set(),
        'Artifact type': new Set(),
        Granularity: new Set(),
        'RE stage': new Set(),
        Task: new Set(),
        Domain: new Set(),
        Languages: new Set(),
        Year: new Set()
    };

    // Collect unique values
    datasets.forEach(dataset => {
        Object.keys(filterOptions).forEach(key => {
            if (dataset[key] && dataset[key].trim()) {
                if (key === 'Domain') {
                    // Split comma-separated domains
                    dataset[key].split(',').forEach(domain => {
                        filterOptions[key].add(domain.trim());
                    });
                } else {
                    filterOptions[key].add(dataset[key].trim());
                }
            }
        });
    });

    // Populate filter selects
    Object.entries(filterOptions).forEach(([key, values]) => {
        let filterElement;

        // Map CSV column names to HTML element IDs
        switch (key) {
            case 'License':
                filterElement = elements.filters.license;
                break;
            case 'Artifact type':
                filterElement = elements.filters.artifact;
                break;
            case 'Granularity':
                filterElement = elements.filters.granularity;
                break;
            case 'RE stage':
                filterElement = elements.filters.stage;
                break;
            case 'Task':
                filterElement = elements.filters.task;
                break;
            case 'Domain':
                filterElement = elements.filters.domain;
                break;
            case 'Languages':
                filterElement = elements.filters.language;
                break;
            case 'Year':
                filterElement = elements.filters.year;
                break;
        }

        if (filterElement) {
            const sortedValues = Array.from(values).sort();
            sortedValues.forEach(value => {
                const option = document.createElement('option');
                option.value = value;
                // For language filter, show full language name
                if (key === 'Languages') {
                    option.textContent = getLanguageName(value);
                } else {
                    option.textContent = value;
                }
                filterElement.appendChild(option);
            });
        }
    });
}

// Render datasets grid
function renderDatasets() {
    if (filteredDatasets.length === 0) {
        elements.datasetGrid.innerHTML = `
            <div class="no-results">
                <i class="fas fa-search"></i>
                <h3>No datasets found</h3>
                <p>Try adjusting your filters or search terms.</p>
            </div>
        `;
        return;
    }

    elements.datasetGrid.innerHTML = filteredDatasets.map(dataset => createDatasetCard(dataset)).join('');
}

// Create dataset card HTML
function createDatasetCard(dataset) {
    const labels = parseLabels(dataset.Labels);
    const extendsLinks = parseExtends(dataset.Extends);

    return `
        <div class="dataset-card" data-code="${dataset.Code}">
            <div class="dataset-header">
                <span class="dataset-code">${dataset.Code}</span>
                <div class="dataset-meta-header">
                    ${dataset.Languages ? `<span class="dataset-language"><i class="fas fa-language"></i> ${getLanguageName(dataset.Languages)}</span>` : ''}
                    ${dataset.Year ? `<span class="dataset-year">${dataset.Year}</span>` : ''}
                    ${dataset.Size ? `<span class="dataset-size">${dataset.Size} items</span>` : ''}
                </div>
            </div>
            
            <h3 class="dataset-title">${dataset.Name}</h3>
            
            <p class="dataset-description">${dataset.Description || 'No description available.'}</p>
            
            <div class="dataset-meta">
                ${dataset.License ? `<span class="meta-tag license"><i class="fas fa-certificate"></i> ${dataset.License}</span>` : ''}
                ${dataset.Domain ? `<span class="meta-tag domain"><i class="fas fa-globe"></i> ${dataset.Domain.split(',').map(d => d.trim()).join(', ')}</span>` : ''}
                ${dataset.Task ? `<span class="meta-tag task"><i class="fas fa-tasks"></i> ${dataset.Task}</span>` : ''}
                ${dataset['Artifact type'] ? `<span class="meta-tag artifact"><i class="fas fa-file-alt"></i> ${dataset['Artifact type']}</span>` : ''}
                ${dataset.Granularity ? `<span class="meta-tag granularity"><i class="fas fa-layer-group"></i> ${dataset.Granularity}</span>` : ''}
                ${dataset['RE stage'] ? `<span class="meta-tag stage"><i class="fas fa-cogs"></i> ${dataset['RE stage']}</span>` : ''}
            </div>
            
            ${labels.length > 0 ? `
                <div class="dataset-labels">
                    <div class="labels-title">Labels:</div>
                    <div class="label-group">
                        ${labels.map(label => `<span class="label">${label}</span>`).join('')}
                    </div>
                </div>
            ` : ''}
            
            ${extendsLinks.length > 0 ? `
                <div class="extends-section">
                    <div class="labels-title">Extends:</div>
                    <div class="label-group">
                        ${extendsLinks.map(link => `<span class="label extends-link" data-code="${link}">${link}</span>`).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

// Parse labels from the Labels column
function parseLabels(labelsString) {
    if (!labelsString || labelsString.trim() === '' || labelsString === '-') {
        return [];
    }

    // Split by semicolon first, then by comma
    return labelsString.split(';').flatMap(group =>
        group.split(',').map(label => label.trim()).filter(label => label)
    );
}

// Parse extends from the Extends column
function parseExtends(extendsString) {
    if (!extendsString || extendsString.trim() === '' || extendsString === '-') {
        return [];
    }

    return extendsString.split(',').map(code => code.trim()).filter(code => code);
}

// Get full language name from code
function getLanguageName(languageCode) {
    if (!languageCode) return '';

    // Handle multiple languages separated by commas
    if (languageCode.includes(',')) {
        const codes = languageCode.split(',').map(code => code.trim());
        return codes.map(code => languageMapping[code] || code).join(', ');
    }

    return languageMapping[languageCode] || languageCode;
}

// Handle dataset card clicks
function handleDatasetClick(event) {
    const card = event.target.closest('.dataset-card');
    if (!card) return;

    const datasetCode = card.dataset.code;
    const dataset = datasets.find(d => d.Code === datasetCode);

    if (dataset) {
        showDatasetDetail(dataset, true); // true = update URL
    }
}

// Show dataset detail view
function showDatasetDetail(dataset, updateURL = false) {
    // Scroll to top first
    window.scrollTo(0, 0);

    currentDataset = dataset;
    currentView = 'detail';

    elements.listingView.classList.remove('active');
    elements.detailView.classList.add('active');

    elements.detailTitle.textContent = dataset.Name;
    elements.detailContent.innerHTML = createDatasetDetail(dataset);

    // Update URL to show dataset ID
    if (updateURL) {
        // Get base path from current location
        const currentPath = window.location.pathname;
        let basePath = '';

        // If we're on index.html, get its directory
        if (currentPath.includes('index.html')) {
            const pathSegments = currentPath.split('/').slice(0, -1);
            basePath = pathSegments.length > 0 ? pathSegments.join('/') + '/' : '/';
        } else if (currentPath !== '/') {
            // If we're on a dataset detail page, get its directory
            const pathSegments = currentPath.split('/').slice(0, -1);
            basePath = pathSegments.length > 0 ? pathSegments.join('/') + '/' : '/';
        } else {
            // We're at root
            basePath = '/';
        }

        // Ensure basePath ends with /
        if (!basePath.endsWith('/')) {
            basePath += '/';
        }

        const newURL = basePath + dataset.Code;
        window.history.pushState({ view: 'detail', datasetCode: dataset.Code }, '', newURL);
    }
}

// Create dataset detail HTML
function createDatasetDetail(dataset) {
    const labels = parseLabels(dataset.Labels);
    const extendsLinks = parseExtends(dataset.Extends);
    const publicationIds = dataset.Publications ? dataset.Publications.split(',').map(id => id.trim()) : [];
    const relatedPublications = publications.filter(pub => publicationIds.includes(pub.ID));

    return `
        <div class="detail-section">
            <h3>Basic Information</h3>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-label">Code</div>
                    <div class="detail-value">${dataset.Code}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Name</div>
                    <div class="detail-value">${dataset.Name}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Year</div>
                    <div class="detail-value">${dataset.Year || 'Not specified'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Size</div>
                    <div class="detail-value">${dataset.Size || 'Not specified'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">License</div>
                    <div class="detail-value">${dataset.License || 'Not specified'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Artifact Type</div>
                    <div class="detail-value">${dataset['Artifact type'] || 'Not specified'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Granularity</div>
                    <div class="detail-value">${dataset.Granularity || 'Not specified'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">RE Stage</div>
                    <div class="detail-value">${dataset['RE stage'] || 'Not specified'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Task</div>
                    <div class="detail-value">${dataset.Task || 'Not specified'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Domain</div>
                    <div class="detail-value">${dataset.Domain ? dataset.Domain.split(',').map(d => d.trim()).join(', ') : 'Not specified'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Languages</div>
                    <div class="detail-value">${dataset.Languages ? getLanguageName(dataset.Languages) : 'Not specified'}</div>
                </div>
            </div>
        </div>
        
        ${dataset.Description ? `
            <div class="detail-section">
                <h3>Description</h3>
                <div class="detail-description">${dataset.Description}</div>
            </div>
        ` : ''}
        
        ${dataset.URL ? `
            <div class="detail-section">
                <h3>Access</h3>
                <div class="detail-item">
                    <div class="detail-label">URL</div>
                    <div class="detail-value">
                        <a href="${dataset.URL}" target="_blank" rel="noopener noreferrer">
                            <i class="fas fa-external-link-alt"></i> ${dataset.URL}
                        </a>
                    </div>
                </div>
            </div>
        ` : ''}
        
        ${labels.length > 0 ? `
            <div class="detail-section">
                <h3>Labels</h3>
                <div class="label-group">
                    ${labels.map(label => `<span class="label">${label}</span>`).join('')}
                </div>
            </div>
        ` : ''}
        
        ${extendsLinks.length > 0 ? `
            <div class="detail-section">
                <h3>Extends</h3>
                <div class="label-group">
                    ${extendsLinks.map(code => `
                        <a href="#" class="extends-link" data-code="${code}">
                            <i class="fas fa-link"></i> ${code}
                        </a>
                    `).join('')}
                </div>
            </div>
        ` : ''}
        
        ${relatedPublications.length > 0 ? `
            <div class="detail-section">
                <h3>Related Publications</h3>
                <ul class="publications-list">
                    ${relatedPublications.map(pub => `
                        <li>
                            <div class="publication-title">${pub.Title}</div>
                            <div class="publication-authors">${pub.Authors}</div>
                            <div class="publication-meta">
                                <span><i class="fas fa-calendar"></i> ${pub.Year}</span>
                                <span><i class="fas fa-book"></i> ${pub['Source title']}</span>
                                ${pub.DOI ? `<span><i class="fas fa-link"></i> <a href="https://doi.org/${pub.DOI}" target="_blank">DOI</a></span>` : ''}
                            </div>
                            ${pub.Abstract ? `<div class="publication-abstract">${pub.Abstract.substring(0, 200)}...</div>` : ''}
                        </li>
                    `).join('')}
                </ul>
            </div>
        ` : ''}
        
        ${dataset.Reference ? `
            <div class="detail-section">
                <h3>Reference</h3>
                <div class="detail-description">${dataset.Reference}</div>
            </div>
        ` : ''}
    `;
}

// Show listing view
function showListingView(updateURL = true) {
    // Scroll to top first
    window.scrollTo(0, 0);

    currentView = 'listing';
    currentDataset = null;

    elements.detailView.classList.remove('active');
    elements.listingView.classList.add('active');

    // Update URL to show base path with query parameters
    if (updateURL) {
        updateURLFromForm();
    }
}

// Update counts
function updateCounts() {
    elements.datasetCount.textContent = datasets.length;
    elements.resultsCount.textContent = filteredDatasets.length;
    elements.totalCount.textContent = datasets.length;
}

// Show error message
function showError(message) {
    elements.datasetGrid.innerHTML = `
        <div class="error-message">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Error</h3>
            <p>${message}</p>
        </div>
    `;
}

// Handle extends link clicks in detail view
document.addEventListener('click', (event) => {
    if (event.target.closest('.extends-link')) {
        event.preventDefault();
        const code = event.target.closest('.extends-link').dataset.code;
        const dataset = datasets.find(d => d.Code === code);

        if (dataset) {
            showDatasetDetail(dataset, true); // true = update URL
        }
    }
});

// URL Parameter Management Functions

// Get URL query parameters
function getURLParams() {
    const params = new URLSearchParams(window.location.search);
    const result = {};
    for (const [key, value] of params.entries()) {
        result[key] = decodeURIComponent(value);
    }
    return result;
}

// Update URL with form state as query parameters
function updateURLFromForm() {
    const params = new URLSearchParams();

    // Add search query
    if (elements.searchInput.value.trim()) {
        params.set('search', elements.searchInput.value.trim());
    }

    // Add filter values
    const filterMap = {
        'license': elements.filters.license.value,
        'artifact': elements.filters.artifact.value,
        'granularity': elements.filters.granularity.value,
        'stage': elements.filters.stage.value,
        'task': elements.filters.task.value,
        'domain': elements.filters.domain.value,
        'language': elements.filters.language.value,
        'year': elements.filters.year.value
    };

    Object.entries(filterMap).forEach(([key, value]) => {
        if (value && value.trim() !== '') {
            params.set(key, value);
        }
    });

    // Add sort parameters
    if (elements.sortSelect.value !== 'name') {
        params.set('sort', elements.sortSelect.value);
    }
    if (elements.sortDirection.dataset.direction !== 'asc') {
        params.set('sortDir', elements.sortDirection.dataset.direction);
    }

    // Build new URL - get base path from current location
    const currentPath = window.location.pathname;
    let basePath = '';

    // If we're on a dataset detail page (path ends with dataset code), go back to index.html
    const pathParts = currentPath.split('/').filter(part => part && part !== 'index.html' && part !== '');
    if (pathParts.length > 0) {
        const lastPart = pathParts[pathParts.length - 1];
        // Check if last part looks like a dataset code (no file extension)
        const knownFiles = ['dashboard.html', 'styles.css', 'script.js'];
        if (lastPart && !lastPart.includes('.') && !knownFiles.includes(lastPart)) {
            // We're on a dataset detail page, go to index.html
            const pathSegments = currentPath.split('/').slice(0, -1);
            if (pathSegments.length > 1) {
                basePath = pathSegments.join('/') + '/index.html';
            } else {
                basePath = 'index.html';
            }
        } else {
            // We're already on index.html or another file
            basePath = currentPath;
        }
    } else {
        // We're at root, use index.html
        basePath = 'index.html';
    }

    // If basePath doesn't end with index.html and doesn't end with /, ensure it points to index.html
    if (!basePath.endsWith('index.html') && !basePath.endsWith('/')) {
        const pathSegments = basePath.split('/').slice(0, -1);
        if (pathSegments.length > 0) {
            basePath = pathSegments.join('/') + '/index.html';
        } else {
            basePath = 'index.html';
        }
    }

    const newURL = basePath + (params.toString() ? `?${params.toString()}` : '');

    // Update URL without reload
    window.history.pushState({ view: 'listing' }, '', newURL);
}

// Load form state from URL parameters
function loadStateFromURL() {
    const params = getURLParams();

    // Load search query
    if (params.search) {
        elements.searchInput.value = params.search;
    }

    // Load filter values
    if (params.license) elements.filters.license.value = params.license;
    if (params.artifact) elements.filters.artifact.value = params.artifact;
    if (params.granularity) elements.filters.granularity.value = params.granularity;
    if (params.stage) elements.filters.stage.value = params.stage;
    if (params.task) elements.filters.task.value = params.task;
    if (params.domain) elements.filters.domain.value = params.domain;
    if (params.language) elements.filters.language.value = params.language;
    if (params.year) elements.filters.year.value = params.year;

    // Load sort parameters
    if (params.sort) elements.sortSelect.value = params.sort;
    if (params.sortDir) {
        elements.sortDirection.dataset.direction = params.sortDir;
        elements.sortDirection.innerHTML = params.sortDir === 'asc'
            ? '<i class="fas fa-sort-amount-up"></i>'
            : '<i class="fas fa-sort-amount-down"></i>';
    }

    // Apply filters after loading
    applyFilters();
}

// Handle initial route (check for dataset ID in path)
function handleInitialRoute() {
    // Check if we're coming from a GitHub Pages 404.html
    // When 404.html is served, the pathname might be /404.html, so check sessionStorage
    const stored404Path = sessionStorage.getItem('404-path');
    const path = stored404Path || window.location.pathname;
    const pathParts = path.split('/').filter(part => part && part !== 'index.html' && part !== '');

    // Clear the stored path if it was set
    if (stored404Path) {
        sessionStorage.removeItem('404-path');
    }

    // Check if there's a dataset code in the path
    if (pathParts.length > 0) {
        const datasetCode = pathParts[pathParts.length - 1];

        // Check if it's a valid dataset code (not a file extension and not a known file)
        const knownFiles = ['dashboard.html', 'styles.css', 'script.js', '404.html'];
        if (datasetCode && !datasetCode.includes('.') && !knownFiles.includes(datasetCode)) {
            const dataset = datasets.find(d => d.Code === datasetCode);
            if (dataset) {
                // Show dataset detail view
                showDatasetDetail(dataset, !stored404Path); // Update URL unless coming from 404

                // If coming from 404, update URL using replaceState to avoid adding history entry
                if (stored404Path) {
                    const currentPath = window.location.pathname;
                    let basePath = '';
                    if (currentPath.includes('index.html') || currentPath.includes('404.html')) {
                        const pathSegments = currentPath.split('/').slice(0, -1);
                        basePath = pathSegments.length > 0 ? pathSegments.join('/') + '/' : '/';
                    } else if (currentPath !== '/') {
                        const pathSegments = currentPath.split('/').slice(0, -1);
                        basePath = pathSegments.length > 0 ? pathSegments.join('/') + '/' : '/';
                    } else {
                        basePath = '/';
                    }
                    if (!basePath.endsWith('/')) {
                        basePath += '/';
                    }
                    const newURL = basePath + dataset.Code;
                    window.history.replaceState({ view: 'detail', datasetCode: dataset.Code }, '', newURL);
                }
                return;
            }
        }
    }

    // If no dataset found, show listing view
    showListingView(false); // false = don't update URL yet (will be updated by loadStateFromURL)
}

// Handle browser back/forward navigation
function handlePopState(event) {
    // Check if there's a dataset code in the current path
    const path = window.location.pathname;
    const pathParts = path.split('/').filter(part => part && part !== 'index.html' && part !== '');

    if (pathParts.length > 0) {
        const datasetCode = pathParts[pathParts.length - 1];

        // Check if it's a valid dataset code (not a file extension and not a known file)
        const knownFiles = ['dashboard.html', 'styles.css', 'script.js'];
        if (datasetCode && !datasetCode.includes('.') && !knownFiles.includes(datasetCode)) {
            const dataset = datasets.find(d => d.Code === datasetCode);
            if (dataset) {
                showDatasetDetail(dataset, false); // false = don't update URL
                return;
            }
        }
    }

    // Otherwise show listing view and load form state from URL
    showListingView(false); // false = don't update URL
    loadStateFromURL();
    renderDatasets();
}

// Add some CSS for error and no-results states
const additionalStyles = `
    .no-results, .error-message {
        grid-column: 1 / -1;
        text-align: center;
        padding: 3rem;
        color: #666;
    }
    
    .no-results i, .error-message i {
        font-size: 3rem;
        margin-bottom: 1rem;
        color: #ccc;
    }
    
    .no-results h3, .error-message h3 {
        margin-bottom: 1rem;
        color: #2c3e50;
    }
    
    .publication-abstract {
        margin-top: 0.5rem;
        font-size: 0.9rem;
        color: #666;
        font-style: italic;
    }
`;

// Add the additional styles to the page
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);

// Generate dynamic insights based on actual data
function generateDynamicInsights() {
    if (!datasets || datasets.length === 0) return;

    const insights = analyzeData();
    updateInsightsSection(insights);
}

// Analyze the dataset to generate insights
function analyzeData() {
    const totalDatasets = datasets.length;

    // Domain analysis
    const domainCounts = {};
    const taskCounts = {};
    const granularityCounts = {};
    const languageCounts = {};
    const stageCounts = {};
    const licenseCounts = {};
    const yearCounts = {};
    const sizes = [];

    datasets.forEach(dataset => {
        // Count domains
        if (dataset.Domain && dataset.Domain.trim()) {
            domainCounts[dataset.Domain] = (domainCounts[dataset.Domain] || 0) + 1;
        }

        // Count tasks
        if (dataset.Task && dataset.Task.trim()) {
            taskCounts[dataset.Task] = (taskCounts[dataset.Task] || 0) + 1;
        }

        // Count granularity
        if (dataset.Granularity && dataset.Granularity.trim()) {
            granularityCounts[dataset.Granularity] = (granularityCounts[dataset.Granularity] || 0) + 1;
        }

        // Count languages
        if (dataset.Languages && dataset.Languages.trim()) {
            const languages = dataset.Languages.split(',').map(lang => lang.trim());
            languages.forEach(lang => {
                languageCounts[lang] = (languageCounts[lang] || 0) + 1;
            });
        }

        // Count RE stages
        if (dataset['RE stage'] && dataset['RE stage'].trim()) {
            stageCounts[dataset['RE stage']] = (stageCounts[dataset['RE stage']] || 0) + 1;
        }

        // Count licenses
        if (dataset.License && dataset.License.trim()) {
            licenseCounts[dataset.License] = (licenseCounts[dataset.License] || 0) + 1;
        }

        // Count years
        if (dataset.Year && dataset.Year.trim()) {
            yearCounts[dataset.Year] = (yearCounts[dataset.Year] || 0) + 1;
        }

        // Collect sizes
        if (dataset.Size && dataset.Size.trim() && !isNaN(parseInt(dataset.Size))) {
            sizes.push(parseInt(dataset.Size));
        }
    });

    // Get top domains
    const topDomains = Object.entries(domainCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([domain, count]) => ({ domain, count }));

    // Get top tasks
    const topTasks = Object.entries(taskCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([task, count]) => ({ task, count }));

    // Get top granularity levels
    const topGranularity = Object.entries(granularityCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 2)
        .map(([granularity, count]) => ({ granularity, count }));

    // Get top RE stages
    const topStages = Object.entries(stageCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 2)
        .map(([stage, count]) => ({ stage, count }));

    // Calculate language statistics
    const englishCount = languageCounts['en'] || 0;
    const englishPercentage = Math.round((englishCount / totalDatasets) * 100);
    const nonEnglishLanguages = Object.keys(languageCounts).filter(lang => lang !== 'en');

    // Calculate open license percentage
    const openLicenses = ['Creative Commons Attribution Share Alike 4.0 International',
        'GNU General Public License v3.0', 'Apache 2.0', 'MIT'];
    const openLicenseCount = Object.entries(licenseCounts)
        .filter(([license]) => openLicenses.some(open => license.includes(open)))
        .reduce((sum, [, count]) => sum + count, 0);
    const openPercentage = Math.round((openLicenseCount / totalDatasets) * 100);

    // Calculate temporal trends
    const currentYear = new Date().getFullYear();
    const recentYears = Object.keys(yearCounts)
        .filter(year => parseInt(year) >= currentYear - 3)
        .reduce((sum, year) => sum + yearCounts[year], 0);
    const recentPercentage = Math.round((recentYears / totalDatasets) * 100);

    // Calculate size statistics
    const minSize = sizes.length > 0 ? Math.min(...sizes) : 0;
    const maxSize = sizes.length > 0 ? Math.max(...sizes) : 0;

    return {
        totalDatasets,
        domainCount: Object.keys(domainCounts).length,
        topDomains,
        topTasks,
        topGranularity,
        topStages,
        englishPercentage,
        nonEnglishLanguages,
        openPercentage,
        recentPercentage,
        minSize,
        maxSize,
        taskCounts,
        granularityCounts
    };
}

// Update the insights section with dynamic data
function updateInsightsSection(insights) {
    // Domain Coverage
    const domainText = insights.domainCount > 1 ? `${insights.domainCount} domains` : 'multiple domains';
    const topDomainText = insights.topDomains.length > 0
        ? insights.topDomains.slice(0, 2).map(d => d.domain).join(' and ')
        : 'various domains';

    updateInsightElement('insight-domains', domainText);
    updateInsightElement('top-domain', topDomainText);

    // Task Diversity
    const topTask = insights.topTasks[0];
    const taskText = topTask ? topTask.task : 'various tasks';
    const taskPercentage = topTask ? Math.round((topTask.count / insights.totalDatasets) * 100) : 0;

    updateInsightElement('insight-tasks', taskText);
    updateInsightElement('classification-percentage', `${taskPercentage}%`);

    // Data Granularity
    const granularityText = Object.keys(insights.granularityCounts).length > 1
        ? 'multiple granularity levels'
        : 'various granularity levels';
    const topGranularityText = insights.topGranularity.length > 0
        ? insights.topGranularity[0].granularity.toLowerCase()
        : 'document-level';
    const secondGranularityText = insights.topGranularity.length > 1
        ? insights.topGranularity[1].granularity.toLowerCase()
        : 'sentence-level';

    updateInsightElement('insight-granularity', granularityText);
    updateInsightElement('top-granularity', topGranularityText);
    updateInsightElement('second-granularity', secondGranularityText);

    // Language Support
    const englishText = insights.englishPercentage > 50 ? 'English dominates' : 'English is prominent';
    const multilingualText = insights.nonEnglishLanguages.length > 0
        ? 'multilingual datasets'
        : 'other languages';

    updateInsightElement('insight-english', englishText);
    updateInsightElement('english-percentage', `${insights.englishPercentage}%`);
    updateInsightElement('insight-multilingual', multilingualText);

    // Size Distribution
    const minSizeText = insights.minSize > 0 ? `under ${Math.ceil(insights.minSize / 100) * 100} items` : 'small datasets';
    const maxSizeText = insights.maxSize > 0 ? `over ${Math.floor(insights.maxSize / 1000) * 1000} items` : 'large collections';

    updateInsightElement('min-size', minSizeText);
    updateInsightElement('max-size', maxSizeText);

    // Temporal Trends
    const trendText = insights.recentPercentage > 50 ? 'increasing activity' : 'steady growth';

    updateInsightElement('insight-trend', trendText);
    updateInsightElement('recent-datasets', `${insights.recentPercentage}%`);

    // RE Stage Coverage
    const stageText = Object.keys(insights.topStages).length > 1 ? 'all major RE stages' : 'various RE stages';
    const topStageText = insights.topStages.length > 0
        ? insights.topStages[0].stage.toLowerCase()
        : 'analysis and verification';

    updateInsightElement('insight-stages', stageText);
    updateInsightElement('top-stage', topStageText);

    // Openness
    updateInsightElement('open-percentage', `${insights.openPercentage}%`);
}

// Helper function to update insight elements
function updateInsightElement(id, text) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = text;
    }
}
