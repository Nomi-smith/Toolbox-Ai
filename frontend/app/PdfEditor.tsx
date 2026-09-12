"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc =
  `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type PdfEditorProps = {
  apiBase: string;
  error: string | null;
  onError: (message: string | null) => void;
};

type PageInfo = {
  width: number;
  height: number;
};

type TextSelection = {
  page: number;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export default function PdfEditor({
  apiBase,
  error,
  onError,
}: PdfEditorProps) {
  const [file, setFile] =
    useState<File | null>(null);

  /*
   * This is the actual PDF file currently being edited.
   *
   * IMPORTANT:
   * We keep the real File object instead of trying to
   * fetch a browser blob URL before every edit.
   *
   * After an edit succeeds, this is replaced with the
   * newly generated PDF so multiple edits can be chained.
   */
  const [currentPdfFile, setCurrentPdfFile] =
    useState<File | null>(null);

  const [pdfUrl, setPdfUrl] =
    useState<string | null>(null);

  const [pageCount, setPageCount] =
    useState(0);

  const [currentPage, setCurrentPage] =
    useState(1);

  const [pageInfo, setPageInfo] =
    useState<PageInfo | null>(null);

  const [selection, setSelection] =
    useState<TextSelection | null>(null);

  const [replacement, setReplacement] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [status, setStatus] =
    useState<string | null>(null);

  const pageContainerRef =
    useRef<HTMLDivElement | null>(null);

  // ==========================================================
  // PAGE WIDTH
  // ==========================================================

  const getPageWidth = () => {
    if (typeof window === "undefined") {
      return 760;
    }

    const available =
      window.innerWidth - 500;

    return Math.max(
      420,
      Math.min(820, available)
    );
  };

  const [displayWidth, setDisplayWidth] =
    useState(760);

  useEffect(() => {
    const handleResize = () => {
      setDisplayWidth(
        getPageWidth()
      );
    };

    handleResize();

    window.addEventListener(
      "resize",
      handleResize
    );

    return () => {
      window.removeEventListener(
        "resize",
        handleResize
      );
    };
  }, []);

  // ==========================================================
  // CLEANUP PDF URL
  // ==========================================================

  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  // ==========================================================
  // CREATE PDF URL
  // ==========================================================

  const showPdfFile = (pdfFile: File) => {
    const newUrl =
      URL.createObjectURL(pdfFile);

    setPdfUrl((oldUrl) => {
      if (oldUrl) {
        URL.revokeObjectURL(oldUrl);
      }

      return newUrl;
    });
  };

  // ==========================================================
  // UPLOAD
  // ==========================================================

  const handleFileUpload = async (
    selectedFile: File | null
  ) => {
    if (!selectedFile) {
      return;
    }

    if (
      selectedFile.type !==
      "application/pdf"
    ) {
      onError(
        "Please upload a PDF file."
      );
      return;
    }

    setLoading(true);

    setStatus(
      "Preparing PDF for editing..."
    );

    onError(null);

    setSelection(null);
    setReplacement("");
    setPageInfo(null);
    setPageCount(0);
    setCurrentPage(1);

    try {
      const formData =
        new FormData();

      formData.append(
        "file",
        selectedFile
      );

      /*
       * The backend makes scanned PDFs searchable
       * by adding an invisible OCR text layer.
       *
       * Normal PDFs are left usable while scanned
       * pages receive OCR text.
       */
      const response =
        await fetch(
          `${apiBase}/pdf/make-searchable`,
          {
            method: "POST",
            body: formData,
          }
        );

      if (!response.ok) {
        let message =
          "Could not prepare the PDF.";

        try {
          const data =
            await response.json();

          if (data.detail) {
            message =
              String(data.detail);
          }
        } catch {
          // Ignore JSON parsing errors.
        }

        throw new Error(message);
      }

      /*
       * IMPORTANT:
       * Store the searchable PDF as a real File.
       *
       * This is the file that will be sent directly
       * to /pdf/edit later.
       */
      const blob =
        await response.blob();

      const preparedFile =
        new File(
          [blob],
          selectedFile.name,
          {
            type: "application/pdf",
          }
        );

      setFile(selectedFile);
      setCurrentPdfFile(
        preparedFile
      );

      showPdfFile(
        preparedFile
      );

      setStatus(
        "PDF ready. Drag across text to select it."
      );
    } catch (err) {
      onError(
        err instanceof Error
          ? err.message
          : "Could not prepare the PDF."
      );

      setFile(null);
      setCurrentPdfFile(null);
      setPdfUrl(null);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================================
  // PDF LOADED
  // ==========================================================

  const handleDocumentLoad = ({
    numPages,
  }: {
    numPages: number;
  }) => {
    setPageCount(numPages);
  };

  // ==========================================================
  // PAGE LOADED
  // ==========================================================

  const handlePageLoad = (
    page: any
  ) => {
    /*
     * React-PDF gives us the rendered page.
     *
     * page.view contains the actual PDF dimensions:
     *
     * [x, y, width, height]
     */

    const view =
      page.view;

    if (
      Array.isArray(view) &&
      view.length >= 4
    ) {
      setPageInfo({
        width:
          Number(view[2]),
        height:
          Number(view[3]),
      });

      return;
    }

    /*
     * Fallback.
     */

    if (
      page.width &&
      page.height
    ) {
      setPageInfo({
        width:
          Number(page.width),
        height:
          Number(page.height),
      });
    }
  };

  // ==========================================================
  // SELECT TEXT
  // ==========================================================

  const handleTextSelection = () => {
    const browserSelection =
      window.getSelection();

    if (
      !browserSelection ||
      browserSelection.rangeCount === 0
    ) {
      return;
    }

    const selectedText =
      browserSelection
        .toString()
        .trim();

    if (!selectedText) {
      return;
    }

    const range =
      browserSelection.getRangeAt(
        0
      );

    const commonNode =
      range.commonAncestorContainer;

    const element =
      commonNode.nodeType ===
      Node.ELEMENT_NODE
        ? (commonNode as Element)
        : commonNode.parentElement;

    const pageElement =
      element?.closest(
        ".pdf-editor-page"
      ) as HTMLElement | null;

    if (!pageElement) {
      return;
    }

    const pageRect =
      pageElement.getBoundingClientRect();

    const selectionRect =
      range.getBoundingClientRect();

    /*
     * Convert browser coordinates into
     * actual PDF points.
     */

    const naturalWidth =
      pageInfo?.width ||
      595;

    const naturalHeight =
      pageInfo?.height ||
      842;

    const scaleX =
      naturalWidth /
      pageRect.width;

    const scaleY =
      naturalHeight /
      pageRect.height;

    const x =
      (
        selectionRect.left -
        pageRect.left
      ) * scaleX;

    const y =
      (
        selectionRect.top -
        pageRect.top
      ) * scaleY;

    const width =
      selectionRect.width *
      scaleX;

    const height =
      selectionRect.height *
      scaleY;

    setSelection({
      page: currentPage,
      text: selectedText,
      x: Math.max(0, x),
      y: Math.max(0, y),
      width: Math.max(1, width),
      height: Math.max(1, height),
    });

    setReplacement(
      selectedText
    );

    setStatus(
      "Text selected. Edit it on the right."
    );
  };

  // ==========================================================
  // APPLY CHANGE
  // ==========================================================

  const applyChange = async () => {
    if (
      !file ||
      !currentPdfFile ||
      !selection
    ) {
      onError(
        "Select text from the PDF first."
      );
      return;
    }

    if (
      !replacement.trim()
    ) {
      onError(
        "Replacement text cannot be empty."
      );
      return;
    }

    if (
      replacement ===
      selection.text
    ) {
      setStatus(
        "No change was made."
      );
      return;
    }

    setLoading(true);
    onError(null);

    setStatus(
      "Applying your change..."
    );

    try {
      /*
       * IMPORTANT FIX:
       *
       * Do NOT fetch(pdfUrl).
       *
       * pdfUrl is only a browser preview URL.
       * We already have the real PDF File in
       * currentPdfFile, so send that directly.
       */

      const formData =
        new FormData();

      formData.append(
        "file",
        currentPdfFile
      );

      formData.append(
        "edits",
        JSON.stringify([
          {
            page:
              selection.page,

            old_text:
              selection.text,

            new_text:
              replacement,

            x:
              selection.x,

            y:
              selection.y,

            width:
              selection.width,

            height:
              selection.height,
          },
        ])
      );

      const response =
        await fetch(
          `${apiBase}/pdf/edit`,
          {
            method: "POST",
            body: formData,
          }
        );

      if (!response.ok) {
        let message =
          "Could not apply the PDF edit.";

        try {
          const data =
            await response.json();

          if (data.detail) {
            message =
              String(data.detail);
          }
        } catch {
          // Ignore JSON parsing errors.
        }

        throw new Error(message);
      }

      /*
       * The backend returns the newly edited PDF.
       */

      const editedBlob =
        await response.blob();

      /*
       * Convert it into a real File.
       *
       * This is important because the user may
       * make another edit immediately afterwards.
       */
      const editedFile =
        new File(
          [editedBlob],
          file.name,
          {
            type: "application/pdf",
          }
        );

      /*
       * Replace the current working PDF.
       *
       * Future edits will therefore operate
       * on this newly edited version.
       */
      setCurrentPdfFile(
        editedFile
      );

      showPdfFile(
        editedFile
      );

      setSelection(null);
      setReplacement("");

      setStatus(
        "Change applied successfully. You can select another piece of text."
      );
    } catch (err) {
      onError(
        err instanceof Error
          ? err.message
          : "Could not apply the PDF edit."
      );

      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================================
  // DOWNLOAD
  // ==========================================================

  const downloadPdf = () => {
    if (!currentPdfFile) {
      return;
    }

    const downloadUrl =
      URL.createObjectURL(
        currentPdfFile
      );

    const link =
      document.createElement(
        "a"
      );

    link.href =
      downloadUrl;

    link.download =
      "toolbox-edited.pdf";

    document.body.appendChild(
      link
    );

    link.click();

    document.body.removeChild(
      link
    );

    URL.revokeObjectURL(
      downloadUrl
    );
  };

  // ==========================================================
  // RESET
  // ==========================================================

  const resetEditor = () => {
    if (pdfUrl) {
      URL.revokeObjectURL(
        pdfUrl
      );
    }

    setFile(null);
    setCurrentPdfFile(null);
    setPdfUrl(null);
    setPageCount(0);
    setCurrentPage(1);
    setPageInfo(null);
    setSelection(null);
    setReplacement("");
    setStatus(null);

    onError(null);
  };

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <section className="mx-auto max-w-[1500px] px-4 pb-12 pt-8 md:px-6">

      {/* ====================================================
          HEADER
          ==================================================== */}

      <div className="mb-7 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">

        <div>

          <p className="text-xs font-semibold tracking-[0.2em] text-black/40">
            PDF TOOL
          </p>

          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.035em] md:text-5xl">
            Edit PDFs naturally.
          </h1>

          <p className="mt-4 max-w-2xl text-base leading-7 text-black/50">
            Select the exact text you want
            to change, edit it, and export
            the updated PDF.
          </p>

        </div>

        {file && (
          <div className="flex gap-2">

            <button
              onClick={
                resetEditor
              }
              className="rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-semibold transition hover:border-black/20"
            >
              New PDF
            </button>

            <button
              onClick={
                downloadPdf
              }
              disabled={
                !currentPdfFile ||
                loading
              }
              className="rounded-full bg-black px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              Download Edited PDF
            </button>

          </div>
        )}

      </div>

      {/* ====================================================
          UPLOAD
          ==================================================== */}

      {!file && (
        <label className="block cursor-pointer rounded-3xl border border-dashed border-black/20 bg-white p-14 text-center transition hover:border-black/40">

          <input
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(event) => {

              const selected =
                event.target.files?.[0] ||
                null;

              handleFileUpload(
                selected
              );

              event.target.value =
                "";
            }}
          />

          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-black text-sm font-bold text-white">
            PDF
          </div>

          <h2 className="mt-5 text-xl font-semibold">
            {loading
              ? "Preparing PDF..."
              : "Upload a PDF"}
          </h2>

          <p className="mt-2 text-sm text-black/45">
            Normal and scanned PDFs
            are supported.
          </p>

        </label>
      )}

      {/* ====================================================
          EDITOR
          ==================================================== */}

      {file &&
        pdfUrl && (
          <div className="grid gap-5 lg:grid-cols-[95px_minmax(0,1fr)_330px]">

            {/* =================================================
                PAGE NAVIGATION
                ================================================= */}

            <aside className="h-fit rounded-3xl border border-black/10 bg-white p-3 lg:sticky lg:top-5">

              <div className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-wider text-black/35">
                Pages
              </div>

              <div className="flex gap-2 overflow-x-auto lg:max-h-[75vh] lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden">

                {Array.from(
                  {
                    length:
                      pageCount,
                  },
                  (_, index) => {

                    const page =
                      index + 1;

                    return (
                      <button
                        key={page}
                        onClick={() => {

                          setCurrentPage(
                            page
                          );

                          setSelection(
                            null
                          );

                          setReplacement(
                            ""
                          );
                        }}
                        className={`flex min-w-[65px] flex-col items-center rounded-2xl border p-3 text-center transition ${
                          currentPage ===
                          page
                            ? "border-black bg-black text-white"
                            : "border-black/10 bg-[#f7f7f5] hover:border-black/25"
                        }`}
                      >

                        <span className="text-xs font-semibold">
                          {page}
                        </span>

                      </button>
                    );
                  }
                )}

              </div>

            </aside>

            {/* =================================================
                PDF VIEWER
                ================================================= */}

            <div className="min-w-0 overflow-auto rounded-3xl border border-black/10 bg-[#dcdcd8] p-4 md:p-6">

              <Document
                file={pdfUrl}
                onLoadSuccess={
                  handleDocumentLoad
                }
                onLoadError={(loadError) => {

                  onError(
                    `Could not render PDF: ${loadError.message}`
                  );

                }}
                loading={
                  <div className="flex min-h-[650px] items-center justify-center text-sm text-black/40">
                    Loading PDF...
                  </div>
                }
              >

                <div
                  ref={
                    pageContainerRef
                  }
                  className="pdf-editor-page relative mx-auto w-fit bg-white shadow-2xl"
                  data-page={
                    currentPage
                  }
                >

                  <Page
                    pageNumber={
                      currentPage
                    }
                    width={
                      displayWidth
                    }
                    renderTextLayer={
                      true
                    }
                    renderAnnotationLayer={
                      true
                    }
                    onLoadSuccess={
                      handlePageLoad
                    }
                    onMouseUp={
                      handleTextSelection
                    }
                  />

                </div>

              </Document>

            </div>

            {/* =================================================
                EDIT PANEL
                ================================================= */}

            <aside className="h-fit rounded-3xl border border-black/10 bg-white p-6 lg:sticky lg:top-5">

              <p className="text-xs font-semibold uppercase tracking-wider text-black/35">
                Edit Selection
              </p>

              {!selection ? (

                <div className="mt-5">

                  <div className="rounded-2xl bg-[#f7f7f5] p-5">

                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black text-sm text-white">
                      ✎
                    </div>

                    <h3 className="mt-4 text-base font-semibold">
                      Select text to edit
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-black/50">
                      Drag your mouse across
                      any text inside the PDF.
                      Your selection will
                      appear here.
                    </p>

                  </div>

                  {status && (
                    <div className="mt-4 rounded-2xl bg-[#f7f7f5] p-4 text-xs leading-5 text-black/55">
                      {status}
                    </div>
                  )}

                </div>

              ) : (

                <>

                  <div className="mt-4">

                    <p className="text-[10px] font-semibold uppercase tracking-wider text-black/35">
                      Selected text
                    </p>

                    <div className="mt-2 max-h-32 overflow-auto rounded-2xl bg-[#f7f7f5] p-4 text-sm leading-6 text-black/65">
                      {selection.text}
                    </div>

                    <p className="mt-3 text-xs text-black/35">
                      Page{" "}
                      {selection.page}
                    </p>

                  </div>

                  <label className="mt-5 block text-xs font-semibold text-black/50">
                    Replace with
                  </label>

                  <textarea
                    value={
                      replacement
                    }
                    onChange={(
                      event
                    ) =>
                      setReplacement(
                        event.target
                          .value
                      )
                    }
                    rows={6}
                    className="mt-2 w-full resize-y rounded-2xl border border-black/10 bg-[#fafafa] p-4 text-sm leading-6 outline-none transition focus:border-black/30"
                    autoFocus
                  />

                  <button
                    onClick={
                      applyChange
                    }
                    disabled={
                      loading
                    }
                    className="mt-4 w-full rounded-2xl bg-black px-5 py-4 text-sm font-semibold text-white transition hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading
                      ? "Applying..."
                      : "Apply Change"}
                  </button>

                  <button
                    onClick={() => {

                      setSelection(
                        null
                      );

                      setReplacement(
                        ""
                      );

                      setStatus(
                        "Selection cleared."
                      );

                    }}
                    className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-5 py-3 text-sm font-semibold transition hover:border-black/20"
                  >
                    Cancel
                  </button>

                  {status && (
                    <div className="mt-4 rounded-2xl bg-[#f7f7f5] p-4 text-xs leading-5 text-black/55">
                      {status}
                    </div>
                  )}

                </>

              )}

              {error && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs leading-5 text-red-700">

                  <span className="font-semibold">
                    Error:
                  </span>{" "}

                  {error}

                </div>
              )}

            </aside>

          </div>
        )}

    </section>
  );
}