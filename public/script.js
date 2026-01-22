// DOM Elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const browseBtn = document.getElementById('browseBtn');
const filePreview = document.getElementById('filePreview');
const previewImage = document.getElementById('previewImage');
const fileName = document.getElementById('fileName');
const removeFile = document.getElementById('removeFile');
const extractBtn = document.getElementById('extractBtn');
const resultsSection = document.getElementById('resultsSection');
const studentsGrid = document.getElementById('studentsGrid');
const jsonOutput = document.getElementById('jsonOutput');
const copyBtn = document.getElementById('copyBtn');
const downloadBtn = document.getElementById('downloadBtn');
const toast = document.getElementById('toast');

let selectedFile = null;
let extractedData = null;

// Event Listeners
browseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
});

uploadArea.addEventListener('click', () => fileInput.click());

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length) {
        handleFile(files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
        handleFile(e.target.files[0]);
    }
});

removeFile.addEventListener('click', () => {
    clearFile();
});

extractBtn.addEventListener('click', () => {
    extractData();
});

copyBtn.addEventListener('click', () => {
    copyToClipboard();
});

downloadBtn.addEventListener('click', () => {
    downloadJSON();
});

// Functions
function handleFile(file) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

    if (!allowedTypes.includes(file.type)) {
        showToast('Invalid file type. Please upload an image or PDF.', 'error');
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        showToast('File too large. Maximum size is 10MB.', 'error');
        return;
    }

    selectedFile = file;
    fileName.textContent = file.name;

    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImage.src = e.target.result;
        };
        reader.readAsDataURL(file);
    } else {
        previewImage.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="%236366f1" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
    }

    uploadArea.style.display = 'none';
    filePreview.style.display = 'flex';
    extractBtn.disabled = false;
}

function clearFile() {
    selectedFile = null;
    fileInput.value = '';
    uploadArea.style.display = 'block';
    filePreview.style.display = 'none';
    extractBtn.disabled = true;
}

async function extractData() {
    if (!selectedFile) return;

    const btnText = extractBtn.querySelector('.btn-text');
    const btnLoader = extractBtn.querySelector('.btn-loader');

    // Show loading
    btnText.style.display = 'none';
    btnLoader.style.display = 'flex';
    extractBtn.disabled = true;

    try {
        const formData = new FormData();
        formData.append('marksheet', selectedFile);

        const response = await fetch('/api/extract', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'Extraction failed');
        }

        extractedData = result.data;
        displayResults(extractedData);
        showToast('Data extracted successfully!', 'success');

    } catch (error) {
        console.error('Error:', error);
        showToast(error.message || 'Failed to extract data', 'error');
    } finally {
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
        extractBtn.disabled = false;
    }
}

function displayResults(data) {
    resultsSection.style.display = 'block';
    studentsGrid.innerHTML = '';

    // Handle different response formats
    const students = data.students || data.data?.students || (Array.isArray(data) ? data : [data]);

    if (!students || students.length === 0) {
        studentsGrid.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 2rem;">No student data found</p>';
    } else {
        students.forEach((student, index) => {
            const card = createStudentCard(student, index);
            studentsGrid.appendChild(card);
        });
    }

    jsonOutput.textContent = JSON.stringify(data, null, 2);

    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function createStudentCard(student, index) {
    const card = document.createElement('div');
    card.className = 'student-card';

    const name = student.name || `Student ${index + 1}`;
    const rollNo = student.roll_no || student.rollNo || student.id || 'N/A';
    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

    let marksHTML = '';
    const marks = student.marks || student.subjects || {};

    if (typeof marks === 'object') {
        for (const [subject, value] of Object.entries(marks)) {
            const numValue = parseInt(value) || 0;
            let colorClass = 'medium';
            if (numValue >= 75) colorClass = 'high';
            else if (numValue < 40) colorClass = 'low';

            marksHTML += `
                <div class="mark-row">
                    <span class="mark-subject">${subject}</span>
                    <span class="mark-value ${colorClass}">${value}</span>
                </div>
            `;
        }
    }

    card.innerHTML = `
        <div class="student-header">
            <div class="student-avatar">${initials}</div>
            <div>
                <div class="student-name">${name}</div>
                <div class="student-id">Roll No: ${rollNo}</div>
            </div>
        </div>
        <div class="marks-table">
            ${marksHTML || '<p style="color: var(--text-muted); font-size: 0.875rem;">No marks data</p>'}
        </div>
    `;

    return card;
}

function copyToClipboard() {
    if (!extractedData) return;

    navigator.clipboard.writeText(JSON.stringify(extractedData, null, 2))
        .then(() => showToast('Copied to clipboard!', 'success'))
        .catch(() => showToast('Failed to copy', 'error'));
}

function downloadJSON() {
    if (!extractedData) return;

    const blob = new Blob([JSON.stringify(extractedData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'marksheet-data.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Download started!', 'success');
}

function showToast(message, type = 'info') {
    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
