export type ApiErrorCode =
    | 'VALIDATION_ERROR'
    | 'LLM_NOT_CONFIGURED'
    | 'BOOK_NOT_FOUND'
    | 'OUTLINE_MISSING'
    | 'OUTLINE_CHAPTERS_NOT_FOUND'
    | 'CHAPTER_NOT_FOUND'
    | 'CHAPTER_ALREADY_EXISTS'
    | 'NO_ACTIVE_BOOK'
    | 'INTERNAL_ERROR'

export type ApiError = {
    code: ApiErrorCode | string
    message: string
    details?: Record<string, unknown>
}

export type ApiOk<T> = {
    ok: true
    data: T
}

export type ApiErr = {
    ok: false
    error: ApiError
}

export type ApiResponse<T> = ApiOk<T> | ApiErr

export type BookRef = {
    book_id: string
    title: string
    slug: string
    status: string
    created_at: string
    updated_at: string
}

export type Book = {
    book_id: string
    title: string
    slug: string
    premise: string
    genre: string
    target_words: number | null
    style_guide: string
    created_at: string
    updated_at: string
    outline_exists: boolean
    chapters_count: number
}

export type ChapterRef = {
    number: number
    title: string
    updated_at: string
}

export type Snippet = {
    snippet_id: string
    book_id: string | null
    created_at: string
    title: string
    text: string
    tags: string[]
    source: string
    url: string | null
}

export type StatusData = {
    server_time: string
    llm_configured: boolean
    active_book_id: string | null
    project: {
        project_id: string
        schema_version: number
        created_at: string
    }
}

export type ListBooksData = {
    active_book_id: string | null
    books: BookRef[]
}

export type CreateBookRequest = {
    premise: string
    title?: string
    genre?: string
    target_words?: number | null
    style_guide?: string
    generate_outline?: boolean
    set_active?: boolean
}

export type CreateBookData = {
    book: Book
    active_book_id: string | null
    outline: { outline_markdown: string } | null
}

export type ActiveBookData = {
    active_book_id: string | null
    book: Book | null
}

export type SetActiveBookRequest = {
    book_id: string
}

export type SetActiveBookData = {
    active_book_id: string
    book: Book
}

export type GetBookData = {
    active_book_id: string | null
    book: Book
}

export type GetOutlineData = {
    book_id: string
    outline_exists: boolean
    outline_markdown: string | null
}

export type GenerateOutlineRequest = {
    instruction?: string
}

export type GenerateOutlineData = {
    book_id: string
    outline_markdown: string
}

export type ListChaptersData = {
    book_id: string
    chapters: ChapterRef[]
}

export type GetChapterData = {
    book_id: string
    number: number
    title: string
    content_markdown: string
}

export type GenerateChapterRequest = {
    number?: number | null
    instruction?: string
    target_chapter_words?: number | null
    retrieve_query?: string
    retrieve_limit?: number
    overwrite?: boolean
}

export type GenerateChapterData = {
    book_id: string
    chapter: {
        number: number
        title: string
        content_markdown: string
    }
    retrieved_snippets: Array<{ snippet_id: string }>
}

export type GenerateAllChaptersRequest = {
    instruction?: string
    target_chapter_words?: number | null
    retrieve_query?: string
    retrieve_limit?: number
    overwrite?: boolean
    start_number?: number | null
    end_number?: number | null
}

export type GenerateAllChaptersData = {
    book_id: string
    start_number: number
    end_number: number
    generated_numbers: number[]
    skipped_numbers: number[]
}

export type CreateSnippetRequest = {
    text: string
    title?: string
    tags?: string[]
    source?: string
    url?: string | null
    book_id?: string | null
}

export type CreateSnippetData = {
    snippet: Snippet
}

export type UserRegisterRequest = {
    email: string
    password: string
    full_name: string
}

export type UserLoginRequest = {
    email: string
    password: string
}

export type TokenResponse = {
    access_token: string
    token_type: string
    user: {
        user_id: string
        email: string
        full_name: string
    }
}
