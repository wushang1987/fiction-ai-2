import { useEffect, useRef, useState } from "react";
import { Routes, Route, Navigate, useParams, useNavigate, useLocation } from "react-router-dom";
import { fictionApi } from "./api/fiction";
import { cn } from "./lib/utils";
import { Button } from "./components/ui/button";
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
import { Home } from "./pages/Home";
import { ReadingPage } from "./pages/ReadingPage";
import { useAuth } from "./contexts/AuthContext";

import { Toaster } from "sonner";

import { Check, Globe, Lock, Pencil, X } from "lucide-react";

type LoadState = "idle" | "loading" | "error";
type View = "dashboard" | "snippets" | "home";

function MainEditor() {
  const { user } = useAuth();
  const { bookId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Derive view and tab from URL
  const activeView: View = location.pathname.startsWith("/snippets") ? "snippets" : "dashboard";
  const activeBookTab: "outline" | "write" | "read" = location.pathname.endsWith("/write") ? "write" : (location.pathname.endsWith("/read") ? "read" : "outline");

  const [statusText, setStatusText] = useState<string>("");

  const [booksState, setBooksState] = useState<LoadState>("idle");
  const [books, setBooks] = useState<BookRef[]>([]);

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

  const [headerEditing, setHeaderEditing] = useState(false);
  const [headerTitle, setHeaderTitle] = useState("");

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

      // In URL-driven mode, we don't need to manually track activeBookId
      // because it's derived from useParams()
      setBooksState("idle");
    } catch (e) {
      setBooksState("error");
    }
  }

  async function setActive(book_id: string) {
    try {
      await fictionApi.setActiveBook({ book_id });
      // Navigate to the book outline view
      navigate(`/books/${book_id}/outline`);
    } catch (e) { }
  }

  async function createBook(data: { premise: string; genre: string; targetWords: string }) {
    setBooksState("loading");
    setOutlineMarkdown("");
    try {
      const tw = data.targetWords.trim() ? Number(data.targetWords) : null;
      const response = await fetch("/api/books/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("fiction_ai_token")}`
        },
        body: JSON.stringify({
          premise: data.premise,
          genre: data.genre || undefined,
          target_words: tw,
          generate_outline: true,
          set_active: true
        })
      });

      if (!response.ok) throw new Error("Stream request failed");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (!reader) return;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            const splitIndex = line.indexOf("\ndata: ");
            if (splitIndex === -1) continue;
            const event = line.slice(7, splitIndex);
            const dataStr = line.slice(splitIndex + 7);

            try {
              const payload = JSON.parse(dataStr);
              if (event === "book_created") {
                await refreshBooks();
                navigate(`/books/${payload.active_book_id}/outline`);
                setOutlineState("loading");
              } else if (event === "outline_chunk") {
                setOutlineMarkdown(prev => (prev || "") + payload.delta);
                setOutlineState("idle");
              } else if (event === "done") {
                setBooksState("idle");
                setOutlineState("idle");
              } else if (event === "error") {
                console.error("Stream error:", payload.message);
                setBooksState("error");
                setOutlineState("error");
              }
            } catch (e) {
              console.error("Error parsing SSE data", e);
            }
          }
        }
      }
    } catch (e) {
      console.error("Create book failed:", e);
      setBooksState("error");
    }
  }

  async function refreshOutline() {
    if (!bookId) return;
    setOutlineState("loading");
    try {
      const data = await fictionApi.getOutline(bookId);
      setOutlineMarkdown(data.outline_markdown);
      setOutlineState("idle");
    } catch (e) {
      setOutlineState("error");
    }
  }

  async function generateOutline() {
    if (!bookId) return;
    setOutlineState("loading");
    setOutlineMarkdown("");
    try {
      const response = await fetch(`/api/books/${bookId}/outline/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("fiction_ai_token")}`
        },
        body: JSON.stringify({})
      });

      if (!response.ok) throw new Error("Stream request failed");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (!reader) return;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            const splitIndex = line.indexOf("\ndata: ");
            if (splitIndex === -1) continue;
            const event = line.slice(7, splitIndex);
            const dataStr = line.slice(splitIndex + 7);

            try {
              const payload = JSON.parse(dataStr);
              if (event === "outline_chunk") {
                setOutlineMarkdown(prev => (prev || "") + payload.delta);
                setOutlineState("idle");
              } else if (event === "done") {
                setOutlineState("idle");
              } else if (event === "error") {
                console.error("Stream error:", payload.message);
                setOutlineState("error");
              }
            } catch (e) {
              console.error("Error parsing SSE data", e);
            }
          }
        }
      }
    } catch (e) {
      console.error("Generate outline failed:", e);
      setOutlineState("error");
    }
  }

  async function refreshChapters() {
    if (!bookId) return;
    setChaptersState("loading");
    try {
      const data = await fictionApi.listChapters(bookId);
      setChapters(data.chapters);
      setChaptersState("idle");
    } catch (e) {
      setChaptersState("error");
    }
  }

  async function openChapter(ch: ChapterRef) {
    if (!bookId) return;
    try {
      const data = await fictionApi.getChapter(bookId, ch.number);
      setSelectedChapter({ number: data.number, title: data.title });
      setChapterMarkdown(data.content_markdown);
    } catch (e) { }
  }

  async function generateChapter(mode: "next" | "number", specificNum?: number) {
    if (!bookId) return;
    setChaptersState("loading");
    try {
      const data = await fictionApi.generateChapter(bookId, {
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
    if (!bookId || streamingAll) return;
    setChaptersState("loading");
    setChapterMarkdown("");
    setSelectedChapter(null);

    const usp = new URLSearchParams();
    const inst = chapterInstruction.trim();
    if (inst) usp.set("instruction", inst);
    const url = `/api/books/${bookId}/chapters/all/stream?${usp.toString()}`;

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
      await fictionApi.createSnippet({ text, book_id: bookId ?? undefined });
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
  }, [user]);

  useEffect(() => {
    if (bookId) {
      refreshOutline();
      refreshChapters();
    }
  }, [bookId]);

  async function togglePublic(book_id: string, is_public: boolean) {
    try {
      await fictionApi.toggleBookPublic(book_id, is_public);
      await refreshBooks();
    } catch (e) { }
  }

  async function updateBookTitle(book_id: string, title: string) {
    try {
      await fictionApi.updateBook(book_id, { title });
      await refreshBooks();
    } catch (e) { }
  }

  async function deleteBook(book_id: string) {
    if (!window.confirm("Are you sure you want to delete this book? This action cannot be undone.")) return;
    try {
      await fictionApi.deleteBook(book_id);
      if (bookId === book_id) {
        navigate("/dashboard");
      }
      await refreshBooks();
    } catch (e) { }
  }

  const viewTitles = {
    home: "Discover",
    dashboard: "My Library",
    snippets: "Text Snippets"
  };

  const handleTabChange = (tab: "dashboard" | "snippets" | "home") => {
    if (tab === "home") {
      navigate("/");
    } else {
      navigate(`/${tab}`);
    }
  };

  return (
    <AppLayout
      sidebar={<Sidebar activeTab={activeView} onTabChange={handleTabChange} statusText={statusText} />}
    >
      <div className="space-y-8 pb-20">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {activeView === "dashboard" && bookId ? (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    {headerEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={headerTitle}
                          onChange={(e) => setHeaderTitle(e.target.value)}
                          className="bg-background border border-border rounded px-2 py-1 text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-primary/50"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              updateBookTitle(bookId, headerTitle);
                              setHeaderEditing(false);
                            }
                            if (e.key === "Escape") setHeaderEditing(false);
                          }}
                        />
                        <Button size="icon" variant="ghost" onClick={() => { updateBookTitle(bookId, headerTitle); setHeaderEditing(false); }}>
                          <Check className="h-5 w-5 text-emerald-500" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setHeaderEditing(false)}>
                          <X className="h-5 w-5 text-destructive" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 group/header">
                        <span>{books.find(b => b.book_id === bookId)?.title || "Book Detail"}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover/header:opacity-100 transition-opacity"
                          onClick={() => {
                            const b = books.find(bx => bx.book_id === bookId);
                            if (b) {
                              setHeaderTitle(b.title);
                              setHeaderEditing(true);
                            }
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground ml-2"
                          onClick={() => {
                            const b = books.find(bx => bx.book_id === bookId);
                            if (b) togglePublic(bookId, !b.is_public);
                          }}
                        >
                          {books.find(b => b.book_id === bookId)?.is_public ? (
                            <Globe className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <Lock className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="flex bg-muted rounded-lg p-1">
                    <button
                      onClick={() => navigate(`/books/${bookId}/outline`)}
                      className={cn(
                        "px-4 py-1.5 text-sm font-medium rounded-md transition-all",
                        activeBookTab === "outline" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Outline
                    </button>
                    <button
                      onClick={() => navigate(`/books/${bookId}/write`)}
                      className={cn(
                        "px-4 py-1.5 text-sm font-medium rounded-md transition-all",
                        activeBookTab === "write" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Writer
                    </button>
                    <button
                      onClick={() => navigate(`/books/${bookId}/read`)}
                      className={cn(
                        "px-4 py-1.5 text-sm font-medium rounded-md transition-all",
                        activeBookTab === "read" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Read
                    </button>
                  </div>
                </div>
              ) : viewTitles[activeView as keyof typeof viewTitles]}
            </h1>
            <p className="text-muted-foreground mt-1">AI-Powered Novel Writing Assistant</p>
          </div>
          <ThemeToggle isDarkMode={isDarkMode} onToggle={toggleTheme} />
        </header>

        <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          {activeView === "dashboard" && !bookId && (
            <div className="space-y-12">
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Active Books</h3>
                <BookList
                  books={books}
                  activeBookId={bookId ?? null}
                  onSetActive={setActive}
                  onTogglePublic={togglePublic}
                  onUpdateTitle={updateBookTitle}
                  onDelete={deleteBook}
                  isLoading={booksState === "loading"}
                />
              </div>
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Start New Project</h3>
                <CreateBookForm onSubmit={createBook} isLoading={booksState === "loading"} />
              </div>
            </div>
          )}

          {activeView === "dashboard" && bookId && (
            <div className="space-y-8">
              {activeBookTab === "outline" ? (
                <OutlineView markdown={outlineMarkdown} isLoading={outlineState === "loading"} onGenerate={generateOutline} onRefresh={refreshOutline} hasActiveBook={!!bookId} />
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 h-[700px]">
                  <div className="lg:col-span-1 min-w-0">
                    <ChapterList chapters={chapters} activeChapterNumber={selectedChapter?.number ?? null} onSelect={openChapter} isLoading={chaptersState === "loading"} />
                  </div>
                  <div className="lg:col-span-3 min-w-0">
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
                  </div>
                </div>
              )}
              <div className="pt-8 border-t border-border">
                <Button variant="ghost" onClick={() => navigate("/dashboard")} className="text-muted-foreground">
                  ← Back to Library
                </Button>
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
      <Route path="/" element={<Home />} />
      <Route path="/books/:bookId/read/:chapterNumber?" element={<ReadingPage />} />
      <Route
        path="/books/:bookId/*"
        element={<MainEditor />}
      />
      <Route
        path="/dashboard"
        element={user ? <MainEditor /> : <Navigate to="/login" />}
      />
      <Route path="/*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;
