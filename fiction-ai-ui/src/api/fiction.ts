import { apiFetch } from './client'
import type {
    ActiveBookData,
    CreateBookData,
    CreateBookRequest,
    CreateSnippetData,
    CreateSnippetRequest,
    GenerateChapterData,
    GenerateChapterRequest,
    GenerateAllChaptersData,
    GenerateAllChaptersRequest,
    GenerateOutlineData,
    GenerateOutlineRequest,
    UpdateBookRequest,
    GetBookData,
    GetChapterData,
    GetOutlineData,
    ListBooksData,
    ListChaptersData,
    SearchSnippetsData,
    SetActiveBookData,
    SetActiveBookRequest,
    StatusData,
} from '../types'

export const fictionApi = {
    status: () => apiFetch<StatusData>('/api/status'),

    listBooks: () => apiFetch<ListBooksData>('/api/books'),
    createBook: (req: CreateBookRequest) =>
        apiFetch<CreateBookData>('/api/books', {
            method: 'POST',
            body: JSON.stringify(req),
        }),

    getActiveBook: () => apiFetch<ActiveBookData>('/api/books/active'),
    setActiveBook: (req: SetActiveBookRequest) =>
        apiFetch<SetActiveBookData>('/api/books/active', {
            method: 'PUT',
            body: JSON.stringify(req),
        }),

    getBook: (book_id: string) => apiFetch<GetBookData>(`/api/books/${book_id}`),

    updateBook: (book_id: string, req: UpdateBookRequest) =>
        apiFetch<{ book_id: string; title?: string; premise?: string }>(`/api/books/${book_id}`, {
            method: 'PATCH',
            body: JSON.stringify(req),
        }),

    deleteBook: (book_id: string) =>
        apiFetch<{ book_id: string; message: string }>(`/api/books/${book_id}`, {
            method: 'DELETE',
        }),

    getOutline: (book_id: string) => apiFetch<GetOutlineData>(`/api/books/${book_id}/outline`),
    generateOutline: (book_id: string, req?: GenerateOutlineRequest) =>
        apiFetch<GenerateOutlineData>(`/api/books/${book_id}/outline`, {
            method: 'POST',
            body: JSON.stringify(req ?? {}),
        }),

    listChapters: (book_id: string) => apiFetch<ListChaptersData>(`/api/books/${book_id}/chapters`),
    getChapter: (book_id: string, number: number) =>
        apiFetch<GetChapterData>(`/api/books/${book_id}/chapters/${number}`),
    generateChapter: (book_id: string, req: GenerateChapterRequest) =>
        apiFetch<GenerateChapterData>(`/api/books/${book_id}/chapters`, {
            method: 'POST',
            body: JSON.stringify(req),
        }),
    generateAllChapters: (book_id: string, req?: GenerateAllChaptersRequest) =>
        apiFetch<GenerateAllChaptersData>(`/api/books/${book_id}/chapters/all`, {
            method: 'POST',
            body: JSON.stringify(req ?? {}),
        }),

    createSnippet: (req: CreateSnippetRequest) =>
        apiFetch<CreateSnippetData>('/api/snippets', {
            method: 'POST',
            body: JSON.stringify(req),
        }),

    searchSnippets: (q: string, params?: { book_id?: string | null; limit?: number }) => {
        const usp = new URLSearchParams()
        usp.set('q', q)
        if (params && 'book_id' in params) {
            const v = params.book_id
            if (v !== undefined) usp.set('book_id', v === null ? '' : v)
        }
        if (params?.limit != null) usp.set('limit', String(params.limit))

        // NOTE: if book_id isn't provided, backend defaults to active book.
        // We keep query param empty-string behavior to let backend treat it as "explicit".
        return apiFetch<SearchSnippetsData>(`/api/snippets/search?${usp.toString()}`)
    },

    toggleBookPublic: (book_id: string, is_public: boolean) =>
        apiFetch<{ book_id: string; is_public: boolean }>(`/api/books/${book_id}/public`, {
            method: 'PATCH',
            body: JSON.stringify({ is_public }),
        }),
}
