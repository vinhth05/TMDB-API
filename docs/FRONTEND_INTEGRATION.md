# Hướng dẫn Tích hợp Frontend LoraFilm TMDB

API này hoạt động như một bộ chuyển đổi tích hợp (integration adapter) để chuẩn hóa các phản hồi từ TMDB thành định dạng tương thích hoàn toàn với luồng xử lý frontend của Movie Service thuộc hệ thống LoraFilm.

## Luồng Thao tác Đề xuất cho Admin
   
1. **Gọi API gợi ý tìm kiếm trong khi gõ:**
   ```http
   GET /api/import/search/suggestions?keyword=dune
   ```
   *Hiển thị một danh sách thả xuống tự động hoàn thành (autocomplete) nhanh với các poster dạng hình thu nhỏ (thumbnail).*

2. **Gọi API tìm kiếm để lấy danh sách kết quả đầy đủ:**
   ```http
   GET /api/import/search?keyword=dune&page=1
   ```
   *Sử dụng khi admin nhấn Enter để xem toàn bộ danh sách kết quả có phân trang.*

3. **Chọn tmdbId.** (ví dụ: `693134` cho Dune 2)

4. **Gọi API bundle (gói tổng hợp) một lần duy nhất:**
   ```http
   GET /api/import/movies/693134/bundle
   ```
   *Yêu cầu duy nhất này sẽ lấy toàn bộ thông tin chi tiết, dàn diễn viên (cast), đoàn làm phim (crew), hình ảnh, video, ngày phát hành và các bản dịch.*

5. **Điền dữ liệu vào form tạo phim (create-movie form):**
   *Sử dụng dữ liệu phản hồi để tự động điền tiêu đề, tóm tắt, poster chính, dàn diễn viên chính, ngày phát hành và các chứng nhận độ tuổi.*

6. **Cho phép admin chỉnh sửa.**
   *Admin có thể chỉnh sửa văn bản đã dịch, chọn một trailer khác hoặc điều chỉnh thứ tự diễn viên.*

7. **Gửi dữ liệu form đã chuẩn hóa tới Movie Service.**

## Ví dụ về TypeScript Interfaces

```typescript
export interface TmdbMovieSearchItem {
  tmdbId: number;
  title: string;
  originalTitle: string | null;
  overview: string | null;
  releaseDate: string | null;
  releaseYear: number | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  genreIds: number[];
  voteAverage: number;
  voteCount: number;
}

export interface TmdbMovieBundle {
  movie: TmdbMoviePreview;
  genres: TmdbGenre[];
  credits: {
    directors: TmdbPerson[];
    writers: TmdbPerson[];
    producers: TmdbPerson[];
    mainCast: TmdbCast[];
    supportingCast: TmdbCast[];
    crew: TmdbPerson[];
  };
  media: {
    primaryPoster: TmdbImage;
    primaryBackdrop: TmdbImage;
    posters: TmdbImage[];
    backdrops: TmdbImage[];
    logos: TmdbImage[];
  };
  videos: {
    primaryTrailer: TmdbVideo;
    trailers: TmdbVideo[];
    teasers: TmdbVideo[];
    clips: TmdbVideo[];
    featurettes: TmdbVideo[];
    other: TmdbVideo[];
  };
  releaseInfo: {
    preferredCountry: string;
    preferredRelease: TmdbRelease;
    countries: TmdbCountryReleases[];
  };
  translations: TmdbTranslation[];
  alternativeTitles: TmdbAlternativeTitle[];
  keywords: TmdbKeyword[];
  externalIds: TmdbExternalIds;
  productionCompanies: TmdbCompany[];
  metadata: {
    provider: string;
    language: string;
    fallbackLanguage: string;
    fetchedAt: string;
    cacheHit: boolean;
  };
}
```

## Cảnh báo Bảo mật
**`x-api-key` TUYỆT ĐỐI KHÔNG được hardcode vào các file bundle công khai của React/Vite.**
Đây là một khóa nội bộ và cần được bảo mật.

Luồng xử lý production đề xuất:
`Admin Frontend -> LoraFilm API Gateway -> TMDB Integration API -> TMDB`
