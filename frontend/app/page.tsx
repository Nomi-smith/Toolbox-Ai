"use client";

import {
  ChangeEvent,
  DragEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import dynamic from "next/dynamic";

const PdfEditor = dynamic(
  () => import("./PdfEditor"),
  { ssr: false }
);

type Tool =
  | "home"
  | "background"
  | "pdf-word"
  | "pdf-text"
  | "pdf-editor"
  | "pdf-ai"
  | "auto";

type AutoResultType = "image" | null;

type PdfPage = {
  page: number;
  text: string;
};

type WorkflowStep = {
  step: number;
  tool: string;
  status: string;
  reason: string;
};

type WorkflowResponse = {
  workflow?: {
    steps?: {
      tool: string;
      reason: string;
    }[];
  };
  steps?: WorkflowStep[];
  summary?: string | null;
  answer?: string | null;
  sources?: number[];
  extracted_text?: string;
  has_word_file?: boolean;
  download_id?: string | null;
};

type AutoResponse = {
  tool?: string;
  reason?: string;
  answer?: string;
  sources?: number[];
  pages?: PdfPage[];
};

const API_BASE = "http://127.0.0.1:8000";

export default function Home() {
  const [activeTool, setActiveTool] =
    useState<Tool>("home");

  // ----------------------------------------------------------
  // Global
  // ----------------------------------------------------------

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ----------------------------------------------------------
  // Background Removal
  // ----------------------------------------------------------

  const [imageFile, setImageFile] =
    useState<File | null>(null);

  const [imagePreview, setImagePreview] =
    useState<string | null>(null);

  const [imageResult, setImageResult] =
    useState<string | null>(null);

  // ----------------------------------------------------------
  // PDF
  // ----------------------------------------------------------

  const [pdfFile, setPdfFile] =
    useState<File | null>(null);

  const [pdfText, setPdfText] =
    useState<PdfPage[]>([]);

  // ----------------------------------------------------------
  // PDF AI Q&A
  // ----------------------------------------------------------

  const [question, setQuestion] =
    useState("");

  const [answer, setAnswer] =
    useState<string | null>(null);

  const [sources, setSources] =
    useState<number[]>([]);

  // ----------------------------------------------------------
  // Auto Mode
  // ----------------------------------------------------------

  const [autoFile, setAutoFile] =
    useState<File | null>(null);

  const [autoPrompt, setAutoPrompt] =
    useState("");

  const [autoResult, setAutoResult] =
    useState<AutoResponse | null>(null);

  const [autoResultType, setAutoResultType] =
    useState<AutoResultType>(null);

  const [workflowResult, setWorkflowResult] =
    useState<WorkflowResponse | null>(null);

  // ----------------------------------------------------------
  // Refs
  // ----------------------------------------------------------

  const imageInputRef =
    useRef<HTMLInputElement | null>(null);

  const pdfInputRef =
    useRef<HTMLInputElement | null>(null);

  const autoInputRef =
    useRef<HTMLInputElement | null>(null);

  // ----------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------

  function clearError() {
    setError(null);
  }

  function goHome() {
    setActiveTool("home");
    setError(null);
  }

  function formatBytes(bytes: number) {
    if (!bytes) return "0 Bytes";

    const sizes = [
      "Bytes",
      "KB",
      "MB",
      "GB",
    ];

    const i = Math.floor(
      Math.log(bytes) / Math.log(1024)
    );

    return `${(
      bytes /
      Math.pow(1024, i)
    ).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
  }

  function handleImageSelect(
    file: File | null
  ) {
    if (!file) return;

    clearError();

    setImageFile(file);
    setImageResult(null);

    const url =
      URL.createObjectURL(file);

    setImagePreview(url);
  }

  function handlePdfSelect(
    file: File | null
  ) {
    if (!file) return;

    clearError();

    setPdfFile(file);
    setPdfText([]);
    setAnswer(null);
    setSources([]);
  }

  function handleAutoSelect(
    file: File | null
  ) {
    if (!file) return;

    clearError();

    setAutoFile(file);
    setAutoResult(null);
    setWorkflowResult(null);
    setAutoResultType(null);
  }

  function handleFileInput(
    event: ChangeEvent<HTMLInputElement>,
    handler: (file: File | null) => void
  ) {
    const file =
      event.target.files?.[0] ?? null;

    handler(file);

    event.target.value = "";
  }

  function handleDrop(
    event: DragEvent<HTMLDivElement>,
    handler: (file: File | null) => void
  ) {
    event.preventDefault();

    const file =
      event.dataTransfer.files?.[0] ?? null;

    handler(file);
  }

  function handleDragOver(
    event: DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();
  }

  async function downloadBlob(
    response: Response,
    filename: string
  ) {
    const blob =
      await response.blob();

    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement("a");

    a.href = url;
    a.download = filename;

    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  }

  // ----------------------------------------------------------
  // Background Removal
  // ----------------------------------------------------------

  async function removeBackground() {
    if (!imageFile) {
      setError(
        "Please select an image first."
      );
      return;
    }

    setLoading(true);
    clearError();

    try {
      const formData =
        new FormData();

      formData.append(
        "file",
        imageFile
      );

      const response =
        await fetch(
          `${API_BASE}/image/remove-background`,
          {
            method: "POST",
            body: formData,
          }
        );

      if (!response.ok) {
        let message =
          "Background removal failed.";

        try {
          const data =
            await response.json();

          message =
            data.detail ||
            data.message ||
            message;
        } catch {
          // Ignore JSON parsing failure.
        }

        throw new Error(message);
      }

      const blob =
        await response.blob();

      const url =
        URL.createObjectURL(blob);

      setImageResult(url);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  // ----------------------------------------------------------
  // PDF → Word
  // ----------------------------------------------------------

  async function convertPdfToWord() {
    if (!pdfFile) {
      setError(
        "Please select a PDF first."
      );
      return;
    }

    setLoading(true);
    clearError();

    try {
      const formData =
        new FormData();

      formData.append(
        "file",
        pdfFile
      );

      const response =
        await fetch(
          `${API_BASE}/pdf/to-word`,
          {
            method: "POST",
            body: formData,
          }
        );

      if (!response.ok) {
        let message =
          "PDF to Word conversion failed.";

        try {
          const data =
            await response.json();

          message =
            data.detail ||
            data.message ||
            message;
        } catch {
          // Ignore JSON parsing failure.
        }

        throw new Error(message);
      }

      const filename =
        pdfFile.name.replace(
          /\.pdf$/i,
          ""
        ) + ".docx";

      await downloadBlob(
        response,
        filename
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  // ----------------------------------------------------------
  // PDF Text Extraction
  // ----------------------------------------------------------

  async function extractPdfText() {
    if (!pdfFile) {
      setError(
        "Please select a PDF first."
      );
      return;
    }

    setLoading(true);
    clearError();

    try {
      const formData =
        new FormData();

      formData.append(
        "file",
        pdfFile
      );

      const response =
        await fetch(
          `${API_BASE}/pdf/extract-text`,
          {
            method: "POST",
            body: formData,
          }
        );

      if (!response.ok) {
        let message =
          "PDF text extraction failed.";

        try {
          const data =
            await response.json();

          message =
            data.detail ||
            data.message ||
            message;
        } catch {
          // Ignore JSON parsing failure.
        }

        throw new Error(message);
      }

      const data =
        await response.json();

      setPdfText(
        Array.isArray(data.pages)
          ? data.pages
          : []
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  // ----------------------------------------------------------
  // Ask PDF
  // ----------------------------------------------------------

  async function askPdf() {
    if (!pdfFile) {
      setError(
        "Please select a PDF first."
      );
      return;
    }

    if (!question.trim()) {
      setError(
        "Please enter a question."
      );
      return;
    }

    setLoading(true);
    clearError();

    try {
      const formData =
        new FormData();

      formData.append(
        "file",
        pdfFile
      );

      formData.append(
        "question",
        question.trim()
      );

      const response =
        await fetch(
          `${API_BASE}/pdf/ask`,
          {
            method: "POST",
            body: formData,
          }
        );

      if (!response.ok) {
        let message =
          "Could not answer the question.";

        try {
          const data =
            await response.json();

          message =
            data.detail ||
            data.message ||
            message;
        } catch {
          // Ignore JSON parsing failure.
        }

        throw new Error(message);
      }

      const data =
        await response.json();

      setAnswer(
        data.answer ?? null
      );

      setSources(
        Array.isArray(data.sources)
          ? data.sources
          : []
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  // ----------------------------------------------------------
  // Auto Mode
  // ----------------------------------------------------------

  async function runAuto() {
    if (!autoFile) {
      setError(
        "Please select a file first."
      );
      return;
    }

    if (!autoPrompt.trim()) {
      setError(
        "Please describe what you want to do."
      );
      return;
    }

    setLoading(true);
    clearError();

    setAutoResult(null);
    setWorkflowResult(null);
    setAutoResultType(null);

    try {
      const formData =
        new FormData();

      formData.append(
        "file",
        autoFile
      );

      formData.append(
        "prompt",
        autoPrompt.trim()
      );

      const response =
        await fetch(
          `${API_BASE}/auto`,
          {
            method: "POST",
            body: formData,
          }
        );

      if (!response.ok) {
        let message =
          "Auto Mode failed.";

        try {
          const data =
            await response.json();

          message =
            data.detail ||
            data.message ||
            message;
        } catch {
          // Ignore JSON parsing failure.
        }

        throw new Error(message);
      }

      const contentType =
        response.headers.get(
          "content-type"
        ) || "";

      if (
        contentType.includes(
          "application/json"
        )
      ) {
        const data =
          await response.json();

        setAutoResult(data);
        setAutoResultType(null);
      } else {
        const blob =
          await response.blob();

        const url =
          URL.createObjectURL(blob);

        setAutoResultType(
          "image"
        );

        setAutoResult({
          tool:
            "Background Removal",
          reason:
            "Auto Mode processed the uploaded image.",
          answer: url,
        });
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  // ----------------------------------------------------------
  // Auto Workflow
  // ----------------------------------------------------------

  async function runWorkflow() {
    if (!autoFile) {
      setError(
        "Please select a file first."
      );
      return;
    }

    if (!autoPrompt.trim()) {
      setError(
        "Please describe the workflow."
      );
      return;
    }

    setLoading(true);
    clearError();

    setAutoResult(null);
    setWorkflowResult(null);
    setAutoResultType(null);

    try {
      const formData =
        new FormData();

      formData.append(
        "file",
        autoFile
      );

      formData.append(
        "prompt",
        autoPrompt.trim()
      );

      const response =
        await fetch(
          `${API_BASE}/auto/workflow`,
          {
            method: "POST",
            body: formData,
          }
        );

      if (!response.ok) {
        let message =
          "Workflow execution failed.";

        try {
          const data =
            await response.json();

          message =
            data.detail ||
            data.message ||
            message;
        } catch {
          // Ignore JSON parsing failure.
        }

        throw new Error(message);
      }

      const data =
        await response.json();

      setWorkflowResult(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  // ----------------------------------------------------------
  // Cleanup
  // ----------------------------------------------------------

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(
          imagePreview
        );
      }

      if (imageResult) {
        URL.revokeObjectURL(
          imageResult
        );
      }

      if (
        autoResultType ===
        "image" &&
        autoResult?.answer
      ) {
        URL.revokeObjectURL(
          autoResult.answer
        );
      }
    };
  }, [
    imagePreview,
    imageResult,
    autoResult,
    autoResultType,
  ]);

  // ----------------------------------------------------------
  // Header
  // ----------------------------------------------------------

  function Header({
    onHome,
  }: {
    onHome: () => void;
  }) {
    return (
      <header className="sticky top-0 z-50 border-b border-black/5 bg-[#f7f7f5]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <button
            onClick={onHome}
            className="flex items-center gap-3"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black text-white">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 3v18" />
                <path d="M3 12h18" />
                <path d="m7 7 10 10" />
                <path d="m17 7-10 10" />
              </svg>
            </div>

            <div className="text-left">
              <div className="text-sm font-semibold tracking-tight">
                Toolbox AI
              </div>

              <div className="text-[10px] uppercase tracking-[0.18em] text-black/40">
                Intelligent tools
              </div>
            </div>
          </button>

          <div className="hidden items-center gap-2 md:flex">
            <div className="rounded-full border border-black/10 bg-white/60 px-3 py-1.5 text-xs text-black/50">
              AI-powered productivity
            </div>
          </div>
        </div>
      </header>
    );
  }

  // ----------------------------------------------------------
  // Error Banner
  // ----------------------------------------------------------

  function ErrorBanner() {
    if (!error) return null;

    return (
      <div className="mx-auto mt-6 max-w-7xl px-6">
        <div className="flex items-start justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <div>
            <div className="font-medium">
              Something went wrong
            </div>

            <div className="mt-0.5 text-red-600/80">
              {error}
            </div>
          </div>

          <button
            onClick={clearError}
            className="rounded-lg px-2 py-1 text-red-500 hover:bg-red-100"
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------
  // Tool Card
  // ----------------------------------------------------------

  function ToolCard({
    title,
    description,
    icon,
    onClick,
    badge,
  }: {
    title: string;
    description: string;
    icon: React.ReactNode;
    onClick: () => void;
    badge?: string;
  }) {
    return (
      <button
        onClick={onClick}
        className="group relative flex min-h-[190px] flex-col rounded-3xl border border-black/8 bg-white p-6 text-left shadow-[0_2px_10px_rgba(0,0,0,0.03)] transition-all duration-200 hover:-translate-y-1 hover:border-black/15 hover:shadow-[0_16px_40px_rgba(0,0,0,0.08)]"
      >
        {badge && (
          <span className="absolute right-5 top-5 rounded-full bg-black px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-white">
            {badge}
          </span>
        )}

        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f3f3f1] text-black transition-colors group-hover:bg-black group-hover:text-white">
          {icon}
        </div>

        <div className="mt-5">
          <h3 className="text-base font-semibold tracking-tight">
            {title}
          </h3>

          <p className="mt-2 max-w-[260px] text-sm leading-6 text-black/50">
            {description}
          </p>
        </div>

        <div className="mt-auto flex items-center gap-1 pt-5 text-xs font-medium text-black/40 transition-colors group-hover:text-black">
          Open tool
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-transform group-hover:translate-x-0.5"
          >
            <path d="M5 12h14" />
            <path d="m13 6 6 6-6 6" />
          </svg>
        </div>
      </button>
    );
  }

  // ----------------------------------------------------------
  // Upload Zone
  // ----------------------------------------------------------

  function UploadZone({
    accept,
    file,
    inputRef,
    onSelect,
    label,
    description,
    icon,
  }: {
    accept: string;
    file: File | null;
    inputRef: React.MutableRefObject<HTMLInputElement | null>;
    onSelect: (file: File | null) => void;
    label: string;
    description: string;
    icon: React.ReactNode;
  }) {
    return (
      <div
        onDragOver={handleDragOver}
        onDrop={(event) =>
          handleDrop(
            event,
            onSelect
          )
        }
        onClick={() =>
          inputRef.current?.click()
        }
        className="group cursor-pointer rounded-3xl border border-dashed border-black/15 bg-white p-8 text-center transition-all hover:border-black/30 hover:bg-white/80"
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(event) =>
            handleFileInput(
              event,
              onSelect
            )
          }
        />

        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f3f3f1] text-black transition-transform group-hover:scale-105">
          {icon}
        </div>

        {file ? (
          <>
            <div className="mt-5 text-sm font-semibold">
              {file.name}
            </div>

            <div className="mt-1 text-xs text-black/40">
              {formatBytes(file.size)}
            </div>

            <div className="mt-4 text-xs font-medium text-black/50">
              Click to replace
            </div>
          </>
        ) : (
          <>
            <div className="mt-5 text-sm font-semibold">
              {label}
            </div>

            <div className="mx-auto mt-2 max-w-sm text-xs leading-5 text-black/40">
              {description}
            </div>

            <div className="mt-4 inline-flex rounded-full border border-black/10 bg-[#f7f7f5] px-3 py-1.5 text-xs font-medium text-black/60">
              Choose file
            </div>
          </>
        )}
      </div>
    );
  }

  // ----------------------------------------------------------
  // Home
  // ----------------------------------------------------------

  if (
    activeTool ===
    "home"
  ) {
    return (
      <main className="min-h-screen bg-[#f7f7f5] text-black">
        <Header
          onHome={goHome}
        />

        <ErrorBanner />

        <section className="mx-auto max-w-7xl px-6 pb-20 pt-16">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-black/8 bg-white px-3 py-1.5 text-xs font-medium text-black/50">
              <span className="h-1.5 w-1.5 rounded-full bg-black" />
              Your AI productivity toolbox
            </div>

            <h1 className="text-4xl font-semibold tracking-[-0.04em] sm:text-5xl lg:text-6xl">
              One toolbox.
              <br />
              <span className="text-black/35">
                Every task.
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-7 text-black/50 sm:text-lg">
              Toolbox AI brings useful image,
              PDF, and AI utilities together in
              one simple workspace — with an
              intelligent Auto Mode that can
              choose the right tool for you.
            </p>
          </div>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <ToolCard
              title="AI Auto Mode"
              description="Describe what you want to accomplish and let AI choose and run the right tool."
              badge="AI"
              onClick={() =>
                setActiveTool("auto")
              }
              icon={
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 3 14 9l6 3-6 3-2 6-2-6-6-3 6-3 2-6Z" />
                </svg>
              }
            />

            <ToolCard
              title="Remove Background"
              description="Automatically remove the background from an image and download the clean result."
              onClick={() =>
                setActiveTool(
                  "background"
                )
              }
              icon={
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect
                    x="3"
                    y="3"
                    width="18"
                    height="18"
                    rx="3"
                  />
                  <circle
                    cx="8.5"
                    cy="8.5"
                    r="1.5"
                  />
                  <path d="m21 15-5-5L5 21" />
                </svg>
              }
            />

            <ToolCard
              title="PDF → Word"
              description="Convert PDF documents into editable Word files with a single click."
              onClick={() =>
                setActiveTool(
                  "pdf-word"
                )
              }
              icon={
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                  <path d="M14 2v6h6" />
                  <path d="M8 13h8" />
                  <path d="M8 17h6" />
                </svg>
              }
            />

            <ToolCard
              title="Extract PDF Text"
              description="Extract readable text from every page of a PDF and inspect it directly."
              onClick={() =>
                setActiveTool(
                  "pdf-text"
                )
              }
              icon={
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                  <path d="M14 2v6h6" />
                  <path d="M8 13h8" />
                  <path d="M8 17h5" />
                </svg>
              }
            />

            <ToolCard
              title="PDF Editor"
              description="Select text directly inside a PDF, replace it, and export the edited document."
              badge="New"
              onClick={() =>
                setActiveTool(
                  "pdf-editor"
                )
              }
              icon={
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
                </svg>
              }
            />

            <ToolCard
              title="Ask Your PDF"
              description="Ask natural-language questions about a PDF and get AI answers grounded in its content."
              onClick={() =>
                setActiveTool(
                  "pdf-ai"
                )
              }
              icon={
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.5 9.5 0 0 1-4-.9L3 21l1.8-4.2A8.4 8.4 0 1 1 21 11.5Z" />
                  <path d="M8 11h.01" />
                  <path d="M12 11h.01" />
                  <path d="M16 11h.01" />
                </svg>
              }
            />
          </div>

          <div className="mt-14 rounded-3xl border border-black/8 bg-black px-6 py-7 text-white sm:px-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold">
                  Let AI handle the decision.
                </div>

                <p className="mt-1 max-w-xl text-sm leading-6 text-white/50">
                  Upload a file, describe the
                  outcome you want, and Auto Mode
                  routes the task through the
                  appropriate Toolbox AI capability.
                </p>
              </div>

              <button
                onClick={() =>
                  setActiveTool("auto")
                }
                className="shrink-0 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition-transform hover:-translate-y-0.5"
              >
                Try Auto Mode
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  // ----------------------------------------------------------
  // PDF Editor
  // ----------------------------------------------------------

  if (
    activeTool ===
    "pdf-editor"
  ) {
    return (
      <main className="min-h-screen bg-[#f7f7f5] text-black">
        <Header
          onHome={goHome}
        />

        <ErrorBanner />

        <PdfEditor
          apiBase={API_BASE}
          error={error}
          onError={setError}
        />
      </main>
    );
  }

  // ----------------------------------------------------------
  // Background Tool
  // ----------------------------------------------------------

  if (
    activeTool ===
    "background"
  ) {
    return (
      <main className="min-h-screen bg-[#f7f7f5] text-black">
        <Header
          onHome={goHome}
        />

        <ErrorBanner />

        <section className="mx-auto max-w-6xl px-6 pb-20 pt-12">
          <button
            onClick={goHome}
            className="mb-8 flex items-center gap-2 text-sm text-black/45 hover:text-black"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            All tools
          </button>

          <div className="max-w-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-white">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect
                  x="3"
                  y="3"
                  width="18"
                  height="18"
                  rx="3"
                />
                <circle
                  cx="8.5"
                  cy="8.5"
                  r="1.5"
                />
                <path d="m21 15-5-5L5 21" />
              </svg>
            </div>

            <h1 className="mt-6 text-3xl font-semibold tracking-[-0.03em]">
              Remove Background
            </h1>

            <p className="mt-3 text-sm leading-6 text-black/50">
              Upload an image and Toolbox AI
              will automatically remove its
              background.
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <div>
              <UploadZone
                accept="image/png,image/jpeg,image/jpg,image/webp"
                file={imageFile}
                inputRef={imageInputRef}
                onSelect={
                  handleImageSelect
                }
                label="Drop your image here"
                description="PNG, JPG, JPEG, or WebP"
                icon={
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 16V4" />
                    <path d="m7 9 5-5 5 5" />
                    <path d="M5 20h14" />
                  </svg>
                }
              />

              <button
                onClick={removeBackground}
                disabled={
                  loading ||
                  !imageFile
                }
                className="mt-4 w-full rounded-2xl bg-black px-5 py-3.5 text-sm font-semibold text-white transition-all hover:bg-black/85 disabled:cursor-not-allowed disabled:opacity-30"
              >
                {loading
                  ? "Removing background..."
                  : "Remove Background"}
              </button>
            </div>

            <div className="rounded-3xl border border-black/8 bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wider text-black/40">
                  Result
                </div>

                {imageResult && (
                  <a
                    href={
                      imageResult
                    }
                    download="toolbox-ai-no-background.png"
                    className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-medium hover:bg-black hover:text-white"
                  >
                    Download
                  </a>
                )}
              </div>

              <div className="flex min-h-[390px] items-center justify-center overflow-hidden rounded-2xl bg-[#f3f3f1]">
                {imageResult ? (
                  <img
                    src={
                      imageResult
                    }
                    alt="Background removed"
                    className="max-h-[500px] max-w-full object-contain"
                  />
                ) : imagePreview ? (
                  <img
                    src={
                      imagePreview
                    }
                    alt="Original"
                    className="max-h-[500px] max-w-full object-contain"
                  />
                ) : (
                  <div className="text-center text-sm text-black/30">
                    Your processed image
                    will appear here.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  // ----------------------------------------------------------
  // PDF → Word
  // ----------------------------------------------------------

  if (
    activeTool ===
    "pdf-word"
  ) {
    return (
      <main className="min-h-screen bg-[#f7f7f5] text-black">
        <Header
          onHome={goHome}
        />

        <ErrorBanner />

        <section className="mx-auto max-w-5xl px-6 pb-20 pt-12">
          <button
            onClick={goHome}
            className="mb-8 flex items-center gap-2 text-sm text-black/45 hover:text-black"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            All tools
          </button>

          <div className="max-w-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-white">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                <path d="M14 2v6h6" />
                <path d="M8 13h8" />
                <path d="M8 17h6" />
              </svg>
            </div>

            <h1 className="mt-6 text-3xl font-semibold tracking-[-0.03em]">
              PDF → Word
            </h1>

            <p className="mt-3 text-sm leading-6 text-black/50">
              Convert your PDF into an
              editable Word document.
            </p>
          </div>

          <div className="mt-10 max-w-3xl">
            <UploadZone
              accept="application/pdf"
              file={pdfFile}
              inputRef={pdfInputRef}
              onSelect={
                handlePdfSelect
              }
              label="Drop your PDF here"
              description="PDF documents only"
              icon={
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                  <path d="M14 2v6h6" />
                </svg>
              }
            />

            <button
              onClick={
                convertPdfToWord
              }
              disabled={
                loading ||
                !pdfFile
              }
              className="mt-4 w-full rounded-2xl bg-black px-5 py-3.5 text-sm font-semibold text-white transition-all hover:bg-black/85 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {loading
                ? "Converting..."
                : "Convert to Word"}
            </button>
          </div>
        </section>
      </main>
    );
  }

  // ----------------------------------------------------------
  // PDF Text
  // ----------------------------------------------------------

  if (
    activeTool ===
    "pdf-text"
  ) {
    return (
      <main className="min-h-screen bg-[#f7f7f5] text-black">
        <Header
          onHome={goHome}
        />

        <ErrorBanner />

        <section className="mx-auto max-w-6xl px-6 pb-20 pt-12">
          <button
            onClick={goHome}
            className="mb-8 flex items-center gap-2 text-sm text-black/45 hover:text-black"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            All tools
          </button>

          <div className="max-w-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-white">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                <path d="M14 2v6h6" />
                <path d="M8 13h8" />
                <path d="M8 17h5" />
              </svg>
            </div>

            <h1 className="mt-6 text-3xl font-semibold tracking-[-0.03em]">
              Extract PDF Text
            </h1>

            <p className="mt-3 text-sm leading-6 text-black/50">
              Extract text page-by-page from
              your PDF document.
            </p>
          </div>

          <div className="mt-10">
            <UploadZone
              accept="application/pdf"
              file={pdfFile}
              inputRef={pdfInputRef}
              onSelect={
                handlePdfSelect
              }
              label="Drop your PDF here"
              description="PDF documents only"
              icon={
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                  <path d="M14 2v6h6" />
                </svg>
              }
            />

            <button
              onClick={
                extractPdfText
              }
              disabled={
                loading ||
                !pdfFile
              }
              className="mt-4 w-full rounded-2xl bg-black px-5 py-3.5 text-sm font-semibold text-white transition-all hover:bg-black/85 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {loading
                ? "Extracting..."
                : "Extract Text"}
            </button>
          </div>

          {pdfText.length >
            0 && (
            <div className="mt-10 space-y-4">
              {pdfText.map(
                (page) => (
                  <div
                    key={
                      page.page
                    }
                    className="rounded-3xl border border-black/8 bg-white p-6"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <div className="text-xs font-semibold uppercase tracking-wider text-black/40">
                        Page{" "}
                        {
                          page.page
                        }
                      </div>
                    </div>

                    <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-black/70">
                      {
                        page.text
                      }
                    </pre>
                  </div>
                )
              )}
            </div>
          )}
        </section>
      </main>
    );
  }

    // ----------------------------------------------------------
  // PDF AI
  // ----------------------------------------------------------

  if (
    activeTool ===
    "pdf-ai"
  ) {
    return (
      <main className="min-h-screen bg-[#f7f7f5] text-black">
        <Header
          onHome={goHome}
        />

        <ErrorBanner />

        <section className="mx-auto max-w-6xl px-6 pb-20 pt-12">
          <button
            onClick={goHome}
            className="mb-8 flex items-center gap-2 text-sm text-black/45 hover:text-black"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            All tools
          </button>

          <div className="max-w-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-white">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.5 9.5 0 0 1-4-.9L3 21l1.8-4.2A8.4 8.4 0 1 1 21 11.5Z" />
                <path d="M8 11h.01" />
                <path d="M12 11h.01" />
                <path d="M16 11h.01" />
              </svg>
            </div>

            <h1 className="mt-6 text-3xl font-semibold tracking-[-0.03em]">
              Ask Your PDF
            </h1>

            <p className="mt-3 text-sm leading-6 text-black/50">
              Ask questions about your
              document and get answers grounded
              in its contents.
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <UploadZone
                accept="application/pdf"
                file={pdfFile}
                inputRef={pdfInputRef}
                onSelect={
                  handlePdfSelect
                }
                label="Drop your PDF here"
                description="PDF documents only"
                icon={
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                    <path d="M14 2v6h6" />
                  </svg>
                }
              />

              <div className="mt-4 rounded-3xl border border-black/8 bg-white p-5">
                <label className="text-xs font-semibold uppercase tracking-wider text-black/40">
                  Your question
                </label>

                <textarea
                  value={question}
                  onChange={(event) =>
                    setQuestion(
                      event.target.value
                    )
                  }
                  placeholder="What is this document about?"
                  rows={5}
                  className="mt-3 w-full resize-none rounded-2xl border border-black/10 bg-[#f7f7f5] px-4 py-3 text-sm outline-none transition focus:border-black/30"
                />

                <button
                  onClick={
                    askPdf
                  }
                  disabled={
                    loading ||
                    !pdfFile ||
                    !question.trim()
                  }
                  className="mt-3 w-full rounded-2xl bg-black px-5 py-3.5 text-sm font-semibold text-white transition-all hover:bg-black/85 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {loading
                    ? "Thinking..."
                    : "Ask PDF"}
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-black/8 bg-white p-6">
              <div className="mb-5 flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wider text-black/40">
                  AI Answer
                </div>

                {sources.length >
                  0 && (
                  <div className="rounded-full bg-[#f3f3f1] px-3 py-1 text-[11px] font-medium text-black/50">
                    {sources.length}{" "}
                    source
                    {sources.length ===
                    1
                      ? ""
                      : "s"}
                  </div>
                )}
              </div>

              {answer ? (
                <div>
                  <div className="whitespace-pre-wrap text-sm leading-7 text-black/75">
                    {answer}
                  </div>

                  {sources.length >
                    0 && (
                    <div className="mt-8 border-t border-black/8 pt-5">
                      <div className="text-xs font-semibold uppercase tracking-wider text-black/35">
                        Sources
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {sources.map(
                          (
                            source
                          ) => (
                            <span
                              key={
                                source
                              }
                              className="rounded-full border border-black/10 px-3 py-1.5 text-xs text-black/50"
                            >
                              Page{" "}
                              {
                                source
                              }
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex min-h-[360px] items-center justify-center rounded-2xl bg-[#f3f3f1] px-8 text-center text-sm leading-6 text-black/30">
                  Upload a PDF and ask a
                  question. Your grounded AI
                  answer will appear here.
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    );
  }

  // ----------------------------------------------------------
  // Auto Mode
  // ----------------------------------------------------------

  if (
    activeTool ===
    "auto"
  ) {
    return (
      <main className="min-h-screen bg-[#f7f7f5] text-black">
        <Header
          onHome={goHome}
        />

        <ErrorBanner />

        <section className="mx-auto max-w-6xl px-6 pb-20 pt-12">
          <button
            onClick={goHome}
            className="mb-8 flex items-center gap-2 text-sm text-black/45 hover:text-black"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            All tools
          </button>

          <div className="max-w-3xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-white">
              <svg
                width="23"
                height="23"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 3 14 9l6 3-6 3-2 6-2-6-6-3 6-3 2-6Z" />
              </svg>
            </div>

            <h1 className="mt-6 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              AI Auto Mode
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-black/50">
              Tell Toolbox AI what you want to
              accomplish. The AI router identifies
              the appropriate capability and the
              backend executes it.
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="space-y-4">
              <UploadZone
                accept="image/*,application/pdf"
                file={autoFile}
                inputRef={autoInputRef}
                onSelect={
                  handleAutoSelect
                }
                label="Drop your file here"
                description="Images or PDF documents"
                icon={
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 16V4" />
                    <path d="m7 9 5-5 5 5" />
                    <path d="M5 20h14" />
                  </svg>
                }
              />

              <div className="rounded-3xl border border-black/8 bg-white p-5">
                <label className="text-xs font-semibold uppercase tracking-wider text-black/40">
                  What do you want to do?
                </label>

                <textarea
                  value={
                    autoPrompt
                  }
                  onChange={(event) =>
                    setAutoPrompt(
                      event.target.value
                    )
                  }
                  placeholder="e.g. Remove the background from this image"
                  rows={5}
                  className="mt-3 w-full resize-none rounded-2xl border border-black/10 bg-[#f7f7f5] px-4 py-3 text-sm outline-none transition focus:border-black/30"
                />

                <button
                  onClick={
                    runAuto
                  }
                  disabled={
                    loading ||
                    !autoFile ||
                    !autoPrompt.trim()
                  }
                  className="mt-3 w-full rounded-2xl bg-black px-5 py-3.5 text-sm font-semibold text-white transition-all hover:bg-black/85 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {loading
                    ? "Running AI..."
                    : "Run Auto Mode"}
                </button>

                <button
                  onClick={
                    runWorkflow
                  }
                  disabled={
                    loading ||
                    !autoFile ||
                    !autoPrompt.trim()
                  }
                  className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-5 py-3.5 text-sm font-semibold text-black transition-all hover:border-black/25 hover:bg-[#f7f7f5] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {loading
                    ? "Running workflow..."
                    : "Run Multi-Step Workflow"}
                </button>
              </div>

              <div className="rounded-2xl border border-black/8 bg-white px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#f3f3f1]">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 2 3 6v6c0 5.25 3.84 8.9 9 10 5.16-1.1 9-4.75 9-10V6l-9-4Z" />
                      <path d="m9 12 2 2 4-4" />
                    </svg>
                  </div>

                  <div>
                    <div className="text-xs font-semibold">
                      Controlled AI routing
                    </div>

                    <div className="mt-0.5 text-[11px] leading-5 text-black/40">
                      AI selects only from supported
                      Toolbox capabilities.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              {autoResult && (
                <div className="rounded-3xl border border-black/8 bg-white p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-black/35">
                        Auto Result
                      </div>

                      <h2 className="mt-2 text-xl font-semibold tracking-tight">
                        {
                          autoResult.tool ||
                          "Completed"
                        }
                      </h2>
                    </div>

                    <div className="rounded-full bg-[#f3f3f1] px-3 py-1.5 text-[11px] font-medium text-black/50">
                      AI selected
                    </div>
                  </div>

                  {autoResult.reason && (
                    <div className="mt-5 rounded-2xl bg-[#f7f7f5] p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-black/35">
                        Why this tool
                      </div>

                      <div className="mt-2 text-sm leading-6 text-black/60">
                        {
                          autoResult.reason
                        }
                      </div>
                    </div>
                  )}

                  {autoResultType ===
                    "image" &&
                    autoResult.answer && (
                      <div className="mt-5">
                        <img
                          src={
                            autoResult.answer
                          }
                          alt="Auto processed result"
                          className="max-h-[520px] w-full rounded-2xl object-contain bg-[#f3f3f1]"
                        />

                        <a
                          href={
                            autoResult.answer
                          }
                          download="toolbox-ai-result.png"
                          className="mt-3 inline-flex rounded-xl bg-black px-4 py-2.5 text-xs font-semibold text-white"
                        >
                          Download Result
                        </a>
                      </div>
                    )}

                  {autoResult.answer &&
                    autoResultType !==
                      "image" && (
                      <div className="mt-5 whitespace-pre-wrap text-sm leading-7 text-black/70">
                        {
                          autoResult.answer
                        }
                      </div>
                    )}

                  {autoResult.sources &&
                    autoResult.sources
                      .length >
                      0 && (
                      <div className="mt-6 border-t border-black/8 pt-5">
                        <div className="text-xs font-semibold uppercase tracking-wider text-black/35">
                          Sources
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {autoResult.sources.map(
                            (
                              source
                            ) => (
                              <span
                                key={
                                  source
                                }
                                className="rounded-full border border-black/10 px-3 py-1.5 text-xs text-black/50"
                              >
                                Page{" "}
                                {
                                  source
                                }
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    )}
                </div>
              )}

              {workflowResult && (
                <div className="rounded-3xl border border-black/8 bg-white p-6">
                  <div className="text-xs font-semibold uppercase tracking-wider text-black/35">
                    Workflow
                  </div>

                  <h2 className="mt-2 text-xl font-semibold tracking-tight">
                    Multi-step execution
                  </h2>

                  {workflowResult.summary && (
                    <p className="mt-3 text-sm leading-6 text-black/55">
                      {
                        workflowResult.summary
                      }
                    </p>
                  )}

                  {workflowResult.workflow?.steps &&
                    workflowResult.workflow
                      .steps
                      .length >
                      0 && (
                      <div className="mt-6 space-y-3">
                        {workflowResult.workflow.steps.map(
                          (
                            step,
                            index
                          ) => (
                            <div
                              key={
                                `${step.tool}-${index}`
                              }
                              className="flex gap-4 rounded-2xl bg-[#f7f7f5] p-4"
                            >
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-black text-xs font-semibold text-white">
                                {index +
                                  1}
                              </div>

                              <div>
                                <div className="text-sm font-semibold">
                                  {
                                    step.tool
                                  }
                                </div>

                                <div className="mt-1 text-xs leading-5 text-black/45">
                                  {
                                    step.reason
                                  }
                                </div>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    )}

                  {workflowResult.steps &&
                    workflowResult.steps
                      .length >
                      0 && (
                      <div className="mt-6 space-y-3">
                        {workflowResult.steps.map(
                          (
                            step
                          ) => (
                            <div
                              key={
                                step.step
                              }
                              className="flex gap-4 rounded-2xl bg-[#f7f7f5] p-4"
                            >
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-black text-xs font-semibold text-white">
                                {
                                  step.step
                                }
                              </div>

                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-semibold">
                                    {
                                      step.tool
                                    }
                                  </span>

                                  <span className="rounded-full bg-white px-2 py-1 text-[10px] font-medium text-black/45">
                                    {
                                      step.status
                                    }
                                  </span>
                                </div>

                                {step.reason && (
                                  <div className="mt-1 text-xs leading-5 text-black/45">
                                    {
                                      step.reason
                                    }
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    )}

                  {workflowResult.answer && (
                    <div className="mt-6 border-t border-black/8 pt-5">
                      <div className="text-xs font-semibold uppercase tracking-wider text-black/35">
                        Result
                      </div>

                      <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-black/70">
                        {
                          workflowResult.answer
                        }
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!autoResult &&
                !workflowResult && (
                  <div className="flex min-h-[570px] items-center justify-center rounded-3xl border border-black/8 bg-white p-8 text-center">
                    <div className="max-w-sm">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f3f3f1]">
                        <svg
                          width="25"
                          height="25"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M12 3 14 9l6 3-6 3-2 6-2-6-6-3 6-3 2-6Z" />
                        </svg>
                      </div>

                      <div className="mt-5 text-sm font-semibold">
                        Ready when you are
                      </div>

                      <p className="mt-2 text-sm leading-6 text-black/35">
                        Upload a file and describe
                        the result you want. Toolbox
                        AI will determine the best
                        available action.
                      </p>
                    </div>
                  </div>
                )}
            </div>
          </div>
        </section>
      </main>
    );
  }

  return null;
}

