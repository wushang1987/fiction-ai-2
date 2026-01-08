import { useEffect, useRef, useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { fictionApi } from "./api/fiction";
import type { BookRef, ChapterRef, Snippet } from "./types";

// Components
import { AppLayout } from "./components/layout/AppLayout";
import { Sidebar } from "./components/layout/Sidebar";
import { BookList } from "./components/features/books/BookList";
import { CreateBookForm } from "./components/features/books/CreateBookForm";
import { OutlineView } from "./components/features/outline/OutlineView";
import { ChapterList } from "./components/features/chapters/ChapterList";
import { ChapterEditor } from "./components/features/chapters/ChapterEditor";
import { SnippetManager } from "./components/features/snippets/SnippetManager";
import { ThemeToggle } from "./components/layout/ThemeToggle";

// Auth Pages
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { VerifyEmail } from "./pages/VerifyEmail";
import { useAuth } from "./contexts/AuthContext";

import { Toaster } from "sonner";

type LoadState = "idle" | "loading" | "error";
type View = "dashboard" | "write" | "outline" | "snippets";

function MainEditor() {
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [statusText, setStatusText] = useState<string>("");

  const [booksState, setBooksState] = useState<LoadState>("idle");
  const [books, setBooks] = useState<BookRef[]>([]);
  const [activeBookId, setActiveBookId] = useState<string | null>(null);

  const [outlineState, setOutlineState] = useState<LoadState>("idle");
  const [outlineMarkdown, setOutlineMarkdown] = useState<string | null>(null);

  const [chaptersState, setChaptersState] = useState<LoadState>("idle");
  const [chapters, setChapters] = useState<ChapterRef[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<{ number: number; title: string; } | null>(null);
  const [chapterMarkdown, setChapterMarkdown] = useState<string>("");

  const [chapterInstruction, setChapterInstruction] = useState<string>("");
  const [streamingAll, setStreamingAll] = useState(false);
  const streamSourceRef = useRef<EventSource | null>(null);
  const pendingTextRef = useRef<string>("");
  const typingTimerRef = useRef<number | null>(null);

  const [snippetState, setSnippetState] = useState<LoadState>("idle");
  const [snippetResults, setSnippetResults] = useState<Snippet[]>([]);

  // --- Theme ---
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  // --- API ---
  async function refreshStatus() {
    try {
      const s = await fictionApi.status();
      setStatusText(s.llm_configured ? "WriterLLM: Online" : "WriterLLM: Offline");
    } catch (e) {
      setStatusText("System Offline");
    }
  }

  async function refreshBooks() {
    setBooksState("loading");
    try {
      const data = await fictionApi.listBooks();
      setBooks(data.books);
      setActiveBookId(data.active_book_id);
      setBooksState("idle");
    } catch (e) {
      setBooksState("error");
    }
  }

  async function setActive(book_id: string) {
    try {
      const data = await fictionApi.setActiveBook({ book_id });
      setActiveBookId(data.active_book_id);
    } catch (e) { }
  }

  async function createBook(data: { premise: string; genre: string; targetWords: string }) {
    setBooksState("loading");
    try {
      const tw = data.targetWords.trim() ? Number(data.targetWords) : null;
      const res = await fictionApi.createBook({
        premise: data.premise,
        genre: data.genre || undefined,
        target_words: tw,
        generate_outline: true,
        set_active: true
      });
      setActiveBookId(res.active_book_id);
      setOutlineMarkdown(res.outline?.outline_markdown ?? null);
      await refreshBooks();
      setActiveView("outline");
    } catch (e) {
      setBooksState("idle");
    }
  }

  async function refreshOutline() {
    if (!activeBookId) return;
    setOutlineState("loading");
    try {
      const data = await fictionApi.getOutline(activeBookId);
      setOutlineMarkdown(data.outline_markdown);
      setOutlineState("idle");
    } catch (e) {
      setOutlineState("error");
    }
  }

  async function generateOutline() {
    if (!activeBookId) return;
    setOutlineState("loading");
    try {
      const data = await fictionApi.generateOutline(activeBookId);
      setOutlineMarkdown(data.outline_markdown);
      setOutlineState("idle");
    } catch (e) {
      setOutlineState("error");
    }
  }

  async function refreshChapters() {
    if (!activeBookId) return;
    setChaptersState("loading");
    try {
      const data = await fictionApi.listChapters(activeBookId);
      setChapters(data.chapters);
      setChaptersState("idle");
    } catch (e) {
      setChaptersState("error");
    }
  }

  async function openChapter(ch: ChapterRef) {
    if (!activeBookId) return;
    try {
      const data = await fictionApi.getChapter(activeBookId, ch.number);
      setSelectedChapter({ number: data.number, title: data.title });
      setChapterMarkdown(data.content_markdown);
    } catch (e) { }
  }

  async function generateChapter(mode: "next" | "number", specificNum?: number) {
    if (!activeBookId) return;
    setChaptersState("loading");
    try {
      const data = await fictionApi.generateChapter(activeBookId, {
        number: mode === "number" ? specificNum : undefined,
        instruction: chapterInstruction.trim() || undefined
      });
      setSelectedChapter({ number: data.chapter.number, title: data.chapter.title });
      setChapterMarkdown(data.chapter.content_markdown);
      await refreshChapters();
      setChaptersState("idle");
    } catch (e) {
      setChaptersState("error");
    }
  }

  async function generateAllChaptersStream() {
    if (!activeBookId || streamingAll) return;
    setChaptersState("loading");
    setChapterMarkdown("");
    setSelectedChapter(null);

    const usp = new URLSearchParams();
    const inst = chapterInstruction.trim();
    if (inst) usp.set("instruction", inst);
    const url = `/api/books/${activeBookId}/chapters/all/stream?${usp.toString()}`;

    pendingTextRef.current = "";
    if (!typingTimerRef.current) {
      typingTimerRef.current = window.setInterval(() => {
        if (pendingTextRef.current.length > 0) {
          const char = pendingTextRef.current[0];
          pendingTextRef.current = pendingTextRef.current.slice(1);
          setChapterMarkdown(p => p + char);
        }
      }, 15);
    }

    const es = new EventSource(url);
    streamSourceRef.current = es;
    setStreamingAll(true);

    es.addEventListener("chapter_start", (evt) => {
      const data = JSON.parse((evt as MessageEvent).data);
      setSelectedChapter({ number: data.number, title: data.title });
      setChapterMarkdown("");
      pendingTextRef.current = "";
    });

    es.addEventListener("chapter_token", (evt) => {
      const data = JSON.parse((evt as MessageEvent).data);
      if (data.delta) pendingTextRef.current += data.delta;
    });

    es.addEventListener("done", async () => {
      es.close();
      setStreamingAll(false);
      window.clearInterval(typingTimerRef.current!);
      typingTimerRef.current = null;
      await refreshChapters();
      setChaptersState("idle");
    });

    es.addEventListener("error", () => {
      es.close();
      setStreamingAll(false);
      setChaptersState("error");
      window.clearInterval(typingTimerRef.current!);
      typingTimerRef.current = null;
    });
  }

  async function saveSnippet(text: string) {
    setSnippetState("loading");
    try {
      await fictionApi.createSnippet({ text, book_id: activeBookId ?? undefined });
      setSnippetState("idle");
    } catch (e) {
      setSnippetState("error");
    }
  }

  async function searchSnippets(q: string) {
    setSnippetState("loading");
    try {
      const data = await fictionApi.searchSnippets(q);
      setSnippetResults(data.snippets);
      setSnippetState("idle");
    } catch (e) {
      setSnippetState("error");
    }
  }

  useEffect(() => {
    refreshStatus();
    refreshBooks();
  }, []);

  useEffect(() => {
    if (activeBookId) {
      refreshOutline();
      refreshChapters();
    }
  }, [activeBookId]);

  const viewTitles = {
    dashboard: "Library",
    outline: "Book Outline",
    write: "Writer Room",
    snippets: "Text Snippets"
  };

  return (
    <AppLayout
      sidebar={<Sidebar activeTab={activeView} onTabChange={setActiveView} statusText={statusText} />}
    >
      <div className="space-y-8 pb-20">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{viewTitles[activeView]}</h1>
            <p className="text-muted-foreground mt-1">AI-Powered Novel Writing Assistant</p>
          </div>
          <ThemeToggle isDarkMode={isDarkMode} onToggle={toggleTheme} />
        </header>

        <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          {activeView === "dashboard" && (
            <div className="space-y-12">
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Active Books</h3>
                <BookList books={books} activeBookId={activeBookId} onSetActive={setActive} isLoading={booksState === "loading"} />
              </div>
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Start New Project</h3>
                <CreateBookForm onSubmit={createBook} isLoading={booksState === "loading"} />
              </div>
            </div>
          )}

          {activeView === "outline" && (
            <OutlineView markdown={outlineMarkdown} isLoading={outlineState === "loading"} onGenerate={generateOutline} onRefresh={refreshOutline} hasActiveBook={!!activeBookId} />
          )}

          {activeView === "write" && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 h-[700px]">
              <div className="lg:col-span-1 min-w-0">
                <ChapterList chapters={chapters} activeChapterNumber={selectedChapter?.number ?? null} onSelect={openChapter} isLoading={chaptersState === "loading"} />
              </div>
              <div className="lg:col-span-3 min-w-0">
                {activeBookId ? (
                  <ChapterEditor
                    chapterNumber={selectedChapter?.number ?? 0}
                    title={selectedChapter?.title ?? ""}
                    markdown={chapterMarkdown}
                    isLoading={chaptersState === "loading"}
                    isStreaming={streamingAll}
                    instruction={chapterInstruction}
                    onInstructionChange={setChapterInstruction}
                    onGenerateNext={() => generateChapter("next")}
                    onGenerateSpecific={(n) => generateChapter("number", n)}
                    onGenerateAll={() => { }}
                    onGenerateAllStream={generateAllChaptersStream}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400">
                    Select a book from the Library to start writing.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeView === "snippets" && (
            <SnippetManager snippets={snippetResults} isSaving={snippetState === "loading"} isSearching={snippetState === "loading"} onSave={saveSnippet} onSearch={searchSnippets} />
          )}
        </section>
      </div>
      <Toaster position="bottom-right" richColors />
    </AppLayout>
  );
}

function App() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
      <Route path="/register" element={!user ? <Register /> : <Navigate to="/" />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route
        path="/*"
        element={
          user ? (
            <MainEditor />
          ) : (
            <Navigate to="/login" state={{ from: location }} />
          )
        }
      />
    </Routes>
  );
}

export default App;
