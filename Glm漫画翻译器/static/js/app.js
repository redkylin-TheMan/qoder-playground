/**
 * GLM Manga Translator - Frontend Logic
 */
(function () {
    "use strict";

    console.log("[App] JS loaded");

    // ========== DOM Elements ==========
    // Single upload
    var dropZone = document.getElementById("drop-zone");
    var fileInput = document.getElementById("file-input");
    var previewContainer = document.getElementById("preview-container");
    var imagePreview = document.getElementById("image-preview");
    var clearBtn = document.getElementById("clear-btn");
    var translateBtn = document.getElementById("translate-btn");

    // Batch upload
    var batchDropZone = document.getElementById("batch-drop-zone");
    var batchFileInput = document.getElementById("batch-file-input");
    var batchFileList = document.getElementById("batch-file-list");
    var batchCount = document.getElementById("batch-count");
    var batchNames = document.getElementById("batch-names");
    var batchClearBtn = document.getElementById("batch-clear-btn");
    var batchTranslateBtn = document.getElementById("batch-translate-btn");

    // Folder
    var folderPathInput = document.getElementById("folder-path-input");
    var folderTranslateBtn = document.getElementById("folder-translate-btn");

    // Common
    var sourceLang = document.getElementById("source-lang");
    var targetLang = document.getElementById("target-lang");
    var progressContainer = document.getElementById("progress-container");
    var progressText = document.getElementById("progress-text");
    var progressBar = document.getElementById("progress-bar");

    // Results
    var emptyState = document.getElementById("empty-state");
    var resultArea = document.getElementById("result-area");
    var langBadge = document.getElementById("lang-badge");
    var segmentsBody = document.getElementById("segments-body");
    var translatedText = document.getElementById("translated-text");
    var rawText = document.getElementById("raw-text");
    var saveBtn = document.getElementById("save-btn");
    var downloadBtn = document.getElementById("download-btn");
    var saveToast = document.getElementById("save-toast");

    var batchResultArea = document.getElementById("batch-result-area");
    var batchResultsBody = document.getElementById("batch-results-body");
    var batchSummary = document.getElementById("batch-summary");

    var currentFile = null;
    var batchFiles = [];
    var lastResult = null;
    var batchResults = []; // store batch results for detail view

    // ========== Prevent browser default drag ==========
    document.addEventListener("dragover", function (e) { e.preventDefault(); });
    document.addEventListener("drop", function (e) { e.preventDefault(); });

    // ========== SINGLE UPLOAD ==========

    fileInput.addEventListener("change", function (e) {
        console.log("[Single] File input changed");
        if (e.target.files.length > 0) {
            handleSingleFile(e.target.files[0]);
        }
    });

    dropZone.addEventListener("dragover", function (e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add("dragover");
    });
    dropZone.addEventListener("dragleave", function (e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove("dragover");
    });
    dropZone.addEventListener("drop", function (e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove("dragover");
        if (e.dataTransfer.files.length > 0) {
            handleSingleFile(e.dataTransfer.files[0]);
        }
    });

    clearBtn.addEventListener("click", function () {
        console.log("[Single] Cleared");
        currentFile = null;
        fileInput.value = "";
        previewContainer.classList.add("d-none");
        dropZone.classList.remove("d-none");
        translateBtn.disabled = true;
    });

    function handleSingleFile(file) {
        var allowed = ["image/png", "image/jpg", "image/jpeg", "image/bmp"];
        if (allowed.indexOf(file.type) === -1) {
            alert("Unsupported format. Use PNG/JPG/JPEG/BMP");
            return;
        }
        if (file.size > 8 * 1024 * 1024) {
            alert("File too large (max 8MB)");
            return;
        }
        currentFile = file;
        translateBtn.disabled = false;
        console.log("[Single] File accepted:", file.name);

        var reader = new FileReader();
        reader.onload = function (e) {
            imagePreview.src = e.target.result;
            previewContainer.classList.remove("d-none");
            dropZone.classList.add("d-none");
            console.log("[Single] Preview rendered");
        };
        reader.readAsDataURL(file);
    }

    translateBtn.addEventListener("click", async function () {
        if (!currentFile) return;
        console.log("[Single] Starting translation...");
        showProgress(10, "Uploading image...");

        try {
            var formData = new FormData();
            formData.append("image", currentFile);
            formData.append("source_lang", sourceLang.value);
            formData.append("target_lang", targetLang.value);

            showProgress(30, "OCR recognizing...");
            var response = await fetch("/api/translate", { method: "POST", body: formData });
            console.log("[Single] Response status:", response.status);

            showProgress(80, "Translating...");
            var result = await response.json();
            console.log("[Single] Result:", result.success ? "SUCCESS" : "FAILED", result);

            if (!result.success) {
                alert(result.error || "Translation failed");
                hideProgress();
                translateBtn.disabled = false;
                return;
            }

            showProgress(100, "Done!");
            lastResult = result.data;
            await sleep(300);
            renderSingleResult(result.data);
        } catch (err) {
            console.error("[Single] Error:", err);
            alert("Request failed: " + err.message);
        } finally {
            hideProgress();
            translateBtn.disabled = !currentFile;
        }
    });

    // ========== BATCH UPLOAD ==========

    batchFileInput.addEventListener("change", function (e) {
        if (e.target.files.length > 0) {
            handleBatchFiles(e.target.files);
        }
    });

    batchDropZone.addEventListener("dragover", function (e) {
        e.preventDefault();
        e.stopPropagation();
        batchDropZone.classList.add("dragover");
    });
    batchDropZone.addEventListener("dragleave", function (e) {
        e.preventDefault();
        e.stopPropagation();
        batchDropZone.classList.remove("dragover");
    });
    batchDropZone.addEventListener("drop", function (e) {
        e.preventDefault();
        e.stopPropagation();
        batchDropZone.classList.remove("dragover");
        if (e.dataTransfer.files.length > 0) {
            handleBatchFiles(e.dataTransfer.files);
        }
    });

    batchClearBtn.addEventListener("click", function () {
        console.log("[Batch] Cleared");
        batchFiles = [];
        batchFileInput.value = "";
        batchFileList.classList.add("d-none");
        batchTranslateBtn.disabled = true;
    });

    function handleBatchFiles(files) {
        var allowed = ["image/png", "image/jpg", "image/jpeg", "image/bmp"];
        batchFiles = [];
        batchNames.innerHTML = "";

        for (var i = 0; i < files.length; i++) {
            if (allowed.indexOf(files[i].type) !== -1) {
                batchFiles.push(files[i]);
                var li = document.createElement("li");
                li.className = "text-muted";
                li.textContent = files[i].name;
                batchNames.appendChild(li);
            }
        }

        if (batchFiles.length > 0) {
            batchFileList.classList.remove("d-none");
            batchCount.textContent = batchFiles.length + " images selected";
            batchTranslateBtn.disabled = false;
            console.log("[Batch] " + batchFiles.length + " files accepted");
        } else {
            batchFileList.classList.add("d-none");
            batchTranslateBtn.disabled = true;
        }
    }

    batchTranslateBtn.addEventListener("click", async function () {
        if (batchFiles.length === 0) return;
        console.log("[Batch] Starting batch translation, count:", batchFiles.length);
        showProgress(5, "Uploading " + batchFiles.length + " images...");

        try {
            var formData = new FormData();
            for (var i = 0; i < batchFiles.length; i++) {
                formData.append("images", batchFiles[i]);
            }
            formData.append("source_lang", sourceLang.value);
            formData.append("target_lang", targetLang.value);

            showProgress(20, "Processing batch OCR + Translation...");
            var response = await fetch("/api/batch-translate", { method: "POST", body: formData });
            var result = await response.json();
            console.log("[Batch] Result:", result);

            showProgress(100, "Done!");
            await sleep(300);
            renderBatchResults(result.results || []);
        } catch (err) {
            console.error("[Batch] Error:", err);
            alert("Batch failed: " + err.message);
        } finally {
            hideProgress();
        }
    });

    // ========== FOLDER TRANSLATE ==========

    folderTranslateBtn.addEventListener("click", async function () {
        var folderPath = folderPathInput.value.trim();
        if (!folderPath) {
            alert("Please enter a folder path");
            return;
        }
        console.log("[Folder] Starting folder translation:", folderPath);
        showProgress(5, "Scanning folder...");

        try {
            var response = await fetch("/api/folder-translate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    folder_path: folderPath,
                    source_lang: sourceLang.value,
                    target_lang: targetLang.value,
                }),
            });

            showProgress(30, "Processing images...");
            var result = await response.json();
            console.log("[Folder] Result:", result);

            if (!result.success) {
                alert(result.error || "Folder translation failed");
                hideProgress();
                return;
            }

            showProgress(100, "Done!");
            await sleep(300);
            renderBatchResults(result.results || [], result.output_dir, result.success_count, result.total);
        } catch (err) {
            console.error("[Folder] Error:", err);
            alert("Folder translation failed: " + err.message);
        } finally {
            hideProgress();
        }
    });

    // ========== RENDER RESULTS ==========

    function renderSingleResult(data) {
        emptyState.classList.add("d-none");
        resultArea.classList.remove("d-none");
        batchResultArea.classList.add("d-none");
        saveToast.classList.add("d-none");

        langBadge.textContent = data.source_lang + " -> " + data.target_lang;

        segmentsBody.innerHTML = "";
        var segments = data.ocr_segments || [];
        for (var i = 0; i < segments.length; i++) {
            var seg = segments[i];
            var loc = seg.location || {};
            var tr = document.createElement("tr");
            tr.innerHTML =
                '<td class="text-muted">' + (i + 1) + "</td>" +
                "<td>" + escapeHtml(seg.text) + "</td>" +
                '<td class="small text-muted">L' + (loc.left || "?") +
                " T" + (loc.top || "?") +
                " W" + (loc.width || "?") +
                " H" + (loc.height || "?") + "</td>";
            segmentsBody.appendChild(tr);
        }

        translatedText.textContent = data.translated_text;
        rawText.textContent = data.ocr_raw_text;
        console.log("[Render] Single result done, segments:", segments.length);
    }

    function renderBatchResults(results, outputDir, successCount, totalCount) {
        emptyState.classList.add("d-none");
        resultArea.classList.add("d-none");
        batchResultArea.classList.remove("d-none");
        batchResults = results;

        batchResultsBody.innerHTML = "";
        var okCount = 0;

        for (var i = 0; i < results.length; i++) {
            var r = results[i];
            var tr = document.createElement("tr");
            var statusHtml = r.success
                ? '<span class="badge bg-success">OK</span>'
                : '<span class="badge bg-danger">FAIL</span>';
            var actionHtml = "";

            if (r.success) {
                okCount++;
                actionHtml = '<button class="btn btn-sm btn-outline-primary batch-detail-btn" data-index="' + i + '">View</button>';
                if (r.output) {
                    actionHtml += ' <span class="small text-muted">Saved</span>';
                }
            } else {
                actionHtml = '<span class="small text-danger">' + escapeHtml(r.error || "") + "</span>";
            }

            tr.innerHTML =
                "<td>" + (i + 1) + "</td>" +
                "<td>" + escapeHtml(r.filename) + "</td>" +
                "<td>" + statusHtml + "</td>" +
                "<td>" + actionHtml + "</td>";
            batchResultsBody.appendChild(tr);
        }

        // Summary
        var summaryText = okCount + "/" + results.length + " succeeded";
        if (outputDir) {
            summaryText += " | Output: " + outputDir;
        }
        batchSummary.textContent = summaryText;
        batchSummary.classList.remove("d-none");

        // Add click handlers for detail buttons
        var detailBtns = document.querySelectorAll(".batch-detail-btn");
        for (var j = 0; j < detailBtns.length; j++) {
            detailBtns[j].addEventListener("click", function () {
                var idx = parseInt(this.getAttribute("data-index"));
                var item = batchResults[idx];
                if (item && item.data) {
                    renderSingleResult(item.data);
                    lastResult = item.data;
                    // Store filename for save
                    currentFile = { name: item.filename };
                }
            });
        }

        console.log("[Render] Batch results done:", okCount + "/" + results.length);
    }

    // ========== SAVE & DOWNLOAD ==========

    saveBtn.addEventListener("click", async function () {
        if (!lastResult) return;
        console.log("[Save] Saving...");
        saveBtn.disabled = true;
        saveBtn.textContent = "Saving...";

        try {
            var fname = (currentFile && currentFile.name) ? currentFile.name.replace(/\.[^.]+$/, "") : "translation";
            var response = await fetch("/api/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    filename: fname,
                    ocr_raw_text: lastResult.ocr_raw_text,
                    translated_text: lastResult.translated_text,
                    source_lang: lastResult.source_lang,
                    target_lang: lastResult.target_lang,
                    segments: lastResult.ocr_segments,
                }),
            });
            var result = await response.json();
            console.log("[Save] Result:", result);
            if (result.success) {
                saveToast.textContent = "Saved to: " + result.filepath;
                saveToast.classList.remove("d-none");
            } else {
                alert("Save failed: " + (result.error || "unknown error"));
            }
        } catch (err) {
            console.error("[Save] Error:", err);
            alert("Save failed: " + err.message);
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = "Save Local";
        }
    });

    downloadBtn.addEventListener("click", function () {
        if (!lastResult) return;
        console.log("[Download] Generating...");

        var lines = [
            "=== Manga Translation ===",
            "Source: " + lastResult.source_lang,
            "Target: " + lastResult.target_lang,
            "",
            "=== Original ===",
            lastResult.ocr_raw_text,
            "",
            "=== Translation ===",
            lastResult.translated_text,
            "",
            "=== Segments ===",
        ];

        var segments = lastResult.ocr_segments || [];
        for (var i = 0; i < segments.length; i++) {
            var seg = segments[i];
            var loc = seg.location || {};
            lines.push(
                "[" + (i + 1) + "] L:" + (loc.left || "?") + " T:" + (loc.top || "?") +
                " W:" + (loc.width || "?") + " H:" + (loc.height || "?") +
                " | " + seg.text
            );
        }

        var blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        var fname = (currentFile && currentFile.name) ? currentFile.name.replace(/\.[^.]+$/, "") : "translation";
        a.download = fname + "_translated.txt";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log("[Download] Done");
    });

    // ========== UTILS ==========

    function showProgress(percent, text) {
        progressContainer.classList.remove("d-none");
        progressBar.style.width = percent + "%";
        progressText.textContent = text;
    }

    function hideProgress() {
        progressContainer.classList.add("d-none");
        progressBar.style.width = "0%";
    }

    function escapeHtml(text) {
        var div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }

    function sleep(ms) {
        return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }

    console.log("[App] Ready");
})();
