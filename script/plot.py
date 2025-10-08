import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns
from collections import Counter
import re

# Set modern style
plt.style.use('default')
sns.set_style("whitegrid")
sns.set_palette("husl")

# Configuration parameters
PROPERTIES = [
    'License', 'Artifact type', 'Granularity', 'RE stage', 
    'Task', 'Domain',  'Size', 'Languages'  # Added 'Size'
]

# SPDX license mapping for cleaner display
SPDX_MAPPING = {
    'Creative Commons Attribution Share Alike 4.0 International': 'CC-BY-SA-4.0',
    'Creative Commons Attribution 4.0 International': 'CC-BY-4.0',
    'GNU General Public License v3.0': 'GPL-3.0',
    'Apache 2.0': 'Apache-2.0',
    'MIT License': 'MIT',
    'SNT Non Commercial LICENSE V.2': 'SNT-NC-2.0',
    'None': 'None'
}

# Color scheme - using a more diverse palette for better distinction
COLORS = {
    'undefined': '#808080',  # Grey for undefined/empty values
    'others': '#ff7f0e',     # Orange for "Others"
    'palette': ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', 
                '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
                '#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5']
}

# Add language mapping after the SPDX_MAPPING
LANGUAGE_MAPPING = {
    'en': 'English',
    'chn': 'Chinese',
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
    'multiple': 'Multiple'
}

def capitalize_label(label):
    """Capitalize only the first letter if it's lowercase, preserve the rest"""
    if not label or label in ['Undefined', 'Others']:
        return label
    
    # Only capitalize the first letter if it's lowercase, leave the rest unchanged
    if label[0].islower():
        return label[0].upper() + label[1:]
    else:
        return label  # First letter is already uppercase, return as-is

def map_language_codes(language_value):
    """Convert ISO language codes to full language names"""
    if pd.isna(language_value) or language_value == '' or language_value == '-':
        return 'Undefined'
    
    language_str = str(language_value).lower().strip()
    
    # Check for exact matches only
    if language_str in LANGUAGE_MAPPING:
        return LANGUAGE_MAPPING[language_str]
    
    # If no exact match found, return 'Undefined'
    return 'Undefined'

# Add size mapping function
def map_size_categories(size_value):
    """Convert size values to categorical ranges"""
    if pd.isna(size_value) or size_value == '' or size_value == '-':
        return 'Undefined'
    
    try:
        # Convert to numeric, handling different formats
        size_str = str(size_value).strip().lower()
        
        # Remove common suffixes and convert to number
        if 'k' in size_str:
            size_num = float(size_str.replace('k', '').replace(',', '')) * 1000
        elif 'm' in size_str:
            size_num = float(size_str.replace('m', '').replace(',', '')) * 1000000
        else:
            # Try to convert directly to number
            size_num = float(size_str.replace(',', ''))
        
        # Categorize based on size
        if size_num < 1000:
            return '<1K'
        elif size_num < 10000:
            return '1K-10K'
        elif size_num < 100000:
            return '10K-100K'
        else:
            return '>100K'
            
    except (ValueError, TypeError):
        # If conversion fails, return 'Undefined'
        return 'Undefined'

def load_and_clean_data(filepath):
    """Load and clean the dataset"""
    df = pd.read_csv(filepath)
    df.columns = df.columns.str.strip()
    return df

def map_license_to_spdx(license_value):
    """Convert license names to SPDX codes"""
    if pd.isna(license_value) or license_value == '' or license_value == '-':
        return 'None'
    
    for full_name, spdx in SPDX_MAPPING.items():
        if full_name in str(license_value):
            return spdx
    
    if len(str(license_value)) > 20:
        return str(license_value)[:17] + '...'
    
    return str(license_value)

def aggregate_low_frequency_values(values, threshold=1):  # Changed from 3 to 2
    """Aggregate values with frequency below threshold into 'Others'"""
    counter = Counter(values)
    high_freq = {k: v for k, v in counter.items() if v >= threshold}
    low_freq = {k: v for k, v in counter.items() if v < threshold}
    
    result = high_freq.copy()
    if sum(low_freq.values()) > 0:
        result['Others'] = sum(low_freq.values())
    
    return result

def create_stacked_distribution_plot(df, properties, output_file='dataset_distribution_stacked.png'):
    """Create a single stacked horizontal bar chart"""
    
    # Set up the figure with reduced height
    fig, ax = plt.subplots(figsize=(12, 7))  # Reduced from 8 to 6
    
    # Prepare data for each property
    property_data = {}
    
    for prop in properties:
        values = df[prop].fillna('Undefined').astype(str)
        
        # Special handling for License column
        if prop == 'License':
            values = values.apply(map_license_to_spdx)
        # Special handling for Languages column
        elif prop == 'Languages':
            values = values.apply(map_language_codes)
        # Special handling for Size column
        elif prop == 'Size':
            values = values.apply(map_size_categories)
        
        # Replace empty strings and dashes with 'Undefined'
        values = values.replace(['', '-', 'nan'], 'Undefined')
        
        # Capitalize all labels
        values = values.apply(capitalize_label)
        
        # Aggregate low frequency values
        value_counts = aggregate_low_frequency_values(values, threshold=1)  # Changed from 2 to 3
        
        # Sort by frequency (descending), but put 'Undefined' last
        sorted_items = sorted(value_counts.items(), key=lambda x: x[1], reverse=True)
        # Move 'Undefined' to the end if it exists
        undefined_item = None
        other_items = []
        for item in sorted_items:
            if item[0] == 'Undefined':
                undefined_item = item
            else:
                other_items.append(item)
        
        if undefined_item:
            sorted_items = other_items + [undefined_item]
        
        property_data[prop] = dict(sorted_items)
    
    # Create color mapping based on frequency (heatmap style)
    all_counts = []
    for prop_data in property_data.values():
        all_counts.extend(prop_data.values())
    
    min_count = min(all_counts)
    max_count = max(all_counts)
    
    # Use a better colormap - Blues from light to dark
    import matplotlib.cm as cm
    # Use 'Blues' but modify it to start from light blue instead of white
    colormap = cm.get_cmap('Blues')
    # Create a new colormap that starts from light blue (0.2) instead of white (0.0)
    from matplotlib.colors import ListedColormap
    colors = colormap(np.linspace(0.2, 1.0, 256))  # Start from 0.2 instead of 0.0
    colormap = ListedColormap(colors)
    
    # Create stacked horizontal bars
    y_pos = np.arange(len(properties))
    bar_width = 0.8
    
    # Draw each segment
    for i, prop in enumerate(properties):
        values = property_data[prop]
        
        left = 0
        
        for j, (value, count) in enumerate(values.items()):
            # Calculate color based on frequency
            if value == 'Undefined':
                # Very light grey for undefined, with white border for consistency
                color = '#f0f0f0'  # Very light grey
                edgecolor = 'white'  # Changed from 'none' to 'white'
                linewidth = 1.5  # Changed from 0 to 1.5 (same as other segments)
            else:
                # Normalize count to [0,1] for colormap
                normalized_count = (count - min_count) / (max_count - min_count) if max_count > min_count else 0.5
                color = colormap(normalized_count)
                edgecolor = 'white'
                linewidth = 1.5
            
            # Draw the segment
            ax.barh(i, count, left=left, height=bar_width, 
                   color=color, alpha=0.8, edgecolor=edgecolor, linewidth=linewidth)
            
            # Add label only if frequency is 3 or higher
            if count >= 3:
                # Determine text color based on background brightness
                if value == 'Undefined':
                    text_color = 'black'  # Always black for light grey undefined
                else:
                    # Calculate brightness of the background color
                    if hasattr(color, '__len__') and len(color) == 4:  # RGBA
                        r, g, b, a = color
                    elif hasattr(color, '__len__') and len(color) == 3:  # RGB
                        r, g, b = color
                    else:
                        # For matplotlib color objects, convert to RGB
                        import matplotlib.colors as mcolors
                        rgb = mcolors.to_rgb(color)
                        r, g, b = rgb
                    
                    # Calculate relative luminance (brightness)
                    brightness = 0.299 * r + 0.587 * g + 0.114 * b
                    
                    # Use black text for light backgrounds, white for dark backgrounds
                    text_color = 'black' if brightness > 0.5 else 'white'
                
                # Add label with number below (always centered)
                ax.text(left + count/2, i, f'{value}\n({count})', 
                       ha='center', va='center', fontweight='normal', 
                       fontsize=14, color=text_color)
            
            left += count
    
    # Customize the plot - consistent font sizes
    ax.set_yticks(y_pos)
    ax.set_yticklabels(properties, fontsize=14, fontweight='normal')
    ax.set_xlabel('Number of Datasets', fontsize=14, fontweight='normal')
    
    # Set x-axis tick labels to same font size
    ax.tick_params(axis='x', labelsize=14)
    ax.tick_params(axis='y', labelsize=14)  # This ensures y-axis ticks are also 12pt
    
    # Remove spines
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_visible(False)
    
    # Add grid
    ax.grid(True, axis='x', alpha=0.3, linestyle='--')
    
    # Invert y-axis to show properties in order
    ax.invert_yaxis()
    
    # Set x-axis limits to match actual data range
    max_total = max([sum(prop_data.values()) for prop_data in property_data.values()])
    ax.set_xlim(0, max_total)
    
    # Remove the colorbar completely
    # sm = plt.cm.ScalarMappable(cmap=colormap, norm=plt.Normalize(vmin=min_count, vmax=max_count))
    # sm.set_array([])
    # cbar = plt.colorbar(sm, ax=ax, shrink=0.8)
    # cbar.set_label('Number of Datasets', fontsize=12)  # Keep at 12
    # cbar.ax.tick_params(labelsize=12)  # Add this to make colorbar tick labels consistent
    
    # Adjust layout
    plt.tight_layout()
    
    # Save the plot
    plt.savefig(output_file, dpi=300, bbox_inches='tight', 
                facecolor='white', edgecolor='none')
    
    print(f"Stacked distribution plot saved as {output_file}")
    
    # Show summary statistics
    print("\n" + "="*60)
    print("DATASET DISTRIBUTION SUMMARY")
    print("="*60)
    
    for prop in properties:
        values = df[prop].fillna('Undefined').astype(str)
        if prop == 'License':
            values = values.apply(map_license_to_spdx)
        elif prop == 'Languages':
            values = values.apply(map_language_codes)
        elif prop == 'Size':
            values = values.apply(map_size_categories)
        values = values.replace(['', '-', 'nan'], 'Undefined')
        values = values.apply(capitalize_label)
        
        value_counts = aggregate_low_frequency_values(values, threshold=1)  # Changed from 2 to 3
        total = len(df)
        
        print(f"\n{prop}:")
        print("-" * 30)
        for value, count in sorted(value_counts.items(), key=lambda x: x[1], reverse=True):
            percentage = (count / total) * 100
            print(f"  {value}: {count} ({percentage:.1f}%)")

def main():
    """Main function"""
    # Load data
    df = load_and_clean_data('data/datasets - datasets.csv')
    
    print(f"Loaded {len(df)} datasets")
    print(f"Properties to analyze: {PROPERTIES}")
    
    # Create the stacked plot
    create_stacked_distribution_plot(df, PROPERTIES, 'dataset_distribution_stacked.png')
    
    # Create a high-resolution version for papers
    create_stacked_distribution_plot(df, PROPERTIES, 'dataset_distribution_stacked_high_res.png')

if __name__ == "__main__":
    main()
