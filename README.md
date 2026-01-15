# 📊 LLM4RE-Datasets

A comprehensive replication package for browsing and exploring datasets used in Large Language Models for Requirements Engineering research.

## 📋 Overview

This project provides a systematic collection and web-based interface for browsing datasets employed in Large Language Models for Requirements Engineering (LLM4RE) research. The replication package includes the complete methodology for dataset collection and characterization, enabling researchers to reproduce and extend the findings.

## 🏗️ Project Structure

### 📁 Root Directory

- **`index.html`** - Main entry point for the web application
- **`dashboard.html`** - Interactive analytics dashboard with advanced filtering capabilities
- **`script.js`** - JavaScript functionality for dataset browsing and filtering
- **`styles.css`** - Cascading Style Sheets for web application styling
- **`LICENSE`** - Project licensing information

### 📚 Literature Review (`literature-review/`)

Contains the systematic literature review artifacts:

- **`publications.xlsx`** - Comprehensive database of reviewed publications
- **`datasets.csv`** - Extracted dataset information from literature review
- **`ORKG comparative.csv`** - Comparative analysis with Open Research Knowledge Graph

### 💾 Data (`data/`)

Processed and curated dataset information:

- **`datasets - datasets.csv`** - Main dataset catalog with comprehensive metadata including:
  - Dataset identification codes and names
  - Descriptions and references
  - Temporal information (publication years)
  - Licensing and artifact type classifications
  - Requirements Engineering stage and task categorizations
  - Domain-specific classifications
  - Size metrics and language specifications
  - Label information and publication mappings

### 📈 Figures (`figures/`)

Generated visualizations and analytical charts:

- **`dataset_distribution_stacked.png`** - Stacked distribution of datasets across categories
- **`dataset_distribution_stacked_high_res.png`** - High-resolution version of distribution chart
- **`re_stage_task_bubble.png`** - Bubble chart mapping RE stages to tasks
- **`year_dataset_line.png`** - Temporal analysis of dataset publication trends

### 🔧 Scripts (`script/`)

Analysis and visualization generation tools:

- **`plot.py`** - Python script for generating statistical visualizations and analytical charts

## ✨ Features

- 🔍 **Interactive Dataset Browser** - Comprehensive search and filtering capabilities
- 📊 **Analytics Dashboard** - Dynamic visualizations and statistical analysis
- 🏷️ **Advanced Filtering** - Multi-dimensional filtering by license, artifact type, granularity, RE stage, task, domain, language, and year
- 📈 **Data Visualization** - Statistical charts and trend analysis
- 🔗 **Reference Integration** - Direct links to original publications and dataset sources

## 🌐 Public Access

A publicly accessible version of this dataset collection is available at: **[https://nlp4se.github.io/LLM4RE-Datasets/](https://nlp4se.github.io/LLM4RE-Datasets/)**

## 🛠️ Development

**AI-Assisted Development**: This replication package was developed with the assistance of AI tools, specifically utilizing Claude (Anthropic) for code generation and implementation support. The methodology and data collection processes remain fully transparent and reproducible.

## 📄 License

This project is licensed under the terms specified in the `LICENSE` file. Please refer to the license file for detailed usage permissions and restrictions.
