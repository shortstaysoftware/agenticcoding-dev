import { marked, Renderer } from "marked";
import matter from "gray-matter";
import { readdir, readFile, writeFile, mkdir } from "fs/promises";
import { join, basename } from "path";

const ARTICLES_DIR = "articles";
const OUTPUT_DIR = "articles";

interface ArticleMeta {
  title: string;
  subtitle?: string;
  date: string;
  author?: string;
  tags?: string[];
  image?: string;
  slug: string;
  readTime: string;
  wordCount: number;
}

interface TocItem {
  id: string;
  text: string;
  level: number;
}

function estimateReadTime(content: string): string {
  const wordsPerMinute = 200;
  const words = content.trim().split(/\s+/).length;
  const minutes = Math.ceil(words / wordsPerMinute);
  return `${minutes} min read`;
}

function countWords(content: string): number {
  return content.trim().split(/\s+/).length;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function generateSlug(filename: string): string {
  return basename(filename, ".md")
    .replace(/^\d+-/, "")
    .toLowerCase();
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Custom renderer to extract TOC and add IDs to headings
function createRenderer(toc: TocItem[]) {
  const renderer = new Renderer();

  renderer.heading = function ({ text, depth }) {
    const id = slugify(text);
    if (depth === 2 || depth === 3) {
      toc.push({ id, text, level: depth });
    }
    return `<h${depth} id="${id}">${text}</h${depth}>`;
  };

  // Add language label and copy button wrapper to code blocks
  renderer.code = function ({ text, lang }) {
    const language = lang || "text";
    const escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `<div class="code-block-wrapper">
      <div class="code-block-header">
        <span class="code-lang">${language}</span>
        <button class="copy-btn" onclick="copyCode(this)">
          <i class="ph ph-copy"></i>
          <span>Copy</span>
        </button>
      </div>
      <pre><code class="language-${language}">${escaped}</code></pre>
    </div>`;
  };

  return renderer;
}

function template(meta: ArticleMeta, content: string, toc: TocItem[]): string {
  const tocHtml = toc
    .map(
      (item) =>
        `<a href="#${item.id}" class="toc-link ${item.level === 3 ? "toc-sub" : ""}">${item.text}</a>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en" class="scroll-smooth">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${meta.title} | AgenticCoding.dev</title>
    <meta name="description" content="${meta.subtitle || ""}">

    <!-- Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">

    <!-- Tailwind -->
    <script src="https://cdn.tailwindcss.com"></script>

    <!-- Icons -->
    <script src="https://unpkg.com/@phosphor-icons/web"></script>

    <!-- Prism.js for syntax highlighting -->
    <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css" rel="stylesheet">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-json.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-bash.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-typescript.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-yaml.min.js"></script>

    <script>
        tailwind.config = {
            theme: {
                extend: {
                    fontFamily: {
                        sans: ['Inter', 'sans-serif'],
                        mono: ['JetBrains Mono', 'monospace'],
                    },
                    colors: {
                        brand: {
                            50: '#f0fdfa',
                            100: '#ccfbf1',
                            400: '#2dd4bf',
                            500: '#14b8a6',
                            600: '#0d9488',
                            900: '#134e4a',
                        },
                        dark: {
                            bg: '#0f172a',
                            card: '#1e293b',
                            border: '#334155',
                        }
                    },
                }
            }
        }
    </script>
    <style>
        body {
            background-color: #0f172a;
            color: #f8fafc;
        }

        /* Scrollbar */
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #0f172a; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #475569; }

        /* Progress bar */
        .progress-bar {
            position: fixed;
            top: 64px;
            left: 0;
            height: 3px;
            background: linear-gradient(90deg, #14b8a6, #3b82f6);
            width: 0%;
            z-index: 100;
            transition: width 0.1s ease-out;
        }

        /* Hero pattern */
        .hero-pattern {
            background-image: radial-gradient(circle at 1px 1px, #334155 1px, transparent 0);
            background-size: 32px 32px;
        }

        /* Title */
        .gradient-title {
            color: #14b8a6;
        }

        /* Drop cap */
        .prose > p:first-of-type::first-letter {
            float: left;
            font-size: 4rem;
            line-height: 1;
            font-weight: 700;
            margin-right: 0.75rem;
            margin-top: 0.25rem;
            background: linear-gradient(135deg, #14b8a6, #3b82f6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        /* Article prose styles */
        .prose { max-width: 65ch; }
        .prose h2 {
            font-size: 1.5rem;
            font-weight: 700;
            margin-top: 3rem;
            margin-bottom: 1rem;
            color: #14b8a6;
            scroll-margin-top: 6rem;
        }
        .prose h3 {
            font-size: 1.25rem;
            font-weight: 600;
            margin-top: 2rem;
            margin-bottom: 0.75rem;
            color: #e2e8f0;
            scroll-margin-top: 6rem;
        }
        .prose p { margin-bottom: 1.5rem; line-height: 1.8; color: #cbd5e1; }
        .prose strong { color: #f8fafc; font-weight: 600; }
        .prose em { color: #94a3b8; }
        .prose a { color: #2dd4bf; text-decoration: underline; text-underline-offset: 3px; }
        .prose a:hover { color: #14b8a6; }
        .prose ul, .prose ol { margin-bottom: 1.5rem; padding-left: 1.5rem; color: #cbd5e1; }
        .prose li { margin-bottom: 0.5rem; line-height: 1.8; }
        .prose ul { list-style-type: disc; }
        .prose ol { list-style-type: decimal; }

        /* Images */
        .prose img {
            border-radius: 0.75rem;
            border: 1px solid #334155;
            margin: 2rem 0;
            box-shadow: 0 0 40px rgba(20, 184, 166, 0.1);
        }

        /* Inline code */
        .prose code:not(pre code) {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.875em;
            background: #1e293b;
            padding: 0.2em 0.4em;
            border-radius: 0.25rem;
            color: #2dd4bf;
            border: 1px solid #334155;
        }

        /* Code block wrapper */
        .code-block-wrapper {
            position: relative;
            margin-bottom: 2rem;
            border-radius: 0.75rem;
            overflow: hidden;
            background: #1e293b;
            border: 1px solid #334155;
            box-shadow: 0 0 40px rgba(20, 184, 166, 0.1);
        }
        .code-block-wrapper:hover {
            box-shadow: 0 0 60px rgba(20, 184, 166, 0.15);
            border-color: #475569;
        }
        .code-block-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.5rem 1rem;
            background: #0f172a;
            border-bottom: 1px solid #334155;
        }
        .code-lang {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.75rem;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .copy-btn {
            display: flex;
            align-items: center;
            gap: 0.375rem;
            padding: 0.375rem 0.75rem;
            font-size: 0.75rem;
            color: #94a3b8;
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 0.375rem;
            cursor: pointer;
            transition: all 0.2s;
        }
        .copy-btn:hover {
            color: #f8fafc;
            border-color: #14b8a6;
            background: #334155;
        }
        .copy-btn.copied {
            color: #14b8a6;
            border-color: #14b8a6;
        }

        /* Override Prism styles */
        .code-block-wrapper pre {
            margin: 0;
            padding: 1.25rem;
            background: transparent !important;
            overflow-x: auto;
        }
        .code-block-wrapper pre code {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.875rem;
            line-height: 1.7;
            background: transparent !important;
        }

        .prose blockquote {
            border-left: 3px solid #14b8a6;
            padding-left: 1.5rem;
            margin: 2rem 0;
            color: #94a3b8;
            font-style: italic;
            background: linear-gradient(90deg, rgba(20, 184, 166, 0.1), transparent);
            padding: 1rem 1.5rem;
            border-radius: 0 0.5rem 0.5rem 0;
        }
        .prose hr {
            border: none;
            border-top: 1px solid #334155;
            margin: 3rem 0;
        }

        /* Table of contents */
        .toc {
            position: sticky;
            top: 6rem;
        }
        .toc-link {
            display: block;
            padding: 0.5rem 0;
            color: #64748b;
            font-size: 0.875rem;
            border-left: 2px solid transparent;
            padding-left: 1rem;
            margin-left: -1rem;
            transition: all 0.2s;
        }
        .toc-link:hover {
            color: #f8fafc;
        }
        .toc-link.active {
            color: #14b8a6;
            border-left-color: #14b8a6;
        }
        .toc-sub {
            padding-left: 2rem;
            font-size: 0.8125rem;
        }

        /* Back to top */
        .back-to-top {
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            width: 3rem;
            height: 3rem;
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #94a3b8;
            cursor: pointer;
            opacity: 0;
            transform: translateY(1rem);
            transition: all 0.3s;
            z-index: 50;
        }
        .back-to-top.visible {
            opacity: 1;
            transform: translateY(0);
        }
        .back-to-top:hover {
            background: #334155;
            color: #14b8a6;
            border-color: #14b8a6;
        }

        /* Lightbox */
        .prose img {
            cursor: zoom-in;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .prose img:hover {
            box-shadow: 0 0 60px rgba(20, 184, 166, 0.2);
        }
        .lightbox-overlay {
            position: fixed;
            inset: 0;
            z-index: 200;
            background: rgba(0, 0, 0, 0.92);
            backdrop-filter: blur(8px);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: zoom-out;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.3s, visibility 0.3s;
        }
        .lightbox-overlay.active {
            opacity: 1;
            visibility: visible;
        }
        .lightbox-overlay img {
            max-width: 92vw;
            max-height: 90vh;
            border-radius: 0.75rem;
            border: 1px solid #334155;
            box-shadow: 0 0 80px rgba(20, 184, 166, 0.15);
            transform: scale(0.95);
            transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .lightbox-overlay.active img {
            transform: scale(1);
        }
        .lightbox-close {
            position: fixed;
            top: 1.5rem;
            right: 1.5rem;
            z-index: 201;
            width: 2.5rem;
            height: 2.5rem;
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #94a3b8;
            cursor: pointer;
            opacity: 0;
            transition: opacity 0.3s, background 0.2s, color 0.2s;
        }
        .lightbox-overlay.active ~ .lightbox-close {
            opacity: 1;
        }
        .lightbox-close:hover {
            background: #334155;
            color: #14b8a6;
            border-color: #14b8a6;
        }

        /* Diagram styles */
        .diagram {
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 0.75rem;
            padding: 2rem;
            margin: 2rem 0;
            overflow-x: auto;
        }
        .diagram svg {
            max-width: 100%;
            height: auto;
        }

        /* Component grid (Skill + Validators + Hook) */
        .component-grid {
            display: grid;
            grid-template-columns: 1fr auto 1fr auto 1fr;
            gap: 0.75rem;
            align-items: stretch;
            margin: 2rem 0;
        }
        @media (max-width: 768px) {
            .component-grid {
                grid-template-columns: 1fr;
            }
            .component-arrow {
                transform: rotate(90deg);
                justify-self: center;
            }
        }
        .component-card {
            background: #1e293b;
            border: 2px solid;
            border-radius: 0.75rem;
            overflow: hidden;
        }
        .component-header {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.75rem 1rem;
            color: #0f172a;
            font-weight: 700;
            font-size: 0.8rem;
            letter-spacing: 0.05em;
        }
        .component-header i {
            font-size: 1.1rem;
        }
        .component-body {
            padding: 1rem;
        }
        .component-body p {
            margin: 0;
            font-size: 0.9rem;
            line-height: 1.6;
            color: #cbd5e1;
        }
        .component-body code {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.75rem;
            background: #0f172a;
            padding: 0.25rem 0.5rem;
            border-radius: 0.25rem;
            color: #64748b;
            display: inline-block;
            margin-bottom: 0.5rem;
        }
        .component-arrow {
            display: flex;
            align-items: center;
            color: #475569;
            font-size: 1.25rem;
        }

        /* Loop visual options */
        .loop-option {
            margin: 2rem 0;
            padding: 1.5rem;
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 0.75rem;
        }
        .loop-option-label {
            font-size: 0.7rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: #a855f7;
            margin-bottom: 1rem;
            padding-bottom: 0.5rem;
            border-bottom: 1px solid #334155;
        }
        .loop-problem { color: #f87171; }
        .loop-success { color: #2dd4bf; }

        /* Option 1: Comparison bars */
        .loop-compare {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
            margin-bottom: 1.25rem;
        }
        .loop-compare-row {
            display: flex;
            align-items: center;
            gap: 1rem;
            padding: 0.75rem 1rem;
            border-radius: 0.5rem;
            background: #0f172a;
        }
        .loop-compare-old { border-left: 3px solid #ef4444; }
        .loop-compare-new { border-left: 3px solid #14b8a6; }
        .loop-compare-label {
            font-weight: 700;
            font-size: 0.8rem;
            min-width: 5rem;
            display: flex;
            align-items: center;
            gap: 0.375rem;
        }
        .loop-compare-old .loop-compare-label { color: #f87171; }
        .loop-compare-new .loop-compare-label { color: #2dd4bf; }
        .loop-compare-steps {
            display: flex;
            align-items: center;
            gap: 0.25rem;
            flex-wrap: wrap;
            font-size: 0.8rem;
            color: #94a3b8;
        }
        .loop-compare-steps span {
            padding: 0.25rem 0.5rem;
            background: #1e293b;
            border-radius: 0.25rem;
        }
        .loop-compare-steps span::after {
            content: ' →';
            color: #475569;
            margin-left: 0.25rem;
        }
        .loop-compare-steps span:last-child::after {
            content: '';
        }

        /* Option 2: Circular loop */
        .loop-circle {
            position: relative;
            width: 220px;
            height: 220px;
            margin: 1rem auto;
        }
        .loop-circle-center {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            color: #14b8a6;
        }
        .loop-circle-center i {
            font-size: 2rem;
            display: block;
        }
        .loop-circle-center span {
            font-size: 0.7rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .loop-circle-item {
            position: absolute;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.25rem;
            background: #0f172a;
            padding: 0.5rem 0.75rem;
            border-radius: 0.5rem;
            border: 1px solid #334155;
            font-size: 0.75rem;
            color: #cbd5e1;
        }
        .loop-circle-item i {
            font-size: 1.25rem;
            color: #14b8a6;
        }
        .loop-circle-1 { top: -10px; left: 50%; transform: translateX(-50%); }
        .loop-circle-2 { top: 50%; right: -20px; transform: translateY(-50%); }
        .loop-circle-3 { bottom: -10px; left: 50%; transform: translateX(-50%); }
        .loop-circle-4 { top: 50%; left: -15px; transform: translateY(-50%); }
        .loop-circle-arrows {
            position: absolute;
            inset: 10px;
            width: calc(100% - 20px);
            height: calc(100% - 20px);
        }

        /* Terminal visualization */
        .loop-terminal {
            background: #0f172a;
            border-radius: 0.75rem;
            overflow: hidden;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.8rem;
            border: 1px solid #334155;
            margin: 2rem 0;
        }
        .loop-terminal-header {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.75rem 1rem;
            background: #1e293b;
            border-bottom: 1px solid #334155;
        }
        .loop-terminal-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
        }
        .loop-terminal-title {
            margin-left: auto;
            color: #64748b;
            font-size: 0.7rem;
        }
        .loop-terminal-body {
            padding: 1rem;
        }
        .loop-terminal-line {
            padding: 0.25rem 0;
            color: #e2e8f0;
        }
        .loop-terminal-prompt {
            color: #14b8a6;
            margin-right: 0.5rem;
        }
        .loop-terminal-dim {
            color: #64748b;
        }
        .loop-terminal-muted {
            color: #475569;
            font-style: italic;
            margin: 0.5rem 0;
        }
        .loop-terminal-hook {
            color: #a855f7;
        }
        .loop-terminal-badge {
            background: #a855f7;
            color: #0f172a;
            padding: 0.125rem 0.375rem;
            border-radius: 0.25rem;
            font-size: 0.65rem;
            font-weight: 700;
            margin-right: 0.5rem;
        }
        .loop-terminal-error {
            color: #f87171;
        }
        .loop-terminal-success {
            color: #2dd4bf;
        }
        .loop-terminal-label {
            color: #64748b;
            margin-right: 0.5rem;
        }

        /* Callout box */
        .callout-box {
            background: linear-gradient(135deg, #134e4a 0%, #1e293b 100%);
            border: 1px solid #14b8a6;
            border-radius: 0.75rem;
            padding: 1.5rem;
            margin: 2rem 0;
        }
        .callout-title {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            color: #14b8a6;
            font-weight: 700;
            font-size: 1.1rem;
            margin-bottom: 0.75rem;
        }
        .callout-title i {
            font-size: 1.25rem;
        }
        .callout-content {
            color: #e2e8f0;
            line-height: 1.7;
        }

        /* Feedback loop steps */
        .feedback-loop {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            flex-wrap: wrap;
            margin: 2rem 0;
            padding: 1.5rem;
            background: #1e293b;
            border-radius: 0.75rem;
            border: 1px solid #334155;
        }
        .feedback-step {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 0.75rem;
            background: #0f172a;
            border-radius: 0.5rem;
            border: 1px solid #334155;
        }
        .feedback-step-highlight {
            border-color: #3b82f6;
            background: rgba(59, 130, 246, 0.1);
        }
        .feedback-step-success {
            border-color: #14b8a6;
            background: rgba(20, 184, 166, 0.1);
        }
        .feedback-num {
            width: 1.5rem;
            height: 1.5rem;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #334155;
            border-radius: 50%;
            font-size: 0.75rem;
            font-weight: 700;
            color: #94a3b8;
        }
        .feedback-step-success .feedback-num {
            background: #14b8a6;
            color: #0f172a;
        }
        .feedback-text {
            font-size: 0.8rem;
            color: #cbd5e1;
        }
        .feedback-arrow {
            color: #475569;
            font-size: 0.875rem;
        }
        @media (max-width: 768px) {
            .feedback-loop {
                flex-direction: column;
                align-items: stretch;
            }
            .feedback-arrow {
                transform: rotate(90deg);
                align-self: center;
            }
        }

        /* Collaborative loop */
        .collab-loop {
            margin: 2rem 0;
            padding: 1.5rem;
            background: #1e293b;
            border-radius: 0.75rem;
            border: 1px solid #334155;
        }
        .collab-step {
            display: flex;
            align-items: flex-start;
            gap: 1rem;
        }
        .collab-icon {
            width: 2.5rem;
            height: 2.5rem;
            border-radius: 0.5rem;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            color: #0f172a;
            font-size: 1.25rem;
        }
        .collab-content {
            flex: 1;
        }
        .collab-title {
            font-weight: 700;
            color: #f8fafc;
            margin-bottom: 0.25rem;
        }
        .collab-desc {
            font-size: 0.875rem;
            color: #94a3b8;
            line-height: 1.5;
        }
        .collab-desc code {
            font-size: 0.8rem;
            background: #0f172a;
            padding: 0.1rem 0.3rem;
            border-radius: 0.25rem;
            color: #64748b;
        }
        .collab-connector {
            padding: 0.5rem 0 0.5rem 0.85rem;
            color: #475569;
        }
        .collab-connector-loop {
            color: #14b8a6;
            font-size: 0.8rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .collab-connector-loop span {
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        /* Transform grid */
        .transform-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 1rem;
            margin: 2rem 0;
        }
        @media (max-width: 768px) {
            .transform-grid {
                grid-template-columns: 1fr;
            }
        }
        .transform-card {
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 0.75rem;
            padding: 1.25rem;
            text-align: center;
        }
        .transform-old {
            color: #f87171;
            font-size: 0.875rem;
            margin-bottom: 0.75rem;
        }
        .transform-old s {
            text-decoration: line-through;
            text-decoration-color: #ef4444;
        }
        .transform-new {
            color: #14b8a6;
            font-weight: 600;
            font-size: 0.95rem;
        }

        /* Getting started */
        .getting-started {
            margin: 2rem 0;
            display: flex;
            flex-direction: column;
            gap: 1rem;
        }
        .gs-item {
            display: flex;
            gap: 1rem;
            padding: 1rem 1.25rem;
            background: #1e293b;
            border-radius: 0.75rem;
            border: 1px solid #334155;
        }
        .gs-num {
            width: 2rem;
            height: 2rem;
            background: #14b8a6;
            color: #0f172a;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 0.875rem;
            flex-shrink: 0;
        }
        .gs-content {
            flex: 1;
        }
        .gs-content strong {
            color: #f8fafc;
            display: block;
            margin-bottom: 0.25rem;
        }
        .gs-content p {
            margin: 0;
            font-size: 0.875rem;
            color: #94a3b8;
            line-height: 1.5;
        }

        /* Animations */
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        .animate-in {
            animation: fadeInUp 0.6s ease-out forwards;
        }
    </style>
</head>
<body class="antialiased font-sans selection:bg-brand-500 selection:text-white">

    <!-- Progress Bar -->
    <div class="progress-bar" id="progress"></div>

    <!-- Navigation -->
    <nav class="fixed w-full z-50 bg-dark-bg/80 backdrop-blur-md border-b border-dark-border">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex items-center justify-between h-16">
                <a href="../index.html" class="flex-shrink-0 flex items-center gap-2">
                    <div class="w-8 h-8 bg-gradient-to-br from-brand-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-mono font-bold text-lg">
                        &lt;/&gt;
                    </div>
                    <span class="font-mono font-bold text-xl tracking-tight text-white">agentic<span class="text-brand-500">coding</span>.dev</span>
                </a>

                <div class="hidden md:block">
                    <div class="ml-10 flex items-baseline space-x-8">
                        <a href="../index.html#episodes" class="hover:text-brand-500 hover:bg-dark-card px-3 py-2 rounded-md text-sm font-medium transition-colors">Podcast</a>
                        <a href="../index.html#articles" class="hover:text-brand-500 hover:bg-dark-card px-3 py-2 rounded-md text-sm font-medium transition-colors">Articles</a>
                        <a href="../index.html#about" class="hover:text-brand-500 hover:bg-dark-card px-3 py-2 rounded-md text-sm font-medium transition-colors">About</a>
                        <a href="https://www.linkedin.com/in/chrispoulterai/" target="_blank" rel="noopener noreferrer" class="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-md text-sm font-bold shadow-lg shadow-brand-500/20 transition-all">Connect</a>
                    </div>
                </div>
            </div>
        </div>
    </nav>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 lg:pt-32 pb-20">
        <div class="lg:grid lg:grid-cols-[1fr_300px] lg:gap-12">

            <!-- Left Column: Header + Article -->
            <div>
                <!-- Article Header -->
                <header class="mb-12">
                    <a href="../index.html#articles" class="inline-flex items-center text-sm text-gray-400 hover:text-brand-500 mb-6 transition-colors">
                        <i class="ph ph-arrow-left mr-2"></i> Back to articles
                    </a>

                    <h1 class="text-3xl sm:text-4xl lg:text-5xl font-bold gradient-title mb-4 leading-tight animate-in">
                        ${meta.title}
                    </h1>

                    ${meta.subtitle ? `<p class="text-xl text-white mb-6 animate-in" style="animation-delay: 0.1s">${meta.subtitle}</p>` : ""}

                    <div class="flex flex-wrap items-center gap-4 text-sm text-gray-500 font-mono animate-in" style="animation-delay: 0.2s">
                        <span>${formatDate(meta.date)}</span>
                        <span class="w-1 h-1 rounded-full bg-gray-600"></span>
                        <span>${meta.readTime}</span>
                        <span class="w-1 h-1 rounded-full bg-gray-600"></span>
                        <span>${meta.wordCount.toLocaleString()} words</span>
                        ${meta.tags ? `<span class="w-1 h-1 rounded-full bg-gray-600"></span><div class="flex gap-2">${meta.tags.map((t) => `<span class="px-2 py-0.5 bg-dark-card border border-dark-border rounded text-xs">${t}</span>`).join("")}</div>` : ""}
                    </div>
                </header>

                <!-- Article Content -->
                <article class="max-w-3xl">
                    <div class="prose">
                        ${content}
                    </div>
                </article>
            </div>

            <!-- Right Column: Image + TOC -->
            <aside class="hidden lg:block">
                ${meta.image ? `
                <div class="mb-8 rounded-xl overflow-hidden border border-dark-border shadow-lg">
                    <img src="${meta.image}" alt="${meta.title}" class="w-full h-48 object-cover object-bottom">
                </div>
                ` : ""}
                <div class="toc">
                    <h4 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">On this page</h4>
                    <nav class="space-y-1">
                        ${tocHtml}
                    </nav>
                </div>
            </aside>

        </div>
    </div>

    <!-- Back to Top -->
    <button class="back-to-top" id="backToTop" onclick="window.scrollTo({top: 0, behavior: 'smooth'})">
        <i class="ph ph-arrow-up text-xl"></i>
    </button>

    <!-- Footer -->
    <footer class="bg-dark-bg border-t border-dark-border pt-12 pb-8">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex flex-col md:flex-row justify-between items-center gap-4">
                <div class="flex items-center gap-2">
                    <div class="w-6 h-6 bg-brand-500 rounded flex items-center justify-center text-white font-mono font-bold text-xs">
                        &lt;/&gt;
                    </div>
                    <span class="font-mono font-bold text-lg text-white">agentic<span class="text-brand-500">coding</span>.dev</span>
                </div>
                <p class="text-gray-600 text-sm">&copy; ${new Date().getFullYear()} AgenticCoding.dev. All rights reserved.</p>
            </div>
        </div>
    </footer>

    <!-- Lightbox -->
    <div class="lightbox-overlay" id="lightbox" onclick="closeLightbox()">
        <img id="lightbox-img" src="" alt="">
    </div>
    <button class="lightbox-close" id="lightbox-close" onclick="closeLightbox()">
        <i class="ph ph-x text-lg"></i>
    </button>

    <script>
        // Lightbox
        function openLightbox(src, alt) {
            const overlay = document.getElementById('lightbox');
            const img = document.getElementById('lightbox-img');
            img.src = src;
            img.alt = alt || '';
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
        function closeLightbox() {
            const overlay = document.getElementById('lightbox');
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeLightbox();
        });
        document.querySelectorAll('.prose img').forEach(img => {
            img.addEventListener('click', () => openLightbox(img.src, img.alt));
        });

        // Copy code functionality
        function copyCode(btn) {
            const wrapper = btn.closest('.code-block-wrapper');
            const code = wrapper.querySelector('code').textContent;
            navigator.clipboard.writeText(code).then(() => {
                btn.classList.add('copied');
                btn.querySelector('span').textContent = 'Copied!';
                btn.querySelector('i').className = 'ph ph-check';
                setTimeout(() => {
                    btn.classList.remove('copied');
                    btn.querySelector('span').textContent = 'Copy';
                    btn.querySelector('i').className = 'ph ph-copy';
                }, 2000);
            });
        }

        // Progress bar
        const progress = document.getElementById('progress');
        const article = document.querySelector('article');

        function updateProgress() {
            const scrollTop = window.scrollY;
            const docHeight = article.offsetHeight + article.offsetTop - window.innerHeight;
            const scrollPercent = Math.min((scrollTop / docHeight) * 100, 100);
            progress.style.width = scrollPercent + '%';
        }

        // Back to top visibility
        const backToTop = document.getElementById('backToTop');

        function updateBackToTop() {
            if (window.scrollY > 500) {
                backToTop.classList.add('visible');
            } else {
                backToTop.classList.remove('visible');
            }
        }

        // TOC active state
        const tocLinks = document.querySelectorAll('.toc-link');
        const headings = document.querySelectorAll('.prose h2, .prose h3');

        function updateToc() {
            const scrollPos = window.scrollY + 150;

            let current = '';
            headings.forEach(heading => {
                if (heading.offsetTop <= scrollPos) {
                    current = heading.id;
                }
            });

            tocLinks.forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === '#' + current) {
                    link.classList.add('active');
                }
            });
        }

        // Throttle scroll events
        let ticking = false;
        window.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    updateProgress();
                    updateBackToTop();
                    updateToc();
                    ticking = false;
                });
                ticking = true;
            }
        });

        // Initial calls
        updateProgress();
        updateBackToTop();
        updateToc();

        // Highlight code on load
        Prism.highlightAll();
    </script>

</body>
</html>`;
}

async function generateArticles() {
  console.log("Generating articles...\n");

  await mkdir(OUTPUT_DIR, { recursive: true });

  const files = await readdir(ARTICLES_DIR);
  const mdFiles = files.filter((f) => f.endsWith(".md"));

  if (mdFiles.length === 0) {
    console.log("No markdown files found in articles/");
    return;
  }

  for (const file of mdFiles) {
    const filepath = join(ARTICLES_DIR, file);
    const raw = await readFile(filepath, "utf-8");

    const { data, content } = matter(raw);

    const slug = generateSlug(file);
    const meta: ArticleMeta = {
      title: data.title || slug.replace(/-/g, " "),
      subtitle: data.subtitle,
      date: data.date || new Date().toISOString().split("T")[0],
      author: data.author,
      tags: data.tags,
      image: data.image,
      slug,
      readTime: estimateReadTime(content),
      wordCount: countWords(content),
    };

    // Create custom renderer with TOC extraction
    const toc: TocItem[] = [];
    const renderer = createRenderer(toc);
    marked.use({ renderer });

    // Strip leading H1 from markdown -- the template already renders the title from frontmatter
    const strippedContent = content.replace(/^\s*#\s+.+\n/, "");

    // Replace em-dashes everywhere: raw content, parsed HTML, and frontmatter fields
    const cleanContent = strippedContent.replace(/\u2014/g, "-");
    const htmlContent = (await marked(cleanContent)).replace(/\u2014/g, "-");
    if (meta.subtitle) meta.subtitle = meta.subtitle.replace(/\u2014/g, "-");
    if (meta.title) meta.title = meta.title.replace(/\u2014/g, "-");
    const html = template(meta, htmlContent, toc);

    const outputPath = join(OUTPUT_DIR, `${slug}.html`);
    await writeFile(outputPath, html);

    console.log(`  ✓ ${file} -> ${slug}.html (${meta.wordCount} words, ${toc.length} sections)`);
  }

  console.log("\nDone!");
}

generateArticles().catch(console.error);
